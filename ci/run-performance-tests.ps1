param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Name
)

$tests = @(
    @{ Script = 'device-detection-node/fiftyone.devicedetection.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_$Name.json" }
    @{ Script = 'ip-intelligence-node/fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console/performance.js'; Output = "results_${Name}_ipi.json" }
)

$testsFailed = $false

Push-Location $RepoName
try
{
    Write-Output "Running performance tests"
    $env:JEST_JUNIT_OUTPUT_DIR = 'test-results/performance'

    $perfSummary = New-Item -ItemType directory -Path test-results/performance-summary -Force

    foreach ($test in $tests) {
        node $test.Script --jsonoutput $test.Output || $($testsFailed = $true)
        Move-Item -Path $test.Output -Destination "$perfSummary/$($test.Output)" || $(throw "failed to move summary")
    }
} finally {
    Pop-Location
}
exit $testsFailed ? 1 : 0
