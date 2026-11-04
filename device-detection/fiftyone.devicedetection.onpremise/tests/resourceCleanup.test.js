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

// The native results, engine and data set of a pipeline are freed only when
// the garbage collector frees the objects that hold them, and freeing the data
// set deletes the engine's temporary copy of the data file. These tests check
// that nothing keeps them alive once the application has dropped them. They
// need node --expose-gc, which the unit-test script passes.

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

const DeviceDetectionOnPremisePipelineBuilder = require51(
  'fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;
const PipelineBuilder = require51('fiftyone.pipeline.core').PipelineBuilder;

const DataFile = path.resolve((process.env.directory || __dirname) +
  '/../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');

const MobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) ' +
  'AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile' +
  '/11D167 Safari/9537.53';

const FlowDataCount = 100;
const CollectAttempts = 20;
const CollectWaitMilliseconds = 50;

/**
 * Builds a pipeline with the default options, which watch the data file for
 * changes, processes flow data with it and lets everything go. The engine and
 * each flow data's native results are registered with the registry given.
 *
 * @param {string} tempDir folder for the engine's copy of the data file
 * @param {FinalizationRegistry} registry counts the native objects freed
 * @returns {Promise<number>} the number of files in tempDir while in use
 */
const processAndDrop = async (tempDir, registry) => {
  const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
    dataFile: DataFile,
    shareUsage: false,
    createTempDataCopy: true,
    tempDataDir: tempDir
  }).build();
  registry.register(pipeline.getElement('device').engine, 'engine');
  for (let i = 0; i < FlowDataCount; i++) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', MobileUserAgent);
    await flowData.process();
    registry.register(flowData.device.swigResults, 'results');
  }
  return fs.readdirSync(tempDir).length;
};

/**
 * Builds from a configuration whose first element is an on-premise engine and
 * whose second cannot be found. Elements have no close method, so what the
 * builder made is released once nothing refers to it.
 *
 * @param {string} tempDir folder for the engine's copy of the data file
 * @returns {{error: string, copies: number}} what was thrown, and the number
 * of files in tempDir straight after
 */
const buildFromFailingConfiguration = (tempDir) => {
  const config = {
    PipelineOptions: {
      Elements: [
        {
          elementName: path.join(__dirname, '..', 'deviceDetectionOnPremise'),
          elementParameters: {
            dataFilePath: DataFile,
            licenceKeys: '',
            autoUpdate: false,
            createTempDataCopy: true,
            tempDataDir: tempDir
          }
        },
        { elementName: 'no-such-element' }
      ]
    }
  };
  let error = 'nothing was thrown';
  try {
    new PipelineBuilder().buildFromConfiguration(config);
  } catch (e) {
    error = String(e);
  }
  return { error, copies: fs.readdirSync(tempDir).length };
};

/**
 * Runs the garbage collector until the check passes or the attempts run out.
 * A registry's callbacks run as tasks after a collection, so each attempt
 * waits for the event loop.
 *
 * @param {Function} check returns true once everything has been freed
 */
const collectUntil = async (check) => {
  for (let i = 0; i < CollectAttempts && !check(); i++) {
    global.gc();
    await new Promise(
      (resolve) => setTimeout(resolve, CollectWaitMilliseconds));
  }
};

describe('resource cleanup', () => {
  // The collection between suites in setup.js does nothing without it.
  test('the garbage collector can be run', () => {
    expect(typeof global.gc).toBe('function');
  });

  test('a dropped pipeline frees its engine, results and data file copy',
    async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-cleanup-'));
      const freed = { engine: 0, results: 0 };
      const registry = new FinalizationRegistry((kind) => { freed[kind]++; });
      try {
        const copies = await processAndDrop(tempDir, registry);
        expect(copies).toBeGreaterThan(0);
        await collectUntil(() =>
          freed.engine === 1 &&
          freed.results === FlowDataCount &&
          fs.readdirSync(tempDir).length === 0);
        expect(freed.results).toBe(FlowDataCount);
        expect(freed.engine).toBe(1);
        expect(fs.readdirSync(tempDir)).toEqual([]);
      } finally {
        // On Windows a copy still in use cannot be removed, and the error
        // would hide the failure above.
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
        }
      }
    }, 60000);

  test('a failed build from configuration releases the engine it built',
    async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-cleanup-'));
      try {
        const { error, copies } = buildFromFailingConfiguration(tempDir);
        expect(error).toContain("Can't find no-such-element");
        expect(copies).toBeGreaterThan(0);
        await collectUntil(() => fs.readdirSync(tempDir).length === 0);
        expect(fs.readdirSync(tempDir)).toEqual([]);
      } finally {
        // As above, a copy still in use cannot be removed on Windows.
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
        }
      }
    }, 60000);
});
