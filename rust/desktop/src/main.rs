use std::{error::Error, io, net::Ipv4Addr};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const PORT: u16 = 56144;
const ASSETS: &[(&str, &[u8])] = include!(concat!(env!("OUT_DIR"), "/assets.rs"));
const CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'";

fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut args = std::env::args().skip(1);
    let mut open_browser = true;
    let mut port = PORT;
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--version" => {
                println!("FORMA {}", env!("CARGO_PKG_VERSION"));
                return Ok(());
            }
            "--no-open" => open_browser = false,
            "--port" => {
                port = args
                    .next()
                    .and_then(|value| value.parse::<u16>().ok())
                    .filter(|&port| port > 0)
                    .ok_or("El puerto debe estar entre 1 y 65535.")?;
            }
            _ => return Err("Uso: forma [--no-open] [--port PUERTO] [--version]".into()),
        }
    }
    let host = format!("127.0.0.1:{port}");
    let origin = format!("http://{host}");
    let server = Server::http((Ipv4Addr::LOCALHOST, port)).map_err(|err| {
        format!(
            "No se pudo iniciar FORMA en {origin}. Cierra otra instancia si está abierta. {err}"
        )
    })?;
    println!("FORMA {} · {origin}", env!("CARGO_PKG_VERSION"));
    println!("Deja esta ventana abierta mientras trabajas. Ctrl+C para salir.");
    if open_browser {
        if let Err(error) = open::that_detached(&origin) {
            eprintln!("Abre {origin} en tu navegador. {error}");
        }
    }
    for request in server.incoming_requests() {
        // A browser may cancel a request when the tab closes or reloads.
        let _ = serve(request, &host);
    }
    Ok(())
}

fn serve(request: Request, host: &str) -> io::Result<()> {
    let valid_host = request
        .headers()
        .iter()
        .filter(|header| header.field.equiv("Host"))
        .map(|header| header.value.as_str())
        .eq([host]);
    let (status, mime, body) = if !valid_host {
        (400, "text/plain; charset=utf-8", b"Bad request".as_slice())
    } else if !matches!(request.method(), Method::Get | Method::Head) {
        (
            405,
            "text/plain; charset=utf-8",
            b"Method not allowed".as_slice(),
        )
    } else {
        let path = request.url().split('?').next().unwrap_or("/");
        let key = if path == "/" {
            "index.html"
        } else {
            path.strip_prefix('/').unwrap_or("")
        };
        match ASSETS.binary_search_by_key(&key, |(name, _)| *name) {
            Ok(index) => (200, content_type(key), ASSETS[index].1),
            Err(_) => (404, "text/plain; charset=utf-8", b"Not found".as_slice()),
        }
    };

    let mut response = Response::from_data(body).with_status_code(StatusCode(status));
    for (name, value) in [
        ("Content-Type", mime),
        ("Content-Security-Policy", CSP),
        ("X-Content-Type-Options", "nosniff"),
        ("Cache-Control", "no-cache"),
    ] {
        response.add_header(Header::from_bytes(name, value).expect("valid HTTP header"));
    }
    request.respond(response)
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("wasm") => "application/wasm",
        _ => "text/plain; charset=utf-8",
    }
}
