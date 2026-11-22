$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    rustup target add wasm32-unknown-unknown
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el destino WebAssembly.' }
    cargo install wasm-bindgen-cli --locked --version 0.2.130
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar wasm-bindgen.' }
} finally {
    Pop-Location
}
