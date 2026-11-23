export = HardwareProfileCloudEngine;
declare const HardwareProfileCloudEngine_base: typeof import("fiftyone.pipeline.cloudrequestengine/types/cloudEngine");
/**
 * This Cloud Aspect Engine enables the parsing of 'hardware profile'
 * responses from the 51Degrees cloud service.
 */
declare class HardwareProfileCloudEngine extends HardwareProfileCloudEngine_base {
    /**
     * Adds the hardware profiles in the cloud response as this engine's
     * Element Data.
     *
     * @param {FlowData} flowData The FlowData object
     * @param {object} cloudData the cloud response, parsed from JSON
     */
    setProfiles(flowData: FlowData, cloudData: object): void;
}
declare namespace HardwareProfileCloudEngine {
    export { FlowData };
}
type FlowData = import("fiftyone.pipeline.core/types/flowData");
