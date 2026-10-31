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
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const FiftyOneDegreesIpIntelligenceOnPremise = require51('fiftyone.ipintelligence.onpremise');

const { getTestDataFile } = require(path.join(__dirname, '/testHelper'));

let pipeline;

beforeAll(() => {
  pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
    .IpIntelligenceOnPremisePipelineBuilder({
      performanceProfile: 'Balanced',
      dataFile: getTestDataFile(),
      shareUsage: false,
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false
    }).build();
});

describe('ipIntelligenceOnPremise value tests', () => {
  // Process a well known public IP address and check that values
  // are returned for the network registration properties that are
  // available in all data file tiers.
  test('known IPv4 address values', async () => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', '8.8.8.8');
    await flowData.process();

    const registeredName = flowData.ip.registeredname;
    expect(registeredName.hasValue).toBe(true);
    expect(typeof registeredName.value).toBe('string');
    expect(registeredName.value.length).toBeGreaterThan(0);

    const registeredCountry = flowData.ip.registeredcountry;
    expect(registeredCountry.hasValue).toBe(true);
    expect(registeredCountry.value).toBe('US');
  });

  // Check that all available properties can be retrieved for an
  // IP address without errors and that values have the expected
  // JavaScript types.
  test('all properties have valid values or a no value message', async () => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', '194.209.0.1');
    await flowData.process();

    const ipEngine = pipeline.getElement('ip');
    for (const [key, property] of Object.entries(ipEngine.properties)) {
      const result = flowData.ip[key];
      expect(result).toBeDefined();
      if (result.hasValue) {
        const value = result.value;
        if (property.type.startsWith('weighted') ||
          property.name.toUpperCase() === 'MCC') {
          expect(Array.isArray(value)).toBe(true);
          for (const item of value) {
            expect(item.value).toBeDefined();
            expect(typeof item.weight).toBe('number');
            expect(item.weight).toBeGreaterThan(0);
            expect(item.weight).toBeLessThanOrEqual(1);
            expect(typeof item.rawWeight).toBe('number');
          }
        } else if (property.type === 'bool') {
          expect(typeof value).toBe('boolean');
        } else if (property.type === 'int' ||
          property.type === 'single' || property.type === 'double') {
          expect(typeof value).toBe('number');
        } else {
          expect(typeof value).toBe('string');
        }
      } else {
        expect(typeof result.noValueMessage).toBe('string');
      }
    }
  });

  // Check that an IPv6 address can be processed without error.
  test('IPv6 address processes without error', async () => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', '2001:4860:4860::8888');
    await flowData.process();

    const registeredName = flowData.ip.registeredname;
    expect(registeredName).toBeDefined();
  });

  // Check that an invalid IP address results in properties with
  // no values rather than an error.
  test('invalid IP address gives no value', async () => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', 'not.an.ip.address');
    await flowData.process();

    const registeredName = flowData.ip.registeredname;
    expect(registeredName.hasValue).toBe(false);
    expect(registeredName.noValueMessage.length).toBeGreaterThan(0);
  });
});
