$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de FORMA.' }
    npm.cmd run build:desktop
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion de escritorio.' }
    node --experimental-strip-types scripts/check-seed-parity.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la comprobacion de semillas.' }
    Write-Host 'FORMA compilado. Abre Iniciar FORMA.cmd.'
} finally {
    Pop-Location
}
