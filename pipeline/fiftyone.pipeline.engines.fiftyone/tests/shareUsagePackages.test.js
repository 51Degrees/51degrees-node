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

// The usage sharing record names every 51Degrees package in use, with its
// version: the package that holds the Pipeline, the package that holds each
// Flow Element in it and every 51Degrees package those depend on, each once.

const http = require('http');
const zlib = require('zlib');
const { PipelineBuilder, FlowElement } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// The longest to wait for the element to send what it queued.
const SEND_TIMEOUT_MS = 10000;
// How often to look for the message while waiting.
const POLL_INTERVAL_MS = 50;

// The 51Degrees packages a Pipeline of usage sharing and the web elements
// uses, each with the version its own package.json gives.
const EXPECTED = [
  'fiftyone.pipeline.core',
  'fiftyone.pipeline.engines',
  'fiftyone.pipeline.engines.fiftyone'
].map((name) => [name, require(`${name}/package.json`).version]);

// Messages the local receiver got, unzipped.
let received;
let server;
let port;

beforeEach(done => { // eslint-disable-line
  received = [];
  server = http.createServer((req, res) => {
    let data = '';
    const gunzip = zlib.createGunzip();
    gunzip.setEncoding('utf8');
    req.pipe(gunzip);
    gunzip.on('data', (chunk) => { data += chunk; });
    gunzip.on('end', () => {
      received.push(data);
      res.writeHead(200);
      res.end();
    });
  });
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    done();
  });
});

afterEach(done => { // eslint-disable-line
  server.close(() => done());
});

// Shares one request through a Pipeline of the elements given and usage
// sharing, and gives the message the receiver got.
const messageFor = async (elements) => {
  const builder = new PipelineBuilder();
  for (const element of elements) {
    builder.add(element);
  }
  const pipeline = builder
    .add(new ShareUsage({
      requestedPackageSize: 1,
      endpoint: `http://127.0.0.1:${port}/`
    }))
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent value');
  await flowData.process();
  const end = Date.now() + SEND_TIMEOUT_MS;
  while (received.length === 0 && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  expect(received.length).toBe(1);
  return received[0];
};

// The name and version of each Package element in a message.
const packagesIn = (message) => Array.from(
  message.matchAll(/<Package Name="([^"]*)">([^<]*)<\/Package>/g),
  (match) => [match[1], match[2]]);

test('the record names each 51Degrees package in use with its version',
  async () => {
    const packages = packagesIn(await messageFor([]));

    expect(packages.slice().sort()).toEqual(EXPECTED.slice().sort());
  }, SEND_TIMEOUT_MS + 5000);

test('an element of the application adds no package', async () => {
  // A Flow Element the application defines, which no 51Degrees package
  // holds.
  class Application extends FlowElement {
    constructor () {
      super({ dataKey: 'application', processInternal: () => {} });
    }
  }
  const packages = packagesIn(await messageFor([new Application()]));

  expect(packages.slice().sort()).toEqual(EXPECTED.slice().sort());
}, SEND_TIMEOUT_MS + 5000);

test('the Package elements come after the FlowElement elements', async () => {
  const message = await messageFor([]);

  expect(message.lastIndexOf('<FlowElement>'))
    .toBeLessThan(message.indexOf('<Package '));
  expect(message.indexOf('</Package>'))
    .toBeLessThan(message.indexOf('<Language>'));
}, SEND_TIMEOUT_MS + 5000);
