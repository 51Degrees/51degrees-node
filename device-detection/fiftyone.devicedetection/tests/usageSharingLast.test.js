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

// The builder puts the usage sharing element after every other Flow Element,
// including one the caller adds after making the builder, whether the
// Pipeline is on-premise or cloud.

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const { DeviceDetectionPipelineBuilder } = require51('fiftyone.devicedetection');
const { FlowElement } = require51('fiftyone.pipeline.core');
const { ShareUsage } = require51('fiftyone.pipeline.engines.fiftyone');
const RequestClient = require51(
  'fiftyone.pipeline.cloudrequestengine/requestClient');

const LiteDataFile = path.resolve(
  process.env.directory || __dirname,
  '../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');
const testWithLite = fs.existsSync(LiteDataFile) ? test : test.skip;

const later = () => new FlowElement({ dataKey: 'later' });

const lastOf = (pipeline) =>
  pipeline.flowElementsChain[pipeline.flowElementsChain.length - 1];

describe('DeviceDetectionPipelineBuilder usage sharing', () => {
  testWithLite('is last in an on-premise Pipeline', () => {
    const pipeline = new DeviceDetectionPipelineBuilder({
      dataFile: LiteDataFile,
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false
    }).add(later()).build();
    expect(lastOf(pipeline)).toBeInstanceOf(ShareUsage);
    expect(pipeline.flowElementsChain.flat()
      .filter((slot) => slot instanceof ShareUsage)).toHaveLength(1);
  });

  test('is last in a cloud Pipeline', () => {
    // The cloud service is not asked, as the test needs only the Pipeline.
    const get = jest.spyOn(RequestClient.prototype, 'get')
      .mockReturnValue(new Promise(() => {}));
    try {
      const pipeline = new DeviceDetectionPipelineBuilder({
        resourceKey: 'AAAAAAAAAAAA'
      }).add(later()).build();
      expect(lastOf(pipeline)).toBeInstanceOf(ShareUsage);
    } finally {
      get.mockRestore();
    }
  });
});
