#Requires -Modules Pester
# Tests that ci/fetch-assets.ps1 leaves the license key to common-ci, whose
# steps/fetch-assets.ps1 downloads every data file with
# _51DEGREES_LICENSE_KEY. So the script reads no key from an input, sets no
# key, and passes no key or address to common-ci.
#
# The script runs from a copy in a temporary folder, with the common-ci
# script it calls replaced by one that records what it was given.

BeforeAll {
    $script:Ci = $PSScriptRoot

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

    # Saves the CI markers and clears them, so the script under test runs as
    # it does outside a workflow.
    function Save-Environment {
        $saved = @{}
        foreach ($name in 'GITHUB_ACTIONS', 'GITHUB_JOB') {
            $saved[$name] = [Environment]::GetEnvironmentVariable($name)
            [Environment]::SetEnvironmentVariable($name, $null)
        }
        return $saved
    }

    function Restore-Environment([hashtable]$Saved) {
        foreach ($name in $Saved.Keys) {
            [Environment]::SetEnvironmentVariable($name, $Saved[$name])
        }
    }
}

Describe 'ci/fetch-assets.ps1' {
    BeforeEach {
        $script:Saved = Save-Environment
        # common-ci's step, which records each call and makes the files.
        $script:Work = New-Work 'fetch-assets.ps1' @{
            'steps/fetch-assets.ps1' = @'
param ([Parameter(Mandatory)][string[]]$Assets)
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

    It 'takes no input' {
        (Get-Command "$script:Ci/fetch-assets.ps1").Parameters.Keys |
            Where-Object { $_ -notin [System.Management.Automation.PSCmdlet]::CommonParameters } |
            Should -BeNullOrEmpty
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
