# Shared by the scripts in this folder, which dot-source them. Paths are
# relative to the repository root.

# Modules with a native extension. The name differs per product, which is why
# common-ci's own node/build-extension.ps1 cannot be used.
$NativePackages = @(
    @{ Path = 'device-detection-node/fiftyone.devicedetection.onpremise'; Module = 'FiftyOneDeviceDetectionHashV4' }
    @{ Path = 'ip-intelligence-node/fiftyone.ipintelligence.onpremise'; Module = 'FiftyOneIpIntelligenceIpiV41' }
)

# ip-intelligence-node has never been published to npm, so its packages are not
# listed here. Adding them is a release decision, not a build change.
$PublishedPackages = @(
    'pipeline-node/fiftyone.pipeline.core'
    'pipeline-node/fiftyone.pipeline.engines'
    'pipeline-node/fiftyone.pipeline.engines.fiftyone'
    'pipeline-node/fiftyone.pipeline.cloudrequestengine'
    'pipeline-node/fiftyone.pipeline.did'
    'pipeline-node/fiftyone.pipeline.translation'
    'device-detection-node/fiftyone.devicedetection'
    'device-detection-node/fiftyone.devicedetection.cloud'
    'device-detection-node/fiftyone.devicedetection.onpremise'
    'device-detection-node/fiftyone.devicedetection.shared'
    'location-node'
)
