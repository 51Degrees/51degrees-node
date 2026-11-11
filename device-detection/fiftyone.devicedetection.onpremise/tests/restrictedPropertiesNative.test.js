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


// An engine built with names in the data set's own spelling gives each
// property under its lower case key, because the pipeline compares property
// names ignoring case. Checked against the native engine and a real data
// file.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const EngineBuilder = require51(
  'fiftyone.devicedetection.onpremise').DeviceDetectionOnPremise;
const testHelper = require('./testHelper');

const dataFile = testHelper.getDataFilePath(testHelper.liteDataFileName);
const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537' +
  '.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D167 Safari/9537.53';

const build = (restrictedProperties) => new EngineBuilder({
  dataFilePath: dataFile,
  licenceKeys: '',
  autoUpdate: false,
  restrictedProperties
});

// Processes one User-Agent and gives back the Flow Data. The Element Data
// throws for a property it does not hold, `then` included, so it is read
// from the Flow Data after the wait rather than given to a promise.
const processed = async (engine) => {
  const pipeline = new core.PipelineBuilder().add(engine).build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', mobileUserAgent);
  await flowData.process();
  return flowData;
};

// What a caller sees of a value, whether or not it has one.
const shown = (value) => value === undefined
  ? 'missing'
  : (value.hasValue
      ? 'value: ' + String(value.value)
      : 'no value: ' + value.noValueMessage);

describe('restricted property names with the native engine', () => {
  test('a read by name and a typed read give the same value', async () => {
    const data = (await processed(
      build(['IsMobile', 'BrowserName', 'PlatformName']))).device;
    const byName = data.get('ismobile');
    const typed = data.ismobile;
    expect(shown(typed)).toBe(shown(byName));
    // Both agree with the native engine asked by name directly.
    expect(String(byName.value))
      .toBe(String(data.swigResults.getValueAsBool('IsMobile').getValue()));
  });
});
