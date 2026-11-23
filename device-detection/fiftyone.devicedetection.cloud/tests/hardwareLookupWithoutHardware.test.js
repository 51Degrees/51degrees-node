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

// Runs the TAC and native model lookup examples from their own folders, as a
// person runs them, against a stand-in for the cloud service on this
// machine. The stand-in's list of accessible properties has no hardware
// element, as for a resource key without the hardware lookup. Each example
// must say so in one line and end normally without making a lookup. No real
// key and no network are used.

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const EXAMPLES = path.join(__dirname, '..', 'examples', 'cloud');
const FIXTURES = path.join(__dirname, 'fixtures');

// Answers captured from the cloud service, with no key in them.
const ACCESSIBLE_PROPERTIES = fs.readFileSync(
  path.join(FIXTURES, 'accessibleproperties-no-hardware.json'), 'utf8');
const EVIDENCE_KEYS = fs.readFileSync(
  path.join(FIXTURES, 'evidencekeys.json'), 'utf8');

// Any key that is not empty, as the stand-in accepts every key.
const STAND_IN_KEY = 'stand-in-key';

// Long enough for an example to start and stop.
const TIMEOUT_MS = 30000;

// Jest waits this much longer than the run, so that it can report a run the
// timeout stopped.
const JEST_MARGIN_MS = 5000;

// Each example, by its folder and file.
const EXAMPLE_FILES = [
  ['taclookup-console', 'tacLookup.js'],
  ['nativemodellookup-console', 'nativeModelLookup.js']
];

// The line the example prints, with its links tagged with the example's
// file.
const expectedLine = (folder, file) => {
  const query = '?utm_source=code&utm_medium=example' +
    '&utm_campaign=51degrees-node' +
    '&utm_content=fiftyone.devicedetection.cloud-examples-cloud-' +
    `${folder}-${file.toLowerCase()}&utm_term=no-hardware-lookup`;
  return 'The resource key does not include HardwarePlatform.Profiles, the ' +
    'hardware lookup this example needs, so no devices are listed. Create ' +
    'a resource key that includes it at ' +
    `https://51degrees.com/configure/QKyYH5XT${query}, or contact us ` +
    `about it at https://51degrees.com/contact-us${query}.`;
};

// Whether a variable is left out of the example's environment: every name a
// key could be read from, the endpoint, which is set to the stand-in, and
// jest's own variable, which the examples read to tell a test run apart.
// Names are matched without regard to case, as Windows matches them.
const removed = (name) => {
  const upper = name.toUpperCase();
  return upper.includes('RESOURCE_KEY') || upper.includes('LICENSE_KEY') ||
    upper === '_51DEGREES_CLOUD_ENDPOINT' || upper === 'JEST_WORKER_ID';
};

// Starts the stand-in on a free port. It answers the two discovery requests
// and gives 404 for anything else, and records the method and path of
// every request.
const startStandIn = () => new Promise((resolve, reject) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    requests.push(`${req.method} ${pathname}`);
    let body;
    if (req.method === 'GET' && pathname.endsWith('/accessibleproperties')) {
      body = ACCESSIBLE_PROPERTIES;
    } else if (req.method === 'GET' && pathname.endsWith('/evidencekeys')) {
      body = EVIDENCE_KEYS;
    }
    if (body === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => resolve({
    server,
    requests,
    endpoint: `http://127.0.0.1:${server.address().port}/api/v4/`
  }));
});

// Runs the example from its own folder, pointed at the stand-in, and gives
// what it printed and how it ended.
const runExample = (folder, file, endpoint) => new Promise((resolve) => {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!removed(name)) {
      env[name] = value;
    }
  }
  env._51DEGREES_RESOURCE_KEY = STAND_IN_KEY;
  env._51DEGREES_CLOUD_ENDPOINT = endpoint;
  const child = childProcess.spawn(process.execPath, [file], {
    cwd: path.join(EXAMPLES, folder),
    env
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
  child.on('close', (status, signal) => {
    clearTimeout(timer);
    resolve({ status, signal, stdout, stderr });
  });
});

describe('hardware lookup examples with a key that has no hardware lookup',
  () => {
    for (const [folder, file] of EXAMPLE_FILES) {
      test(`${file} says what the key needs and makes no lookup`, async () => {
        const standIn = await startStandIn();
        let result;
        try {
          result = await runExample(folder, file, standIn.endpoint);
        } finally {
          await new Promise((resolve) => standIn.server.close(resolve));
        }

        // What the example printed is shown when it did not end normally.
        expect({
          status: result.status,
          signal: result.signal,
          printed: result.status === 0
            ? ''
            : `${result.stdout}\n${result.stderr}`
        }).toEqual({ status: 0, signal: null, printed: '' });

        // Nothing was logged as an error or with a stack trace.
        expect(result.stderr.split(/\r?\n/)
          .filter((line) => /error|^\s+at\s/i.test(line))).toEqual([]);

        const lines = result.stdout.split(/\r?\n/);
        expect(lines.filter((line) =>
          line.includes('HardwarePlatform.Profiles')))
          .toEqual([expectedLine(folder, file)]);
        expect(lines.filter((line) =>
          line.startsWith('Which devices are associated'))).toEqual([]);
        expect(lines).toContain('Find out more:');

        // The example asked the stand-in for the properties, and made no
        // lookup, which is the request for the key's JSON.
        expect(standIn.requests).toContain('GET /api/v4/accessibleproperties');
        expect(standIn.requests.filter((request) => request.endsWith('json')))
          .toEqual([]);
      }, TIMEOUT_MS + JEST_MARGIN_MS);
    }
  });
