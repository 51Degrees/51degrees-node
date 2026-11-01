export let errorMessages: {
    cacheNotSupport: string;
    evidenceNotFound: string;
    dataFilePathRequired: string;
    fileNotFound: string;
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
        superResourceKeyEnvVar: string;
        ipiResourceKeyEnvVar: string;
        licenseKeyEnvVar: string;
    };
    ipAddresses: {
        switzerlandIpv4: string;
        belgiumIpv4: string;
        austriaIpv4: string;
        googleIpv4: string;
        documentationIpv6: string;
        invalidIp: string;
    };
};
export let keyUtils: {
    getNamedKey: (keyName: string) => string;
    isInvalidKey: (keyValue: string) => boolean;
};
export let exampleConstants: {
    defaultEvidenceValues: Map<string, string>[];
    fileNames: {
        enterpriseDataFileName: string;
        liteDataFileName: string;
        evidenceFileName: string;
        evidenceCsvFileName: string;
    };
};
export let optionsExtension: typeof import("./examples/optionsExtension");
export let dataExtension: typeof import("./examples/dataExtension");
