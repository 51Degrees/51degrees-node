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

// The environment variable used to get the resource key to use when
// running examples.
const RESOURCE_KEY_ENV_VAR = '_51DEGREES_RESOURCE_KEY';

// Get the resource key from the environment, under the one name it has.
const getResourceKeyFromEnv = function () {
  return process.env[RESOURCE_KEY_ENV_VAR];
};

// The common message shown when a resource key leaves one or more of
// the properties used by an example without values.
const PRICING_MESSAGE = 'Some properties used by this example are not ' +
  'available with a free resource key. See https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-exampleutils.js&utm_term=resource-key-required ' +
  'to get a paid subscription with more properties.';

module.exports = {
  RESOURCE_KEY_ENV_VAR,
  PRICING_MESSAGE,
  getResourceKeyFromEnv
};
