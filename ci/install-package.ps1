param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. "$PSScriptRoot/packages.ps1"

Push-Location $RepoName
try {
    npm install
    # npm keeps a workspace's symlink when given that workspace's tarball, which
    # leaves the tests running the source. Put the packed files in its place.
    $packed = @()
    foreach ($tarball in Get-ChildItem ../package/*.tgz) {
        $name = $tarball.Name -replace '-\d.*$'
        $packed += $name
        $installed = "node_modules/$name"
        (Get-Item $installed).Delete()
        New-Item -ItemType Directory -Path $installed | Out-Null
        # A relative archive path, as tar on Windows reads 'D:' as a remote host.
        tar -xzf "../package/$($tarball.Name)" -C $installed --strip-components=1
    }
    # A package this publish does not release has no tarball to carry its
    # native module, so the module is built from the source the tests run.
    foreach ($package in $NativePackages) {
        $name = (Get-Content "$($package.Path)/package.json" | ConvertFrom-Json).name
        if ($name -in $packed) {
            continue
        }
        Push-Location $package.Path
        try {
            & "$PSScriptRoot/build-extension.ps1" -PackageName $package.Path -ModuleName $package.Module
        } finally {
            Pop-Location
        }
    }
} finally {
    Pop-Location
}

# The web examples load their engine by a path in 51d.json, which points at the
# source next to them. Point them at the installed package instead, so these
# examples test what was packed.
$examples = @(
    @{ File = 'device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/gettingstarted-web/51d.json'; Index = 0; Engine = 'fiftyone.devicedetection.onpremise/deviceDetectionOnPremise' }
    @{ File = 'device-detection/fiftyone.devicedetection.cloud/examples/cloud/gettingstarted-web/51d.json'; Index = 1; Engine = 'fiftyone.devicedetection.cloud/deviceDetectionCloud' }
)
foreach ($example in $examples) {
    $path = Join-Path $RepoName $example.File
    $json = Get-Content $path | ConvertFrom-Json
    $json.PipelineOptions.Elements[$example.Index].elementName = $example.Engine
    $json | ConvertTo-Json -Depth 10 | Set-Content $path
}
