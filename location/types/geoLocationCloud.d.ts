export = GeoLocationCloud;
declare const GeoLocationCloud_base: typeof import("fiftyone.pipeline.cloudrequestengine/types/cloudEngine");
declare class GeoLocationCloud extends GeoLocationCloud_base {
    /**
     * Constructor for GeoLocationCloud
     *
     * @param {object} options the options for GeoLocationCloud
     * @param {string} options.locationProvider name of location provider
     */
    constructor({ locationProvider }: {
        locationProvider: string;
    }, ...args: any[]);
}
