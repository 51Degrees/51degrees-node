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
    foreach ($package in $NativePackages) {
        Push-Location $package.Path
        try {
            & "$PSScriptRoot/build-extension.ps1" -PackageName $package.Path -ModuleName $package.Module
        } finally {
            Pop-Location
        }
    }
    npm run lint
} finally {
    Pop-Location
}
