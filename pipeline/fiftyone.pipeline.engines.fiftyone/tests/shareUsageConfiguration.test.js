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

// A configuration file gives a list of strings as one comma separated
// string (pipeline-configuration.md lines 50 to 62), so the usage sharing
// element's query string and header lists may be given that way.

const http = require('http');
const zlib = require('zlib');
const { PipelineBuilder } = require('fiftyone.pipeline.core');

// How long a test may wait for the usage data to reach the receiver. It is
// a limit on the test, not a measurement.
const TEST_TIMEOUT_MS = 30000;

// Usage data received by the local receiver, and a promise of the first.
let received = [];
let arrived = null;
let receiver = null;
let endpoint = null;

beforeEach((done) => {
  received = [];
  let firstArrived;
  arrived = new Promise((resolve) => { firstArrived = resolve; });
  receiver = http.createServer((req, res) => {
    let data = '';
    const gunzip = zlib.createGunzip();
    gunzip.setEncoding('utf8');
    req.pipe(gunzip);
    gunzip.on('data', (chunk) => { data += chunk; });
    gunzip.on('end', () => {
      received.push(data);
      res.writeHead(200);
      res.end();
      firstArrived();
    });
  });
  receiver.listen(0, '127.0.0.1', () => {
    endpoint = `http://127.0.0.1:${receiver.address().port}/`;
    done();
  });
});

afterEach((done) => {
  receiver.close(done);
});

/**
 * The usage data sent for one request through a Pipeline built from a
 * configuration whose usage sharing element has the lists given.
 *
 * @param {Array<string>|string} queryWhitelist the query string parameters
 * to share
 * @param {Array<string>|string} headerBlacklist the headers not to share
 * @returns {Promise<string>} the usage data the receiver got
 */
const sharedFor = async (queryWhitelist, headerBlacklist) => {
  const pipeline = new PipelineBuilder().buildFromConfiguration({
    PipelineOptions: {
      Elements: [{
        elementName: 'fiftyone.pipeline.engines.fiftyone/shareUsage',
        elementParameters: {
          requestedPackageSize: 1,
          endpoint,
          queryWhitelist,
          headerBlacklist
        }
      }]
    }
  });
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.campaign', 'campaign value');
  flowData.evidence.add('query.utm_source', 'source value');
  flowData.evidence.add('query.other', 'other value');
  flowData.evidence.add('header.x-blocked', 'blocked value');
  flowData.evidence.add('header.x-also-blocked', 'also blocked value');
  flowData.evidence.add('header.x-kept', 'kept value');
  await flowData.process();
  await arrived;
  return received[0];
};

describe('usage sharing built from a configuration', () => {
  test('reads its lists given as comma separated strings', async () => {
    const shared = await sharedFor(
      'campaign, utm_source', 'x-blocked, x-also-blocked');

    expect(shared).toContain('campaign value');
    expect(shared).toContain('source value');
    expect(shared).toContain('kept value');
    expect(shared).not.toContain('other value');
    expect(shared).not.toContain('blocked value');
  }, TEST_TIMEOUT_MS);

  test('reads its lists given as lists', async () => {
    const shared = await sharedFor(
      ['campaign', 'utm_source'], ['x-blocked', 'x-also-blocked']);

    expect(shared).toContain('campaign value');
    expect(shared).toContain('source value');
    expect(shared).toContain('kept value');
    expect(shared).not.toContain('other value');
    expect(shared).not.toContain('blocked value');
  }, TEST_TIMEOUT_MS);
});
