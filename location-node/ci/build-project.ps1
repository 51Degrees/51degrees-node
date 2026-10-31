param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packages = ".";

Push-Location $RepoName

Remove-Item -Path ./package-lock.json -Force

Pop-Location

./node/build-project.ps1 -RepoName $RepoName -Packages $packages

exit $LASTEXITCODE