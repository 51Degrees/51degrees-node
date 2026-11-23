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

# The keys are not set here. common-ci exports each one under its agreed
# _51DEGREES_ name, from the organization variable (resource keys) or secret
# (license keys) of the same name, before this script runs, and the examples
# and tests read them from there.

./node/setup-environment.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
