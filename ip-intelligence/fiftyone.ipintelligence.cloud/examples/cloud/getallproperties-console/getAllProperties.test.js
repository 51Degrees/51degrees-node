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

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const fs = require('fs');

const example = require(path.join(__dirname, '/getAllProperties.js'));

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));

const shared = require51('fiftyone.ipintelligence.shared');
const tc = shared.testConstants;
const keyUtils = shared.keyUtils;
const ExampleOutput = shared.exampleOutput.ExampleOutput;
const OptionsExtension = shared.optionsExtension;
const CloudRequestEngine =
  require51('fiftyone.pipeline.cloudrequestengine').CloudRequestEngine;

const resourceKeyNames = keyUtils.resourceKeyNames(
  tc.envVars.superResourceKeyVariable,
  ExampleUtils.RESOURCE_KEY_VARIABLE);

describe('Examples', () => {
  test('cloud get all properties', async () => {
    const resourceKey = keyUtils.getResourceKey(resourceKeyNames);
    if (!resourceKey) {
      throw new Error(keyUtils.missingResourceKeyMessage(resourceKeyNames,
        'ip', 'every IP Intelligence property of 8.8.8.8'));
    }
    await keyUtils.requireProduct(
      new CloudRequestEngine({ resourceKey }), 'ip');

    // Load the configuration from a config file to a JSON object.
    const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')), 'utf8');
    OptionsExtension.updateElementPath(options, __dirname);
    OptionsExtension.setResourceKey(options, resourceKey);

    const output = new ExampleOutput();

    await example.run(options, output);

    // The example prints one line per property. 8.8.8.8 is registered to
    // Google in the United States.
    expect(output.text()).toContain(
      "What property values are associated with the IP '8.8.8.8'?");
    expect(output.lines()).toContain('registeredcountry = US');
    expect(output.faults()).toEqual([]);
  });
});
