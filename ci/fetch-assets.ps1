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

$deviceDetectionData = "$PSScriptRoot/../cxx/device-detection-data"
$ipIntelligenceData = "$PSScriptRoot/../cxx/ip-intelligence-data"

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

if ($IpIntelligence) {
    $asset = '51Degrees-EnterpriseIpiV41.ipi'
    ./steps/fetch-assets.ps1 -IpIntelligence:$IpIntelligence -IpIntelligenceUrl:$IpIntelligenceUrl -Assets $asset
    New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/$asset"
    # Use Enterprise as Lite for testing until a Lite file is freely available.
    New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$asset" -Path "$ipIntelligenceData/51Degrees-LiteV41.ipi"
} else {
    Write-Host "::warning file=$($MyInvocation.ScriptName),line=$($MyInvocation.ScriptLineNumber),title=No License Key::An IP intelligence license was not provided, so the on-premise data file will not be downloaded."
}

# Generate the evidence files used by tests and examples.
Push-Location $ipIntelligenceData
try {
    ./evidence-gen.ps1 -v4 10000 -v6 10000
    ./evidence-gen.ps1 -v4 10000 -v6 10000 -csv -path "evidence.csv"
} finally {
    Pop-Location
}
