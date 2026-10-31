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
    foreach ($tarball in Get-ChildItem ../package/*.tgz) {
        $installed = "node_modules/$($tarball.Name -replace '-\d.*$')"
        (Get-Item $installed).Delete()
        New-Item -ItemType Directory -Path $installed | Out-Null
        # A relative archive path, as tar on Windows reads 'D:' as a remote host.
        tar -xzf "../package/$($tarball.Name)" -C $installed --strip-components=1
    }
    # Unpublished packages have no tarball to carry their native module.
    foreach ($package in $NativePackages | Where-Object { $_.Path -notin $PublishedPackages }) {
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
    @{ File = 'device-detection-node/fiftyone.devicedetection.onpremise/examples/onpremise/gettingstarted-web/51d.json'; Index = 0; Engine = 'fiftyone.devicedetection.onpremise/deviceDetectionOnPremise' }
    @{ File = 'device-detection-node/fiftyone.devicedetection.cloud/examples/cloud/gettingstarted-web/51d.json'; Index = 1; Engine = 'fiftyone.devicedetection.cloud/deviceDetectionCloud' }
)
foreach ($example in $examples) {
    $path = Join-Path $RepoName $example.File
    $json = Get-Content $path | ConvertFrom-Json
    $json.PipelineOptions.Elements[$example.Index].elementName = $example.Engine
    $json | ConvertTo-Json -Depth 10 | Set-Content $path
}
