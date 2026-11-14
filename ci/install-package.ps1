param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. "$PSScriptRoot/packages.ps1"

Push-Location $RepoName
try {
    npm install
    # npm keeps a workspace's symlink when given that workspace's tarball, which
    # leaves the tests running the source. Put the packed files in its place.
    $packed = @()
    foreach ($tarball in Get-ChildItem ../package/*.tgz) {
        $name = $tarball.Name -replace '-\d.*$'
        $packed += $name
        $installed = "node_modules/$name"
        (Get-Item $installed).Delete()
        New-Item -ItemType Directory -Path $installed | Out-Null
        # A relative archive path, as tar on Windows reads 'D:' as a remote host.
        tar -xzf "../package/$($tarball.Name)" -C $installed --strip-components=1
    }
    # A package this publish does not release has no tarball to carry its
    # native module, so the module is built from the source the tests run.
    foreach ($package in $NativePackages) {
        $name = (Get-Content "$($package.Path)/package.json" | ConvertFrom-Json).name
        if ($name -in $packed) {
            continue
        }
        Push-Location $package.Path
        try {
            & "$PSScriptRoot/build-extension.ps1" -PackageName $package.Path -ModuleName $package.Module
        } finally {
            Pop-Location
        }
    }
} finally {
    Pop-Location
}
