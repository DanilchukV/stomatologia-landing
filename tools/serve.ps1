# Local static server for previewing the site (Windows; tools/serve.sh is the macOS version).
# Usage:  powershell -File tools\serve.ps1        (Ctrl+C to stop)
param([int]$Port = 8081)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'; '.json' = 'application/json'
    '.woff2'= 'font/woff2';  '.woff' = 'font/woff'
    '.jpg'  = 'image/jpeg';  '.jpeg' = 'image/jpeg'
    '.png'  = 'image/png';   '.webp' = 'image/webp'
    '.svg'  = 'image/svg+xml'; '.ico' = 'image/x-icon'
    '.txt'  = 'text/plain; charset=utf-8'; '.xml' = 'application/xml'
}

# Try to listen on the whole network first (needs the URL ACL from lan-setup.ps1),
# otherwise localhost only.
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
try { $listener.Start(); $lan = $true } catch {
    $listener = New-Object Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start(); $lan = $false
}
Write-Host "Server: http://localhost:$Port/   root: $root"
if ($lan) {
    Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host "On the network: http://$($_.IPAddress):$Port/   ($($_.InterfaceAlias))" }
} else {
    Write-Host 'localhost only. For a phone: powershell -File tools\lan-setup.ps1'
}
Write-Host 'Ctrl+C to stop'

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        if ($rel -eq '') { $rel = 'index.html' }

        $path = Join-Path $root ($rel -replace '/', '\')
        # don't serve anything outside the root
        $full = [IO.Path]::GetFullPath($path)
        if (-not $full.StartsWith([IO.Path]::GetFullPath($root), 'OrdinalIgnoreCase')) {
            $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue
        }

        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $bytes = [IO.File]::ReadAllBytes($full)
            $ext = [IO.Path]::GetExtension($full).ToLower()
            $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $ctx.Response.Headers['Cache-Control'] = 'no-cache'
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ("200  {0}  ({1} KB)" -f $rel, [math]::Round($bytes.Length / 1KB, 1))
        } else {
            $ctx.Response.StatusCode = 404
            Write-Host "404  $rel" -ForegroundColor Yellow
        }
        $ctx.Response.Close()
    }
} finally {
    $listener.Stop(); $listener.Close()
}
