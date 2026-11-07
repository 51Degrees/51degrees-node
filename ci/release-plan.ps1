# Dot-sourced by the publish scripts in this folder. Loads common-ci's
# steps/release-plan.ps1, which reads ci/packages.json and works out which
# packages a publish releases and at which version, and adds what this
# repository needs on top of it.
#
# common-ci runs these scripts from its own root, with this repository checked
# out inside it, which is where this looks first. COMMON_CI can name another
# checkout of common-ci.
$CommonCi = @($env:COMMON_CI, (Join-Path $PSScriptRoot '..' '..')) |
    Where-Object { $_ -and (Test-Path (Join-Path $_ 'steps' 'release-plan.ps1')) } |
    Select-Object -First 1
if ($null -eq $CommonCi) {
    throw "common-ci's steps/release-plan.ps1 was not found. Set COMMON_CI " +
        "to a checkout of common-ci."
}
$CommonCi = (Resolve-Path $CommonCi).Path
. (Join-Path $CommonCi 'steps' 'release-plan.ps1')

# The packages from ci/packages.json. A package's examples sit inside its
# folder, so each ExcludePaths folder is given to git as an exclude pathspec
# after the package's other folders, and a change only there releases nothing.
function Get-NodePackages([string]$RepoPath) {
    $packages = @(Get-Packages $RepoPath)
    foreach ($package in $packages) {
        if ($package.ExcludePaths) {
            $paths = @(@($package.ExtraPaths) + @($package.ExcludePaths |
                ForEach-Object { ":(exclude)$_" }) | Where-Object { $_ })
            $package | Add-Member -NotePropertyName ExtraPaths `
                -NotePropertyValue $paths -Force
        }
    }
    return $packages
}

function Get-NodeReleasePlan([string]$RepoPath) {
    return @(Get-ReleasePlan $RepoPath (Get-NodePackages $RepoPath))
}

# What a build of HEAD packs. That is the release plan, or, when nothing is to
# be released, every published package at its released version, so that the
# publish's tests still install packed packages.
function Get-NodeBuildPlan([string]$RepoPath) {
    $plan = @(Get-NodeReleasePlan $RepoPath)
    if ($plan.Count -gt 0) {
        return $plan
    }
    $published = @(Get-Packages $RepoPath | Where-Object { $_.Publish -eq $true })
    foreach ($name in (Sort-ByDependency $published @($published.Name))) {
        $package = $published | Where-Object { $_.Name -eq $name }
        $last = @(Get-ReleasedVersions $RepoPath $name)[-1]
        [pscustomobject]@{
            Name = $name
            Path = $package.Path
            Version = "$last"
            Previous = $last
            Reason = 'already released, packed for the tests'
        }
    }
}

# The version each published package has once the plan is released: the
# planned version, or the last released one for a package not in the plan.
# A package's requirements on the others here are set from this.
function Get-NodeVersions([string]$RepoPath, $Plan) {
    $versions = @{}
    foreach ($package in (Get-Packages $RepoPath |
            Where-Object { $_.Publish -eq $true })) {
        $release = $Plan | Where-Object { $_.Name -eq $package.Name }
        if ($null -ne $release) {
            $versions[$package.Name] = $release.Version
            continue
        }
        $released = @(Get-ReleasedVersions $RepoPath $package.Name)
        if ($released.Count -gt 0) {
            $versions[$package.Name] = "$($released[-1])"
        }
    }
    return $versions
}
