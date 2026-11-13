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
    return require(path.join(__dirname, '/../../../../node_modules/', requestedPackage));
  } catch (e) {
    try {
      return require(requestedPackage);
    } catch (e2) {
      return require(requestedPackage);
    }
  }
};

const request = require('supertest');

const fs = require('fs');

// Load the example module
const example = require(path.join(__dirname, '/gettingStarted.js'));

const ExampleUtils = require(path.join(__dirname, '/../../exampleUtils'));

const shared = require51('fiftyone.ipintelligence.shared');
const tc = shared.testConstants;
const keyUtils = shared.keyUtils;
const OptionsExtension = shared.optionsExtension;
const CloudRequestEngine =
  require51('fiftyone.pipeline.cloudrequestengine').CloudRequestEngine;

const resourceKeyNames = keyUtils.resourceKeyNames(
  tc.envVars.superResourceKeyVariable,
  ExampleUtils.RESOURCE_KEY_VARIABLE);

describe('Examples', () => {
  test('cloud mixed getting started web', async () => {
    const resourceKey = keyUtils.getResourceKey(resourceKeyNames);
    if (!resourceKey) {
      throw new Error(keyUtils.missingResourceKeyMessage(resourceKeyNames,
        ['ip', 'device'], 'IP Intelligence and device detection ' +
        'properties of the request'));
    }
    const cloud = new CloudRequestEngine({ resourceKey });
    await keyUtils.requireProduct(cloud, 'ip');
    await keyUtils.requireProduct(cloud, 'device');

    // Load configuration options
    const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

    // Update element path with a full path
    OptionsExtension.updateElementPath(options, __dirname);

    OptionsExtension.setResourceKey(options, resourceKey);

    example.setPipeline(options);
    const response = await request(example.server)
      .get('/?client-ip=8.8.8.8');
    expect(response.statusCode).toBe(200);
  });
});
