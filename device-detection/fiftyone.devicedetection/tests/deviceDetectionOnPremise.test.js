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

const fs = require('fs');

const FiftyOneDegreesDeviceDetection = require51('fiftyone.devicedetection');
const DataFile = 'test.hash';
const LiteDataFile = path.resolve(
  process.env.directory || __dirname,
  '../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');

const MobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) ' +
  'AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile' +
  '/11D167 Safari/9537.53';

const haveLiteDataFile = fs.existsSync(LiteDataFile);
if (!haveLiteDataFile) {
  console.warn(
    'The update matched User-Agent test is skipped because the free Lite ' +
    `data file is not at ${LiteDataFile}. Run cxx/data/get-data-files.sh ` +
    'or cxx/data/get-data-files.ps1 to download it.');
}
const testWithLite = haveLiteDataFile ? test : test.skip;

describe('deviceDetectionOnPremise', () => {
  // The matched characters of the User-Agent are recorded unless the
  // option turns them off. A UserAgents value has the User-Agent's
  // character where it was matched and an underscore where it was not.
  testWithLite('a builder left at its defaults returns the matched ' +
    'characters of the User-Agent', async () => {
    const pipeline = new FiftyOneDegreesDeviceDetection
      .DeviceDetectionPipelineBuilder({
        dataFile: LiteDataFile,
        licenceKeys: '',
        autoUpdate: false,
        updateOnStart: false,
        fileSystemWatcher: false,
        shareUsage: false
      }).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', MobileUserAgent);
    await flowData.process();
    const userAgents = flowData.device.userAgents;
    expect(userAgents.hasValue).toBe(true);
    let matched = 0;
    for (const value of userAgents.value) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== '_') {
          expect(value[i]).toBe(MobileUserAgent[i]);
          matched++;
        }
      }
    }
    expect(matched).toBeGreaterThan(0);
  });

  // Check that setting cache for on-premise engine builder will
  // throw exception
  test('No cache support for on-premise engine', done => {
    try {
      new FiftyOneDegreesDeviceDetection
        .DeviceDetectionPipelineBuilder({
          dataFile: DataFile,
          cacheSize: 100
        }).build();
    } catch (err) {
      expect(err.indexOf('cache cannot be configured') !== -1).toBe(true);

      done();
    }
  });
});
