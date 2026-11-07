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
# change what the plan would say.
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

./node/publish-package-npm.ps1 -RepoName:$RepoName -Keys:$Keys -DryRun:$DryRun

# One tag and one GitHub release per package, '<package>/<version>', in place
# of common-ci's single tag, which would name no package. The notes list the
# commits that touched the package's folders since its last release.
$packages = @(Get-NodePackages $RepoName)
foreach ($release in $plan) {
    $tag = "$($release.Name)/$($release.Version)"
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
    gh -R "$OrgName/$RepoName" release create $tag $tarballs[$release.Name] `
        --verify-tag --title "$($release.Name) $($release.Version)" --notes $notes
}

# Tells common-ci's publish not to add its own single tag and release.
$global:SkipUpdateTag = $true
