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

// Runs the base CloudEngine.processInternal against cloud answers where the
// engine's element is missing, which is how the cloud service answers for a
// product the resource key does not include, and where it is null.

const util = require('util');
const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');

// CloudEngine requires its dependencies by package name, so add the folder
// holding the packages to the module lookup paths.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const CloudRequestEngine = require('../cloudRequestEngine');
const CloudEngine = require('../cloudEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));
const coreErrorMessages = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/errorMessages'));
const engineErrorMessages = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.engines/errorMessages'));

const dataKey = 'ip';

// Only sets the data key, so processing is the base class's.
class TestCloudEngine extends CloudEngine {
  constructor () {
    super(...arguments);
    this.dataKey = dataKey;
  }
}

// What the accessibleproperties endpoint gives for a key that carries the
// device product and not the ip one.
const properties = {
  Products: {
    device: {
      DataTier: 'CloudV4Free',
      Properties: [
        { Name: 'IsMobile', Type: 'Boolean', Category: 'Device' }
      ]
    }
  }
};

/**
 * Builds a pipeline whose cloud answer is the JSON given, and collects the
 * errors it logs.
 *
 * @param {object} json the answer from the cloud service
 * @returns {{pipeline: object, errors: string[]}} the pipeline and the
 * errors it has logged so far
 */
function build (json) {
  const pipeline = new PipelineBuilder()
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new MockRequestClient({ properties, json })
    }))
    .add(new TestCloudEngine())
    .build();
  const errors = [];
  pipeline.on('error', (message) => errors.push(String(message)));
  return { pipeline, errors };
}

// Answers the discovery POST a license key alone makes, as well as the
// requests the mock client already answers.
class LicenseKeyClient extends MockRequestClient {
  post (url, data, origin) {
    if (url.toLowerCase().includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify(this.properties));
    }
    return super.post(url, data, origin);
  }
}

/**
 * Builds a pipeline on a license key alone whose cloud answer is the JSON
 * given, and collects the errors it logs.
 *
 * @param {object} json the answer from the cloud service
 * @returns {{pipeline: object, errors: string[]}} the pipeline and the
 * errors it has logged so far
 */
function buildOnLicenseKey (json) {
  const pipeline = new PipelineBuilder()
    .add(new CloudRequestEngine({
      licenseKey: 'LICENSEKEY1234567890',
      requestedProperties: ['device.ismobile'],
      requestClient: new LicenseKeyClient({ properties, json })
    }))
    .add(new TestCloudEngine())
    .build();
  const errors = [];
  pipeline.on('error', (message) => errors.push(String(message)));
  return { pipeline, errors };
}

/**
 * Reads a property and returns what reading it threw.
 *
 * @param {object} flowData processed flow data
 * @param {string} property the property to read
 * @returns {*} the value thrown, or undefined if nothing was
 */
function thrownReading (flowData, property) {
  try {
    flowData.get(dataKey).get(property);
  } catch (e) {
    return e;
  }
  return undefined;
}

const missingPropertyMessage =
  util.format(coreErrorMessages.genericMissingProperties,
    'registeredcountry') +
  ' in data for element "' + dataKey + '".' +
  util.format(engineErrorMessages.cloudNoPropertiesAccess, dataKey);

test('an answer without the element resolves and says the key lacks it',
  async () => {
    const { pipeline, errors } = build({
      device: { ismobile: false },
      javascriptProperties: []
    });
    const flowData = pipeline.createFlowData();

    await flowData.process();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("'" + dataKey + "'");
    expect(errors[0]).toContain('does not include');
    expect(errors[0]).toContain('accessibleproperties?resource=');
    expect(errors[0]).not.toContain('undefined');
    expect(thrownReading(flowData, 'registeredcountry'))
      .toBe(missingPropertyMessage);

    // The key cannot gain the product between requests, so the second
    // request is not reported again.
    await pipeline.createFlowData().process();
    expect(errors).toHaveLength(1);
  });

test('a null element logs the not populated prefix and the reason',
  async () => {
    const reason = 'The reason the cloud service gave.';
    const { pipeline, errors } = build({
      device: { ismobile: false },
      [dataKey]: null,
      [dataKey + 'nullreason']: reason,
      javascriptProperties: []
    });
    const flowData = pipeline.createFlowData();

    await flowData.process();

    expect(errors).toEqual([dataKey + ' not populated. ' + reason]);
    expect(thrownReading(flowData, 'registeredcountry'))
      .toBe(missingPropertyMessage);
  });

test('a null element with no reason logs the fallback text', async () => {
  const { pipeline, errors } = build({
    device: { ismobile: false },
    [dataKey]: null,
    javascriptProperties: []
  });
  const flowData = pipeline.createFlowData();

  await flowData.process();

  expect(errors).toHaveLength(1);
  expect(errors[0].startsWith(dataKey + ' not populated. ')).toBe(true);
  expect(errors[0]).toContain("'" + dataKey + "'");
  expect(errors[0]).not.toContain('undefined');
  expect(thrownReading(flowData, 'registeredcountry'))
    .toBe(missingPropertyMessage);
});

test('an element with values still reads them and logs nothing',
  async () => {
    const { pipeline, errors } = build({
      device: { ismobile: false },
      [dataKey]: {
        registeredcountry: 'GB',
        registeredname: null,
        registerednamenullreason: 'No value for this address.'
      },
      javascriptProperties: []
    });
    const flowData = pipeline.createFlowData();

    await flowData.process();

    expect(errors).toHaveLength(0);
    const registeredCountry = flowData.get(dataKey).get('registeredcountry');
    expect(registeredCountry.hasValue).toBe(true);
    expect(registeredCountry.value).toBe('GB');
    const registeredName = flowData.get(dataKey).get('registeredname');
    expect(registeredName.hasValue).toBe(false);
    expect(registeredName.noValueMessage).toBe('No value for this address.');
  });

// Under a license key alone there is no resource key to name, and a product
// is also left out when requestedProperties names none of its properties.
describe('under a license key alone', () => {
  test('a missing element names the key in use and requestedProperties',
    async () => {
      const { pipeline, errors } = buildOnLicenseKey({
        device: { ismobile: false },
        javascriptProperties: []
      });
      await pipeline.createFlowData().process();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('The key in use does not include');
      expect(errors[0]).toContain("'" + dataKey + "'");
      expect(errors[0]).toContain('requestedProperties');
      expect(errors[0]).not.toContain('resource key');
      expect(errors[0]).not.toContain('undefined');
    });

  test('a null element with no reason names no resource key', async () => {
    const { pipeline, errors } = buildOnLicenseKey({
      device: { ismobile: false },
      [dataKey]: null,
      javascriptProperties: []
    });
    await pipeline.createFlowData().process();

    expect(errors).toHaveLength(1);
    expect(errors[0].startsWith(dataKey + ' not populated. ')).toBe(true);
    expect(errors[0]).toContain('requestedProperties');
    expect(errors[0]).not.toContain('resource key');
    expect(errors[0]).not.toContain('undefined');
  });
});
