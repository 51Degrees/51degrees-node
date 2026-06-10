param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packages = "fiftyone.ipintelligence", "fiftyone.ipintelligence.cloud", "fiftyone.ipintelligence.onpremise", "fiftyone.ipintelligence.shared"

./node/update-packages.ps1 -RepoName $RepoName -Packages $packages

exit $LASTEXITCODE
