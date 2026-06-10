param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# List of packages for build
$packages = "fiftyone.ipintelligence", "fiftyone.ipintelligence.cloud", "fiftyone.ipintelligence.onpremise", "fiftyone.ipintelligence.shared"

# List of packages which does not use remote package.json
$noRemote = "fiftyone.ipintelligence.shared"

# Creating build folder inside of specific package
New-Item -ItemType Directory -Path "$RepoName/fiftyone.ipintelligence.onpremise/build" -Force | Out-Null

# Copying all binaries to package build folder
Copy-Item -Path "./package-files/*/*.node" -Destination "$RepoName/fiftyone.ipintelligence.onpremise/build" -Recurse

./node/build-package-npm.ps1 -RepoName $RepoName -Packages $packages -NoRemote $noRemote -Version $Version

exit $LASTEXITCODE
