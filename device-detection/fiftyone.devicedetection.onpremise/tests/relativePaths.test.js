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

// A data file path and a temporary folder given relative to the working
// folder of the process work, as file-system-paths.md lines 3 to 5 ask.

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const Builder = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremisePipelineBuilder;

const LITE = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection', '51Degrees-LiteV4.1.hash');
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 ' +
  'Safari/604.1';
const TIMEOUT_MS = 300000;

// The path given, relative to the working folder of the process.
const relative = (absolute) => path.relative(process.cwd(), absolute);

// Whether the Pipeline built with the options given finds a mobile device.
const isMobile = async (options) => {
  const pipeline = new Builder({
    autoUpdate: false,
    fileSystemWatcher: false,
    shareUsage: false,
    licenceKeys: '',
    ...options
  }).build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', USER_AGENT);
  await flowData.process();
  return flowData.device.ismobile.value;
};

describe('a relative path', () => {
  let folder;

  beforeAll(() => {
    if (!fs.existsSync(LITE)) {
      throw new Error(`No data file at '${LITE}'.`);
    }
  });

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(__dirname, 'relative-paths-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 });
  });

  test('to the data file works', async () => {
    const dataFile = relative(LITE);
    expect(path.isAbsolute(dataFile)).toBe(false);
    expect(await isMobile({ dataFile })).toBe(true);
  }, TIMEOUT_MS);

  test('to the folder for a copy of the data file works', async () => {
    const tempDataDir = relative(folder);
    expect(path.isAbsolute(tempDataDir)).toBe(false);
    expect(await isMobile({
      dataFile: relative(LITE),
      // The copy is read into memory and let go of, so the folder can be
      // removed after on Windows too.
      performanceProfile: 'MaxPerformance',
      createTempDataCopy: true,
      tempDataDir
    })).toBe(true);
    expect(fs.readdirSync(folder).length).toBeGreaterThan(0);
  }, TIMEOUT_MS);
});
