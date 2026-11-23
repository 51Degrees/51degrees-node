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
        resourceKeyBespokeEnvVar: string;
        licenseKeyBespokeEnvVar: string;
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
        evidenceFileName: string;
    };
};
export let optionsExtension: typeof import("./lib/optionsExtension");
export let dataExtension: typeof import("./lib/dataExtension");
