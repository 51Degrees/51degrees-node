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

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');
const http = require('http');
const zlib = require('zlib');

// A port of its own, so that sends made after a test ends cannot reach the
// receiver the other usage sharing tests use.
const PORT = 8081;
const ENDPOINT = `http://127.0.0.1:${PORT}/`;

// The status the receiver answers with. Only data it accepts is received.
let status = 200;
// The usage data the receiver accepted.
let received = [];
// When each request arrived, whatever the answer.
let attempts = [];
let server = null;
// The element under test, stopped when the test ends.
let usageEngine = null;
let requests = 0;

/**
 * Local server that answers usage data with the status the test sets.
 *
 * @param {http.IncomingMessage} req the request
 * @param {http.ServerResponse} res the response
 */
const requestListener = function (req, res) {
  attempts.push(Date.now());
  let data = '';
  const gunzip = zlib.createGunzip();
  req.pipe(gunzip);
  gunzip.on('data', chunk => {
    data += chunk;
  });
  gunzip.on('end', () => {
    if (status === 200) {
      received.push(data);
    }
    res.writeHead(status);
    res.end();
  });
};

beforeEach(done => {
  status = 200;
  received = [];
  attempts = [];
  requests = 0;
  usageEngine = null;
  server = http.createServer(requestListener);
  server.listen(PORT, done);
});

afterEach(() => {
  if (usageEngine && usageEngine.resumeTimer) {
    clearTimeout(usageEngine.resumeTimer);
  }
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  server.close();
});

/**
 * Wait for the given time.
 *
 * @param {number} milliseconds how long to wait
 * @returns {Promise} resolved after the time
 */
const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * Wait for a condition, failing if it is not met within 30 seconds.
 *
 * @param {Function} condition returns true when the wait is over
 * @param {Function} message returns the reason for the failure
 */
const waitFor = async (condition, message) => {
  const end = Date.now() + 30000;
  while (!condition()) {
    if (Date.now() > end) {
      throw new Error(message());
    }
    await sleep(20);
  }
};

/**
 * The client IPs in the usage data received.
 *
 * @returns {Array<string>} the client IPs
 */
const clientIps = () => received
  .flatMap(data => [...data.matchAll(/<ClientIP>([^<]*)<\/ClientIP>/g)])
  .map(match => match[1]);

/**
 * A pipeline whose usage sharing element sends each entry on its own.
 *
 * @param {object} settings more settings for the element
 * @returns {object} the pipeline
 */
const createPipeline = (settings = {}) => {
  usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: ENDPOINT,
    ...settings
  });
  return new PipelineBuilder().add(usageEngine).build();
};

/**
 * Process a request whose evidence no other request has.
 *
 * @param {object} pipeline the pipeline to process it with
 * @returns {string} its client IP
 */
const processUnique = async pipeline => {
  const ip = `10.0.${Math.floor(requests / 250)}.${requests % 250 + 1}`;
  requests++;
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('server.client-ip', ip);
  await flowData.process();
  return ip;
};

/**
 * Process requests one at a time, waiting for each to be sent, so each is a
 * separate failed send.
 *
 * @param {object} pipeline the pipeline to process them with
 * @param {number} count how many sends to fail
 */
const failSends = async (pipeline, count) => {
  status = 500;
  for (let sent = 1; sent <= count; sent++) {
    await processUnique(pipeline);
    await waitFor(
      () => attempts.length === sent,
      () => `Send ${sent} was not made.`);
    // Lets the element read the answer before the next request.
    await sleep(50);
  }
};

/**
 * Ten failed sends pause sending for two seconds, the defaults. Nothing is
 * sent during the pause, the evidence processed during it is queued, and all
 * of it is sent once the pause ends and the service answers, with no more
 * requests processed.
 */
test('share usage back-off - pauses then drains the queue', async () => {
  const pipeline = createPipeline();
  await failSends(pipeline, 10);
  const pausedAt = Date.now();

  const queued = [];
  for (let i = 0; i < 5; i++) {
    queued.push(await processUnique(pipeline));
  }
  await sleep(700);
  expect(attempts.length).toBe(10);

  status = 200;
  await waitFor(
    () => queued.every(ip => clientIps().includes(ip)),
    () => 'The evidence processed during the pause was not all sent once ' +
      `the service answered. Sent: ${clientIps()}`);
  expect(attempts[10] - pausedAt).toBeGreaterThanOrEqual(1500);
}, 30000);
