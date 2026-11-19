#Requires -Modules Pester
# Tests of ci/publish-package.ps1 against a small repository of three
# packages, with npm and gh replaced by functions that keep a registry and the
# releases in memory. git is real, with a bare repository as origin. Needs
# COMMON_CI to name a checkout of common-ci, as ci/release-plan.ps1 does.
#
# The packages are named so that name order and dependency order differ:
# alpha.app depends on zeta.base, and mid.tool stands alone.

BeforeAll {
    $script:Ci = $PSScriptRoot
    $script:CommonCi = (Resolve-Path $env:COMMON_CI).Path

    function Invoke-Git([string]$Path) {
        $gitArgs = $args
        & (Get-Command git -CommandType Application | Select-Object -First 1) `
            -C $Path @gitArgs
        if ($LASTEXITCODE -ne 0) { throw "git $gitArgs failed in $Path" }
    }

    # A repository whose three packages were last released at 1.0.0, with
    # zeta.base and mid.tool changed since, so the plan is all three at 1.0.1.
    function New-TestRepository {
        $work = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid())
        $repo = Join-Path $work 'repo'
        $origin = Join-Path $work 'origin.git'
        New-Item -ItemType Directory -Path $repo, "$work/package", "$work/node" | Out-Null
        Copy-Item "$script:CommonCi/node/publish-package-npm.ps1" "$work/node/"
        & git init --quiet --bare $origin
        & git init --quiet $repo
        Invoke-Git $repo config user.name test
        Invoke-Git $repo config user.email test@example.com
        New-Item -ItemType Directory -Path "$repo/ci", "$repo/zeta", "$repo/alpha", "$repo/mid" | Out-Null
        @(
            @{ Name = 'zeta.base'; Path = 'zeta'; DependsOn = @(); Publish = $true }
            @{ Name = 'alpha.app'; Path = 'alpha'; DependsOn = @('zeta.base'); Publish = $true }
            @{ Name = 'mid.tool'; Path = 'mid'; DependsOn = @(); Publish = $true }
        ) | ConvertTo-Json -Depth 5 | Set-Content "$repo/ci/packages.json"
        foreach ($folder in 'zeta', 'alpha', 'mid') {
            Set-Content "$repo/$folder/index.js" '// first'
        }
        Invoke-Git $repo add -A
        Invoke-Git $repo commit --quiet -m first
        foreach ($name in 'zeta.base', 'alpha.app', 'mid.tool') {
            Invoke-Git $repo tag "$name/1.0.0"
        }
        Set-Content "$repo/zeta/index.js" '// changed'
        Set-Content "$repo/mid/index.js" '// changed'
        Invoke-Git $repo commit --quiet -am second
        Invoke-Git $repo remote add origin $origin
        Invoke-Git $repo push --quiet origin HEAD:refs/heads/main --tags
        foreach ($name in 'zeta.base', 'alpha.app', 'mid.tool') {
            Set-Content "$work/package/$name-1.0.1.tgz" $name
        }
        return [pscustomobject]@{ Work = $work; Repo = $repo; Origin = $origin }
    }

    # What the registry holds, every publish in order, and the releases made.
    function Reset-Registry([string[]]$Published = @(), [string[]]$FailOn = @()) {
        $global:TestNpmRegistry = [Collections.Generic.HashSet[string]]::new([string[]]$Published)
        $global:TestNpmPublishes = [Collections.Generic.List[string]]::new()
        $global:TestNpmFailOn = [Collections.Generic.HashSet[string]]::new([string[]]$FailOn)
        $global:TestReleases = [Collections.Generic.List[string]]::new()
    }

    # Stands in for npm. A publish of a name and version the registry already
    # has is refused, as npm refuses it.
    function global:npm {
        $global:LASTEXITCODE = 0
        switch ($args[0]) {
            'whoami' { return 'tester' }
            'view' {
                if ($global:TestNpmRegistry.Contains($args[1])) {
                    return $args[1].Split('@')[-1]
                }
                return
            }
            'publish' {
                $tarball = @($args | Where-Object { "$_" -like '*.tgz' })[0]
                # npm reads a relative path such as 'package/name.tgz' as the
                # GitHub repository 'package/name.tgz', so a path has to start
                # with '.', '/' or a drive.
                if ("$tarball" -notmatch '^(\.|/|[A-Za-z]:)') {
                    throw "npm reads '$tarball' as a GitHub repository"
                }
                $file = Split-Path -Leaf "$tarball"
                $name = $file -replace '-\d.*$'
                $version = $file -replace '^.*-(\d+\.\d+\.\d+)\.tgz$', '$1'
                $id = "$name@$version"
                if ($global:TestNpmFailOn.Remove($name)) {
                    throw "npm publish failed for $id"
                }
                if ($global:TestNpmRegistry.Contains($id)) {
                    throw "npm refuses to publish over $id"
                }
                if ($args -notcontains '--dry-run') {
                    [void]$global:TestNpmRegistry.Add($id)
                }
                $global:TestNpmPublishes.Add($id)
                return
            }
            default { return }
        }
    }

    function global:gh {
        $global:LASTEXITCODE = 0
        $create = [array]::IndexOf([object[]]$args, 'create')
        if ($create -ge 0) {
            $global:TestReleases.Add("$($args[$create + 1])")
        }
    }

    function Invoke-Publish($Test, [bool]$DryRun = $false) {
        Push-Location $Test.Work
        try {
            & "$script:Ci/publish-package.ps1" -RepoName $Test.Repo -OrgName test `
                -Keys @{ NPMAuthToken = 'token' } -DryRun $DryRun
        } finally {
            Pop-Location
        }
    }

    # The 1.0.1 tags origin holds, sorted and joined, for one comparison.
    function Get-OriginTags($Test) {
        return (@(& git -C $Test.Origin tag -l |
            Where-Object { $_ -like '*/1.0.1' } | Sort-Object) -join ',')
    }

    $script:AllTags = 'alpha.app/1.0.1,mid.tool/1.0.1,zeta.base/1.0.1'
}

AfterAll {
    Remove-Item function:global:npm, function:global:gh -ErrorAction Ignore
}

Describe 'publish-package.ps1' {
    BeforeEach {
        $script:Test = New-TestRepository
    }
    AfterEach {
        Remove-Item -Recurse -Force $script:Test.Work -ErrorAction Ignore
    }

    It 'publishes each package after the packages it depends on' {
        Reset-Registry
        Invoke-Publish $script:Test | Out-Null
        $order = @($global:TestNpmPublishes)
        $order | Should -HaveCount 3
        $order.IndexOf('zeta.base@1.0.1') |
            Should -BeLessThan $order.IndexOf('alpha.app@1.0.1')
        Get-OriginTags $script:Test | Should -Be $script:AllTags
    }

    It 'tags a package npm already has without publishing it again' {
        Reset-Registry -Published @('zeta.base@1.0.1')
        Invoke-Publish $script:Test | Out-Null
        @($global:TestNpmPublishes) | Should -Not -Contain 'zeta.base@1.0.1'
        @($global:TestNpmPublishes) | Should -HaveCount 2
        Get-OriginTags $script:Test | Should -Be $script:AllTags
        @($global:TestReleases) | Should -Contain 'zeta.base/1.0.1'
    }

    # The plan's order is mid.tool, zeta.base, alpha.app.
    It 'finishes the release on a rerun after a publish that stopped part way' {
        Reset-Registry -FailOn @('zeta.base')
        { Invoke-Publish $script:Test } | Should -Throw
        # The rerun starts from what the first run left on npm and in origin.
        $global:TestNpmPublishes.Clear()
        Invoke-Publish $script:Test | Out-Null
        foreach ($id in 'zeta.base@1.0.1', 'alpha.app@1.0.1', 'mid.tool@1.0.1') {
            $global:TestNpmRegistry.Contains($id) | Should -BeTrue
        }
        Get-OriginTags $script:Test | Should -Be $script:AllTags
        @($global:TestReleases | Sort-Object -Unique) | Should -HaveCount 3
    }

    It 'releases on a rerun a package whose only change is a dependency the stopped publish released' {
        Reset-Registry -FailOn @('alpha.app')
        { Invoke-Publish $script:Test } | Should -Throw
        Get-OriginTags $script:Test | Should -Be 'mid.tool/1.0.1,zeta.base/1.0.1'
        $global:TestNpmPublishes.Clear()
        Invoke-Publish $script:Test | Out-Null
        @($global:TestNpmPublishes) | Should -Be @('alpha.app@1.0.1')
        Get-OriginTags $script:Test | Should -Be $script:AllTags
    }

    It 'publishes nothing and pushes no tag in a dry run' {
        Reset-Registry
        Invoke-Publish $script:Test -DryRun $true | Out-Null
        $global:TestNpmRegistry.Count | Should -Be 0
        Get-OriginTags $script:Test | Should -Be ''
        @($global:TestReleases) | Should -HaveCount 0
    }
}
