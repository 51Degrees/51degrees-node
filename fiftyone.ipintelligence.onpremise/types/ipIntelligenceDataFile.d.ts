export = IpIntelligenceDataFile;
declare const IpIntelligenceDataFile_base: typeof import("fiftyone.pipeline.engines/types/dataFile");
/**
 * Instance of DataFile class for the IP Intelligence Engine
 * Extends datafile by providing a formatter for the DataFileUpdateService
 * update url which contains the type and licensekeys.
 * These parameters are passed in to the datafile constructor's
 * updateURLParams parameter
 **/
declare class IpIntelligenceDataFile extends IpIntelligenceDataFile_base {
    /**
     * Constructor for IP Intelligence DataFile
     *
     * @param {object} options options for the datafile
     * @param {string} options.useUrlFormatter whether to append default URL params for Data File download
     **/
    constructor({ useUrlFormatter, ...rest }: {
        useUrlFormatter: string;
    });
    useUrlFormatter: string;
}
