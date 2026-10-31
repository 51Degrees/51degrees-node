param (
    [string]$IpIntelligence,
    [string]$IpIntelligenceUrl
)
$ErrorActionPreference = 'Stop'

# PreBuild is a job from the nightly-publish-main workflow
if ($env:GITHUB_JOB -eq "PreBuild") {
    Write-Output "Skipping assets fetching"
    exit 0
}

$ipIntelligenceData = "$PSScriptRoot/../fiftyone.ipintelligence.onpremise/ip-intelligence-cxx/ip-intelligence-data"

$assets = @()
if ($IpIntelligence) {
    $assets += '51Degrees-EnterpriseIpiV41.ipi'
} else {
    Write-Host "::warning file=$($MyInvocation.ScriptName),line=$($MyInvocation.ScriptLineNumber),title=No License Key::An IP intelligence license was not provided, so the on-premise data file will not be downloaded."
}

if ($assets.Count -gt 0) {
    ./steps/fetch-assets.ps1 -IpIntelligence:$IpIntelligence -IpIntelligenceUrl:$IpIntelligenceUrl -Assets $assets
    foreach ($asset in $assets) {
        switch -Exact -CaseSensitive ($asset) {
            '51Degrees-EnterpriseIpiV41.ipi' {
                New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$ipIntelligenceData/$_"
                # Use Enterprise as Lite for testing until a Lite file
                # is freely available.
                New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$ipIntelligenceData/51Degrees-LiteV41.ipi"
            }
            default {New-Item -ItemType SymbolicLink -Force -Target "$PWD/assets/$_" -Path "$ipIntelligenceData/$_"}
        }
    }
}

# Generate the evidence files used by tests and examples.
Push-Location $ipIntelligenceData
try {
    ./evidence-gen.ps1 -v4 10000 -v6 10000
    ./evidence-gen.ps1 -v4 10000 -v6 10000 -csv -path "evidence.csv"
} finally {
    Pop-Location
}
