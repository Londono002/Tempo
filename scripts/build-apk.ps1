$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$projectParent = Split-Path -Parent $projectRoot
$androidRoot = Join-Path $projectRoot 'android'
$androidAppRoot = Join-Path $androidRoot 'app'
$driveLetter = @('P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z') |
  Where-Object { -not (Get-PSDrive -Name $_ -ErrorAction SilentlyContinue) } |
  Select-Object -First 1

if (-not $driveLetter) {
  throw 'No hay una letra de unidad libre para acortar la ruta del build en Windows.'
}

$projectDrive = "${driveLetter}:"
$mappedProjectRoot = "${projectDrive}\$(Split-Path -Leaf $projectRoot)"
$appAlias = "${projectDrive}\ct"
$jdkHome = Join-Path $projectRoot '.android-toolchain\jdk-17.0.20.1+1'
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$gradleHome = Join-Path $env:USERPROFILE '.gradle'
$projectSubstCreated = $false
$appAliasCreated = $false

try {
  & subst.exe $projectDrive $projectParent
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la unidad temporal para compilar Android.' }
  $projectSubstCreated = $true

  if (Test-Path -LiteralPath $appAlias) {
    $aliasItem = Get-Item -LiteralPath $appAlias -Force
    $aliasTarget = [System.IO.Path]::GetFullPath([string]$aliasItem.Target).TrimEnd('\\')
    $expectedTarget = [System.IO.Path]::GetFullPath($androidAppRoot).TrimEnd('\\')
    if ($aliasItem.LinkType -ne 'Junction' -or $aliasTarget -ine $expectedTarget) {
      throw "$appAlias ya existe y no apunta al módulo Android de este proyecto."
    }
    $appAliasCreated = $true
  } else {
    New-Item -ItemType Junction -Path $appAlias -Target $androidAppRoot | Out-Null
    $appAliasCreated = $true
  }

  if (-not (Test-Path -LiteralPath (Join-Path $jdkHome 'bin\javac.exe'))) {
    throw "No se encontró JDK 17 en $jdkHome."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $androidSdk 'platforms'))) {
    throw "No se encontró Android SDK en $androidSdk."
  }

  $env:JAVA_HOME = $jdkHome
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
  $env:GRADLE_USER_HOME = $gradleHome
  $env:COZY_ANDROID_APP_PROJECT_DIR = $appAlias
  $env:COZY_PROJECT_ROOT = $projectRoot
  $env:COZY_MAPPED_PROJECT_ROOT = $mappedProjectRoot
  $env:Path = "$jdkHome\bin;$androidSdk\platform-tools;$env:Path"

  Push-Location $mappedProjectRoot
  try {
    & '.\android\gradlew.bat' -p '.\android' assembleRelease --no-daemon --stacktrace
    if ($LASTEXITCODE -ne 0) { throw "Gradle terminó con código $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  Write-Host "APK creada: $(Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk')"
} finally {
  Remove-Item Env:\COZY_ANDROID_APP_PROJECT_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:\COZY_PROJECT_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:\COZY_MAPPED_PROJECT_ROOT -ErrorAction SilentlyContinue
  if ($appAliasCreated) { Remove-Item -LiteralPath $appAlias -Force }
  if ($projectSubstCreated) { & subst.exe $projectDrive /D }
}
