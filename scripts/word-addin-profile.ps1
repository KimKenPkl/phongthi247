param([ValidateSet('Audit','Apply','Restore')][string]$Mode='Audit',[string]$BackupPath)
$ErrorActionPreference='Stop'
$startup=Join-Path $env:APPDATA 'Microsoft\Word\Startup'
$machine='C:\Program Files\Microsoft Office\root\Office16\STARTUP'
$brokenKey='HKCU:\Software\Microsoft\Office\Word\Addins\TracNghiem_2025'
if($Mode -eq 'Audit') {
  foreach($dir in @($startup,$machine)){Get-ChildItem $dir -File -ErrorAction SilentlyContinue | Where-Object Name -NotLike '~$*' | ForEach-Object {[pscustomobject]@{Path=$_.FullName;SHA256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash}}}
  return
}
if(Get-Process WINWORD -ErrorAction SilentlyContinue){throw 'Close Word normally before changing the profile. No document will be force-closed.'}
if($Mode -eq 'Apply') {
  $backup=Join-Path $env:LOCALAPPDATA ('PhongThi247\WordAddinBackup\'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $state=[ordered]@{version=1;created=(Get-Date).ToString('o');files=@();registry=$null}
  # Store recovery state BEFORE moving any file. Never delete vendor files or modify VBA.
  $plan=@()
  $older=Join-Path $startup 'BTPRO2020-15102020.dotm'
  if((Test-Path $older) -and (Test-Path (Join-Path $startup 'BTPRO2020.dotm'))){$plan+=$older}
  $duplicate=Join-Path $startup 'Tool_BTN2022_Share.dotm'
  $other=Join-Path $machine 'Tool_BTN2022_Share.dotm'
  if((Test-Path $duplicate) -and (Test-Path $other) -and ((Get-FileHash $duplicate).Hash -eq (Get-FileHash $other).Hash)){$plan+=$duplicate}
  foreach($source in $plan){
    $target=Join-Path $backup ([IO.Path]::GetFileName($source))
    Copy-Item -LiteralPath $source -Destination $target
    if((Get-FileHash $source).Hash -ne (Get-FileHash $target).Hash){throw 'Backup verification failed'}
    $state.files+=@{source=$source;backup=$target;sha256=(Get-FileHash $source).Hash}
  }
  if(Test-Path $brokenKey){
    $reg=Get-ItemProperty $brokenKey
    $manifest=[string]$reg.Manifest -replace '\|.*$',''
    if($manifest -match '^file:'){$manifest=([uri]$manifest).LocalPath}
    if($manifest -and -not(Test-Path -LiteralPath $manifest)){$state.registry=@{path=$brokenKey;loadBehavior=$reg.LoadBehavior}}
  }
  $state | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $backup 'state.json') -Encoding utf8
  foreach($entry in $state.files){
    # Renaming inside the original folder keeps restoration local and reversible.
    Rename-Item -LiteralPath $entry.source -NewName ([IO.Path]::GetFileName($entry.source)+'.ptw-disabled')
  }
  if($state.registry){Set-ItemProperty $brokenKey -Name LoadBehavior -Value 0}
  Write-Output "Backup: $backup"
  Write-Output "Disabled redundant templates: $($state.files.Count). Restart Word normally to verify."
} else {
  if(-not $BackupPath){throw 'Provide -BackupPath from the Apply output'}
  $root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PhongThi247\WordAddinBackup'))+[IO.Path]::DirectorySeparatorChar
  $resolved=(Resolve-Path -LiteralPath $BackupPath).Path
  if(-not $resolved.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'Backup is outside the owned backup folder'}
  $state=Get-Content -LiteralPath (Join-Path $resolved 'state.json') -Raw | ConvertFrom-Json
  if($state.version -ne 1){throw 'Unsupported recovery state'}
  foreach($entry in $state.files){
    $source=[IO.Path]::GetFullPath($entry.source)
    if([IO.Path]::GetDirectoryName($source) -ne [IO.Path]::GetFullPath($startup)){throw 'Unexpected startup path'}
    $saved=Join-Path $resolved ([IO.Path]::GetFileName($source))
    if((Get-FileHash -LiteralPath $saved).Hash -ne $entry.sha256){throw 'Backup checksum mismatch'}
    if(Test-Path -LiteralPath $source){throw "Restore would overwrite an existing file: $source"}
  }
  foreach($entry in $state.files){Copy-Item -LiteralPath (Join-Path $resolved ([IO.Path]::GetFileName($entry.source))) -Destination $entry.source}
  if($state.registry -and $state.registry.path -eq $brokenKey){Set-ItemProperty $brokenKey -Name LoadBehavior -Value ([int]$state.registry.loadBehavior)}
  Write-Output 'Restored original active files and registry setting. Disabled copies retained for inspection.'
}
