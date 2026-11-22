param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

# The enterprise IP Intelligence data file used in CI is 5.7GB and the update
# tests make a temporary copy of it, which does not fit in the space left on
# the hosted Linux runners. Remove preinstalled toolchains this build never
# uses to make room. .NET stays, as the Selenium contract tests run on it.
if ($IsLinux -and $env:GITHUB_ACTIONS -eq "true") {
    Write-Output "Freeing runner disk space"
    sudo rm -rf /usr/local/lib/android /usr/local/.ghcup /usr/share/swift
    df -h /
}

# The keys are not set here. Each one is in the environment under its
# _51DEGREES_ name before this script runs, and the tests read them from
# there.

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

Push-Location $RepoName
try {
    npm install
} finally { Pop-Location }
