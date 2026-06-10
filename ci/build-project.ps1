param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packages = "fiftyone.ipintelligence", "fiftyone.ipintelligence.cloud", "fiftyone.ipintelligence.onpremise", "fiftyone.ipintelligence.shared";

$needExtensions = "fiftyone.ipintelligence.onpremise"

Push-Location $RepoName

try {
    foreach ($package in $packages) {
        $path = Join-Path . $package
        Push-Location $path

        Write-Output "Installing dependencies for $package - [START]"
        npm install
        Write-Output "Installing dependencies for $package - [END]"

        if ($needExtensions -Contains $package) {
            # Use the local build-extension script rather than the
            # common-ci one as the native module name differs.
            & "$PSScriptRoot/build-extension.ps1" -PackageName $package
        }

        Pop-Location
    }
    Write-Output "Linting JS files - $RepoName - [START]"
    npm run lint
    Write-Output "Linting JS files - $RepoName - [END]"
} finally {
    Pop-Location
}

exit $LASTEXITCODE
