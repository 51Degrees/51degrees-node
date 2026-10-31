param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packages = "."

./node/update-packages.ps1 -RepoName $RepoName -Packages $packages

exit $LASTEXITCODE