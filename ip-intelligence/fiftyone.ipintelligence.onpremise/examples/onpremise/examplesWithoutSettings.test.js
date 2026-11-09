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
// licence key settings, on the free data files. Each example must finish,
// show what needs the Enterprise data file, and give the link to ask for a
// copy. The examples default to the Lite data file, and CI puts the
// Enterprise data file under that name, so CI also links the free Lite
// data file under its asset name, which these tests use first and name to
// the examples. The performance and update examples default to the ASN data
// file, which they find themselves.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const { ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, 'exampleUtils'));

const DATA_DIR =
  path.join(__dirname, '..', '..', '..', '..', 'cxx', 'data', 'ip-intelligence');
const LITE_ASSET = path.join(DATA_DIR, '51Degrees-LiteIpiV41.ipi');
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';
const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code';
const NEEDS_LICENCE_KEY = 'which needs a licence key';
const TIMEOUT_MS = 300000;

// The settings that name a data file or a licence key. A fresh clone has
// none of them.
const SETTINGS = [
  '51DEGREES_IPI_PATH',
  '51DEGREES_DD_PATH',
  'LICENSEKEY',
  'LICENSE_KEY'
];

// The free Lite data file, downloaded if it is missing.
const liteFile = () => fs.existsSync(LITE_ASSET)
  ? LITE_ASSET
  : ExampleUtils.findFile(LITE_V_4_1_IPI);

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

// Makes the settings of a web example use the free Lite data files and
// the elements in its folder.
const webOptions = (dir, dataFiles) => {
  const options = JSON.parse(fs.readFileSync(path.join(dir, '51d.json')));
  options.PipelineOptions.Elements = options.PipelineOptions.Elements.filter(
    (element) => !element.elementName.includes('shareUsage'));
  options.PipelineOptions.Elements.forEach((element, i) => {
    if (element.elementName.startsWith('.')) {
      element.elementName = path.join(dir, element.elementName);
    }
    element.elementParameters.dataFilePath = dataFiles[i];
  });
  return options;
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
    const result = runExample('gettingstarted-console/gettingStarted.js', [liteFile()]);
    expectOutput(result, `Country: ${NEEDS_ENTERPRISE}`, CONTACT_US);
    // The Lite data file has the registration properties.
    expect(result.stdout).not.toContain(`Registered Name: ${NEEDS_ENTERPRISE}`);
  }, TIMEOUT_MS);

  test('metadata says what the Enterprise data file adds', () => {
    expectOutput(runExample('metadata-console/metaData.js', [liteFile()]),
      'The Enterprise data file adds', CONTACT_US);
  }, TIMEOUT_MS);

  test('offline processing marks the Enterprise properties', () => {
    const output = path.join(os.tmpdir(), 'offline-processing-free-ipi.yml');
    try {
      expectOutput(runExample('offlineprocessing-console/offlineProcessing.js', [
        liteFile(), path.join(DATA_DIR, 'evidence.yml'), output
      ]), CONTACT_US);
      const yaml = fs.readFileSync(output, 'utf8');
      expect(yaml).toContain('# Some of these properties need the Enterprise data file.');
      expect(yaml).toContain(`ip.country: ${NEEDS_ENTERPRISE}`);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }, TIMEOUT_MS);

  test('performance runs on the ASN data file', () => {
    expectOutput(runExample('performance-console/performance.js'),
      'asnname = known', 'The Enterprise data file adds', CONTACT_US);
  }, TIMEOUT_MS);

  test('compare says what it needs and stops', () => {
    const output = path.join(os.tmpdir(), 'compare-free.csv');
    try {
      expectOutput(runExample('compare-console/compare.js', [
        liteFile(), path.join(DATA_DIR, 'geoip_comparison_evidence.csv'), output
      ]), 'Comparing locations needs the Latitude, Longitude and Areas properties',
      CONTACT_US);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }, TIMEOUT_MS);

  test('country translation says what it needs and stops', () => {
    expectOutput(runExample('country-translation-console/gettingStarted.js', [liteFile()]),
      'Ordering the countries needs the', CONTACT_US);
  }, TIMEOUT_MS);

  test('metrics says what it needs and stops', () => {
    const output = path.join(os.tmpdir(), 'metrics-free.csv');
    try {
      expectOutput(runExample('metrics-console/metrics.js', [liteFile(), output]),
        'Measuring the areas needs the Areas property', CONTACT_US);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }, TIMEOUT_MS);

  test('suspicious says what it needs and stops', () => {
    expectOutput(runExample('suspicious-console/suspicious.js', [liteFile()]),
      'Telling whether an IP address is suspicious needs the', CONTACT_US);
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

  test('mixed getting started marks the Enterprise properties', () => {
    const result = runExample('mixed/gettingstarted-console/gettingStarted.js', [
      ExampleUtils.findFile(LITE_V_4_1_HASH), liteFile()
    ]);
    expectOutput(result, `Device Type: ${NEEDS_ENTERPRISE}`,
      `Country: ${NEEDS_ENTERPRISE}`, CONTACT_US);
    // The Lite data files have these properties.
    expect(result.stdout).not.toContain(`Platform Name: ${NEEDS_ENTERPRISE}`);
    expect(result.stdout).not.toContain(`Registered Name: ${NEEDS_ENTERPRISE}`);
  }, TIMEOUT_MS);

  test('the web page marks the Enterprise properties', async () => {
    const dir = path.join(__dirname, 'gettingstarted-web');
    const example = require(path.join(dir, 'gettingStarted.js'));
    example.setPipeline(webOptions(dir, [liteFile()]));
    const response = await request(example.server).get('/?client-ip=8.8.8.8');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain(NEEDS_ENTERPRISE);
    expect(response.text).toContain(CONTACT_US);
  }, TIMEOUT_MS);

  test('the mixed web page marks the Enterprise properties', async () => {
    const dir = path.join(__dirname, 'mixed', 'gettingstarted-web');
    const example = require(path.join(dir, 'gettingStarted.js'));
    example.setPipeline(webOptions(dir, [
      ExampleUtils.findFile(LITE_V_4_1_HASH), liteFile()
    ]));
    const response = await request(example.server).get('/?client-ip=8.8.8.8');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain(NEEDS_ENTERPRISE);
    expect(response.text).toContain(CONTACT_US);
  }, TIMEOUT_MS);
});
