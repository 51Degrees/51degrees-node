param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

# The enterprise IP Intelligence data file used in CI is 5.7GB and the update
# tests make a temporary copy of it, which does not fit in the space left on
# the hosted Linux runners. Remove preinstalled toolchains this build never
# uses to make room.
if ($IsLinux -and $env:GITHUB_ACTIONS -eq "true") {
    Write-Output "Freeing runner disk space"
    sudo rm -rf /usr/local/lib/android /usr/share/dotnet /usr/local/.ghcup /usr/share/swift
    df -h /
}

# Resource key environment variables follow the 51Degrees convention, which
# is that every one of them starts with '_51DEGREES_RESOURCE_KEY'. That is
# the prefix common-ci's central steps/set-resource-keys.ps1 exports, so a
# key added as an organisation secret under the convention arrives here on
# its own. These names are read by the examples and the tests across every
# product in this repository.
$env:_51DEGREES_RESOURCE_KEY = $Options.Keys.TestResourceKey
$env:_51DEGREES_RESOURCE_KEY_SUPER = $Options.Keys.TestSuperResourceKey # currently the same as the key above
$env:_51DEGREES_RESOURCE_KEY_PLATFORM = $Options.Keys.TestPlatformResourceKey
$env:_51DEGREES_RESOURCE_KEY_HARDWARE = $Options.Keys.TestHardwareResourceKey
$env:_51DEGREES_RESOURCE_KEY_BROWSER = $Options.Keys.TestBrowserResourceKey
$env:_51DEGREES_RESOURCE_KEY_NO_SETHEADER = $Options.Keys.TestNoSetHeaderResourceKey

./node/setup-environment.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
