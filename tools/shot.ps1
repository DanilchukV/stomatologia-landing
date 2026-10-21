# Screenshots and measurements without opening windows (Windows; tools/shot.sh is the macOS version).
# Examples:
#   powershell -File tools\shot.ps1 -Page documents.html             # another page of the site
#   powershell -File tools\shot.ps1                                   # 1440 and 390, top of the page
#   powershell -File tools\shot.ps1 -Target "#services" -Width 1440,1024,390
#   powershell -File tools\shot.ps1 -Target ".hero h1" -Width 1440 -Scale 3 -Height 200
#   powershell -File tools\shot.ps1 -Target "#services" -Js "ov('#services .svc-card')" -NoShot
#   powershell -File tools\shot.ps1 -Target "#form" -Do "document.querySelector('#form button[type=submit]').click()"
#
# The page loads in the tools\shot.html iframe harness: animations off, the -Target element
# scrolled to -Offset px from the top. -Js runs inside
# the page, with helpers ov(sel) (horizontal overflow) and box(sel) (size and position).
# -Do: a JS action before scrolling and the shot (fill a field, click a button), variable document. -Wait: ms to wait after it (default 400).
# Shots: %TEMP%\stomatologia-shots\shot-<width>.png. Starts the server if it isn't running.
param(
    [string]$Page,
    [string[]]$Width = @("1440", "390"),
    [int]$Height = 900,
    [string]$Target,
    [string]$Js,
    [string]$Do,
    [int]$Wait = 400,
    [double]$Scale = 1,
    [int]$Offset = 100,
    [switch]$NoShot,
    [string]$Out = "$env:TEMP\stomatologia-shots",
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$c = New-Object Net.Sockets.TcpClient
try { $c.Connect('localhost', $Port); $up = $true } catch { $up = $false } finally { $c.Close() }
if (-not $up) { & powershell -NoProfile -ExecutionPolicy Bypass -File "$root\tools\dev.ps1" -Port $Port -NoOpen | Out-Null }

$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome/Edge not found.' }

New-Item -ItemType Directory -Force $Out | Out-Null
Add-Type -AssemblyName System.Web
# a fresh profile per run: two parallel sessions sharing a profile interfere (empty result)
$profileDir = "$env:TEMP\stomatologia-shot-profile-$PID"

function Invoke-Browser([string[]]$extra, [string]$url, [string]$stdout) {
    $a = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
        "--user-data-dir=`"$profileDir`"", '--virtual-time-budget=10000') + $extra + @("`"$url`"")
    $p = @{ FilePath = $browser; ArgumentList = $a; Wait = $true; NoNewWindow = $true
            RedirectStandardError = "$Out\chrome-err.txt" }
    if ($stdout) { $p.RedirectStandardOutput = $stdout }
    Start-Process @p
}

[int[]]$widths = @($Width -join "," -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { [int]$_ })
foreach ($w in $widths) {
    $qs = "w=$w&h=$Height&off=$Offset&wait=$Wait"
    if ($Page) { $qs += '&p=' + [Web.HttpUtility]::UrlEncode($Page) }
    if ($Do) { $qs += '&do=' + [Web.HttpUtility]::UrlEncode($Do) }
    if ($Target) { $qs += '&t=' + [Web.HttpUtility]::UrlEncode($Target) }
    $base = "http://localhost:$Port/tools/shot.html?$qs"
    $name = "shot-$w"
    $win = "--window-size=$([Math]::Max($w, 500)),$Height"

    if (-not $NoShot) {
        $png = "$Out\$name.png"
        Remove-Item $png -ErrorAction SilentlyContinue
        Invoke-Browser @($win, "--force-device-scale-factor=$Scale", "--screenshot=`"$png`"") $base $null
        # the headless Chrome window is at least 500px wide - crop narrow shots to the iframe width
        if ((Test-Path $png) -and $w -lt 500) {
            Add-Type -AssemblyName System.Drawing
            $bmp = [Drawing.Bitmap]::FromFile($png)
            $cw = [Math]::Min($bmp.Width, [int][Math]::Round($w * $Scale))
            $crop = New-Object Drawing.Bitmap($cw, $bmp.Height)
            $g = [Drawing.Graphics]::FromImage($crop)
            $g.DrawImage($bmp, (New-Object Drawing.Rectangle(0, 0, $cw, $bmp.Height)), 0, 0, $cw, $bmp.Height, [Drawing.GraphicsUnit]::Pixel)
            $g.Dispose(); $bmp.Dispose(); $crop.Save($png, [Drawing.Imaging.ImageFormat]::Png); $crop.Dispose()
        }
        if (Test-Path $png) { Write-Host "shot ${w}: $png" } else { Write-Host "shot ${w}: FAILED" -ForegroundColor Yellow }
    }

    $dom = "$Out\$name.dom.txt"
    $jsq = if ($Js) { '&js=' + [Web.HttpUtility]::UrlEncode($Js) } else { '' }
    if ($Js -or $NoShot) {
        Invoke-Browser @($win, '--dump-dom') ($base + $jsq) $dom
        $m = [regex]::Match((Get-Content $dom -Raw -Encoding UTF8), '<pre id="RES">([\s\S]*?)</pre>')
        $txt = if ($m.Success) { [Web.HttpUtility]::HtmlDecode($m.Groups[1].Value) } else { 'no result' }
        Write-Host "js ${w}: $txt"
    }
}

# the profile is temporary - remove it
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
