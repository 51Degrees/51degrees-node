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

// Runs the examples as a fresh clone runs them, with no data file or
// licence key settings, so on the free Lite data file. Each example must
// finish, show what needs the Enterprise data file, and give the link to
// ask for a copy. The Lite data file is the one the examples find in
// cxx/data/device-detection, where CI links the Lite asset, rather than the
// file of that name in the tests folder, which CI fills with a fuller file.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const optionsExtension =
  require51('fiftyone.devicedetection.shared').optionsExtension;

const { ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, 'exampleUtils'));

const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';
const EVIDENCE = '20000 Evidence Records.yml';
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code';
const NEEDS_LICENCE_KEY = 'which needs a licence key';
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT_MS = 300000;

// The settings that name a data file or a licence key. A fresh clone has
// none of them.
const SETTINGS = [
  '51DEGREES_DD_PATH',
  '_51DEGREES_DD_PATH',
  'LICENSEKEY',
  'LICENSE_KEY'
];

// Runs an example in its own process, from its own folder, as a person
// runs it. The examples skip their main block under jest, so the jest
// variable is removed too. Names are matched without regard to case, as
// Windows matches them.
const runExample = (file, args = []) => {
  const remove = new Set(SETTINGS.concat(['JEST_WORKER_ID'])
    .map((name) => name.toUpperCase()));
  const env = Object.assign({}, process.env);
  for (const name of Object.keys(env)) {
    if (remove.has(name.toUpperCase())) {
      delete env[name];
    }
  }
  return childProcess.spawnSync(
    process.execPath, [path.basename(file), ...args], {
      cwd: path.join(__dirname, path.dirname(file)),
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024
    });
};

// Checks the example finished, showing its error output when it did not,
// and wrote each of the texts.
const expectOutput = (result, ...texts) => {
  expect({ status: result.status, stderr: result.stderr })
    .toEqual({ status: 0, stderr: expect.any(String) });
  for (const text of texts) {
    expect(result.stdout).toContain(text);
  }
};

// The web examples run in this process, so the settings are removed from
// its environment while they do.
const saved = {};
beforeAll(() => {
  for (const name of SETTINGS) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});
afterAll(() => {
  for (const name of SETTINGS) {
    if (saved[name] !== undefined) {
      process.env[name] = saved[name];
    }
  }
});

describe('Examples without settings', () => {
  test('getting started marks the Enterprise properties', () => {
    expectOutput(runExample('gettingstarted-console/gettingStarted.js'),
      `Hardware Vendor: ${NEEDS_ENTERPRISE}`,
      `Device Type: ${NEEDS_ENTERPRISE}`,
      CONTACT_US);
  }, TIMEOUT_MS);

  test('metadata says what the Enterprise data file adds', () => {
    expectOutput(runExample('metadata-console/metaData.js'),
      'The Enterprise data file adds', CONTACT_US);
  }, TIMEOUT_MS);

  test('match metrics says what the Enterprise data file adds', () => {
    expectOutput(runExample('matchmetrics-console/matchMetrics.js'),
      'The Enterprise data file adds', CONTACT_US);
  }, TIMEOUT_MS);

  test('performance says what the Enterprise data file adds', () => {
    expectOutput(runExample('performance-console/performance.js'),
      'ismobile = true', 'The Enterprise data file adds', CONTACT_US);
  }, TIMEOUT_MS);

  test('offline processing marks the Enterprise properties', () => {
    // The files are the ones the example finds itself, named so that the
    // output is not written into the data folder.
    const output = path.join(os.tmpdir(), 'offline-processing-free.yml');
    try {
      expectOutput(runExample('offlineprocessing-console/offlineProcessing.js', [
        ExampleUtils.findFile(LITE_V_4_1_HASH),
        ExampleUtils.findFile(EVIDENCE),
        output
      ]), CONTACT_US);
      const yaml = fs.readFileSync(output, 'utf8');
      expect(yaml).toContain('# Some of these properties need the Enterprise data file.');
      expect(yaml).toContain(`device.hardwarevendor: ${NEEDS_ENTERPRISE}`);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }, TIMEOUT_MS);

  test('updating the data file says it needs a licence key', () => {
    expectOutput(runExample('updatedatafile-console/updatedatafile.js'),
      NEEDS_LICENCE_KEY, CONTACT_US);
  }, TIMEOUT_MS);

  test.each([
    'automaticupdates/dataFileSystemWatcher.js',
    'automaticupdates/updateOnStartUp.js',
    'automaticupdates/updatePollingInterval.js'
  ])('%s says it needs a licence key', (file) => {
    expectOutput(runExample(file), NEEDS_LICENCE_KEY, CONTACT_US);
  }, TIMEOUT_MS);

  test('the web page marks the Enterprise properties', async () => {
    const example = require(path.join(__dirname, 'gettingstarted-web/gettingStarted.js'));
    const dir = path.join(__dirname, 'gettingstarted-web');
    const options = JSON.parse(fs.readFileSync(path.join(dir, '51d.json')));
    // The page is read once, so usage is not shared.
    options.PipelineOptions.Elements = options.PipelineOptions.Elements.filter(
      (element) => !element.elementName.includes('shareUsage'));
    optionsExtension.setDataFilePath(options, ExampleUtils.findFile(LITE_V_4_1_HASH));
    optionsExtension.updateElementPath(options, dir);
    example.setPipeline(options);
    const response = await request(example.server).get('/').set('User-Agent', CHROME);
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain(NEEDS_ENTERPRISE);
    expect(response.text).toContain(CONTACT_US);
  }, TIMEOUT_MS);

  test('the client hints web page marks the Enterprise properties', async () => {
    const example = require(path.join(__dirname, 'useragentclienthints-web/userAgentClientHintsWeb.js'));
    example.setPipeline(null);
    const response = await request(example.server).get('/').set('User-Agent', CHROME);
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain(NEEDS_ENTERPRISE);
    expect(response.text).toContain(CONTACT_US);
  }, TIMEOUT_MS);
});
