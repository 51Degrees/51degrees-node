param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Name
)

# The first of the data files that is there is used.
$tests = @(
    @{ DataFiles = 'cxx/data/device-detection/Enterprise-HashV41.hash', 'cxx/data/device-detection/51Degrees-LiteV4.1.hash'; Evidence = 'cxx/data/device-detection/20000 User Agents.csv'; Script = 'device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_$Name.json" }
    @{ DataFiles = 'cxx/data/ip-intelligence/51Degrees-LiteV41.ipi'; Evidence = 'cxx/data/ip-intelligence/evidence.csv'; Script = 'ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_${Name}_ipi.json" }
)

$testsFailed = $false

Push-Location $RepoName
try
{
    Write-Output "Running performance tests"
    $env:JEST_JUNIT_OUTPUT_DIR = 'test-results/performance'

    $perfSummary = New-Item -ItemType directory -Path test-results/performance-summary -Force

    foreach ($test in $tests) {
        # Pass the files explicitly, so the graph is measured with the full
        # data file rather than whichever file of that name the example's
        # folder search finds first. Without a license key the TAC file isn't
        # downloaded, so the Lite file is used.
        $fileArgs = @('--evidence', $test.Evidence)
        $dataFile = $test.DataFiles | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($dataFile) {
            $fileArgs += '--datafile', $dataFile
        }
        node $test.Script @fileArgs --jsonoutput $test.Output || $($testsFailed = $true)
        Move-Item -Path $test.Output -Destination "$perfSummary/$($test.Output)" || $(throw "failed to move summary")
    }
} finally {
    Pop-Location
}
exit $testsFailed ? 1 : 0
