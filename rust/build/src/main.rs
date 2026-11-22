use sha2::{Digest, Sha256};
use std::env;
use std::error::Error;
use std::fs;
use std::io::{self, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const WEB_TARGET: &str = "wasm32-unknown-unknown";

struct Platform {
    name: &'static str,
    target: &'static str,
    bin: &'static str,
    instructions: &'static str,
}

const PLATFORMS: &[Platform] = &[
    Platform {
        name: "Windows-x64",
        target: "x86_64-pc-windows-msvc",
        bin: "forma.exe",
        instructions: "Abre Iniciar FORMA.cmd o forma.exe.",
    },
    Platform {
        name: "macOS-Apple-Silicon",
        target: "aarch64-apple-darwin",
        bin: "forma",
        instructions: "En macOS 13 o posterior, ejecuta ./forma en Terminal.",
    },
    Platform {
        name: "macOS-Intel",
        target: "x86_64-apple-darwin",
        bin: "forma",
        instructions: "En macOS 13 o posterior, ejecuta ./forma en Terminal.",
    },
    Platform {
        name: "Linux-x64",
        target: "x86_64-unknown-linux-musl",
        bin: "forma",
        instructions: "Abre una terminal y ejecuta ./forma.",
    },
];

fn main() -> Result<(), Box<dyn Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()?;
    env::set_current_dir(root)?;
    match env::args().skip(1).collect::<Vec<_>>().as_slice() {
        [command] if command == "web" => build_web()?,
        [command] if command == "desktop" => {
            build_web()?;
            cargo(&["build", "--release", "--locked", "-p", "forma"])?;
        }
        [command, target] if command == "desktop" => {
            platform(target)?;
            build_web()?;
            cargo(&[
                "build",
                "--release",
                "--locked",
                "-p",
                "forma",
                "--target",
                target,
            ])?;
        }
        [command] if command == "package" => package()?,
        _ => {
            return Err("Uso: cargo run -p forma-build -- web | desktop [target] | package".into());
        }
    }
    Ok(())
}

fn platform(target: &str) -> Result<&'static Platform, Box<dyn Error>> {
    PLATFORMS
        .iter()
        .find(|platform| platform.target == target)
        .ok_or_else(|| format!("Target no disponible: {target}").into())
}

fn run(executable: &Path, args: &[&str]) -> Result<(), Box<dyn Error>> {
    let status = Command::new(executable).args(args).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{} terminó con {status}.", executable.display()).into())
    }
}

fn cargo(args: &[&str]) -> Result<(), Box<dyn Error>> {
    run(Path::new(env!("CARGO")), args)
}

fn build_web() -> Result<(), Box<dyn Error>> {
    // The embedded desktop build resolves the same target/forma-web directory.
    cargo(&[
        "build",
        "--release",
        "--locked",
        "--target-dir",
        "target",
        "--target",
        WEB_TARGET,
        "-p",
        "forma-studio",
    ])?;
    let web = Path::new("target/forma-web");
    fs::create_dir_all(web)?;
    let wasm = format!("target/{WEB_TARGET}/release/forma_studio.wasm");
    let bindgen = env::var_os("FORMA_WASM_BINDGEN").unwrap_or_else(|| "wasm-bindgen".into());
    run(
        Path::new(&bindgen),
        &[
            &wasm,
            "--target",
            "web",
            "--no-typescript",
            "--out-dir",
            "target/forma-web",
        ],
    )?;
    for (source, dest) in [
        ("web/index.html", "index.html"),
        ("web/styles.css", "styles.css"),
        ("web/start.js", "start.js"),
        ("web/worker.js", "worker.js"),
        ("public/forma.svg", "forma.svg"),
        (
            "public/third-party-licenses.txt",
            "third-party-licenses.txt",
        ),
        ("docs/licenses/desktop.txt", "desktop-licenses.txt"),
    ] {
        fs::copy(source, web.join(dest))?;
    }
    Ok(())
}

fn binary(platform: &Platform) -> PathBuf {
    let targeted = Path::new("target")
        .join(platform.target)
        .join("release")
        .join(platform.bin);
    if !targeted.is_file() && platform.bin == "forma.exe" {
        Path::new("target/release").join(platform.bin)
    } else {
        targeted
    }
}

fn package() -> Result<(), Box<dyn Error>> {
    let binaries: Vec<_> = PLATFORMS
        .iter()
        .map(|platform| {
            let path = binary(platform);
            fs::read(&path).map_err(|reason| {
                io::Error::new(reason.kind(), format!("{}: {reason}", path.display()))
            })
        })
        .collect::<Result<_, _>>()?;
    if binaries.iter().any(|bin| {
        !bin.windows(VERSION.len())
            .any(|section| section == VERSION.as_bytes())
    }) {
        return Err("Los ejecutables deben corresponder a la versión actual.".into());
    }
    let shared = [
        ("LICENSE", fs::read("LICENSE")?),
        (
            "third-party-licenses.txt",
            fs::read("public/third-party-licenses.txt")?,
        ),
        (
            "desktop-licenses.txt",
            fs::read("docs/licenses/desktop.txt")?,
        ),
    ];
    let directory = Path::new("release").join(VERSION);
    fs::create_dir_all(&directory)?;
    let combined = format!("FORMA-{VERSION}-Todos-los-sistemas.zip");
    let mut all = open_zip(&directory.join(&combined))?;
    let mut names = vec![combined];
    for (platform, exe) in PLATFORMS.iter().zip(binaries) {
        let folder = format!("FORMA-{VERSION}-{}", platform.name);
        let name = format!("{folder}.zip");
        let mut zip = open_zip(&directory.join(&name))?;
        let mut guide = format!(
            "FORMA {VERSION} · {}\n\n{}\n",
            platform.name, platform.instructions
        );
        if platform.bin == "forma" {
            guide.push_str("Si tu extractor omite los permisos, ejecuta chmod +x forma.\n");
        }
        if platform.name.starts_with("macOS") {
            guide.push_str("Vista previa sin notarización de Apple.\n");
        }
        guide.push_str("Deja la terminal abierta mientras trabajas. Pulsa Ctrl+C para salir.\nAbre http://127.0.0.1:56144/ si el navegador no se abre automáticamente.\nPara trasladar tu biblioteca, usa Mis recetas > Importar JSON.\n");
        for archive in [&mut zip, &mut all] {
            add(archive, &folder, platform.bin, &exe, 0o755)?;
            for (filename, data) in &shared {
                add(archive, &folder, filename, data, 0o644)?;
            }
            add(archive, &folder, "LEEME.txt", guide.as_bytes(), 0o644)?;
            if platform.bin == "forma.exe" {
                add(
                    archive,
                    &folder,
                    "Iniciar FORMA.cmd",
                    &fs::read("Iniciar FORMA.cmd")?,
                    0o644,
                )?;
            }
        }
        zip.finish()?;
        names.push(name);
    }
    all.finish()?;
    let mut sums = String::new();
    use std::fmt::Write as _;
    for name in names {
        writeln!(
            sums,
            "{:x}  {name}",
            Sha256::digest(fs::read(directory.join(&name))?)
        )?;
    }
    fs::write(directory.join("SHA256SUMS.txt"), sums)?;
    println!("FORMA {VERSION}: {}", directory.display());
    Ok(())
}

fn open_zip(path: &Path) -> io::Result<ZipWriter<BufWriter<fs::File>>> {
    Ok(ZipWriter::new(BufWriter::new(fs::File::create(path)?)))
}

fn add(
    archive: &mut ZipWriter<BufWriter<fs::File>>,
    folder: &str,
    name: &str,
    data: &[u8],
    mode: u32,
) -> Result<(), Box<dyn Error>> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(mode);
    archive.start_file(format!("{folder}/{name}"), options)?;
    archive.write_all(data)?;
    Ok(())
}
