Add-Type -AssemblyName System.Drawing
foreach ($arg in $args) {
  $pair = $arg -split '\|'
  $src = $pair[0]; $dst = $pair[1]
  try {
    $img = [System.Drawing.Image]::FromFile($src)
    $w = [int][math]::Round($img.Width * 3.0)
    $h = [int][math]::Round($img.Height * 3.0)
    if ($w -lt 10) { $w = 10 }
    if ($h -lt 10) { $h = 10 }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    Write-Output ("OK|" + (Split-Path -Leaf $dst))
  } catch {
    Write-Output ("ERR|" + (Split-Path -Leaf $dst) + "|" + $_.Exception.Message)
  }
}