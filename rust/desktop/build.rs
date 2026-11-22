use std::{env, fs, io, path::PathBuf};

fn main() -> io::Result<()> {
    let root =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../../target/forma-web");
    println!("cargo:rerun-if-changed={}", root.display());
    let output = PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("assets.rs");
    let mut paths = vec![
        "index.html".to_owned(),
        "forma.svg".to_owned(),
        "styles.css".to_owned(),
        "start.js".to_owned(),
        "worker.js".to_owned(),
        "forma_studio.js".to_owned(),
        "forma_studio_bg.wasm".to_owned(),
        "third-party-licenses.txt".to_owned(),
        "desktop-licenses.txt".to_owned(),
    ];
    paths.sort_unstable();
    let mut source = String::from("&[\n");
    for path in paths {
        let file = root.join(&path).canonicalize().map_err(|reason| {
            io::Error::new(
                reason.kind(),
                format!("Falta {path}. Ejecuta cargo run -p forma-build -- web. {reason}"),
            )
        })?;
        source.push_str(&format!("    ({:?}, include_bytes!({:?})),\n", path, file));
    }
    source.push_str("]\n");
    fs::write(output, source)
}
