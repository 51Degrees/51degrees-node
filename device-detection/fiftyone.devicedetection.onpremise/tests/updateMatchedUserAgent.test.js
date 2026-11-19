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

// Recording the matched characters of the User-Agent, which the UserAgents
// property returns, is on unless it is turned off.

const path = require('path');
const fs = require('fs');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const PipelineBuilder = require51('fiftyone.pipeline.core').PipelineBuilder;
const {
  DeviceDetectionOnPremise,
  DeviceDetectionOnPremisePipelineBuilder
} = require51('fiftyone.devicedetection.onpremise');

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
    'The update matched User-Agent tests are skipped because the free ' +
    `Lite data file is not at ${LiteDataFile}. Run ` +
    'cxx/data/get-data-files.sh or cxx/data/get-data-files.ps1 to ' +
    'download it.');
}
const describeWithLite = haveLiteDataFile ? describe : describe.skip;

/**
 * The number of characters of the User-Agent the UserAgents values show as
 * matched. A value has the User-Agent's character where it was matched and
 * an underscore where it was not, so each matched character is checked
 * against the User-Agent at the same position.
 *
 * @param {object} userAgents the UserAgents property value
 * @param {string} userAgent the User-Agent that was detected
 * @returns {number} the number of matched characters
 */
function matchedCharacters (userAgents, userAgent) {
  expect(userAgents.hasValue).toBe(true);
  let count = 0;
  for (const value of userAgents.value) {
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== '_') {
        expect(value[i]).toBe(userAgent[i]);
        count++;
      }
    }
  }
  return count;
}

/**
 * The UserAgents property for the mobile User-Agent from the pipeline.
 *
 * @param {object} pipeline the pipeline to process the evidence with
 * @returns {Promise<object>} the UserAgents property value
 */
async function userAgentsFrom (pipeline) {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', MobileUserAgent);
  await flowData.process();
  return flowData.device.userAgents;
}

describeWithLite('updateMatchedUserAgent', () => {
  test('an engine left at its defaults returns the matched characters',
    async () => {
      const engine = new DeviceDetectionOnPremise({
        dataFilePath: LiteDataFile,
        autoUpdate: false,
        licenceKeys: ''
      });
      const pipeline = new PipelineBuilder().add(engine).build();
      const userAgents = await userAgentsFrom(pipeline);
      expect(matchedCharacters(userAgents, MobileUserAgent))
        .toBeGreaterThan(0);
    });

  test('a pipeline builder left at its defaults returns the matched ' +
    'characters', async () => {
    const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
      dataFile: LiteDataFile,
      licenceKeys: '',
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false,
      shareUsage: false
    }).build();
    const userAgents = await userAgentsFrom(pipeline);
    expect(matchedCharacters(userAgents, MobileUserAgent))
      .toBeGreaterThan(0);
  });

  test('false turns the recording off', async () => {
    const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
      dataFile: LiteDataFile,
      licenceKeys: '',
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false,
      shareUsage: false,
      updateMatchedUserAgent: false
    }).build();
    const userAgents = await userAgentsFrom(pipeline);
    expect(matchedCharacters(userAgents, MobileUserAgent)).toBe(0);
  });
});
