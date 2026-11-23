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

// The Element Data of DeviceDetectionOnPremise is read only once it has
// finished. Its values read from the native results are not writes.

const fs = require('fs');
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

const DataFile = path.resolve(__dirname, '../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');
const testWithLite = fs.existsSync(DataFile) ? test : test.skip;

testWithLite('DeviceDetectionOnPremise Element Data is read only once ' +
  'processed', async () => {
  const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
    dataFile: DataFile,
    shareUsage: false,
    autoUpdate: false,
    fileSystemWatcher: false
  }).build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'Mozilla/5.0 (iPhone)');
  await flowData.process();
  expect(flowData.device.ismobile).toBeDefined();
  expect(() => { flowData.device.probe = 1; })
    .toThrow('has finished processing');
});
