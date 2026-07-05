param(
  [string]$TaskName = 'JP Invest Official Source Refresh',
  [string]$DailyAt = '08:00'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$time = [DateTime]::ParseExact($DailyAt, 'HH:mm', $null)
$action = New-ScheduledTaskAction -Execute $npm -Argument 'run research:refresh' -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Refresh tracked JP Invest companies from official sources.' -Force | Out-Null
Write-Output "Registered '$TaskName' to run daily at $DailyAt local time."
