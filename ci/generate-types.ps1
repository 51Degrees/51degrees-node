param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

Push-Location $RepoName
# Requires setup-environment.ps1 to be finished before running this
try {
    Write-Output "Generating TS types from JS files - $RepoName - [START]"
    npm run tsc
    Write-Output "Generating TS types from JS files - $RepoName - [END]"
} finally {
    Pop-Location
}

exit $LASTEXITCODE
