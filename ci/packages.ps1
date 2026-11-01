# Shared by the scripts in this folder, which dot-source them. Paths are
# relative to the repository root.

# Modules with a native extension. The name differs per product, which is why
# common-ci's own node/build-extension.ps1 cannot be used.
$NativePackages = @(
    @{ Path = 'device-detection/fiftyone.devicedetection.onpremise'; Module = 'FiftyOneDeviceDetectionHashV4' }
    @{ Path = 'ip-intelligence/fiftyone.ipintelligence.onpremise'; Module = 'FiftyOneIpIntelligenceIpiV41' }
)

# ip-intelligence has never been published to npm, so its packages are not
# listed here. Adding them is a release decision, not a build change.
$PublishedPackages = @(
    'pipeline/fiftyone.pipeline.core'
    'pipeline/fiftyone.pipeline.engines'
    'pipeline/fiftyone.pipeline.engines.fiftyone'
    'pipeline/fiftyone.pipeline.cloudrequestengine'
    'pipeline/fiftyone.pipeline.did'
    'pipeline/fiftyone.pipeline.translation'
    'device-detection/fiftyone.devicedetection'
    'device-detection/fiftyone.devicedetection.cloud'
    'device-detection/fiftyone.devicedetection.onpremise'
    'device-detection/fiftyone.devicedetection.shared'
    'location'
)
