export namespace envVars {
    let resourceKeyEnvVar: string;
    let superResourceKeyEnvVar: string;
    let platformResourceKeyEnvVar: string;
    let hardwareResourceKeyEnvVar: string;
    let browserResourceKeyEnvVar: string;
    let noSetHeaderResourceKeyEnvVar: string;
    /**
     * @deprecated No test reads a licence key under this name. The licence
     * key is read from the _51DEGREES_LICENSE_KEY environment variable.
     */
    let licenseKeyEnvVar: string;
}
/**
 * @deprecated The name each of envVars replaced. An old name is read only
 * when the name that replaced it is unset or empty. Use envVars.
 */
export namespace legacyEnvVars {
    let _51DEGREES_RESOURCE_KEY: string;
    let _51DEGREES_RESOURCE_KEY_SUPER: string;
    let _51DEGREES_RESOURCE_KEY_PLATFORM: string;
    let _51DEGREES_RESOURCE_KEY_HARDWARE: string;
    let _51DEGREES_RESOURCE_KEY_BROWSER: string;
    let _51DEGREES_RESOURCE_KEY_NO_SETHEADER: string;
}
export namespace userAgents {
    let chromeUA: string;
    let edgeUA: string;
    let firefoxUA: string;
    let safariUA: string;
    let curlUA: string;
}
