param (
    [Parameter(Mandatory)][string]$RepoName,
    [string]$Repository,
    [string]$HowToAllow
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot/release-plan.ps1"

# The shared publish runs this in place of its own check, because each package
# here is tagged '<package>/<version>'. Every package about to be published
# goes through common-ci's steps/check-release-interval.ps1 against its own
# tags, which refuses a release less than a week after that package's last
# unless ALLOW_EARLY_RELEASE is 'true'.

$check = Join-Path $CommonCi 'steps' 'check-release-interval.ps1'
$arguments = @{ RepoName = $RepoName }
if ($Repository) { $arguments.Repository = $Repository }
if ($HowToAllow) { $arguments.HowToAllow = $HowToAllow }

$refused = @()
foreach ($release in (Get-NodeReleasePlan $RepoName)) {
    Write-Output "$($release.Name) $($release.Version):"
    $global:LASTEXITCODE = 0
    & $check @arguments -TagPrefix $release.Name
    if ($LASTEXITCODE -ne 0) {
        $refused += $release.Name
    }
}

if ($refused) {
    Write-Output "Nothing is released, because these packages were released less than a week ago: $($refused -join ', ')."
    exit 1
}
exit 0
