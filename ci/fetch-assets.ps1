# Takes no key or address. common-ci exports _51DEGREES_LICENSE_KEY before
# this runs, and its steps/fetch-assets.ps1 downloads every licensed file
# from the Distributor with it, failing with the variable named when it is
# not set.
$ErrorActionPreference = 'Stop'

# PreBuild is a job from the nightly-publish-main workflow
if ($env:GITHUB_JOB -eq "PreBuild") {
    Write-Output "Skipping assets fetching"
    exit 0
}

$data = "$PSScriptRoot/../cxx/data"
$deviceDetectionData = "$data/device-detection"
$ipIntelligenceData = "$data/ip-intelligence"

# Every data file the tests read is an asset, kept in ./assets, which the run
# caches once, so a test job restores the files rather than downloading them.

$assets = '51Degrees-LiteV4.1.hash', '20000 Evidence Records.yml',
    'TAC-HashV41.hash', '51Degrees.csv'

./steps/fetch-assets.ps1 -Assets $assets
foreach ($asset in $assets) {
    switch -Exact -CaseSensitive ($asset) {
        'TAC-HashV41.hash' {New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$deviceDetectionData/Enterprise-HashV41.hash", "$PSScriptRoot/../device-detection/fiftyone.devicedetection.onpremise/tests/51Degrees-LiteV4.1.hash"}
        '51Degrees.csv' {New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$PSScriptRoot/../device-detection/fiftyone.devicedetection.cloud/tests/$_"}
        '51Degrees-LiteV4.1.hash' {New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$deviceDetectionData/$_", "$deviceDetectionData/51Degrees.hash"}
        default {New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$deviceDetectionData/$_"}
    }
}

# The free Lite file under its asset name, for the tests that run the
# examples as a fresh clone does, because the Lite name can hold the
# Enterprise file.
$liteAsset = '51Degrees-LiteIpiV41.ipi'
./steps/fetch-assets.ps1 -Assets $liteAsset
New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$liteAsset" -Path "$ipIntelligenceData/$liteAsset"

$asset = '51Degrees-EnterpriseIpiV41.ipi'
./steps/fetch-assets.ps1 -Assets $asset
New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/$asset"
# The Enterprise file stands in for the Lite one too.
New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/51Degrees-LiteV41.ipi"
# The Asn file the IP Intelligence tests use.
$asn = '51Degrees-IPIV4AsnIpiV41.ipi'
./steps/fetch-assets.ps1 -Assets $asn
Copy-Item "assets/$asn" $ipIntelligenceData

# Generate the evidence file used by tests and examples.
Push-Location $ipIntelligenceData
try {
    ./evidence-gen.ps1 -v4 10000 -v6 10000
} finally {
    Pop-Location
}
