param([string]$ToolsRoot=(Join-Path $env:LOCALAPPDATA 'PhongThi247\AndroidBuild'))
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$jdk=(Get-ChildItem (Join-Path $ToolsRoot 'jdk') -Directory | Select-Object -First 1).FullName
$env:JAVA_HOME=$jdk
$env:PATH="$jdk\bin;$env:PATH"
$sdk=Join-Path $ToolsRoot 'sdk'
$bt=Join-Path $sdk 'build-tools\35.0.0'
$jar=Join-Path $sdk 'platforms\android-35\android.jar'
$build=Join-Path $ToolsRoot ('build-'+[guid]::NewGuid().ToString('N'))
$www=Join-Path $build 'assets\www'
New-Item -ItemType Directory -Force $www,(Join-Path $build 'classes'),(Join-Path $build 'dex'),(Join-Path $repo 'downloads') | Out-Null
function Check-Native {if($LASTEXITCODE -ne 0){throw "Native build failed ($LASTEXITCODE)"}}
$pages=@('giao-vien.html','qr.html','cham-bai.html','soan-de.html','tronde.html')
foreach($page in $pages){
  $html=Get-Content (Join-Path $repo $page) -Raw -Encoding utf8
  # Missing online-only destinations explicitly open in the external browser.
  $html=[regex]::Replace($html,'href="((?:hoc-sinh|lab)\.html|(?:admin|report)/index\.html|downloads/[^"]+)"', {param($m) 'href="https://kimkenpkl.github.io/phongthi247/'+$m.Groups[1].Value+'"'})
  $html | Set-Content (Join-Path $www $page) -Encoding utf8
}
Copy-Item (Join-Path $repo 'android\index.html') (Join-Path $www 'index.html')
Copy-Item (Join-Path $repo 'android\index.html') (Join-Path $www 'giao-vien.html')
New-Item -ItemType Directory -Force (Join-Path $www 'assets') | Out-Null
$assets=@('app.css','teacher-tools.css','teacher-data.js','teacher-grading.js','teacher-editor.js','qr-tool.js','tnmaker-qr.js','tronde.js','common.js','import-docx.js','favicon.svg')
foreach($asset in $assets){Copy-Item (Join-Path $repo "assets\$asset") (Join-Path $www 'assets')}
Copy-Item (Join-Path $repo 'assets\logo-512.png') (Join-Path $www 'assets')
Copy-Item (Join-Path $repo 'assets\vendor') (Join-Path $www 'assets\vendor') -Recurse
Copy-Item (Join-Path $repo 'assets\mau') (Join-Path $www 'assets\mau') -Recurse
New-Item -ItemType Directory -Force (Join-Path $www 'data') | Out-Null
# No question bank or student data in the APK. Word import/sample tools remain available.
'{"exams":[]}' | Set-Content (Join-Path $www 'data\exams.json') -Encoding utf8
Copy-Item (Join-Path $repo 'android\native-downloads.js') (Join-Path $build 'assets\native-downloads.js')
& "$bt\aapt.exe" package -f -M (Join-Path $repo 'android\AndroidManifest.xml') -A (Join-Path $build 'assets') -I $jar -F (Join-Path $build 'unsigned.apk');Check-Native
& "$jdk\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $jar -d (Join-Path $build 'classes') (Join-Path $repo 'android\MainActivity.java');Check-Native
$classes=@(Get-ChildItem (Join-Path $build 'classes') -Recurse -Filter '*.class' | ForEach-Object FullName)
& "$bt\d8.bat" --min-api 26 --lib $jar --output (Join-Path $build 'dex') @classes;Check-Native
Push-Location (Join-Path $build 'dex')
try { & "$jdk\bin\jar.exe" uf (Join-Path $build 'unsigned.apk') classes.dex;Check-Native } finally {Pop-Location}
& "$bt\zipalign.exe" -f 4 (Join-Path $build 'unsigned.apk') (Join-Path $build 'aligned.apk');Check-Native
$key=Join-Path $ToolsRoot 'teacher-trial.p12'
# Public trial credential only; key file stays outside the repository.
if(-not(Test-Path $key)){& "$jdk\bin\keytool.exe" -genkeypair -keystore $key -storetype PKCS12 -storepass android -keypass android -alias trial -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=PhongThi247 Trial';Check-Native}
$apk=Join-Path $repo 'downloads\phongthi247-trial.apk'
& "$bt\apksigner.bat" sign --ks $key --ks-key-alias trial --ks-pass pass:android --out $apk (Join-Path $build 'aligned.apk');Check-Native
& "$bt\apksigner.bat" verify --verbose $apk;Check-Native
& "$bt\aapt.exe" dump badging $apk;Check-Native
Get-FileHash $apk -Algorithm SHA256
$hash=(Get-FileHash $apk -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  phongthi247-trial.apk" | Set-Content (Join-Path $repo 'downloads\phongthi247-trial.sha256') -Encoding ascii
Write-Output "APK: $apk"
