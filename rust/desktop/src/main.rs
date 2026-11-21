use std::{error::Error, io, net::Ipv4Addr};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const PORT: u16 = 56144;
const HOST: &str = "127.0.0.1:56144";
const ORIGIN: &str = "http://127.0.0.1:56144";
const ASSETS: &[(&str, &[u8])] = include!(concat!(env!("OUT_DIR"), "/assets.rs"));
const CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'";

fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    let open_browser = match std::env::args().skip(1).collect::<Vec<_>>().as_slice() {
        [] => true,
        [flag] if flag == "--no-open" => false,
        [flag] if flag == "--version" => {
            println!("FORMA {}", env!("CARGO_PKG_VERSION"));
            return Ok(());
        }
        _ => return Err("Uso: forma [--no-open | --version]".into()),
    };
    let server = Server::http((Ipv4Addr::LOCALHOST, PORT)).map_err(|err| {
        format!(
            "No se pudo iniciar FORMA en {ORIGIN}. Cierra otra instancia si está abierta. {err}"
        )
    })?;
    println!("FORMA {} · {ORIGIN}", env!("CARGO_PKG_VERSION"));
    println!("Deja esta ventana abierta mientras trabajas. Ctrl+C para salir.");
    if open_browser {
        if let Err(error) = open::that_detached(ORIGIN) {
            eprintln!("Abre {ORIGIN} en tu navegador. {error}");
        }
    }
    for request in server.incoming_requests() {
        // A browser may cancel a request when the tab closes or reloads.
        let _ = serve(request);
    }
    Ok(())
}

fn serve(request: Request) -> io::Result<()> {
    let valid_host = request
        .headers()
        .iter()
        .filter(|header| header.field.equiv("Host"))
        .map(|header| header.value.as_str())
        .eq([HOST]);
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
