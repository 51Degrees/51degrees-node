# Shared by the scripts in this folder, which dot-source them. Paths are
# relative to the repository root. The packages published to npm, their
# folders and their dependencies are in packages.json.

# Modules with a native extension. The name differs per product, which is why
# common-ci's own node/build-extension.ps1 cannot be used.
$NativePackages = @(
    @{ Path = 'device-detection/fiftyone.devicedetection.onpremise'; Module = 'FiftyOneDeviceDetectionHashV4' }
    @{ Path = 'ip-intelligence/fiftyone.ipintelligence.onpremise'; Module = 'FiftyOneIpIntelligenceIpiV41' }
)
