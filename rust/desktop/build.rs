use std::{env, fs, io, path::PathBuf};

fn main() -> io::Result<()> {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../../dist");
    println!("cargo:rerun-if-changed={}", root.display());
    let output = PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("assets.rs");
    let mut paths = vec![
        "index.html".to_owned(),
        "forma.svg".to_owned(),
        "forma-core.wasm".to_owned(),
        "third-party-licenses.txt".to_owned(),
    ];
    for entry in fs::read_dir(root.join("assets"))? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            paths.push(format!("assets/{}", entry.file_name().to_string_lossy()));
        }
    }
    paths.sort_unstable();
    let mut source = String::from("&[\n");
    for path in paths {
        let file = root.join(&path).canonicalize()?;
        source.push_str(&format!("    ({:?}, include_bytes!({:?})),\n", path, file));
    }
    source.push_str("]\n");
    fs::write(output, source)
}
