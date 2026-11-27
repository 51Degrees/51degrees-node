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

// A stand-in for the cloud service on this machine, and a way to run the TAC
// and native model lookup examples against it from their own folders, as a
// person runs them. The tests that use it need no real key and no network.

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const EXAMPLES = path.join(__dirname, '..', 'examples', 'cloud');
const FIXTURES = path.join(__dirname, 'fixtures');

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

/**
 * An answer captured from the cloud service, with no key in it.
 *
 * @param {string} name The file name in the fixtures folder
 * @returns {string} The answer's JSON text
 */
const fixture = function (name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
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

/**
 * The answer to one request of a kind, given how many of that kind came
 * before it. A list gives its answers in turn and then repeats its last.
 *
 * @param {string|number|Array<string|number>} answers The answers
 * @param {number} before The number of earlier requests of the kind
 * @returns {string|number} The answer
 */
const answerFor = function (answers, before) {
  return Array.isArray(answers)
    ? answers[Math.min(before, answers.length - 1)]
    : answers;
};

/**
 * Starts the stand-in on 127.0.0.1 and a free port. Each answer is JSON
 * text, sent with status 200, a number, sent as that status with no body,
 * or a list of those, given in turn. A request with no answer gets 404. The
 * method and path of every request are recorded.
 *
 * @param {object} answers The answers
 * @param {string|number|Array<string|number>} answers.accessibleProperties
 * For accessibleproperties
 * @param {string|number|Array<string|number>} answers.evidenceKeys For
 * evidencekeys
 * @param {string|number|Array<string|number>} [answers.lookup] For the
 * lookup, whose path ends json
 * @returns {Promise<object>} The server, the requests and the endpoint
 */
const startStandIn = function (answers) {
  return new Promise((resolve, reject) => {
    const requests = [];
    const counts = {};
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      requests.push(`${req.method} ${pathname}`);
      let kind;
      if (req.method === 'GET' && pathname.endsWith('/accessibleproperties')) {
        kind = 'accessibleProperties';
      } else if (req.method === 'GET' && pathname.endsWith('/evidencekeys')) {
        kind = 'evidenceKeys';
      } else if (pathname.endsWith('json')) {
        kind = 'lookup';
      }
      let answer;
      if (kind !== undefined) {
        const before = counts[kind] || 0;
        counts[kind] = before + 1;
        answer = answerFor(answers[kind], before);
      }
      if (answer === undefined) {
        answer = 404;
      }
      if (typeof answer === 'number') {
        res.writeHead(answer);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(answer);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      requests,
      endpoint: `http://127.0.0.1:${server.address().port}/api/v4/`
    }));
  });
};

/**
 * Runs the example from its own folder, pointed at the stand-in.
 *
 * @param {string} folder The example's folder
 * @param {string} file The example's file
 * @param {string} endpoint The stand-in's endpoint
 * @param {string} resourceKey The resource key the example reads
 * @returns {Promise<object>} The exit status, signal, stdout and stderr
 */
const runExample = function (folder, file, endpoint, resourceKey) {
  return new Promise((resolve) => {
    const env = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (!removed(name)) {
        env[name] = value;
      }
    }
    env._51DEGREES_RESOURCE_KEY = resourceKey;
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
};

/**
 * Starts the stand-in, runs the example against it and stops the stand-in.
 *
 * @param {string} folder The example's folder
 * @param {string} file The example's file
 * @param {object} answers The stand-in's answers, as startStandIn takes them
 * @param {string} [resourceKey] The resource key the example reads, the
 * stand-in key unless given
 * @returns {Promise<object>} What runExample gives, with the requests the
 * stand-in received
 */
const runAgainstStandIn = async function (
  folder, file, answers, resourceKey = STAND_IN_KEY) {
  const standIn = await startStandIn(answers);
  try {
    const result = await runExample(
      folder, file, standIn.endpoint, resourceKey);
    return Object.assign(result, { requests: standIn.requests });
  } finally {
    await new Promise((resolve) => standIn.server.close(resolve));
  }
};

/**
 * What the example printed, for a failure message.
 *
 * @param {object} result What runExample gave
 * @returns {string} The standard output and standard error
 */
const printed = function (result) {
  return `${result.stdout}\n${result.stderr}`;
};

module.exports = {
  EXAMPLE_FILES,
  JEST_MARGIN_MS,
  TIMEOUT_MS,
  fixture,
  printed,
  runAgainstStandIn
};
