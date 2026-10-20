# Allow opening the preview from a phone over Wi-Fi (once, needs admin rights).
# Usage:  powershell -File tools\lan-setup.ps1            (add)
#          powershell -File tools\lan-setup.ps1 -Remove    (remove)
#
# Does two things:
#   1. URL ACL on http://+:8081/ for the current user, so serve.ps1 can listen
#      on the network, not just localhost, without admin rights.
#   2. Firewall rule: inbound TCP 8081 from the local subnet only.
# Relaunches itself elevated (UAC) if started without admin rights.
param([int]$Port = 8081, [switch]$Remove, [string]$Sid)

$ErrorActionPreference = 'Stop'
$rule = "Stomatologia preview $Port"
$url  = "http://+:$Port/"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    # take the SID before elevating: UAC may ask for a different (admin) account
    $mySid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Port', $Port, '-Sid', $mySid)
    if ($Remove) { $argList += '-Remove' }
    $p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList $argList
    if ($p.ExitCode -ne 0) { throw "Setup failed (code $($p.ExitCode))." }
    Write-Host ($(if ($Remove) { 'Network access removed.' } else { 'Done: the server can now be opened from a phone.' }))
    return
}

if (-not $Sid) { $Sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value }

netsh http delete urlacl url=$url 2>&1 | Out-Null
Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule

if (-not $Remove) {
    netsh http add urlacl url=$url sddl="D:(A;;GX;;;$Sid)" | Out-Null
    if ($LASTEXITCODE -ne 0) { exit 1 }
    New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $Port `
        -RemoteAddress LocalSubnet -Action Allow -Profile Any | Out-Null
}
exit 0
