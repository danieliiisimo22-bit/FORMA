"""Create matching portable ZIPs from the four Rust release binaries."""

from hashlib import sha256
from pathlib import Path
import stat
import tomllib
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
PLATFORMS = {
    'Windows-x64': ('', 'forma.exe', 'Abre Iniciar FORMA.cmd o forma.exe.'),
    'macOS-Apple-Silicon': ('aarch64-apple-darwin', 'forma', 'En macOS 13 o posterior, ejecuta ./forma en Terminal.'),
    'macOS-Intel': ('x86_64-apple-darwin', 'forma', 'En macOS 13 o posterior, ejecuta ./forma en Terminal.'),
    'Linux-x64': ('x86_64-unknown-linux-musl', 'forma', 'En una terminal, ejecuta ./forma.'),
}


def add_file(archive, name, data, mode=0o644):
    entry = ZipInfo(name)
    entry.create_system = 3  # Retain Unix permissions even when packaging on Windows.
    entry.external_attr = (stat.S_IFREG | mode) << 16
    archive.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=9)


def main():
    manifest = ROOT / 'rust/desktop/Cargo.toml'
    version = tomllib.loads(manifest.read_text(encoding='utf-8'))['package']['version']
    binaries = {
        platform: (ROOT / 'target' / target / 'release' / binary).read_bytes()
        for platform, (target, binary, _) in PLATFORMS.items()
    }
    license_text = (ROOT / 'LICENSE').read_bytes()
    third_party = (ROOT / 'public/third-party-licenses.txt').read_bytes()
    rust_notices = (ROOT / 'docs/licenses/desktop.txt').read_bytes()
    launcher = (ROOT / 'Iniciar FORMA.cmd').read_bytes()
    output = ROOT / 'release' / version
    output.mkdir(parents=True, exist_ok=True)
    combined = output / f'FORMA-{version}-Todos-los-sistemas.zip'
    packages = [combined]

    with ZipFile(combined, 'w') as all_platforms:
        for platform, (_, binary, launch) in PLATFORMS.items():
            name = f'FORMA-{version}-{platform}'
            package = output / f'{name}.zip'
            guide = f'FORMA {version} · {platform}\n\n{launch}\n'
            if binary == 'forma':
                guide += 'Si tu extractor omite los permisos, ejecuta chmod +x forma.\n'
            if platform.startswith('macOS'):
                guide += 'Vista previa compilada para Mac sin notarización de Apple.\n'
            guide += (
                'Deja la terminal abierta mientras trabajas. Pulsa Ctrl+C para salir.\n'
                'Abre http://127.0.0.1:56144/ si el navegador no se abre automáticamente.\n'
                'Para trasladar tu biblioteca, usa Mis recetas > Importar JSON.\n'
            )
            files = [
                (binary, binaries[platform], 0o755),
                ('LICENSE', license_text, 0o644),
                ('third-party-licenses.txt', third_party, 0o644),
                ('desktop-licenses.txt', rust_notices, 0o644),
                ('LEEME.txt', guide.encode(), 0o644),
            ]
            if platform == 'Windows-x64':
                files.append(('Iniciar FORMA.cmd', launcher, 0o644))
            with ZipFile(package, 'w') as single:
                for filename, data, mode in files:
                    add_file(single, f'{name}/{filename}', data, mode)
                    add_file(all_platforms, f'{name}/{filename}', data, mode)
            packages.append(package)

    checksums = ''.join(f'{sha256(package.read_bytes()).hexdigest()}  {package.name}\n' for package in packages)
    (output / 'SHA256SUMS.txt').write_text(checksums, encoding='ascii', newline='\n')


if __name__ == '__main__':
    main()
