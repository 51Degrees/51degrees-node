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

const request = require('supertest');
// Test constants
const tc = require51('fiftyone.devicedetection.shared').testConstants;

const keyUtils = require51('fiftyone.devicedetection.shared').keyUtils;

const DeviceDetectionCloudPipelineBuilder =
  require51('fiftyone.devicedetection.cloud').DeviceDetectionCloudPipelineBuilder;

// Load the example module
const example = require(path.join(__dirname, '/userAgentClientHintsWeb.js'));

// Each case runs the example with one key. A case whose key is not set is
// skipped, and its name and a warning say which variable to set.
//
// The cases for a single Accept-CH header use the cloud licence with
// values= naming only the one property each needs, with its component, so
// the answer carries that SetHeader property and no other. The 'none' case
// asks for a property that needs no client hint, so the answer carries no
// SetHeader property, and the test checks that the property came back, so
// a call the cloud refused cannot pass for one that set no header.
const cases = [
  ['All available properties',
    {
      keyEnvVar: tc.envVars.superResourceKeyEnvVar,
      userAgents: [
        tc.userAgents.chromeUA,
        tc.userAgents.edgeUA
      ]
    },
    ['Sec-CH-UA-Model',
      'Sec-CH-UA-Platform',
      'Sec-CH-UA']
  ],
  ['SetHeaderPlatformAccept-CH',
    {
      keyEnvVar: tc.envVars.licenseKeyBespokeEnvVar,
      requestedProperties: ['device.SetHeaderPlatformAccept-CH'],
      userAgents: [
        tc.userAgents.chromeUA,
        tc.userAgents.edgeUA
      ]
    },
    ['Sec-CH-UA-Platform']
  ],
  ['SetHeaderHardwareAccept-CH',
    {
      keyEnvVar: tc.envVars.licenseKeyBespokeEnvVar,
      requestedProperties: ['device.SetHeaderHardwareAccept-CH'],
      userAgents: [
        tc.userAgents.chromeUA,
        tc.userAgents.edgeUA
      ]
    },
    ['Sec-CH-UA-Model']
  ],
  ['SetHeaderBrowserAccept-CH',
    {
      keyEnvVar: tc.envVars.licenseKeyBespokeEnvVar,
      requestedProperties: ['device.SetHeaderBrowserAccept-CH'],
      userAgents: [
        tc.userAgents.chromeUA,
        tc.userAgents.edgeUA
      ]
    },
    ['Sec-CH-UA']
  ],
  ['No SetHeader properties',
    {
      keyEnvVar: tc.envVars.licenseKeyBespokeEnvVar,
      requestedProperties: ['device.IsMobile'],
      checkedProperty: 'ismobile',
      userAgents: [
        tc.userAgents.chromeUA,
        tc.userAgents.edgeUA
      ]
    },
    null
  ],
  ['No UACH supports',
    {
      keyEnvVar: tc.envVars.superResourceKeyEnvVar,
      userAgents: [
        tc.userAgents.firefoxUA,
        tc.userAgents.safariUA,
        tc.userAgents.curlUA
      ]
    },
    null
  ]
];

// The key a case needs, or undefined when its variable is not set.
const keyFor = (testData) => keyUtils.getResourceKey(testData.keyEnvVar);

// The pipeline options for a case: a resource key on its own, or the
// licence with the properties it asks for.
const optionsFor = (testData, key) => testData.requestedProperties
  ? { licenceKeys: key, requestedProperties: testData.requestedProperties }
  : { resourceKey: key };

describe('Examples', () => {
  for (const [name, testData, expectedValues] of cases) {
    const key = keyFor(testData);
    const run = key ? test : test.skip;
    const title = 'hash user agent client hints web - ' + name +
      (key ? '' : ` (skipped: '${testData.keyEnvVar}' is not set)`);
    if (!key) {
      console.warn(`Skipping '${name}': set the environment variable ` +
        `'${testData.keyEnvVar}' to run it.`);
    }

    run(title, async () => {
      const options = optionsFor(testData, key);

      // Loop through the test user agents
      for (const ua of testData.userAgents) {
        example.setPipeline(options.resourceKey || null, options);
        const response = await request(example.server)
          .get('/')
          .set('User-Agent', ua);
        const resVal = response.headers['accept-ch'];
        if (expectedValues === null) {
          expect(resVal).toBeUndefined();
        } else {
          expect(resVal).toBeDefined();
          // Get the list of items in the header value
          const vals = resVal.split(',').map((i) => i.trim());
          // Each expected value is in the header.
          expectedValues.forEach((v) => {
            expect(vals).toContain(v);
          });
        }

        if (testData.checkedProperty) {
          // The property asked for came back, so the cloud answered.
          const pipeline = new DeviceDetectionCloudPipelineBuilder(
            options).build();
          const flowData = pipeline.createFlowData();
          flowData.evidence.add('header.user-agent', ua);
          await flowData.process();
          expect(flowData.device[testData.checkedProperty].hasValue)
            .toBe(true);
        }
      }
    }, 10000);
  }
});
