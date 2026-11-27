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
const util = require('util');

const example = require(path.join(__dirname, '/tacLookup.js'));

const shared = require51('fiftyone.devicedetection.shared');
const tc = shared.testConstants;
const keyUtils = shared.keyUtils;
const ExampleOutput = shared.exampleOutput.ExampleOutput;

const OptionsExtension = shared.optionsExtension;

const { checkHardwareLookupOutput } = require(
  path.join(__dirname, '..', '..', '..', 'tests', 'hardwareLookupOutput.js'));

describe('Examples', () => {
  test('cloud tac lookup', async () => {
    const resourceKey = keyUtils.getResourceKey(
      tc.envVars.resourceKeyBespokeEnvVar);

    if (!resourceKey) {
      // The message names the variable that was wanted, so whoever reads
      // the run knows what to set.
      throw new Error(keyUtils.missingResourceKeyMessage(
        tc.envVars.resourceKeyBespokeEnvVar));
    }

    // Load the configuration from a config file to a JSON object.
    const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')), 'utf8');
    OptionsExtension.updateElementPath(options, __dirname);
    OptionsExtension.setResourceKey(options, resourceKey);

    const output = new ExampleOutput();

    // The example logs pipeline errors to the console, so those are kept
    // with what it writes. The spy still calls through.
    const spy = jest.spyOn(console, 'error');
    let logged = '';
    try {
      await example.run(options, output);
    } finally {
      logged = spy.mock.calls
        .map((args) => util.format(...args) + '\n').join('');
      spy.mockRestore();
    }
    const printed = output.text() + logged;

    checkHardwareLookupOutput(printed, {
      keyName: tc.envVars.resourceKeyBespokeEnvVar,
      name: 'TAC lookup',
      subject: 'TAC',
      values: ['35925406', '86386802']
    });

    // Nothing it printed may read as a programming fault.
    expect(output.faults()).toEqual([]);
  });
});
