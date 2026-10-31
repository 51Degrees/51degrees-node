param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

./node/build-package-npm.ps1 -RepoName $RepoName

exit $LASTEXITCODE