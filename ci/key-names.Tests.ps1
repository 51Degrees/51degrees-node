#Requires -Modules Pester
# Tests that the scripts in ci/ leave the keys to common-ci. common-ci
# exports each key under its _51DEGREES_ name before any of these scripts
# runs, and its steps/fetch-assets.ps1 downloads every data file with
# _51DEGREES_LICENSE_KEY. So a script here reads no key from an input, sets
# no key, and passes no key or address to common-ci.
#
# Each script runs from a copy in a temporary folder, with the common-ci
# scripts it calls replaced by ones that record what they were given.

BeforeAll {
    $script:Ci = $PSScriptRoot

    # The names that left the agreed list, and the old inputs that carried
    # keys and addresses before callers passed `secrets: inherit`.
    $script:DroppedNames = @(
        '_51DEGREES_RESOURCE_KEY_PLATFORM', '_51DEGREES_RESOURCE_KEY_HARDWARE',
        '_51DEGREES_RESOURCE_KEY_BROWSER', '_51DEGREES_RESOURCE_KEY_NO_SETHEADER'
    )
    $script:OldInputs = @(
        'TestResourceKey', 'TestSuperResourceKey', 'TestPlatformResourceKey',
        'TestHardwareResourceKey', 'TestBrowserResourceKey',
        'TestNoSetHeaderResourceKey', 'TestLicenseKey', 'DeviceDetection',
        'DeviceDetectionUrl', 'CsvUrl', 'IpIntelligence', 'IpIntelligenceUrl'
    )

    # A folder holding a copy of one script under ci/, with the given
    # common-ci scripts beside it.
    function New-Work([string]$Script, [hashtable]$Stubs) {
        $work = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid())
        New-Item -ItemType Directory -Path "$work/repo/ci" | Out-Null
        Copy-Item "$script:Ci/$Script" "$work/repo/ci/"
        foreach ($path in $Stubs.Keys) {
            $full = Join-Path $work $path
            New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
            Set-Content -Path $full -Value $Stubs[$path]
        }
        return $work
    }

    # Saves the named variables and the CI markers, and clears the markers,
    # so a script under test never frees disk space on a runner.
    function Save-Environment([string[]]$Names) {
        $saved = @{}
        foreach ($name in @($Names) + 'GITHUB_ACTIONS', 'GITHUB_JOB') {
            $saved[$name] = [Environment]::GetEnvironmentVariable($name)
        }
        [Environment]::SetEnvironmentVariable('GITHUB_ACTIONS', $null)
        [Environment]::SetEnvironmentVariable('GITHUB_JOB', $null)
        return $saved
    }

    function Restore-Environment([hashtable]$Saved) {
        foreach ($name in $Saved.Keys) {
            [Environment]::SetEnvironmentVariable($name, $Saved[$name])
        }
    }
}

Describe 'ci/setup-environment.ps1' {
    BeforeEach {
        $script:Saved = Save-Environment (@('_51DEGREES_RESOURCE_KEY',
            '_51DEGREES_RESOURCE_KEY_SUPER') + $script:DroppedNames)
        $script:Work = New-Work 'setup-environment.ps1' @{
            'node/setup-environment.ps1' = '$global:LASTEXITCODE = 0'
        }
    }
    AfterEach {
        Restore-Environment $script:Saved
        Remove-Item -Recurse -Force $script:Work
    }

    It 'keeps the keys common-ci exported when the inputs are empty' {
        $env:_51DEGREES_RESOURCE_KEY = 'exported-key'
        $env:_51DEGREES_RESOURCE_KEY_SUPER = 'exported-super'
        # The options a caller passing `secrets: inherit` gives: the keys
        # under their organization names, none under the old inputs.
        $Options = @{ Keys = @{ _51DEGREES_RESOURCE_KEY_BESPOKE = 'bespoke' } }
        Push-Location $script:Work
        try { & "$script:Work/repo/ci/setup-environment.ps1" -RepoName repo }
        finally { Pop-Location }
        $env:_51DEGREES_RESOURCE_KEY | Should -Be 'exported-key'
        $env:_51DEGREES_RESOURCE_KEY_SUPER | Should -Be 'exported-super'
    }

    It 'sets none of the names that left the list' {
        $Options = @{ Keys = @{
            TestPlatformResourceKey = 'p'; TestHardwareResourceKey = 'h'
            TestBrowserResourceKey = 'b'; TestNoSetHeaderResourceKey = 'n'
        } }
        Push-Location $script:Work
        try { & "$script:Work/repo/ci/setup-environment.ps1" -RepoName repo }
        finally { Pop-Location }
        foreach ($name in $script:DroppedNames) {
            [Environment]::GetEnvironmentVariable($name) | Should -BeNullOrEmpty -Because $name
        }
    }
}

Describe 'ci/run-integration-tests.ps1' {
    BeforeEach {
        $script:Saved = Save-Environment @('_51DEGREES_RESOURCE_KEY',
            '_51DEGREES_RESOURCE_KEY_51DID', '_51DEGREES_LICENSE_KEY_51DID',
            'NAMES_TEST_KEY_SEEN', 'NAMES_TEST_LICENSE_SEEN')
        $script:Work = New-Work 'run-integration-tests.ps1' @{
            'node/run-integration-tests.ps1' = 'param($RepoName)
$env:NAMES_TEST_KEY_SEEN = "[$env:_51DEGREES_RESOURCE_KEY]"
$env:NAMES_TEST_LICENSE_SEEN = "[$env:_51DEGREES_LICENSE_KEY_51DID]"'
        }
    }
    AfterEach {
        Restore-Environment $script:Saved
        Remove-Item -Recurse -Force $script:Work
    }

    It 'takes no key as an input' {
        $parameters = (Get-Command "$script:Ci/run-integration-tests.ps1").Parameters.Keys
        foreach ($name in $script:OldInputs) {
            $parameters | Should -Not -Contain $name
        }
    }

    It 'runs the tests with the key common-ci exported' {
        $env:_51DEGREES_RESOURCE_KEY = 'exported-key'
        Push-Location $script:Work
        try {
            & "$script:Work/repo/ci/run-integration-tests.ps1" -RepoName repo -SeleniumContract $false
        } finally { Pop-Location }
        $env:NAMES_TEST_KEY_SEEN | Should -Be '[exported-key]'
        $env:_51DEGREES_RESOURCE_KEY | Should -Be 'exported-key'
    }

    # common-ci exports the 51Did license into every job, but it redeems
    # only with the 51DID resource key. With any other key the licensed
    # redeem in didClient.integration.test.js answers unreadable.
    It 'gives the tests no 51Did license when the key is not the 51DID key' {
        $env:_51DEGREES_RESOURCE_KEY = 'bespoke-key'
        $env:_51DEGREES_RESOURCE_KEY_51DID = 'did-key'
        $env:_51DEGREES_LICENSE_KEY_51DID = 'did-license'
        Push-Location $script:Work
        try {
            & "$script:Work/repo/ci/run-integration-tests.ps1" -RepoName repo -SeleniumContract $false
        } finally { Pop-Location }
        $env:NAMES_TEST_LICENSE_SEEN | Should -Be '[]'
    }

    It 'gives the tests no 51Did license when there is no 51DID key' {
        $env:_51DEGREES_RESOURCE_KEY = 'bespoke-key'
        $env:_51DEGREES_RESOURCE_KEY_51DID = $null
        $env:_51DEGREES_LICENSE_KEY_51DID = 'did-license'
        Push-Location $script:Work
        try {
            & "$script:Work/repo/ci/run-integration-tests.ps1" -RepoName repo -SeleniumContract $false
        } finally { Pop-Location }
        $env:NAMES_TEST_LICENSE_SEEN | Should -Be '[]'
    }

    It 'gives the tests the 51Did license when the key is the 51DID key' {
        $env:_51DEGREES_RESOURCE_KEY = 'did-key'
        $env:_51DEGREES_RESOURCE_KEY_51DID = 'did-key'
        $env:_51DEGREES_LICENSE_KEY_51DID = 'did-license'
        Push-Location $script:Work
        try {
            & "$script:Work/repo/ci/run-integration-tests.ps1" -RepoName repo -SeleniumContract $false
        } finally { Pop-Location }
        $env:NAMES_TEST_LICENSE_SEEN | Should -Be '[did-license]'
    }
}

Describe 'ci/fetch-assets.ps1' {
    BeforeEach {
        $script:Saved = Save-Environment @()
        # common-ci's step, which records each call and makes the files.
        $script:Work = New-Work 'fetch-assets.ps1' @{
            'steps/fetch-assets.ps1' = @'
param ([Parameter(Mandatory)][string[]]$Assets, [string]$LicenseKey,
    [string]$DeviceDetection, [string]$DeviceDetectionUrl, [string]$CsvUrl,
    [string]$IpIntelligence, [string]$IpIntelligenceUrl, [switch]$FullCsv)
$global:FetchCalls += , @{ Assets = $Assets; Bound = @($PSBoundParameters.Keys) }
# Without New-Item, which the test replaces for links.
$null = [IO.Directory]::CreateDirectory("$PWD/assets")
foreach ($asset in $Assets) { [IO.File]::WriteAllText("$PWD/assets/$asset", $asset) }
'@
            'repo/cxx/data/ip-intelligence/evidence-gen.ps1' = ''
        }
        New-Item -ItemType Directory -Force -Path @(
            "$script:Work/repo/cxx/data/device-detection",
            "$script:Work/repo/device-detection/fiftyone.devicedetection.onpremise/tests",
            "$script:Work/repo/device-detection/fiftyone.devicedetection.cloud/tests"
        ) | Out-Null
        $global:FetchCalls = @()
    }
    AfterEach {
        Restore-Environment $script:Saved
        Remove-Item -Recurse -Force $script:Work
        Remove-Variable -Scope Global -Name FetchCalls
    }

    It 'takes no key or address as an input' {
        $parameters = (Get-Command "$script:Ci/fetch-assets.ps1").Parameters.Keys
        foreach ($name in $script:OldInputs) {
            $parameters | Should -Not -Contain $name
        }
    }

    It 'asks common-ci for the licensed files, and passes it no key or address' {
        # A link needs a privilege Windows gives only some accounts, and the
        # links are not what this test is about.
        Mock New-Item -ParameterFilter { $ItemType -eq 'SymbolicLink' } {}
        Push-Location $script:Work
        try { & "$script:Work/repo/ci/fetch-assets.ps1" }
        finally { Pop-Location }
        $asked = $global:FetchCalls | ForEach-Object { $_.Assets }
        $asked | Should -Contain 'TAC-HashV41.hash'
        $asked | Should -Contain '51Degrees.csv'
        $asked | Should -Contain '51Degrees-EnterpriseIpiV41.ipi'
        foreach ($call in $global:FetchCalls) {
            $call.Bound | Should -Be @('Assets')
        }
    }
}
