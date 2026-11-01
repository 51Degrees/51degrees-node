param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Name
)

$tests = @(
    @{ DataFile = 'cxx/device-detection-data/Enterprise-HashV41.hash'; Script = 'device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_$Name.json" }
    @{ Script = 'ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_${Name}_ipi.json" }
)

$testsFailed = $false

Push-Location $RepoName
try
{
    Write-Output "Running performance tests"
    $env:JEST_JUNIT_OUTPUT_DIR = 'test-results/performance'

    $perfSummary = New-Item -ItemType directory -Path test-results/performance-summary -Force

    foreach ($test in $tests) {
        # Pass the TAC data file explicitly, so the graph is measured with the full
        # data file rather than whichever file the example's folder search finds
        # first. Without a license key the TAC file isn't downloaded.
        $dataFileArgs = @()
        if ($test.DataFile -and (Test-Path $test.DataFile)) {
            $dataFileArgs = '--datafile', $test.DataFile
        }
        node $test.Script @dataFileArgs --jsonoutput $test.Output || $($testsFailed = $true)
        Move-Item -Path $test.Output -Destination "$perfSummary/$($test.Output)" || $(throw "failed to move summary")
    }
} finally {
    Pop-Location
}
exit $testsFailed ? 1 : 0
