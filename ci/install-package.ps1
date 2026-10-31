param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

./node/install-package.ps1 -RepoName $RepoName

# The web examples load their engine by a path in 51d.json, which points at the
# source next to them. Point them at the installed package instead, so these
# examples test what was packed.
$examples = @(
    @{ File = 'device-detection-node/fiftyone.devicedetection.onpremise/examples/onpremise/gettingstarted-web/51d.json'; Index = 0; Engine = 'fiftyone.devicedetection.onpremise/deviceDetectionOnPremise' }
    @{ File = 'device-detection-node/fiftyone.devicedetection.cloud/examples/cloud/gettingstarted-web/51d.json'; Index = 1; Engine = 'fiftyone.devicedetection.cloud/deviceDetectionCloud' }
)
foreach ($example in $examples) {
    $path = Join-Path $RepoName $example.File
    $json = Get-Content $path | ConvertFrom-Json
    $json.PipelineOptions.Elements[$example.Index].elementName = "../../../../../node_modules/$($example.Engine)"
    $json | ConvertTo-Json -Depth 10 | Set-Content $path
}
