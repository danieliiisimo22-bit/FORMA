$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    cargo test --locked -p forma-core
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del motor Rust.' }
    cargo run --locked -p forma-build -- desktop
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion de escritorio.' }
    Write-Host 'FORMA compilado. Abre Iniciar FORMA.cmd.'
} finally {
    Pop-Location
}
