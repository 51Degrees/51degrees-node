param (
    [Parameter(Mandatory)][string]$RepoName,
    [Parameter(Mandatory)][string]$OrgName,
    [Parameter(Mandatory)][hashtable]$Keys,
    [Parameter(Mandatory)][boolean]$DryRun
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. "$PSScriptRoot/release-plan.ps1"

# The plan is read before anything is tagged, because the tags made below
# change what the plan would say. It lists each package after the packages it
# depends on.
$plan = @(Get-NodeReleasePlan $RepoName)

# Only the planned packages are published, each from its own tarball.
$tarballs = @{}
foreach ($release in $plan) {
    $tarballs[$release.Name] = "package/$($release.Name)-$($release.Version).tgz"
    if ((Test-Path $tarballs[$release.Name]) -eq $false) {
        throw "$($tarballs[$release.Name]) was not built, so nothing is published."
    }
}
foreach ($tarball in (Get-ChildItem package -Filter *.tgz)) {
    if ("package/$($tarball.Name)" -notin $tarballs.Values) {
        Write-Output "Leaving out $($tarball.Name), which this publish does not release."
        Remove-Item $tarball.FullName
    }
}

# npm answers an unauthorised publish with '404 Not Found', so a failure here
# names the token rather than leaving a missing package to be suspected.
$registryUrl = 'https://registry.npmjs.org/'
$authTokenHint = "The NPMAuthToken secret is missing, expired, revoked, or has " +
    "lost publish rights on the fiftyone.* packages. npm answers an " +
    "unauthorised publish with '404 Not Found', so a 404 here does not mean " +
    "the package is absent."
if ([string]::IsNullOrWhiteSpace($Keys.NPMAuthToken)) {
    $message = "NPMAuthToken is not set, so publishing cannot succeed. $authTokenHint"
    if ($DryRun) { Write-Warning $message } else { throw $message }
}
npm config set '//registry.npmjs.org/:_authToken' $Keys.NPMAuthToken
try {
    $npmUser = npm whoami --registry $registryUrl
    Write-Output "Authenticated with $registryUrl as '$npmUser'"
} catch {
    $message = "'npm whoami' failed against $registryUrl. If the output above " +
        "is an authentication error rather than a network error: $authTokenHint"
    if ($DryRun) { Write-Warning $message } else { throw $message }
}

# Whether npm already has this version of the package, which it has when an
# earlier run published it and stopped before tagging it.
function Test-Published([string]$Name, [string]$Version) {
    $PSNativeCommandUseErrorActionPreference = $false
    $found = npm view "$Name@$Version" version 2>$null
    $published = $LASTEXITCODE -eq 0 -and "$found".Trim() -eq $Version
    $global:LASTEXITCODE = 0
    return $published
}

# Each package is published, tagged '<package>/<version>' and given its own
# GitHub release before the next, in the plan's order, so npm never offers a
# package before the versions it requires. A publish that stops part way
# leaves every package before the failure released and tagged, so a rerun
# plans only the rest. A package npm already has is tagged and released
# without publishing it again, because npm refuses a version twice. The notes
# list the commits that touched the package's folders since its last release.
$packages = @(Get-NodePackages $RepoName)
foreach ($release in $plan) {
    $tarball = $tarballs[$release.Name]
    $tag = "$($release.Name)/$($release.Version)"

    if (Test-Published $release.Name $release.Version) {
        Write-Output "npm already has $($release.Name)@$($release.Version), so it is tagged without publishing it again"
    } else {
        $distTag = $tarball -cmatch '-\d+.\d+.\d+-(\w+).\d+.tgz$' ? $Matches.1 : 'latest'
        try {
            npm publish ($DryRun ? '--dry-run' : $null) --access public --tag $distTag $tarball
        } catch {
            Write-Host ("::error::Failed to publish '$tarball' with tag '$distTag'. " +
                "If the output above reports 'E404 ... is not in this registry', " +
                "npm is masking an authorisation failure. $authTokenHint")
            throw
        }
    }

    git -C $RepoName tag $tag
    if ($DryRun -eq $true) {
        Write-Output "Dry run - tagged '$tag' locally, not pushed, no release made"
        continue
    }
    git -C $RepoName push origin $tag

    $notes = "$($release.Name) $($release.Version): $($release.Reason)."
    if ($null -ne $release.Previous) {
        $package = $packages | Where-Object { $_.Name -eq $release.Name }
        $range = "$($release.Name)/$($release.Previous)..HEAD"
        $commits = git -C $RepoName log --format='- %s (%h)' $range `
            -- (Get-PackagePaths $package)
        if ($commits) {
            $notes += "`n`n" + ($commits -join "`n")
        }
    }
    gh -R "$OrgName/$RepoName" release create $tag $tarball `
        --verify-tag --title "$($release.Name) $($release.Version)" --notes $notes
}

# Tells common-ci's publish not to add its own single tag and release.
$global:SkipUpdateTag = $true
