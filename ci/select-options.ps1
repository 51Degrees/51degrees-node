param(
    # Every entry of options.json.
    [Parameter(Mandatory)][object[]]$Options,
    # The files the pull request changes, less documentation.
    [string[]]$ChangedFiles,
    # Those of the changed files whose change touches only comments.
    [string[]]$CommentOnlyFiles
)
# Chooses the options.json entries a pull request is built on, for common-ci's
# steps/select-options.ps1. The branch itself and a release build every entry.
#
# The standard set is Node 24 and Node 22 on Linux, as each builds its own
# native addon, with the Selenium contract on Node 24 alone. A change in more
# than its comments to a native package or the cxx submodule adds Windows and
# Linux ARM for Node 24, and a change outside the package folders, such as ci
# or the root package.json, adds every entry. Only five macOS jobs run at once
# across the organisation, and the releases need them, so macOS is left to the
# branch and release builds, as is performance.
. $PSScriptRoot/packages.ps1

$Standard = @('Ubuntu_Node_24', 'Ubuntu_Node_22')
$Contract = 'Ubuntu_Node_24'
$Native = @('Windows_Node_24', 'Ubuntu_ARM_Node_24')
$PackageFolders = @('pipeline/', 'device-detection/', 'ip-intelligence/',
    'location/')
$NativePaths = @($NativePackages | ForEach-Object { "$($_.Path)/" })

function Test-Under([string]$Path, [string[]]$Prefixes) {
    return @($Prefixes | Where-Object { $Path.StartsWith($_) }).Count -gt 0
}

$code = @($ChangedFiles | Where-Object { $CommentOnlyFiles -notcontains $_ })
$native = @($code | Where-Object {
    $_ -eq 'cxx' -or (Test-Under $_ $NativePaths)
}).Count -gt 0
$other = @($code | Where-Object {
    $_ -ne 'cxx' -and !(Test-Under $_ $PackageFolders)
}).Count -gt 0
Write-Host "Native: $native. Outside the package folders: $other."

foreach ($entry in $Options) {
    $name = $entry.Name
    if ($entry.Image -like 'macos*') {
        Write-Host "$name is left to the branch and release builds"
        continue
    }
    $why = if ($Standard -contains $name) { 'the standard set' }
        elseif ($other) { 'a change outside the package folders' }
        elseif ($native -and $Native -contains $name) { 'a native change' }
    if (!$why) {
        Write-Host "$name is not needed for this change"
        continue
    }
    $entry.SeleniumContract = $name -eq $Contract
    $entry.RunPerformance = $false
    Write-Host "$name runs for $why"
    $entry
}
