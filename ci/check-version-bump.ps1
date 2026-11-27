param (
    [Parameter(Mandatory)][string]$RepoName,
    [string]$Version
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot/release-plan.ps1"

# The shared publish runs this in place of its own check, because each package
# here has its own version. Every package about to be published goes twice
# through common-ci's steps/check-version-bump.ps1, which refuses a major or
# minor move unless ALLOW_VERSION_BUMP is 'true'. Once against its own tags,
# and once against the version npm installs by default, so that neither a tag
# pushed by hand nor a FirstVersion in packages.json can set where it starts.

$check = Join-Path $CommonCi 'steps' 'check-version-bump.ps1'

# The version npm's latest dist-tag names, or $null for a package npm does not
# have.
function Get-NpmLatestVersion([string]$Name) {
    try {
        $tags = Invoke-RestMethod "https://registry.npmjs.org/-/package/$Name/dist-tags"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) { return $null }
        throw
    }
    return $tags.latest
}

Write-Output "The publish's label is $Version. Each package is checked on its own."

$refused = @()
foreach ($release in (Get-NodeReleasePlan $RepoName)) {
    Write-Output "$($release.Name) $($release.Version), against its own tags:"
    $global:LASTEXITCODE = 0
    & $check -Version $release.Version -RepoName $RepoName -TagPrefix $release.Name
    $passed = $LASTEXITCODE -eq 0

    $latest = Get-NpmLatestVersion $release.Name
    if ($null -ne $latest) {
        Write-Output "$($release.Name) $($release.Version), against $latest on npm:"
        $global:LASTEXITCODE = 0
        & $check -Version $release.Version -ReleasedVersion $latest
        $passed = $passed -and $LASTEXITCODE -eq 0
    }
    if ($passed -eq $false) {
        $refused += $release.Name
    }
}

if ($refused) {
    Write-Output "Nothing is published, because these packages were refused: $($refused -join ', ')."
    exit 1
}
exit 0
