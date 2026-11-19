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

// The on-premise engine's Element Data is Aspect Data, as
// device-detection-specification/data-model.md line 10 asks, and gives a
// Property by name as an AspectPropertyValue, as the cloud engine's does
// (cloud-aspect-engine.md line 24).

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const { AspectPropertyValue } = require51('fiftyone.pipeline.core');
const { AspectData } = require51('fiftyone.pipeline.engines');
const Builder = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremisePipelineBuilder;

const LITE = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection', '51Degrees-LiteV4.1.hash');
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 ' +
  'Safari/604.1';
const TIMEOUT_MS = 300000;

test('the on-premise Element Data is Aspect Data of AspectPropertyValues',
  async () => {
    if (!fs.existsSync(LITE)) {
      throw new Error(`No data file at '${LITE}'.`);
    }
    const pipeline = new Builder({
      dataFile: LITE,
      autoUpdate: false,
      fileSystemWatcher: false,
      shareUsage: false,
      licenceKeys: ''
    }).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', USER_AGENT);
    await flowData.process();

    const device = flowData.get('device');
    expect(device).toBeInstanceOf(AspectData);
    const isMobile = device.get('ismobile');
    expect(isMobile).toBeInstanceOf(AspectPropertyValue);
    expect(isMobile.hasValue).toBe(true);
    expect(isMobile.value).toBe(true);
  }, TIMEOUT_MS);
