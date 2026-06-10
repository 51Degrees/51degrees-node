param (
    [Parameter(Mandatory)][string]$PackageName
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

# This is a local version of common-ci/node/build-extension.ps1 that
# builds the IP intelligence native module rather than the device
# detection one.

$moduleName = "FiftyOneIpIntelligenceIpiV41"

Write-Output "Building extension for $PackageName"

# Installing binary builder
npm i -g node-gyp

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
node-gyp configure

# Build configuration
node-gyp build

# Getting major node version
$nodeVersion = node --version
$nodeMajorVersion = $nodeVersion.TrimStart('v').Split('.')[0]

# Creating folder for binaries artifacts
New-Item -ItemType Directory -Path "../../package-files" -Force | Out-Null

# Storing binary artifact (needs to be in both of these places for different tests, and packaging)
Copy-Item "./build/Release/$moduleName.node" "./build/$moduleName-$os-$arch-$nodeMajorVersion.node"
Move-Item "./build/Release/$moduleName.node" "../../package-files/$moduleName-$os-$arch-$nodeMajorVersion.node"

# Installing package for some examples
npm install n-readlines
