param (
    [string]$DeviceDetection,
    [string]$DeviceDetectionUrl,
    [string]$CsvUrl,
    [string]$IpIntelligence,
    [string]$IpIntelligenceUrl
)
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

$assets = '51Degrees-LiteV4.1.hash', '20000 Evidence Records.yml', '20000 User Agents.csv'
if ($DeviceDetection) {
    $assets += 'TAC-HashV41.hash', '51Degrees.csv'
} else {
    Write-Host "::warning file=$($MyInvocation.ScriptName),line=$($MyInvocation.ScriptLineNumber),title=No License Key::A device detection license was not provided, so On-Premise Data file and 51Degrees.csv will not be downloaded."
}

./steps/fetch-assets.ps1 -DeviceDetection:$DeviceDetection -DeviceDetectionUrl:$DeviceDetectionUrl -CsvUrl:$CsvUrl -Assets $assets
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

if ($IpIntelligence) {
    $asset = '51Degrees-EnterpriseIpiV41.ipi'
    ./steps/fetch-assets.ps1 -IpIntelligence:$IpIntelligence -IpIntelligenceUrl:$IpIntelligenceUrl -Assets $asset
    New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/$asset"
    # The Enterprise file stands in for the Lite one too.
    New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/51Degrees-LiteV41.ipi"
} else {
    Write-Host "::warning file=$($MyInvocation.ScriptName),line=$($MyInvocation.ScriptLineNumber),title=No License Key::An IP intelligence license was not provided, so the Enterprise data file will not be downloaded."
    New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$liteAsset" -Path "$ipIntelligenceData/51Degrees-LiteV41.ipi"
}
# The Asn file the IP Intelligence tests use.
$asn = '51Degrees-IPIV4AsnIpiV41.ipi'
./steps/fetch-assets.ps1 -Assets $asn
Copy-Item "assets/$asn" $ipIntelligenceData

# Generate the evidence files used by tests and examples.
Push-Location $ipIntelligenceData
try {
    ./evidence-gen.ps1 -v4 10000 -v6 10000
    ./evidence-gen.ps1 -v4 10000 -v6 10000 -csv -path "evidence.csv"
} finally {
    Pop-Location
}
