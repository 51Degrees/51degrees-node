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

// Refreshing an engine's data, as the data update service does once it has a
// new file. A refresh from a file that cannot be used fails with an error,
// and the engine goes on answering from the data it had (data-updates.md
// line 39). A refresh made while requests are being processed leaves each of
// them answered (line 38).

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
const Engine = require51('fiftyone.ipintelligence.onpremise')
  .IpIntelligenceOnPremise;

// The small ASN data file, which the other tests here use.
const ASN = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
const IP_ADDRESS = '8.8.8.8';
// Requests started in one batch, half before the refresh and half after.
const REQUESTS = 100;
const TIMEOUT_MS = 300000;

/**
 * An engine on a copy of the ASN data file in the folder given, the data
 * file it registers with the update service, and a Pipeline holding it.
 *
 * @param {string} folder the folder for the copy
 * @returns {object} the file, the engine, the data file and the Pipeline
 */
const build = (folder) => {
  if (!fs.existsSync(ASN)) {
    throw new Error(`No data file at '${ASN}'.`);
  }
  const file = path.join(folder, path.basename(ASN));
  fs.copyFileSync(ASN, file);
  const engine = new Engine({
    dataFilePath: file,
    // The whole file is read into memory, so the file can be replaced while
    // the engine is open.
    performanceProfile: 'MaxPerformance',
    autoUpdate: false,
    // The test refreshes the data itself, so no watcher is left on the file
    // once the test has removed it.
    fileSystemWatcher: false,
    licenceKeys: ''
  });
  let dataFile;
  engine.registrationCallbacks[0]({
    dataFileUpdateService: {
      registerDataFile: (registered) => { dataFile = registered; }
    }
  });
  const pipeline = new core.PipelineBuilder().add(engine).build();
  return { file, engine, dataFile, pipeline };
};

// Starts processing a request, and resolves with its Flow Data once done.
const processed = (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.client-ip', IP_ADDRESS);
  return flowData.process().then(() => flowData);
};

// Every Property of the engine that a processed request gives, each as its
// value in JSON, or that it has none.
const valuesOf = (flowData) => {
  const ip = flowData.get('ip');
  return Object.keys(ip.flowElement.properties).sort().map((name) => {
    const value = ip.get(name);
    return [name, value.hasValue ? JSON.stringify(value.value) : 'no value'];
  });
};

// Whether any Property has a value, so that comparing the values shows
// something.
const anyValue = (values) => values.some(([, value]) => value !== 'no value');

describe('refreshing the data', () => {
  let folder;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-data-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  test('from a file that cannot be used fails and keeps the data it had',
    async () => {
      const { file, engine, dataFile, pipeline } = build(folder);
      const before = valuesOf(await processed(pipeline));
      expect(anyValue(before)).toBe(true);
      const product = engine.engine.getProduct();

      fs.writeFileSync(file, 'This is not a data file.');
      expect(() => dataFile.refresh()).toThrow();

      expect(engine.engine.getProduct()).toBe(product);
      expect(valuesOf(await processed(pipeline))).toEqual(before);
    }, TIMEOUT_MS);

  test('while requests are processed leaves each one answered',
    async () => {
      const { dataFile, pipeline } = build(folder);
      const expected = valuesOf(await processed(pipeline));
      expect(anyValue(expected)).toBe(true);

      // One request processed before the refresh and read after it, a batch
      // started either side of the refresh, and one processed after the
      // batch, all read once the last is done.
      const early = await processed(pipeline);
      const batch = [];
      for (let i = 0; i < REQUESTS; i++) {
        if (i === REQUESTS / 2) {
          dataFile.refresh();
        }
        batch.push(processed(pipeline));
      }
      const done = await Promise.all(batch);
      const late = await processed(pipeline);

      for (const flowData of [early, ...done, late]) {
        expect(flowData.errors).toEqual({});
        expect(valuesOf(flowData)).toEqual(expected);
      }
    }, TIMEOUT_MS);
});
