# Pester 5 tests for release-plan-filter.ps1. Each test makes a repository
# with a tagged package, changes it and asks the filter which files count.
#   Invoke-Pester ./ci/release-plan-filter.Tests.ps1

BeforeAll {
    $script:Filter = Join-Path $PSScriptRoot 'release-plan-filter.ps1'
    $script:Tag = 'pkg/1.0.0'

    function Get-BaseManifest {
        return [ordered]@{
            name = 'pkg'
            version = '1.0.0'
            description = 'A package.'
            keywords = @('one')
            homepage = 'https://example.com/one'
            repository = [ordered]@{ type = 'git'; url = 'https://example.com/r' }
            bugs = [ordered]@{ url = 'https://example.com/b' }
            author = 'Someone'
            license = 'EUPL-1.2'
            files = @('index.js')
            readme = 'readme.md'
            main = 'index.js'
            exports = [ordered]@{ '.' = './index.js' }
            scripts = [ordered]@{ test = 'jest' }
            dependencies = [ordered]@{ dep = '^1.0.0' }
        }
    }

    function Set-Manifest([string]$Repo, [string]$File, $Manifest) {
        $path = Join-Path $Repo $File
        New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
        Set-Content -Path $path -Value ($Manifest | ConvertTo-Json -Depth 10)
    }

    function Invoke-Git([string]$Repo) {
        & git -C $Repo -c user.name=test -c user.email=test@example.com @args
        if ($LASTEXITCODE -ne 0) { throw "git $args failed" }
    }

    # A repository with pkg/package.json, pkg/remote_package.json and
    # pkg/index.js committed and tagged.
    function New-Repo {
        $repo = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory $repo | Out-Null
        Invoke-Git $repo init -q
        Set-Manifest $repo 'pkg/package.json' (Get-BaseManifest)
        Set-Manifest $repo 'pkg/remote_package.json' (Get-BaseManifest)
        Set-Content (Join-Path $repo 'pkg/index.js') 'module.exports = 1;'
        Invoke-Git $repo add -A
        Invoke-Git $repo commit -q -m base
        Invoke-Git $repo tag $script:Tag
        return $repo
    }

    function Save-Change([string]$Repo) {
        Invoke-Git $Repo add -A
        Invoke-Git $Repo commit -q -m change
    }

    function Invoke-Filter([string]$Repo, [string[]]$Files) {
        $package = [pscustomobject]@{ Name = 'pkg'; Path = 'pkg' }
        return @(& $script:Filter -RepoPath $Repo -Package $package `
            -From $script:Tag -Files $Files 6>$null)
    }
}

Describe 'release-plan-filter' {
    BeforeEach {
        $script:Repo = New-Repo
    }

    It 'does not count a package.json change only to <Field>' -ForEach @(
        @{ Field = 'description'; Value = 'Another description.' }
        @{ Field = 'keywords'; Value = @('one', 'two') }
        @{ Field = 'homepage'; Value = 'https://example.com/two' }
        @{ Field = 'repository'; Value = [ordered]@{ type = 'git'; url = 'https://example.com/r2' } }
        @{ Field = 'bugs'; Value = [ordered]@{ url = 'https://example.com/b2' } }
        @{ Field = 'author'; Value = 'Someone Else' }
        @{ Field = 'license'; Value = 'MIT' }
        @{ Field = 'files'; Value = @('index.js', 'types') }
        @{ Field = 'readme'; Value = 'README.md' }
    ) {
        $manifest = Get-BaseManifest
        $manifest[$Field] = $Value
        Set-Manifest $script:Repo 'pkg/package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') | Should -BeNullOrEmpty
    }

    It 'counts a package.json change to <Field>' -ForEach @(
        @{ Field = 'version'; Value = '1.0.1' }
        @{ Field = 'dependencies'; Value = [ordered]@{ dep = '^2.0.0' } }
        @{ Field = 'main'; Value = 'main.js' }
        @{ Field = 'exports'; Value = [ordered]@{ '.' = './main.js' } }
        @{ Field = 'scripts'; Value = [ordered]@{ test = 'jest'; build = 'tsc' } }
        @{ Field = 'peerDependencies'; Value = [ordered]@{ peer = '^1.0.0' } }
    ) {
        $manifest = Get-BaseManifest
        $manifest[$Field] = $Value
        Set-Manifest $script:Repo 'pkg/package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') |
            Should -Be @('pkg/package.json')
    }

    It 'counts a field removed from package.json' {
        $manifest = Get-BaseManifest
        $manifest.Remove('dependencies')
        Set-Manifest $script:Repo 'pkg/package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') |
            Should -Be @('pkg/package.json')
    }

    It 'counts a metadata change made with a dependency change' {
        $manifest = Get-BaseManifest
        $manifest.homepage = 'https://example.com/two'
        $manifest.dependencies = [ordered]@{ dep = '^2.0.0' }
        Set-Manifest $script:Repo 'pkg/package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') |
            Should -Be @('pkg/package.json')
    }

    It 'does not count a remote_package.json change only to metadata' {
        $manifest = Get-BaseManifest
        $manifest.homepage = 'https://example.com/two'
        Set-Manifest $script:Repo 'pkg/remote_package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/remote_package.json') |
            Should -BeNullOrEmpty
    }

    It 'counts a remote_package.json change to a dependency' {
        $manifest = Get-BaseManifest
        $manifest.dependencies = [ordered]@{ dep = '^2.0.0' }
        Set-Manifest $script:Repo 'pkg/remote_package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/remote_package.json') |
            Should -Be @('pkg/remote_package.json')
    }

    It 'does not count a change only to the order of the fields' {
        $manifest = Get-BaseManifest
        $reordered = [ordered]@{}
        foreach ($key in @($manifest.Keys | Sort-Object -Descending)) {
            $reordered[$key] = $manifest[$key]
        }
        Set-Manifest $script:Repo 'pkg/package.json' $reordered
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') | Should -BeNullOrEmpty
    }

    It 'counts a manifest added since the tag' {
        Set-Manifest $script:Repo 'pkg/sub/package.json' (Get-BaseManifest)
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/sub/package.json') |
            Should -Be @('pkg/sub/package.json')
    }

    It 'counts a manifest removed since the tag' {
        Remove-Item (Join-Path $script:Repo 'pkg/remote_package.json')
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/remote_package.json') |
            Should -Be @('pkg/remote_package.json')
    }

    It 'counts a manifest that is not JSON' {
        Set-Content (Join-Path $script:Repo 'pkg/package.json') '{ not json'
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/package.json') |
            Should -Be @('pkg/package.json')
    }

    It 'passes every other file through, and keeps only the files that count' {
        Set-Content (Join-Path $script:Repo 'pkg/index.js') 'module.exports = 2;'
        $manifest = Get-BaseManifest
        $manifest.description = 'Another description.'
        Set-Manifest $script:Repo 'pkg/package.json' $manifest
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/index.js', 'pkg/package.json') |
            Should -Be @('pkg/index.js')
    }

    It 'leaves no exit code for its caller' {
        Remove-Item (Join-Path $script:Repo 'pkg/remote_package.json')
        Save-Change $script:Repo
        Invoke-Filter $script:Repo @('pkg/remote_package.json') | Out-Null
        $LASTEXITCODE | Should -Be 0
    }
}
