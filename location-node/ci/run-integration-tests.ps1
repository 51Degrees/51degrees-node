param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    $Keys
)

Push-Location $RepoName

try
{
    Write-Output "Running integration tests"
    $env:RESOURCE_KEY = $Keys.TestResourceKey
    $env:JEST_JUNIT_OUTPUT_DIR = 'test-results/integration'
    npm run test
} finally {
    Pop-Location
}

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
