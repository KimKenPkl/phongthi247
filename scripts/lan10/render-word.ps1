param(
  [string]$Root = 'D:\phongthi247',
  [string]$Out = 'C:\Users\LENOVO\AppData\Local\Temp\opencode\lan10-render'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $Out -Force | Out-Null
# A new automation instance; only generated documents are opened read-only.
# Do not attach to a user's running Word window or change any source files.
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $files = Get-ChildItem -LiteralPath (Join-Path $Root 'data\docs') -Filter 'on-tap-lan10-de-*.docx' | Sort-Object Name
  foreach ($file in $files) {
    $doc = $null
    try {
      $doc = $word.Documents.Open($file.FullName, $false, $true, $false)
      $doc.Repaginate()
      $pdf = Join-Path $Out ($file.BaseName + '.pdf')
      $doc.ExportAsFixedFormat($pdf, 17)
      $pages = $doc.ComputeStatistics(2)
      Write-Output "$($file.Name): $pages pages -> $pdf"
    } finally {
      if ($null -ne $doc) {
        $doc.Close(0)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc)
      }
    }
  }
} finally {
  if ($null -ne $word) {
    $word.Quit(0)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
}
