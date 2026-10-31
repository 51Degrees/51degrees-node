param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

./node/setup-environment.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}



