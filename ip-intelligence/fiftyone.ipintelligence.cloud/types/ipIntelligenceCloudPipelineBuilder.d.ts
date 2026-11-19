export = IpIntelligenceCloudPipelineBuilder;
declare const IpIntelligenceCloudPipelineBuilder_base: typeof import("fiftyone.pipeline.core/types/pipelineBuilder");
/**
 * Extension of pipelineBuilder class that allows for the quick
 * generation of an IP intelligence cloud pipeline. Adds share usage,
 * caching.
 */
declare class IpIntelligenceCloudPipelineBuilder extends IpIntelligenceCloudPipelineBuilder_base {
    /**
     * Constructor for IpIntelligenceCloudPipelineBuilder
     *
     * @param {object} options the options for the pipeline builder
     * @param {string} options.licenceKeys license key(s) used by the
     * data file update service. A key can be obtained from the
     * 51Degrees website: https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-ipintelligencecloudpipelinebuilder.js&utm_term=constructor.
     * This parameter MUST be set when using a data file.
     * If you do not wish to use a key then you can specify
     * an empty string, but this will cause automatic updates
     * to be disabled.
     * @param {Array<string>|string} options.requestedProperties the fully
     * qualified names of the properties to ask the cloud service for, such
     * as ip.registeredcountry. Required with a license key and no resource key.
     * @param {string} options.resourceKey resourceKey
     * @param {number} options.cacheSize size of the default cache
     * (includes cache if set).
     * @param {string} options.cloudEndPoint Choose a non default endpoint
     * for the cloud request engine
     * @param {string} options.cloudRequestOrigin The value to set the
     * Origin header to when making requests to the cloud service
     */
    constructor({ licenceKeys, resourceKey, requestedProperties, cacheSize, cloudEndPoint, cloudRequestOrigin }: {
        licenceKeys: string;
        requestedProperties: Array<string> | string;
        resourceKey: string;
        cacheSize: number;
        cloudEndPoint: string;
        cloudRequestOrigin: string;
    }, ...args: any[]);
}
