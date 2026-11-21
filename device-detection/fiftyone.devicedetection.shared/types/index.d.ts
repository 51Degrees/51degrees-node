export let errorMessages: {
    cacheNotSupport: string;
    evidenceNotFound: string;
    dataFilePathRequired: string;
    fileNotFound: string;
    fileNotFoundNotDownloaded: string;
    moduleDirNotFound: string;
    nativeModuleNotFound: string;
    invalidFileExtension: string;
    /**
     * @deprecated No longer thrown. The engines throw
     * licenseKeyRequiredForUpdates, which names the options that need a key.
     */
    licenseKeyRequired: string;
    licenseKeyRequiredForUpdates: string;
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
        licenseKeyBespokeEnvVar: string;
        licenseKeyEnvVar: string;
    };
    legacyEnvVars: {
        _51DEGREES_RESOURCE_KEY: string;
        _51DEGREES_RESOURCE_KEY_SUPER: string;
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
