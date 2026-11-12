export namespace envVars {
    let superResourceKeyEnvVar: string;
    /**
     * @deprecated No test reads a resource key under this name. Use
     * superResourceKeyEnvVar.
     */
    let ipiResourceKeyEnvVar: string;
    /**
     * @deprecated No test reads a licence key under this name. The licence
     * key is read from the _51DEGREES_LICENSE_KEY environment variable.
     */
    let licenseKeyEnvVar: string;
}
export namespace ipAddresses {
    let switzerlandIpv4: string;
    let belgiumIpv4: string;
    let austriaIpv4: string;
    let googleIpv4: string;
    let documentationIpv6: string;
    let invalidIp: string;
}
