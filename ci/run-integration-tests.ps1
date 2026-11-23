param (
    [Parameter(Mandatory)][string]$RepoName,
    # False, from select-options.ps1, on every entry of a pull request but
    # one, so the browser contract runs once.
    [bool]$SeleniumContract = $true
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

# The pipeline and location tests read _51DEGREES_RESOURCE_KEY, which
# common-ci exports before this runs. It is not set here, so an empty input
# cannot clear it.

# common-ci does not export the 51Did license, so the main CI has none and
# the tests redeem unlicensed. Only .github/workflows/cloud-51did.yml sets
# it. A license redeems only with a resource key of the same account. With
# any other key the licensed redeem in didClient.integration.test.js answers
# unreadable, so should a job ever have the license, the tests get it only
# when they run with the 51DID resource key. Without it they redeem
# unlicensed and check for the unreadable answer.
if (-not $env:_51DEGREES_RESOURCE_KEY_51DID -or
    $env:_51DEGREES_RESOURCE_KEY -cne $env:_51DEGREES_RESOURCE_KEY_51DID) {
    Remove-Item env:_51DEGREES_LICENSE_KEY_51DID -ErrorAction Ignore
}

./node/run-integration-tests.ps1 -RepoName $RepoName

if (-not $SeleniumContract) {
    Write-Host "Another entry runs the Selenium contract tests for this pull request."
    exit
}

if ($IsLinux -and [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq [System.Runtime.InteropServices.Architecture]::Arm64) {
    Write-Host "::warning title=Selenium skipped::Selenium contract skipped on linux-arm64 (no selenium-manager aarch64 build); covered on x64 and macOS-arm."
    exit
}

# The suite runs on .NET. A dotnet that is only a file, such as a link to an
# SDK that has been removed, is opened rather than run, which sets no exit
# code, so the tests would be reported as passed without running.
$dotnet = Get-Command dotnet -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $dotnet -or -not (Test-Path -PathType Leaf $dotnet.Source)) {
    throw "The Selenium contract tests need .NET, and no dotnet program was found."
}
& $dotnet.Source --version

# Starts one of this repository's web examples, runs the shared Selenium
# contract tests against it, and stops it again. Throws if the tests fail,
# after printing the example's output so the failure can be diagnosed from the
# job log.
function Invoke-ContractTests {
    param (
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$ExampleDir,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][hashtable]$Environment
    )
    Write-Host "Running Selenium contract tests against the $Name example on port $Port..."
    $example = $null
    try {
        # The background job is a new process, which inherits this process's
        # environment and current location when it starts.
        $env:PORT = $Port
        # PowerShell names ignore case, so the loop variable must not be $name,
        # which is the same variable as the $Name parameter.
        foreach ($variable in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($variable, $Environment[$variable])
        }
        Push-Location $ExampleDir
        try {
            $example = node gettingStarted.js 2>&1 &
        } finally { Pop-Location }

        # Wait for the example to come up. Loading an on-premise data file can
        # take longer than connecting to the cloud, so allow up to two minutes.
        curl -sS -o $(if ($IsWindows) { 'NUL' } else { '/dev/null' }) --retry 20 --retry-delay 3 --retry-max-time 120 --retry-connrefused "http://localhost:$Port"
        if ($LASTEXITCODE -ne 0) { throw "The $Name example did not start on port $Port." }

        # The suite reads the running example's address and language under
        # its _51DEGREES_ names. Without _51DEGREES_EXAMPLE_URL it launches
        # an example of its own.
        ${env:_51DEGREES_EXAMPLE_URL} = "http://localhost:$Port"
        ${env:_51DEGREES_EXAMPLE_LANG} = 'node'
        & $dotnet.Source test selenium-api-tests -c Release --filter TestCategory=Contract |
            Tee-Object -Variable output | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "dotnet test exited with $LASTEXITCODE." }
        # A run that found no test also exits with 0.
        if (-not ($output -match 'Passed:\s+[1-9]')) {
            throw "dotnet test reported no test that passed."
        }
        Write-Host "Selenium contract tests passed against the $Name example."
    } catch {
        Write-Host "::error title=Selenium contract failed::The Selenium contract tests failed against the $Name example. $_"
        if ($example) { Write-Host ">>> $Name example output >>>"; Receive-Job $example | Out-Host; Write-Host "<<< $Name example output <<<" }
        throw
    } finally {
        if ($example) { Remove-Job -Force $example }
        Remove-Item env:_51DEGREES_EXAMPLE_URL, env:_51DEGREES_EXAMPLE_LANG `
            -ErrorAction SilentlyContinue
        foreach ($variable in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($variable, $null)
        }
    }
}

# Get the shared contract tests.
if (-not (Test-Path selenium-api-tests)) {
    git clone --depth 1 https://github.com/51Degrees/selenium-api-tests.git
}

$failed = @()

# Cloud example, pointed at the live cloud.
# The contract needs every property, so the example is given the key that
# carries them all, under the name it reads, _51DEGREES_RESOURCE_KEY.
if ($env:_51DEGREES_RESOURCE_KEY_BESPOKE) {
    try {
        Invoke-ContractTests `
        -Name 'cloud' `
        -ExampleDir "$PSScriptRoot/../device-detection/fiftyone.devicedetection.cloud/examples/cloud/gettingstarted-web" `
        -Port 8096 `
        -Environment @{
            '_51DEGREES_RESOURCE_KEY' = $env:_51DEGREES_RESOURCE_KEY_BESPOKE
            '_51DEGREES_CLOUD_ENDPOINT' = 'https://cloud.51degrees.com/api/v4/'
        }
    } catch { $failed += 'cloud' }
} else {
    Write-Host "::warning title=No Resource Key::No resource key; skipping the Selenium contract against the cloud example."
}

# On-premise example, using the TAC data file. The Lite data file has neither
# the DeviceType property nor the JavaScript properties the contract tests
# need, so the tests are skipped when the TAC file was not fetched (that is,
# when no device detection licence was given to fetch-assets.ps1, which puts
# its files in ./assets).
$tacDataFile = Join-Path $PWD 'assets' 'TAC-HashV41.hash'
if (Test-Path $tacDataFile) {
    try {
        Invoke-ContractTests `
        -Name 'on-premise' `
        -ExampleDir "$PSScriptRoot/../device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/gettingstarted-web" `
        -Port 8097 `
        -Environment @{
            '_51DEGREES_DD_PATH' = (Resolve-Path $tacDataFile).Path
        }
    } catch { $failed += 'on-premise' }
} else {
    Write-Host "::warning title=No TAC data file::'$tacDataFile' was not found; skipping the Selenium contract against the on-premise example."
}

if ($failed) {
    throw "Selenium contract tests failed against the $($failed -join ' and ') example(s)."
}
