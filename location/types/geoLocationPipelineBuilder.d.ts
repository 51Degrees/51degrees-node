export = GeoLocationPipelineBuilder;
declare const GeoLocationPipelineBuilder_base: typeof import("fiftyone.pipeline.core/types/pipelineBuilder");
declare class GeoLocationPipelineBuilder extends GeoLocationPipelineBuilder_base {
    /**
       * Extension of pipelineBuilder class that allows for the quick generation of a geo-location pipeline. Adds share usage, caching with simple paramater changes
       * @param {Object} options
       * @param {Boolean} options.shareUsage // include share usage element?
       * @param {String} options.resourceKey // resourceKey for cloud
       * @param {String} options.licenceKeys // license key for cloud, beside
       * a resourceKey or on its own
       * @param {Array<string>|string} options.requestedProperties // the
       * fully qualified names of the properties to ask the cloud service for.
       * Required with a license key and no resource key.
       * @param {String} options.locationProvider // the provider to request data from. Either "fiftyonedegrees" or "digitalelement".
       * @param {string} options.cloudRequestOrigin The value to set the
       * Origin header to when making requests to the cloud service
       * @param {string} options.baseURL base URL for cloud request
       *
      */
    constructor({ shareUsage, resourceKey, licenceKeys, requestedProperties, locationProvider, baseURL, cloudRequestOrigin }: {
        shareUsage: boolean;
        resourceKey: string;
        licenceKeys: string;
        requestedProperties: Array<string> | string;
        locationProvider: string;
        cloudRequestOrigin: string;
        baseURL: string;
    }, ...args: any[]);
}
