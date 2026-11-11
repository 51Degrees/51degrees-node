/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

module.exports = {
  // Environment variables name for testing
  envVars: {
    superResourceKeyEnvVar: '_51DEGREES_RESOURCE_KEY_SUPER'
  },
  // IP addresses for testing
  ipAddresses: {
    // An IPv4 address allocated in Switzerland.
    switzerlandIpv4: '194.209.0.1',
    // An IPv4 address allocated in Belgium.
    belgiumIpv4: '91.183.0.1',
    // An IPv4 address allocated in Austria.
    austriaIpv4: '77.119.0.1',
    // A Google public DNS IPv4 address.
    googleIpv4: '8.8.8.8',
    // An IPv6 documentation address.
    documentationIpv6: '2001:0db8:085a:0000:0000:8a2e:0370:7334',
    // An invalid IP address.
    invalidIp: 'not.an.ip.address'
  }
};
