$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$package = Get-Content -LiteralPath (Join-Path $workspaceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$makerDirectory = Join-Path $workspaceRoot 'out/make/squirrel.windows/x64'
$applicationDirectory = Join-Path $workspaceRoot 'out/Animonkey-win32-x64'

if (-not (Test-Path -LiteralPath $makerDirectory -PathType Container)) {
  throw "Squirrel output directory was not created: $makerDirectory"
}

$setupFiles = @(Get-ChildItem -LiteralPath $makerDirectory -File -Filter '* Setup.exe')
$fullPackages = @(Get-ChildItem -LiteralPath $makerDirectory -File -Filter '*-full.nupkg')
$releasesPath = Join-Path $makerDirectory 'RELEASES'

if ($setupFiles.Count -ne 1 -or $fullPackages.Count -ne 1 -or -not (Test-Path -LiteralPath $releasesPath -PathType Leaf)) {
  throw 'Forge did not produce exactly one Setup.exe, one full .nupkg, and a RELEASES manifest.'
}

$expectedSetupName = "Animonkey-$version Setup.exe"
$expectedPackageName = "animonkey_electron-$version-full.nupkg"
if ($setupFiles[0].Name -ne $expectedSetupName) {
  throw "Unexpected installer name '$($setupFiles[0].Name)'; expected '$expectedSetupName'."
}
if ($fullPackages[0].Name -ne $expectedPackageName) {
  throw "Unexpected full package name '$($fullPackages[0].Name)'; expected '$expectedPackageName'."
}
if ($setupFiles[0].Length -le 0 -or $fullPackages[0].Length -le 0) {
  throw 'The generated installer and full package must be non-empty.'
}

$releaseEntry = Get-Content -LiteralPath $releasesPath | Where-Object {
  $fields = $_.Trim() -split '\s+'
  $fields.Count -eq 3 -and $fields[1] -eq $fullPackages[0].Name
} | Select-Object -First 1

if (-not $releaseEntry) {
  throw 'The RELEASES manifest does not reference the generated full .nupkg.'
}

$releaseFields = $releaseEntry.Trim() -split '\s+'
$expectedHash = (Get-FileHash -LiteralPath $fullPackages[0].FullName -Algorithm SHA1).Hash
if ($releaseFields[0] -ne $expectedHash) {
  throw 'The RELEASES manifest hash does not match the generated full .nupkg.'
}
if ([int64]$releaseFields[2] -ne $fullPackages[0].Length) {
  throw 'The RELEASES manifest size does not match the generated full .nupkg.'
}

$applicationPath = Join-Path $applicationDirectory 'Animonkey.exe'
$appArchivePath = Join-Path $applicationDirectory 'resources/app.asar'
$runtimeVersionPath = Join-Path $applicationDirectory 'resources/anivexa-runtime/anivexa-version.json'
$nativeBindingPath = Join-Path $applicationDirectory 'resources/anivexa-runtime/node_modules/@wreq-js/binding-win32-x64-msvc/wreq-js.win32-x64-msvc.node'
foreach ($path in @($applicationPath, $appArchivePath, $runtimeVersionPath, $nativeBindingPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Packaged application is missing a required file: $path"
  }
}

$versionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($applicationPath)
if ($versionInfo.ProductName -ne $package.productName -or $versionInfo.OriginalFilename -ne 'Animonkey.exe') {
  throw 'The packaged executable metadata does not match the Animonkey application identity.'
}

$submodulePath = Join-Path $workspaceRoot 'vendor/anivexa-api'
$submoduleRevision = git -C $submodulePath rev-parse HEAD
if ($LASTEXITCODE -ne 0) {
  throw 'Could not identify the checked-out Anivexa API submodule revision.'
}
$runtimeVersion = Get-Content -LiteralPath $runtimeVersionPath -Raw | ConvertFrom-Json
if ($runtimeVersion.commit -ne $submoduleRevision) {
  throw 'The packaged Anivexa runtime does not match the pinned API submodule revision.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($fullPackages[0].FullName)
try {
  $entries = @($archive.Entries)
  $entryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $entries) {
    [void]$entryNames.Add($entry.FullName.Replace('\', '/'))
  }

  $requiredEntries = @(
    'lib/net45/Animonkey.exe',
    'lib/net45/Animonkey_ExecutionStub.exe',
    'lib/net45/LICENSE',
    'lib/net45/LICENSES.chromium.html',
    'lib/net45/resources/app.asar',
    'lib/net45/resources/anivexa-runtime/anivexa-version.json',
    'lib/net45/resources/anivexa-runtime/node_modules/@wreq-js/binding-win32-x64-msvc/wreq-js.win32-x64-msvc.node'
  )
  $missingEntries = @($requiredEntries | Where-Object { -not $entryNames.Contains($_) })
  if ($missingEntries.Count -gt 0) {
    throw "The full .nupkg is missing required entries: $($missingEntries -join ', ')"
  }

  $nuspecEntries = @($entries | Where-Object { $_.FullName -match '(^|/)[^/]+\.nuspec$' })
  if ($nuspecEntries.Count -ne 1) {
    throw 'The full .nupkg must contain exactly one NuGet package manifest.'
  }

  $reader = [System.IO.StreamReader]::new($nuspecEntries[0].Open())
  try {
    $nuspec = [System.Xml.XmlDocument]::new()
    $nuspec.LoadXml($reader.ReadToEnd())
  } finally {
    $reader.Dispose()
  }

  $namespaceManager = [System.Xml.XmlNamespaceManager]::new($nuspec.NameTable)
  $namespaceManager.AddNamespace('n', 'http://schemas.microsoft.com/packaging/2011/08/nuspec.xsd')
  $packageId = $nuspec.SelectSingleNode('/n:package/n:metadata/n:id', $namespaceManager)
  $packageVersion = $nuspec.SelectSingleNode('/n:package/n:metadata/n:version', $namespaceManager)
  if (-not $packageId -or $packageId.InnerText -ne 'animonkey_electron') {
    throw 'The full .nupkg has an unexpected Squirrel package identity.'
  }
  if (-not $packageVersion -or $packageVersion.InnerText -ne $version) {
    throw 'The full .nupkg version does not match package.json.'
  }
} finally {
  $archive.Dispose()
}

Write-Output "Verified Animonkey $version Windows x64 package and RELEASES hash/size."
