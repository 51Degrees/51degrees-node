export = IpIntelligenceCloud;
declare const IpIntelligenceCloud_base: typeof import("fiftyone.pipeline.cloudrequestengine/types/cloudEngine");
/**
 * The IP intelligence cloud engine requires the 51Degrees
 * cloudRequestEngine to be placed in a pipeline before it.
 * It takes that raw JSON response and parses it to extract the
 * IP intelligence part. It also uses this data to generate a list
 * of properties. Properties that have weighted values are returned
 * as arrays of objects with 'value' and 'weight' entries.
 **/
declare class IpIntelligenceCloud extends IpIntelligenceCloud_base {
}
