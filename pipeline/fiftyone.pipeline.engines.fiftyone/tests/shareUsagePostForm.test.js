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

// The parameters of a POST request's form body follow the same usage
// sharing rule as the parameters of a query string. One whose name starts
// with 51D_ is shared, one a Flow Element in the Pipeline accepts is shared,
// and a password parameter no Flow Element accepts is never shared, even
// when all Evidence is shared (automated-testing.md, ShareUsage, and
// usage-sharing-element.md, shared Evidence).

const http = require('http');
const zlib = require('zlib');
const request = require('supertest');
const {
  PipelineBuilder, FlowElement, ElementDataDictionary,
  BasicListEvidenceKeyFilter
} = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// The same three parameters are sent in a query string and in a form body.
const PARAMETERS = '51D_x=prefixed-value&used=used-value&password=secret-value';

// Usage data received by the local usage receiver.
let received = [];
let receiver = null;
let endpoint = null;

beforeEach((done) => {
  received = [];
  receiver = http.createServer((req, res) => {
    let data = '';
    const gunzip = zlib.createGunzip();
    req.pipe(gunzip);
    gunzip.on('data', (chunk) => { data += chunk; });
    gunzip.on('end', () => {
      received.push(data);
      res.writeHead(200);
      res.end();
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
 * Waits until the receiver has had the given number of messages.
 *
 * @param {number} count the number of messages
 * @returns {Promise<void>} resolves when they have arrived
 */
const receivedCount = (count) => new Promise((resolve, reject) => {
  const started = Date.now();
  const check = () => {
    if (received.length >= count) {
      resolve();
    } else if (Date.now() - started > 5000) {
      reject(new Error(`${received.length} of ${count} messages received`));
    } else {
      setTimeout(check, 20);
    }
  };
  check();
});

/**
 * An element that accepts the User-Agent and the parameter named used.
 *
 * @returns {FlowElement} the element
 */
const testEngine = () => new FlowElement({
  dataKey: 'test',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(
    ['header.user-agent', 'query.used']),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { used: flowData.evidence.get('query.used') }
    }));
  }
});

/**
 * A pipeline holding only the test engine and the usage sharing element,
 * which sends each record to the local receiver as soon as it is made.
 *
 * @param {object} options options for the usage sharing element
 * @returns {object} the pipeline
 */
const usagePipeline = (options) => new PipelineBuilder({
  addJavaScriptBuilder: false,
  useSetHeaderProperties: false
}).add(testEngine())
  .add(new ShareUsage(Object.assign(
    { requestedPackageSize: 1, endpoint }, options)))
  .build();

/**
 * Processes a real HTTP request through a pipeline, reading the evidence
 * from it as a web integration does.
 *
 * @param {object} pipeline the pipeline
 * @param {Function} send given the supertest agent of the server, makes
 * the request
 * @returns {Promise<object>} the processed flow data
 */
const processRequest = (pipeline, send) => {
  return new Promise((resolve, reject) => {
    let flowData;
    const server = http.createServer(async (req, res) => {
      try {
        flowData = pipeline.createFlowData();
        await flowData.evidence.addFromRequestAsync(req);
        await flowData.process();
        res.end('done');
      } catch (e) {
        reject(e);
        res.end();
      }
    });
    send(request(server)).set({ 'User-Agent': 'agent value' })
      .then(() => resolve(flowData), reject);
  });
};

// How the parameters reach the server, and the method the server sees.
const requests = [
  ['the query string of a GET request', 'GET',
    (agent) => agent.get('/page?' + PARAMETERS)],
  ['the form body of a POST request', 'POST',
    (agent) => agent.post('/page').type('form').send(PARAMETERS)]
];

describe.each(requests)('usage sharing of parameters in %s',
  (name, method, send) => {
    test.each([
      ['by default', {}],
      ['when all evidence is shared', { shareAll: true }]
    ])('shares a 51D_ parameter and one a Flow Element accepts, and never ' +
      'a password parameter, %s', async (mode, options) => {
      const flowData = await processRequest(usagePipeline(options), send);
      await receivedCount(1);

      // The web integration read all three parameters from the request, so
      // the password parameter is left out by the rule, not for want of
      // being read.
      const view = flowData.evidence.get('server.http-request');
      expect(view['server.request-method']).toBe(method);
      expect(view['query.51D_x']).toBe('prefixed-value');
      expect(view['query.used']).toBe('used-value');
      expect(view['query.password']).toBe('secret-value');

      expect(received[0])
        .toContain('<query Name="51D_x">prefixed-value</query>');
      expect(received[0]).toContain('<query Name="used">used-value</query>');
      expect(received[0]).not.toContain('secret-value');
      expect(received[0]).not.toMatch(/Name="password"/i);
    });
  });
