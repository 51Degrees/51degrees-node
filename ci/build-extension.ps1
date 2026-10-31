param (
    [Parameter(Mandatory)][string]$PackageName,
    [Parameter(Mandatory)][string]$ModuleName
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

# This is a local version of common-ci/node/build-extension.ps1, which can
# only build the device detection native module, and writes its artifacts
# relative to a package directly under the repository.

Write-Output "Building extension for $PackageName"

# node-gyp 12 or newer is required to recognise Visual Studio 2026 (v18),
# which ships on the current windows-latest image. Older node-gyp reports it
# as "unknown version" and fails to find a compiler. node-gyp 12 requires
# Node ^20.17.0 or >=22.9.0, so ci/options.json pins the matrix to "20" and
# "22" (latest of each) rather than the old 22.5.1, which falls in the
# unsupported gap. Invoke through npx so this pinned version is used rather
# than any node-gyp already on the PATH.
$nodeGyp = "node-gyp@12"

# Determine the operating system
if ($IsMacOS) {
    $os = "darwin"
} elseif ($IsLinux) {
    $os = "linux"
    sudo apt-get install g++ make libatomic1
} elseif ($IsWindows) {
    $os = "win32"
} else {
    $os = "unknown"
}
$arch = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLower()

# Creating folder for future build
New-Item -ItemType Directory -Path build -Force | Out-Null

# Renaming building config file
Copy-Item binding.51d binding.gyp

# Run configuration
npx --yes $nodeGyp configure

# Build configuration
npx --yes $nodeGyp build

# Getting major node version
$nodeVersion = node --version
$nodeMajorVersion = $nodeVersion.TrimStart('v').Split('.')[0]

# Creating folder for binaries artifacts
New-Item -ItemType Directory -Path "$PSScriptRoot/../../package-files" -Force | Out-Null

# Storing binary artifact (needs to be in both of these places for different tests, and packaging)
Copy-Item "./build/Release/$moduleName.node" "./build/$moduleName-$os-$arch-$nodeMajorVersion.node"
Move-Item "./build/Release/$moduleName.node" "$PSScriptRoot/../../package-files/$moduleName-$os-$arch-$nodeMajorVersion.node"
