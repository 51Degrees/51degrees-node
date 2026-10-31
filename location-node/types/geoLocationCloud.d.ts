export = GeoLocationCloud;
declare class GeoLocationCloud {
    /**
     * Constructor for GeoLocationCloud
     *
     * @param {object} options the options for GeoLocationCloud
     * @param {string} options.locationProvider name of location provider
     */
    constructor({ locationProvider }: {
        locationProvider: string;
    }, ...args: any[]);
    dataKey: string;
}
