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

// evidence.md line 10: "Keys MUST be case-insensitive". The native evidence
// matches a key's prefix with case, so a key spelled in another case must
// still reach the native engine. Checked against a real data file.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const DeviceDetectionOnPremisePipelineBuilder = require51(
  'fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;
const testHelper = require('./testHelper');

const dataFile = testHelper.getDataFilePath(testHelper.liteDataFileName);
const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537' +
  '.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D167 Safari/9537.53';

const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
  dataFile,
  licenceKeys: '',
  autoUpdate: false,
  shareUsage: false
}).build();

const isMobile = async (key) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add(key, mobileUserAgent);
  await flowData.process();
  return flowData.device.ismobile;
};

test.each(['Header.User-Agent', 'HEADER.USER-AGENT', 'Query.User-Agent'])(
  'the key %p reaches the native engine', async (key) => {
    const expected = await isMobile(key.toLowerCase());
    const actual = await isMobile(key);
    expect(expected.hasValue).toBe(true);
    expect(actual.hasValue).toBe(true);
    expect(actual.value).toBe(expected.value);
  });
