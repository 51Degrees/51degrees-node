export let errorMessages: {
    cacheNotSupport: string;
    evidenceNotFound: string;
    dataFilePathRequired: string;
    fileNotFound: string;
    fileNotFoundNotDownloaded: string;
    moduleDirNotFound: string;
    nativeModuleNotFound: string;
    invalidFileExtension: string;
    licenseKeyRequired: string;
    invalidPerformanceProfile: string;
    propertyKeyDataFiles: string;
    propertyNotFound: string;
    badDataUnsupportedVersion: string;
    badDataIncorrectFormat: string;
};
export let testConstants: {
    envVars: {
        resourceKeyEnvVar: string;
        superResourceKeyEnvVar: string;
        platformResourceKeyEnvVar: string;
        hardwareResourceKeyEnvVar: string;
        browserResourceKeyEnvVar: string;
        noSetHeaderResourceKeyEnvVar: string;
        /**
         * @deprecated No test reads a licence key under this name. The licence
         * key is read from the _51DEGREES_LICENSE_KEY environment variable.
         */
        licenseKeyEnvVar: string;
    };
    /**
     * @deprecated The name each of envVars replaced. An old name is read only
     * when the name that replaced it is unset or empty. Use envVars.
     */
    legacyEnvVars: {
        _51DEGREES_RESOURCE_KEY: string;
        _51DEGREES_RESOURCE_KEY_SUPER: string;
        _51DEGREES_RESOURCE_KEY_PLATFORM: string;
        _51DEGREES_RESOURCE_KEY_HARDWARE: string;
        _51DEGREES_RESOURCE_KEY_BROWSER: string;
        _51DEGREES_RESOURCE_KEY_NO_SETHEADER: string;
    };
    userAgents: {
        chromeUA: string;
        edgeUA: string;
        firefoxUA: string;
        safariUA: string;
        curlUA: string;
    };
};
export let keyUtils: {
    getNamedKey: (keyName: string) => string;
    getResourceKey: (envVarName: string) => string;
    missingResourceKeyMessage: (envVarName: string) => string;
    isInvalidKey: (keyValue: string) => boolean;
};
export let exampleOutput: typeof import("./lib/exampleOutput");
export let exampleConstants: {
    defaultEvidenceValues: Map<string, string>[];
    fileNames: {
        enterpriseDataFileName: string;
        liteDataFileName: string;
        uaFileName: string;
        evidenceFileName: string;
    };
};
export let optionsExtension: typeof import("./lib/optionsExtension");
export let dataExtension: typeof import("./lib/dataExtension");
