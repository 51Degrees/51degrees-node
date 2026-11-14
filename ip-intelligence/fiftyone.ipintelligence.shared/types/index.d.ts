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
        superResourceKeyVariable: string;
        /**
         * @deprecated The name the variable had before, which is read only
         * when the variable superResourceKeyVariable names is unset or empty.
         * Use superResourceKeyVariable.
         */
        superResourceKeyEnvVar: string;
        /**
         * @deprecated No test reads a resource key under this name. Use
         * superResourceKeyVariable.
         */
        ipiResourceKeyEnvVar: string;
        /**
         * @deprecated No test reads a licence key under this name. The licence
         * key is read from the _51DEGREES_LICENSE_KEY environment variable.
         */
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
    resourceKeyNames: (...extraNames: string[]) => Array<string>;
    getResourceKey: (names: Array<string>) => string;
    missingResourceKeyMessage: (names: Array<string>, products: string | Array<string>, asksFor: string, plural?: boolean) => string;
    missingFromAnswerMessage: (thing: string, reason: string, product: string) => string;
    requireProduct: (cloudRequestEngine: object, product: string) => Promise<void>;
    getNamedKey: (keyName: string) => string;
    isInvalidKey: (keyValue: string) => boolean;
};
export let exampleOutput: typeof import("./lib/exampleOutput");
export let exampleConstants: {
    defaultEvidenceValues: Map<string, string>[];
    fileNames: {
        enterpriseDataFileName: string;
        liteDataFileName: string;
        evidenceFileName: string;
        evidenceCsvFileName: string;
    };
};
export let optionsExtension: typeof import("./lib/optionsExtension");
export let dataExtension: typeof import("./lib/dataExtension");
