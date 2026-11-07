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
const ShareUsageBackOff = require('../shareUsageBackOff');
const http = require('http');
const zlib = require('zlib');

// A port of its own, so that sends made after a test ends cannot reach the
// receiver the other usage sharing tests use.
const PORT = 8081;
const ENDPOINT = `http://127.0.0.1:${PORT}/`;

// The status the receiver answers with. Only data it accepts is received.
let status = 200;
// When true the receiver never answers.
let hang = false;
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
  if (hang) {
    return;
  }
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
  hang = false;
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

/**
 * Each failed send after a pause multiplies the delay, and the delay stops
 * growing at the maximum.
 */
test('share usage back-off - delay grows to the maximum', async () => {
  const pipeline = createPipeline({
    failuresToEnterRecovery: 1,
    initialRecoveryDelaySeconds: 0.5,
    maxRecoveryDelaySeconds: 1
  });
  status = 500;
  for (let i = 0; i < 40; i++) {
    await processUnique(pipeline);
  }

  await waitFor(
    () => attempts.length >= 4,
    () => 'Fewer than four sends were made.');
  const gaps = [1, 2, 3].map(i => attempts[i] - attempts[i - 1]);
  expect(gaps[0]).toBeGreaterThanOrEqual(400);
  expect(gaps[1]).toBeGreaterThanOrEqual(900);
  expect(gaps[2]).toBeGreaterThanOrEqual(900);
  expect(gaps[2]).toBeLessThan(1900);
}, 30000);

/**
 * When the queue fills during a pause, new evidence is dropped and what was
 * queued first is sent once sending resumes.
 */
test('share usage back-off - full queue drops new evidence', async () => {
  const pipeline = createPipeline({
    maximumQueueSize: 4,
    failuresToEnterRecovery: 1,
    initialRecoveryDelaySeconds: 2,
    maxRecoveryDelaySeconds: 2
  });
  await failSends(pipeline, 1);

  const kept = [];
  for (let i = 0; i < 4; i++) {
    kept.push(await processUnique(pipeline));
  }
  const dropped = [];
  for (let i = 0; i < 6; i++) {
    dropped.push(await processUnique(pipeline));
  }
  status = 200;

  await waitFor(
    () => kept.every(ip => clientIps().includes(ip)),
    () => `The evidence queued during the pause was not all sent. Sent: ${clientIps()}`);
  await sleep(500);
  expect(dropped.filter(ip => clientIps().includes(ip))).toEqual([]);
}, 30000);

/**
 * A request that is never answered counts as a failed send once the request
 * timeout passes, so it cannot stop the element sending.
 */
test('share usage back-off - request with no answer does not stop sending', async () => {
  const pipeline = createPipeline({ requestTimeout: 300 });
  hang = true;
  await processUnique(pipeline);
  await waitFor(
    () => attempts.length === 1,
    () => 'The first send was not made.');
  hang = false;
  const next = await processUnique(pipeline);

  await waitFor(
    () => clientIps().includes(next),
    () => 'Nothing more was sent after a request with no answer.');
}, 30000);

/**
 * Settings the pause cannot work with are rejected.
 */
test('share usage back-off - invalid settings are rejected', () => {
  [
    { failuresToEnterRecovery: 0 },
    { failuresToEnterRecovery: 101 },
    { failuresWindowSeconds: 0 },
    { initialRecoveryDelaySeconds: 0 },
    { maxRecoveryDelaySeconds: -1 },
    { recoveryMultiplier: 0.5 },
    { maximumQueueSize: 0 }
  ].forEach(settings => {
    expect(() => new ShareUsage({
      requestedPackageSize: 1,
      endpoint: ENDPOINT,
      ...settings
    })).toThrow(RangeError);
  });
});

/**
 * The rules that decide when usage sharing may send after failed sends, with
 * each test setting the time in milliseconds. Three failures within a ten
 * second window start a two second pause, rising by two each time up to
 * five.
 */
describe('share usage back-off rules', () => {
  const create = ({ failures = 3, initial = 2, maximum = 5 } = {}) =>
    new ShareUsageBackOff({
      failuresToEnterRecovery: failures,
      failuresWindowSeconds: 10,
      initialRecoveryDelaySeconds: initial,
      maxRecoveryDelaySeconds: maximum,
      recoveryMultiplier: 2
    });

  test('pauses after failures within the window', () => {
    const backOff = create();
    expect(backOff.failed(0)).toBe(0);
    expect(backOff.failed(1000)).toBe(0);
    expect(backOff.remaining(1000)).toBe(0);
    expect(backOff.backingOff).toBe(false);

    expect(backOff.failed(2000)).toBe(2000);
    expect(backOff.backingOff).toBe(true);
    expect(backOff.remaining(3000)).toBe(1000);
    expect(backOff.remaining(4000)).toBe(0);
  });

  test('failures outside the window do not count', () => {
    const backOff = create();
    backOff.failed(0);
    backOff.failed(1000);
    expect(backOff.failed(11500)).toBe(0);
    expect(backOff.backingOff).toBe(false);
  });

  test('successes between failures do not reset the count', () => {
    const backOff = create();
    backOff.failed(0);
    expect(backOff.succeeded()).toBe(false);
    backOff.failed(1000);
    expect(backOff.succeeded()).toBe(false);
    expect(backOff.failed(2000)).toBe(2000);
  });

  test('a failed send after a pause multiplies the delay', () => {
    const backOff = create({ failures: 1 });
    expect(backOff.failed(0)).toBe(2000);
    expect(backOff.failed(2000)).toBe(4000);
    expect(backOff.failed(6000)).toBe(5000);
    expect(backOff.failed(11000)).toBe(5000);
    expect(backOff.remaining(11000)).toBe(5000);
  });

  test('a success ends the back-off', () => {
    const backOff = create({ failures: 2 });
    backOff.failed(0);
    backOff.failed(1000);
    backOff.failed(3000);
    expect(backOff.succeeded()).toBe(true);
    expect(backOff.backingOff).toBe(false);
    expect(backOff.remaining(4000)).toBe(0);
    // The next pause needs the full number of failures again, and starts
    // from the initial delay.
    expect(backOff.failed(8000)).toBe(0);
    expect(backOff.failed(9000)).toBe(2000);
  });

  test('a maximum below the initial delay limits the first pause', () => {
    const backOff = create({ failures: 1, initial: 10, maximum: 3 });
    expect(backOff.failed(0)).toBe(3000);
  });
});
