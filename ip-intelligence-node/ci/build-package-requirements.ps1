param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packagesWithExtensions = "fiftyone.ipintelligence.onpremise";

Push-Location $RepoName

try {
    foreach ($package in $packagesWithExtensions) {
        $path = Join-Path . $package
        Push-Location $path
        Write-Output "Building requirements for $package"

        # Use the local build-extension script rather than the
        # common-ci one as the native module name differs.
        & "$PSScriptRoot/build-extension.ps1" -PackageName $package

        Pop-Location
    }
}
finally {
    Pop-Location
}
