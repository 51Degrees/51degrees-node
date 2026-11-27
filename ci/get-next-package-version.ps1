param (
    [Parameter(Mandatory)][string]$RepoName,
    [Parameter(Mandatory)][string]$VariableName
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot/release-plan.ps1"

# common-ci's publish carries one version through its jobs. Each package here
# has its own version, so that one is only a label for the run: the highest
# version this publish releases, or, when it releases nothing, the highest
# version released so far. package-update-required.ps1 decides whether
# anything is released, and build-package.ps1 and publish-package.ps1 give
# each package its version and tag, all from the same release plan.
$plan = @(Get-NodeReleasePlan $RepoName)
if ($plan.Count -gt 0) {
    $versions = @($plan.Version)
} else {
    $versions = @(Get-Packages $RepoName |
        Where-Object { $_.Publish -eq $true } |
        ForEach-Object { "$(@(Get-ReleasedVersions $RepoName $_.Name)[-1])" })
}
$label = $versions | Sort-Object { [version]$_ } | Select-Object -Last 1

Set-Variable -Scope Global -Name $VariableName -Value $label
