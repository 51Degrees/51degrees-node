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

// Runs each example in its own process, from its own folder, as a person
// runs it, and checks what it prints or serves.

const childProcess = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const TIMEOUT_MS = 30000;

// The environment of an example run as a person runs it, outside jest.
const exampleEnvironment = () => {
  const env = Object.assign({}, process.env);
  delete env.JEST_WORKER_ID;
  return env;
};

// Runs a console example to its end, from its own folder.
const runExample = (file) => childProcess.spawnSync(
  process.execPath, [path.basename(file)], {
    cwd: path.dirname(file),
    env: exampleEnvironment(),
    encoding: 'utf8',
    timeout: TIMEOUT_MS
  });

// A port nothing is listening on.
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

// Gets a page, or undefined when nothing answers yet.
const get = (port, urlPath) => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', () => resolve(undefined));
});

// Starts a web example from its own folder, gets one page from it once it
// answers, and stops it. What the example wrote is returned with the page,
// so a failure shows why.
const getFromExample = async (file, urlPath) => {
  const port = await freePort();
  const env = exampleEnvironment();
  env.PORT = String(port);
  const child = childProcess.spawn(
    process.execPath, [path.basename(file)], {
      cwd: path.dirname(file),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    const end = Date.now() + TIMEOUT_MS / 2;
    while (Date.now() < end && child.exitCode === null) {
      const response = await get(port, urlPath);
      if (response !== undefined) {
        return Object.assign(response, { output });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { status: undefined, body: '', output };
  } finally {
    child.kill();
  }
};

const EXAMPLES = path.resolve(__dirname, '..', 'examples');

test('caching example', () => {
  const result = runExample(path.join(EXAMPLES, 'caching.js'));

  expect({ status: result.status, stderr: result.stderr })
    .toEqual({ status: 0, stderr: expect.any(String) });
  // The second request with the same user id is answered from the cache.
  expect(result.stdout).toContain('Fetched from cache');
}, TIMEOUT_MS);

test('on premise flow element example', async () => {
  const page = await getFromExample(
    path.join(EXAMPLES, 'onPremiseFlowElement.js'),
    '/?dateOfBirth=2019-09-26');

  expect({ status: page.status, output: page.output })
    .toEqual({ status: 200, output: expect.any(String) });
  expect(page.body).toMatch(/Your starsign is libra/i);
}, TIMEOUT_MS);
