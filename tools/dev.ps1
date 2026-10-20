# Start the site for work: server + desktop tab + mobile window (Windows; tools/dev.sh is the macOS version).
# Usage:  powershell -File tools\dev.ps1            (everything)
#          powershell -File tools\dev.ps1 -NoOpen    (server only, no windows)
#
# The server runs in a separate minimised PowerShell window, independent of the
# terminal or Claude session that started it. Close that window to stop it.
# If a server is already listening on the port, a second one is not started.
param([int]$Port = 8081, [switch]$NoOpen)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url  = "http://localhost:$Port/"

function Test-Port {
    $c = New-Object Net.Sockets.TcpClient
    try { $c.Connect('localhost', $Port); $true } catch { $false } finally { $c.Close() }
}

if (Test-Port) {
    Write-Host "Server already running: $url"
} else {
    Start-Process powershell -WindowStyle Minimized -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit',
        '-File', "`"$root\tools\serve.ps1`"", '-Port', $Port)
    $deadline = (Get-Date).AddSeconds(10)
    while (-not (Test-Port)) {
        if ((Get-Date) -gt $deadline) { throw "Server did not come up on port $Port within 10 seconds." }
        Start-Sleep -Milliseconds 250
    }
    Write-Host "Server started: $url   (minimized PowerShell window - close it to stop)"
}

$code = (Invoke-WebRequest $url -UseBasicParsing).StatusCode
if ($code -ne 200) { throw "Server answered $code instead of 200." }

# links for a phone on the same Wi-Fi - work after tools\lan-setup.ps1
Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    ForEach-Object { Write-Host "From a phone: http://$($_.IPAddress):$Port/   ($($_.InterfaceAlias))" }

if ($NoOpen) { return }

# desktop: default browser
Start-Process $url

# mobile view: a separate ~390px Chrome (or Edge) window with an iPhone user agent.
# A dedicated profile is required, otherwise it opens as a tab in the running browser
# and the size and user agent are ignored.
$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
    Write-Host 'Chrome/Edge not found - no mobile window. Use F12 -> Ctrl+Shift+M.' -ForegroundColor Yellow
    return
}

$ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
Start-Process $browser -ArgumentList @(
    "--user-data-dir=`"$env:LOCALAPPDATA\stomatologia-mobile-preview`"",
    '--no-first-run', '--no-default-browser-check',
    "--app=$url", '--window-size=406,900', '--window-position=40,40',
    "--user-agent=`"$ua`"")
Write-Host 'Opened: desktop tab + mobile window.'
