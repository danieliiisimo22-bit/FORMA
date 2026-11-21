$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    rustup target add wasm32-unknown-unknown
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el destino WebAssembly.' }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
} finally {
    Pop-Location
}
