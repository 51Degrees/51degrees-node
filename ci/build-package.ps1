param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [string]$Version
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. "$PSScriptRoot/packages.ps1"
. "$PSScriptRoot/release-plan.ps1"

# Packs the packages this publish releases, each at its own version from the
# release plan, with its requirements on the other packages here set to the
# versions they have once the plan is released. $Version is common-ci's label
# for the run and is not used.

$plan = @(Get-NodeBuildPlan $RepoName)
$versions = Get-NodeVersions $RepoName $plan
$packages = @(Get-Packages $RepoName)

$packageFolder = New-Item -ItemType Directory -Path package -Force

foreach ($release in $plan) {
    Write-Output "::group::Pack $($release.Name) $($release.Version)"
    $package = $packages | Where-Object { $_.Name -eq $release.Name }

    $native = $NativePackages | Where-Object { $_.Path -eq $release.Path }
    if ($null -ne $native) {
        $build = New-Item -ItemType Directory -Path "$RepoName/$($release.Path)/build" -Force
        Copy-Item -Path "./package-files/*/$($native.Module)-*.node" -Destination $build
    }

    # common-ci's node/build-package-npm.ps1 expects each package to be
    # directly under the repository, and names the tarball after the path it
    # was given.
    Push-Location "$RepoName/$($release.Path)"
    try {
        # package.json refers to the other packages in this repository by
        # path. remote_package.json is the same manifest with the versions
        # consumers install.
        if (Test-Path remote_package.json) {
            Move-Item -Path remote_package.json -Destination package.json -Force
        }
        $manifest = Get-Content -Raw package.json | ConvertFrom-Json

        # A requirement on a package here that packages.json does not list
        # would not be raised when that package is released.
        $required = @($manifest.dependencies.PSObject.Properties.Name |
            Where-Object { $_ -in $packages.Name })
        $missing = @($required | Where-Object { $_ -notin $package.DependsOn })
        $extra = @($package.DependsOn | Where-Object { $_ -notin $required })
        if ($missing -or $extra) {
            throw "$($release.Name) requires $($required -join ', ') but " +
                "ci/packages.json lists $($package.DependsOn -join ', ')."
        }

        $manifest.version = $release.Version
        foreach ($name in $required) {
            if (-not $versions[$name]) {
                throw "$name has no released version for $($release.Name) to require."
            }
            $manifest.dependencies.$name = "^$($versions[$name])"
        }
        $manifest | ConvertTo-Json -Depth 32 | Set-Content package.json
        foreach ($name in $required) {
            Write-Output "Requires $name $($manifest.dependencies.$name)"
        }

        npm pack --pack-destination $packageFolder
    } finally {
        Pop-Location
    }
    Write-Output "::endgroup::"
}
