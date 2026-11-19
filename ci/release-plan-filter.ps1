# Called by common-ci's steps/release-plan.ps1 for each package that has
# changed files left once its Ignore globs have left theirs out. Returns the
# files that count towards releasing the package.
#
# Every file counts except a package.json or remote_package.json whose only
# changes since the package's last tag are to the fields below, which say
# what the package is and where to find it rather than what it installs or
# runs. A change to any other field, such as version, dependencies, main,
# exports or scripts, counts, as does a manifest added or removed.
param(
    [Parameter(Mandatory)][string]$RepoPath,
    [Parameter(Mandatory)]$Package,
    [Parameter(Mandatory)][string]$From,
    [string[]]$Files = @()
)
$ErrorActionPreference = 'Stop'
# A manifest missing from one side is an answer here, not a failure.
$PSNativeCommandUseErrorActionPreference = $false

$MetadataFields = @(
    'description'
    'keywords'
    'homepage'
    'repository'
    'bugs'
    'author'
    'license'
    'readme'
)
$ManifestNames = @('package.json', 'remote_package.json')

# The manifest as it was at a commit, or null when it was not there or is
# not JSON.
function Get-Manifest([string]$Ref, [string]$File) {
    $text = & git -C $RepoPath show "${Ref}:$File" 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    try {
        return ($text -join "`n") | ConvertFrom-Json -AsHashtable
    } catch {
        return $null
    }
}

# A value written with its object keys sorted, so that two values compare
# equal when only the order of their keys differs.
function ConvertTo-Canonical($Value) {
    if ($null -eq $Value) {
        return 'null'
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $parts = foreach ($key in ($Value.Keys | Sort-Object -CaseSensitive)) {
            (ConvertTo-Json -Compress -InputObject ([string]$key)) + ':' +
                (ConvertTo-Canonical $Value[$key])
        }
        return '{' + ($parts -join ',') + '}'
    }
    if ($Value -is [System.Collections.IList]) {
        $parts = foreach ($item in $Value) {
            ConvertTo-Canonical $item
        }
        return '[' + ($parts -join ',') + ']'
    }
    return ConvertTo-Json -Compress -InputObject $Value
}

# The fields that differ between two manifests, or null when either side
# is missing.
function Get-ChangedFields([string]$File) {
    $old = Get-Manifest $From $File
    $new = Get-Manifest 'HEAD' $File
    if ($null -eq $old -or $null -eq $new) {
        return $null
    }
    $fields = @(@($old.Keys) + @($new.Keys) | Sort-Object -Unique -CaseSensitive)
    # The comma keeps an empty or one-field list a list for the caller.
    return , @($fields | Where-Object {
        $before = if ($old.ContainsKey($_)) { ConvertTo-Canonical $old[$_] }
        $after = if ($new.ContainsKey($_)) { ConvertTo-Canonical $new[$_] }
        $before -cne $after
    })
}

$name = if ($Package -is [string]) { $Package } else { $Package.Name }
foreach ($file in $Files) {
    if ($ManifestNames -ccontains (Split-Path $file -Leaf)) {
        $changed = Get-ChangedFields $file
        if ($null -ne $changed -and @($changed | Where-Object {
                $MetadataFields -cnotcontains $_ }).Count -eq 0) {
            $what = 'its layout'
            if ($changed.Count -gt 0) {
                $what = $changed -join ', '
            }
            Write-Host "${name}: $file changed only in $what, which does not count."
            continue
        }
    }
    $file
}
$global:LASTEXITCODE = 0
