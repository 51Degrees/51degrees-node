export = IpIntelligenceCloud;
declare const IpIntelligenceCloud_base: typeof import("fiftyone.pipeline.cloudrequestengine/types/cloudEngine");
/**
 * The IP intelligence cloud engine requires the 51Degrees
 * cloudRequestEngine to be placed in a pipeline before it.
 * It takes that raw JSON response and parses it to extract the
 * IP intelligence part. It also uses this data to generate a list
 * of properties. Properties that have weighted values are returned
 * as arrays of objects with 'value', 'weight' and 'rawWeight' entries,
 * and a WKT value as its text, as the on-premise engine returns them.
 **/
declare class IpIntelligenceCloud extends IpIntelligenceCloud_base {
    /**
     * Reads the IP Intelligence part of the cloud response as the
     * CloudEngine does, then gives each value in the form the on-premise
     * engine gives it.
     *
     * @param {FlowData} flowData the flow data to process
     * @returns {Promise<void>} resolves once the Element Data is set
     */
    processInternal(flowData: FlowData): Promise<void>;
}
declare namespace IpIntelligenceCloud {
    export { FlowData };
}
type FlowData = import("fiftyone.pipeline.core/types/flowData");
