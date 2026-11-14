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

// An engine built with no Property names keeps the Property list it started
// with when its data file reloads, and reads each of those Properties from
// the reloaded file, as the C library's NothingNamed_SmallThenLarge reload
// tests pin. The data file here starts as the free Lite data file and is
// replaced with the Enterprise data file CI fetches, which has many more
// Properties at other positions.

const fs = require('fs');
const os = require('os');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const Engine = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremise;

const DATA = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection');
const LITE = path.join(DATA, '51Degrees-LiteV4.1.hash');
const ENTERPRISE = path.join(DATA, 'Enterprise-HashV41.hash');
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 ' +
  'Safari/604.1';
// Properties both data files have, at different positions.
const READ = ['ismobile', 'platformname', 'browsername'];
const TIMEOUT_MS = 300000;

// The values of READ the pipeline gives for USER_AGENT.
const values = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', USER_AGENT);
  await flowData.process();
  return READ.map((name) => flowData.device[name].value);
};

describe('an engine built with no Property names', () => {
  let folder;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'reload-properties-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  test('keeps its Property list and reads it from the reloaded data file',
    async () => {
      for (const file of [LITE, ENTERPRISE]) {
        if (!fs.existsSync(file)) {
          throw new Error(`No data file at '${file}'.`);
        }
      }
      const file = path.join(folder, path.basename(LITE));
      fs.copyFileSync(LITE, file);

      const engine = new Engine({
        dataFilePath: file,
        // The whole file is read into memory, so the file can be replaced
        // while the engine is open.
        performanceProfile: 'MaxPerformance',
        autoUpdate: false,
        // The test refreshes the data file itself, so no watcher is left
        // on the file once the test has removed it.
        fileSystemWatcher: false,
        licenceKeys: ''
      });
      // The data file the engine registers, which the update service
      // refreshes after it has replaced the file.
      let dataFile;
      engine.registrationCallbacks[0]({
        dataFileUpdateService: {
          registerDataFile: (registered) => { dataFile = registered; }
        }
      });
      const pipeline = new core.PipelineBuilder().add(engine).build();
      const before = Object.keys(engine.properties).sort();
      const valuesBefore = await values(pipeline);
      expect(valuesBefore[0]).toBe(true);

      fs.copyFileSync(ENTERPRISE, file);
      dataFile.refresh();

      expect(engine.engine.getProduct()).not.toBe('Lite');
      expect(Object.keys(engine.properties).sort()).toEqual(before);
      expect(await values(pipeline)).toEqual(valuesBefore);
    }, TIMEOUT_MS);
});
