param (
    [Parameter(Mandatory)][string]$RepoName,
    [string]$Version
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot/release-plan.ps1"

# Called by common-ci's publish in place of its own check, which looks for a
# tag of one version and cannot tell the packages here apart. Exits 0 when the
# release plan has something in it and 1 when it is empty, as that check does.
# $Version is the run's label from get-next-package-version.ps1.

$plan = @(Get-NodeReleasePlan $RepoName)
if ($plan.Count -eq 0) {
    Write-Output "No package changed since its last release, so there is nothing to publish."
    exit 1
}

Write-Output "This publish releases:"
$plan | Format-Table Name, Previous, Version, Reason -AutoSize | Out-String |
    Write-Output
exit 0
