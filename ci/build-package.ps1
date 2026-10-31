param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Version
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. "$PSScriptRoot/packages.ps1"

$packageFolder = New-Item -ItemType Directory -Path package -Force

foreach ($package in $NativePackages) {
    $build = New-Item -ItemType Directory -Path "$RepoName/$($package.Path)/build" -Force
    Copy-Item -Path "./package-files/*/$($package.Module)-*.node" -Destination $build
}

# common-ci's node/build-package-npm.ps1 expects each package to be directly
# under the repository, and names the tarball after the path it was given.
foreach ($path in $PublishedPackages) {
    Push-Location "$RepoName/$path"
    try {
        # package.json refers to the other packages in this repository by
        # path. remote_package.json is the same manifest with the versions
        # consumers install.
        if (Test-Path remote_package.json) {
            Move-Item -Path remote_package.json -Destination package.json -Force
        }
        # npm pack bundles from the package's own node_modules, and the
        # workspace hoists everything to the root.
        if ((Get-Content package.json | ConvertFrom-Json).bundleDependencies) {
            npm install --no-workspaces --no-package-lock --omit=dev
        }
        npm version $Version --no-git-tag-version --workspaces-update=false
        npm pack --pack-destination $packageFolder
    } finally {
        Pop-Location
    }
}
