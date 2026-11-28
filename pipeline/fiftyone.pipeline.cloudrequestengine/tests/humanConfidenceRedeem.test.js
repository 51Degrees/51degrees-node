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

// The Cloud Request Engine redeems a sealed Human Confidence result in its
// JSON call, as human-confidence.md sets out. Each test drives a stand-in
// for the cloud service, so no network is touched.

const util = require('util');
const { PipelineBuilder, FlowElement } = require('fiftyone.pipeline.core');
const { LruCache } = require('fiftyone.pipeline.engines');
const CloudRequestEngine = require('../cloudRequestEngine');
const DerivedCloudEngine = require('../derivedCloudEngine');
const errorMessages = require('../errorMessages');

const RESOURCE = 'AQTestResourceKey';
const LICENSE = 'TESTLICENSEKEYNOTREAL1234';
const SEALED = 'sealedResultNotReal_0123456789-abcdef';

// The keys the stand-in accepts. The sealed result is not one of them, so
// the cache key of a request is the same with it as without it.
const KEYS = ['header.user-agent'];

const PROPERTIES = {
  Products: {
    derived: {
      DataTier: 'CloudV5Bespoke',
      Properties: [
        { Name: 'HumanConfidence', Type: 'String', Category: 'Bot' },
        { Name: 'HumanConfidenceSource', Type: 'String', Category: 'Bot' }
      ]
    }
  }
};

// A response that redeemed a sealed result to High.
const REDEEMED = {
  derived: { humanconfidence: 'High', humanconfidencesource: 'Active' }
};

/**
 * A stand-in for the cloud service that keeps each request it is sent.
 */
class Cloud {
  /**
   * Makes the stand-in.
   *
   * @param {object} [options] options
   * @param {Function|object|string} [options.answer] the response to a JSON
   * call, or a function of the call's content that gives it
   * @param {*} [options.postFailure] what a JSON call rejects with
   * @param {*} [options.getFailure] what a discovery request rejects with
   */
  constructor ({ answer = REDEEMED, postFailure, getFailure } = {}) {
    this.answer = answer;
    this.postFailure = postFailure;
    this.getFailure = getFailure;
    this.posts = [];
    this.gets = [];
  }

  post (url, content) {
    if (url.includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify(PROPERTIES));
    }
    this.posts.push({ url, content: Object.assign({}, content) });
    if (this.postFailure !== undefined) {
      return Promise.reject(this.postFailure);
    }
    const answer = typeof this.answer === 'function'
      ? this.answer(content)
      : this.answer;
    return Promise.resolve(
      typeof answer === 'string' ? answer : JSON.stringify(answer));
  }

  get (url) {
    this.gets.push(url);
    if (this.getFailure !== undefined) {
      return Promise.reject(this.getFailure);
    }
    return Promise.resolve(JSON.stringify(
      url.includes('evidencekeys') ? KEYS : PROPERTIES));
  }
}

/**
 * A Pipeline with a Cloud Request Engine and the derived cloud engine.
 *
 * @param {object} [options] options
 * @param {Cloud} [options.cloud] the stand-in for the cloud service
 * @param {string} [options.licenseKey] the License Key to configure
 * @param {object} [options.cache] the Cloud Request Engine's cache
 * @param {Array<string>} [options.requestedProperties] the configured list
 * @returns {object} the engine, the pipeline, the stand-in and the logs
 */
function build ({
  cloud = new Cloud(),
  licenseKey = LICENSE,
  cache,
  requestedProperties
} = {}) {
  const engine = new CloudRequestEngine({
    resourceKey: RESOURCE,
    licenseKey,
    requestedProperties,
    requestClient: cloud,
    cache
  });
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(engine).add(new DerivedCloudEngine()).build();
  const logs = [];
  for (const level of ['error', 'warn', 'info', 'debug']) {
    pipeline.on(level, (message) => logs.push(message));
  }
  return { engine, pipeline, cloud, logs };
}

/**
 * Processes a Flow Data with the evidence given.
 *
 * @param {object} pipeline the pipeline
 * @param {object} evidence the evidence
 * @returns {Promise<object>} the Flow Data and what processing rejected
 * with, if anything
 */
async function run (pipeline, evidence) {
  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    flowData.evidence.add(key, value);
  }
  const rejection = await flowData.process().then(
    () => undefined, (error) => error);
  return { flowData, rejection };
}

/**
 * A Pipeline of the derived cloud engine alone, with no Cloud Request
 * Engine. Process exceptions are not suppressed, so any error rejects.
 *
 * @returns {object} the pipeline
 */
function withoutRequestEngine () {
  return new PipelineBuilder({
    addJavaScriptBuilder: false,
    suppressProcessExceptions: false
  }).add(new DerivedCloudEngine()).build();
}

/**
 * Counts the HTTP and HTTPS requests made until restore is called.
 *
 * @returns {Function} gives the count, with restore to stop counting
 */
function watchRequests () {
  const spies = [require('http'), require('https')].flatMap((module) =>
    ['request', 'get'].map((name) => jest.spyOn(module, name)));
  const count = () => spies.reduce((all, spy) => all + spy.mock.calls.length, 0);
  count.restore = () => spies.forEach((spy) => spy.mockRestore());
  return count;
}

/**
 * The evidence of a request that carries a sealed result for a page the
 * engine started.
 *
 * @param {CloudRequestEngine} engine the engine
 * @param {object} [more] more evidence
 * @returns {{evidence: object, transaction: string}} the evidence, and the
 * transaction the engine kept for the page
 */
function sealedRequest (engine, more = {}) {
  const { page, script } = engine.newHumanConfidencePage();
  return {
    evidence: Object.assign({
      'header.user-agent': 'Mozilla/5.0 (test)',
      'query.humanconfidence': SEALED,
      'query.humanconfidencepage': page
    }, more),
    transaction: new URL(script).searchParams.get('transaction')
  };
}

/**
 * The two Properties as a read gives them.
 *
 * @param {object} flowData the processed Flow Data
 * @returns {object} each Property's value, or its message where it has none
 */
function read (flowData) {
  const shown = (name) => {
    const property = flowData.derived[name];
    return property.hasValue ? property.value : { none: property.noValueMessage };
  };
  return {
    HumanConfidence: shown('humanconfidence'),
    HumanConfidenceSource: shown('humanconfidencesource')
  };
}

const MEDIUM_ACTIVE = { HumanConfidence: 'Medium', HumanConfidenceSource: 'Active' };

describe('a sealed Human Confidence result', () => {
  test('that redeems gives the Value in the response, with the source ' +
    'Active', async () => {
    const { engine, pipeline, cloud } = build();
    const { evidence, transaction } = sealedRequest(engine);
    const { flowData, rejection } = await run(pipeline, evidence);

    expect(rejection).toBeUndefined();
    expect(read(flowData)).toEqual(
      { HumanConfidence: 'High', HumanConfidenceSource: 'Active' });
    // Redeemed through the JSON call, and through nothing else.
    expect(cloud.posts).toHaveLength(1);
    expect(cloud.posts[0].url).toBe(
      'https://cloud.51degrees.com/api/v4/' + RESOURCE + '.json');
    expect(cloud.gets.some((url) => /redeem/i.test(url))).toBe(false);
    expect(cloud.posts[0].content).toMatchObject({
      humanconfidence: SEALED,
      transaction,
      license: LICENSE,
      values: 'derived.HumanConfidence'
    });
  });

  test('names derived.HumanConfidence beside the configured list, and ' +
    'reports only the configured names the answer left out', async () => {
    // An answer that holds neither name, so a report made for the list the
    // call sent would name both.
    const cloud = new Cloud({ answer: { derived: {} } });
    const { engine, pipeline, logs } = build({
      cloud, requestedProperties: ['device.ismobile']
    });
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);
    await run(pipeline, { 'header.user-agent': 'Mozilla/5.0 (test)' });

    expect(cloud.posts.map((post) => post.content.values)).toEqual([
      'device.ismobile,derived.HumanConfidence',
      'device.ismobile'
    ]);
    expect(read(flowData)).toEqual(MEDIUM_ACTIVE);
    const reports = logs.filter((log) => /did not return/.test(String(log)));
    expect(reports).toHaveLength(1);
    expect(reports[0]).toContain('device.ismobile');
    expect(reports[0]).not.toContain('HumanConfidence');
  });

  test('is sent to the cloud with one transaction, the one the engine ' +
    'kept, when the Evidence holds a transaction and a challenge',
  async () => {
    const { engine, pipeline, cloud } = build();
    const { evidence, transaction } = sealedRequest(engine, {
      'query.transaction': 'fromTheRequest',
      'header.Transaction': 'fromAHeader',
      'cookie.CHALLENGE': 'fromACookie',
      'query.challenge': 'olderName'
    });
    await run(pipeline, evidence);

    const names = Object.keys(cloud.posts[0].content);
    expect(names.filter((name) => /^(transaction|challenge)$/i.test(name)))
      .toEqual(['transaction']);
    expect(cloud.posts[0].content.transaction).toBe(transaction);
  });

  test('is redeemed with the configured License Key and never one from ' +
    'Evidence', async () => {
    const { engine, pipeline, cloud } = build();
    const { evidence } = sealedRequest(engine, {
      'query.license': 'EVIDENCELICENSEKEY',
      'header.licence': 'EVIDENCELICENCEKEY'
    });
    await run(pipeline, evidence);

    const content = cloud.posts[0].content;
    expect(Object.keys(content).filter((name) => /^licen[cs]e$/i.test(name)))
      .toEqual(['license']);
    expect(content.license).toBe(LICENSE);
  });

  test('read twice makes one request to the cloud service', async () => {
    const { engine, pipeline, cloud } = build();
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

    const first = flowData.derived.humanconfidence.value;
    const second = flowData.derived.humanconfidence.value;
    expect([first, second]).toEqual(['High', 'High']);
    expect(cloud.posts).toHaveLength(1);
  });

  test('is neither served from nor stored in a cache', async () => {
    const cloud = new Cloud({
      answer: (content) => content.humanconfidence === undefined
        ? { derived: { humanconfidence: 'Low', humanconfidencesource: 'Passive' } }
        : REDEEMED
    });
    const { engine, pipeline } = build({
      cloud, cache: new LruCache({ size: 10 })
    });
    await engine.ready();
    const plain = { 'header.user-agent': 'Mozilla/5.0 (test)' };

    // Stored: a request with no sealed result.
    await run(pipeline, plain);
    expect(cloud.posts).toHaveLength(1);

    // Not served: the same evidence with a sealed result goes to the cloud.
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);
    expect(cloud.posts).toHaveLength(2);
    expect(read(flowData).HumanConfidence).toBe('High');

    // Not stored: the next plain request is served the first answer.
    const { flowData: after } = await run(pipeline, plain);
    expect(cloud.posts).toHaveLength(2);
    expect(read(after)).toEqual(
      { HumanConfidence: 'Low', HumanConfidenceSource: 'Passive' });
  });

  test('gives a new transaction to each page', () => {
    const { engine } = build();
    const pages = [];
    for (let i = 0; i < 50; i++) {
      pages.push(engine.newHumanConfidencePage());
    }
    const transactions = pages.map(
      ({ script }) => new URL(script).searchParams.get('transaction'));
    expect(new Set(transactions).size).toBe(50);
    expect(new Set(pages.map(({ page }) => page)).size).toBe(50);
    for (const { page, script } of pages) {
      expect(script).not.toContain(page);
      expect(script.startsWith(
        'https://cloud.51degrees.com/api/v4/' + RESOURCE + '.js?')).toBe(true);
    }
  });

  test('gives the consumer no accessor for the transaction', async () => {
    const { engine, pipeline } = build();
    const { evidence, transaction } = sealedRequest(engine);
    const { flowData } = await run(pipeline, evidence);

    // Everything reachable from the engine and the Flow Data, but not the
    // stand-in, which keeps what it was sent.
    engine.requestClient = undefined;
    const everything = util.inspect(
      [engine, flowData.derived, flowData.cloud, flowData.errors],
      { depth: 6, showHidden: true });
    expect(everything).not.toContain(transaction);
    expect(everything).not.toContain(SEALED);
  });
});

// Only a query.humanconfidence that is not empty is a sealed result. A value
// anywhere else is neither sent nor redeemed, and the request's own
// transaction and challenge stay out of the call.
describe('a sealed result under another key', () => {
  test.each([
    ['a header', { 'header.humanconfidence': SEALED }],
    ['a cookie', { 'cookie.HumanConfidence': SEALED }],
    ['server.', { 'server.humanconfidence': SEALED }],
    ['no prefix', { humanconfidence: SEALED }],
    ['a header, beside an empty query value', {
      'query.humanconfidence': '',
      'header.humanconfidence': SEALED
    }]
  ])('in %s is not sent, redeemed or cached', async (name, more) => {
    // The stand-in redeems whatever it is sent as humanconfidence.
    const cloud = new Cloud({
      answer: (content) => content.humanconfidence === undefined
        ? { derived: { humanconfidence: 'Low', humanconfidencesource: 'Passive' } }
        : REDEEMED
    });
    const { engine, pipeline } = build({
      cloud, cache: new LruCache({ size: 10 })
    });
    const { page } = engine.newHumanConfidencePage();
    const plain = { 'header.user-agent': 'Mozilla/5.0 (test)' };
    const { flowData } = await run(pipeline, Object.assign({
      'query.humanconfidencepage': page,
      'query.transaction': 'fromThePage',
      'header.transaction': 'fromAHeader',
      'cookie.challenge': 'fromACookie'
    }, plain, more));

    expect(cloud.posts).toHaveLength(1);
    const sent = Object.keys(cloud.posts[0].content).filter((key) =>
      /^(humanconfidence|transaction|challenge)$/i.test(key));
    expect(sent).toEqual([]);
    expect(read(flowData)).toEqual(
      { HumanConfidence: 'Low', HumanConfidenceSource: 'Passive' });

    // The answer cached for the same Evidence is the one with no Value.
    const { flowData: after } = await run(pipeline, plain);
    expect(cloud.posts).toHaveLength(1);
    expect(read(after)).toEqual(
      { HumanConfidence: 'Low', HumanConfidenceSource: 'Passive' });
  });
});

// Each case in "Where the sealed result is not redeemed" gives Medium and
// Active, and the read adds no error of its own.
describe('a sealed Human Confidence result not redeemed', () => {
  /**
   * Checks the two Properties are Medium and Active, and that no error is
   * the derived engine's.
   *
   * @param {object} flowData the processed Flow Data
   */
  const expectMediumActive = (flowData) => {
    expect(read(flowData)).toEqual(MEDIUM_ACTIVE);
    expect(Object.keys(flowData.errors || {})).not.toContain('derived');
  };

  test('where the engine has no License Key, and the sealed result is not ' +
    'sent', async () => {
    const { engine, pipeline, cloud } = build({ licenseKey: '' });
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

    expectMediumActive(flowData);
    expect(cloud.posts).toHaveLength(1);
    expect(cloud.posts[0].content.humanconfidence).toBeUndefined();
    expect(cloud.posts[0].content.transaction).toBeUndefined();
  });

  test('where the request names no page', async () => {
    const { engine, pipeline, cloud } = build();
    const { evidence } = sealedRequest(engine);
    delete evidence['query.humanconfidencepage'];
    const { flowData } = await run(pipeline, evidence);

    expectMediumActive(flowData);
    expect(cloud.posts[0].content.humanconfidence).toBeUndefined();
  });

  test('where the request names a page the engine did not start',
    async () => {
      const { engine, pipeline, cloud } = build();
      const { evidence } = sealedRequest(engine, {
        'query.humanconfidencepage': 'notAPageTheEngineStarted'
      });
      const { flowData } = await run(pipeline, evidence);

      expectMediumActive(flowData);
      expect(cloud.posts[0].content.humanconfidence).toBeUndefined();
    });

  test('where the page\'s transaction was used before', async () => {
    const { engine, pipeline, cloud } = build();
    const { evidence } = sealedRequest(engine);
    const first = await run(pipeline, evidence);
    const second = await run(pipeline, evidence);

    expect(read(first.flowData).HumanConfidence).toBe('High');
    expectMediumActive(second.flowData);
    expect(cloud.posts[1].content.humanconfidence).toBeUndefined();
    expect(cloud.posts[1].content.transaction).toBeUndefined();
  });

  test('where the page\'s transaction has been kept longer than ten minutes',
    async () => {
      const { engine, pipeline, cloud } = build();
      await engine.ready();
      const start = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
      try {
        const { evidence } = sealedRequest(engine);
        clock.mockReturnValue(start + 10 * 60 * 1000 + 1);
        const { flowData } = await run(pipeline, evidence);

        expectMediumActive(flowData);
        expect(cloud.posts[0].content.humanconfidence).toBeUndefined();
        expect(cloud.posts[0].content.transaction).toBeUndefined();
      } finally {
        clock.mockRestore();
      }
    });

  test('where the Pipeline has no Cloud Request Engine, and no request is ' +
    'made', async () => {
    const pipeline = withoutRequestEngine();
    const requests = watchRequests();
    try {
      const { flowData, rejection } = await run(pipeline, {
        'header.user-agent': 'Mozilla/5.0 (test)',
        'query.humanconfidence': SEALED,
        'query.humanconfidencepage': 'anyPage'
      });

      expect(rejection).toBeUndefined();
      expectMediumActive(flowData);
      expect(flowData.errors || {}).toEqual({});
      expect(flowData.tryGet('cloud')).toBeUndefined();
      expect(requests()).toBe(0);
    } finally {
      requests.restore();
    }
  });

  test('where the engine made no request, as discovery failed', async () => {
    const cloud = new Cloud({ getFailure: new Error('unreachable') });
    const { engine, pipeline } = build({ cloud });
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

    expectMediumActive(flowData);
    expect(cloud.posts).toHaveLength(0);
  });

  test.each([
    ['the request failed', { statusCode: 500, headers: {}, content: 'Server error' }],
    ['the request did not complete in time', new Error('ETIMEDOUT')]
  ])('where %s, which is recorded once as the engine\'s error',
    async (name, failure) => {
      const cloud = new Cloud({ postFailure: failure });
      const { engine, pipeline } = build({ cloud });
      const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

      expectMediumActive(flowData);
      expect(Object.keys(flowData.errors)).toEqual(['cloud']);
      expect(flowData.errors.cloud).toHaveLength(1);
    });

  test('where the errors list says HumanConfidence is not covered',
    async () => {
      const cloud = new Cloud({
        answer: {
          errors: ['The license key does not cover the property ' +
            'derived.HumanConfidence.']
        }
      });
      const { engine, pipeline } = build({ cloud });
      const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

      expectMediumActive(flowData);
    });

  test.each([
    ['the derived member is absent', { device: { ismobile: false } }],
    ['the derived member is null', { derived: null, derivednullreason: 'No.' }],
    ['the derived member holds no humanconfidence', { derived: { other: 1 } }],
    ['humanconfidence is null', {
      derived: { humanconfidence: null, humanconfidencenullreason: 'No.' }
    }],
    ['humanconfidence is Unknown', { derived: { humanconfidence: 'Unknown' } }],
    ['humanconfidence is another word', { derived: { humanconfidence: 'high' } }],
    ['the response is not JSON', 'not json'],
    ['the response is JSON null', 'null'],
    ['the response is a JSON list', '[{"derived":{"humanconfidence":"High"}}]'],
    ['the response is a JSON number', '5'],
    ['the response is a JSON string', '"High"']
  ])('where %s', async (name, answer) => {
    const cloud = new Cloud({ answer });
    const { engine, pipeline } = build({ cloud });
    const { flowData } = await run(pipeline, sealedRequest(engine).evidence);

    expectMediumActive(flowData);
  });
});

describe('the sealed result, the transaction and the License Key', () => {
  /**
   * Everything a value shows when it is logged or printed.
   *
   * @param {*} value the value
   * @returns {string} its text
   */
  const shown = (value) =>
    util.inspect(value, { depth: null, showHidden: true }) + '\n' +
    String(value);

  /**
   * Every run of four characters of a value, each of which counts as a
   * part of it.
   *
   * @param {string} value the value
   * @returns {Array<string>} the parts
   */
  const partsOf = (value) => Array.from({ length: value.length - 3 },
    (unused, i) => value.slice(i, i + 4));

  /**
   * Checks the text holds neither the sealed result nor the transaction,
   * and no part of the License Key, its last four characters included.
   *
   * @param {string} text the text
   * @param {string} [transaction] the transaction
   */
  const expectNone = (text, transaction) => {
    for (const secret of [SEALED, transaction, encodeURIComponent(SEALED)]) {
      if (secret !== undefined) {
        expect([secret, text.includes(secret)]).toEqual([secret, false]);
      }
    }
    expect(partsOf(LICENSE).filter((part) => text.includes(part)))
      .toEqual([]);
  };

  test.each([
    ['an errors list', {
      statusCode: 400,
      headers: {},
      content: JSON.stringify({ errors: [] })
    }],
    ['a body that is not JSON', { statusCode: 500, headers: {}, content: '' }]
  ])('are in no log entry or error message when the cloud echoes them ' +
    'in %s', async (name, failure) => {
    const { engine, pipeline, logs } = build({
      cloud: new Cloud({ postFailure: failure })
    });
    const { evidence, transaction } = sealedRequest(engine);
    const echo = `license=${LICENSE} humanconfidence=${SEALED} ` +
      `transaction=${transaction} ${encodeURIComponent(SEALED)}`;
    failure.content = name === 'an errors list'
      ? JSON.stringify({ errors: [echo] })
      : echo;
    const { flowData, rejection } = await run(pipeline, evidence);

    expect(read(flowData)).toEqual(MEDIUM_ACTIVE);
    expect(flowData.errors.cloud).toHaveLength(1);
    expectNone(shown(logs), transaction);
    expectNone(shown(flowData.errors), transaction);
    expectNone(shown(rejection), transaction);
  });

  test('are in no log entry when the cloud echoes them in its answer\'s ' +
    'errors or warnings', async () => {
    const echo = { text: '' };
    const cloud = new Cloud({
      answer: () => ({ warnings: [echo.text], errors: [echo.text] })
    });
    const { engine, pipeline, logs } = build({ cloud });
    const { evidence, transaction } = sealedRequest(engine);
    echo.text = `${LICENSE} ${SEALED} ${transaction}`;
    const { flowData, rejection } = await run(pipeline, evidence);

    expect(logs.some((log) => String(log).includes('[hidden]'))).toBe(true);
    expectNone(shown(logs), transaction);
    expectNone(shown(flowData.errors), transaction);
    expectNone(shown(rejection), transaction);
  });

  test('are in no log entry when the evidence holds the sealed result ' +
    'under more than one prefix', async () => {
    const { engine, pipeline, logs } = build();
    const { evidence, transaction } = sealedRequest(engine, {
      'cookie.humanconfidence': SEALED + 'cookie',
      'header.humanconfidence': SEALED + 'header'
    });
    await run(pipeline, evidence);

    expectNone(shown(logs), transaction);
  });

  test('are in no evidence conflict warning when the evidence holds them ' +
    'under other names', async () => {
    const { engine, pipeline, logs } = build();
    const { page, script } = engine.newHumanConfidencePage();
    const transaction = new URL(script).searchParams.get('transaction');
    // The page sends each value back under a name of its own, as a header
    // and as a cookie, so each name conflicts with itself.
    const { flowData } = await run(pipeline, {
      'header.user-agent': 'Mozilla/5.0 (test)',
      'query.humanconfidence': SEALED,
      'query.humanconfidencepage': page,
      'header.t': transaction,
      'cookie.t': transaction,
      'header.copy': SEALED,
      'cookie.copy': SEALED,
      'header.k': LICENSE,
      'cookie.k': LICENSE
    });

    expect(read(flowData).HumanConfidence).toBe('High');
    const warnings = logs.filter((log) => /conflicts with/.test(String(log)));
    expect(warnings).toHaveLength(3);
    expectNone(shown(logs), transaction);
  });
});

describe('the License Key on a request with no sealed result', () => {
  const shown = (value) =>
    util.inspect(value, { depth: null, showHidden: true }) + '\n' +
    String(value);
  const parts = Array.from({ length: LICENSE.length - 3 },
    (unused, i) => LICENSE.slice(i, i + 4));
  const partsIn = (text) => parts.filter((part) => text.includes(part));

  test.each([
    ['a failed call', (echo) => ({
      postFailure: { statusCode: 403, headers: {}, content: echo }
    })],
    ['an errors list', (echo) => ({
      answer: { errors: [echo] }
    })],
    ['a warning', (echo) => ({
      answer: { warnings: [echo], derived: REDEEMED.derived }
    })]
  ])('is in no part in any message when the cloud echoes it in %s',
    async (name, answerOf) => {
      const echo = `license=${LICENSE} key ${LICENSE}.`;
      const { pipeline, logs } = build({ cloud: new Cloud(answerOf(echo)) });
      const { flowData, rejection } = await run(pipeline,
        { 'header.user-agent': 'Mozilla/5.0 (test)' });

      expect(logs.length + Object.keys(flowData.errors).length)
        .toBeGreaterThan(0);
      expect(partsIn(shown(logs))).toEqual([]);
      expect(partsIn(shown(flowData.errors))).toEqual([]);
      expect(partsIn(shown(rejection))).toEqual([]);
    });

  test('is in no part in any message where the setting holds two keys',
    async () => {
      const other = 'SECONDKEYNOTREAL9876';
      const { pipeline, logs } = build({
        licenseKey: LICENSE + '|' + other,
        cloud: new Cloud({
          answer: { errors: [`Not valid: ${LICENSE}, and ${other}.`] }
        })
      });
      const { flowData } = await run(pipeline,
        { 'header.user-agent': 'Mozilla/5.0 (test)' });

      const text = shown(logs) + shown(flowData.errors);
      expect(text).toContain('[hidden]');
      expect(partsIn(text)).toEqual([]);
      expect(text).not.toContain(other.slice(-4));
    });
});

describe('HumanConfidence with a credential that does not carry it', () => {
  test('gives no value and the cloud service\'s reason, on a request with ' +
    'no sealed result', async () => {
    const cloud = new Cloud({
      answer: {
        derived: {
          humanconfidence: null,
          humanconfidencenullreason: 'HumanConfidence is a paid property.',
          humanconfidencesource: null,
          humanconfidencesourcenullreason:
            'HumanConfidenceSource is a paid property.'
        }
      }
    });
    const { pipeline } = build({ cloud });
    const { flowData } = await run(pipeline,
      { 'header.user-agent': 'Mozilla/5.0 (test)' });

    expect(read(flowData)).toEqual({
      HumanConfidence: { none: 'HumanConfidence is a paid property.' },
      HumanConfidenceSource: { none: 'HumanConfidenceSource is a paid property.' }
    });
  });

  test('gives no value and says why where the response leaves it out',
    async () => {
      const cloud = new Cloud({ answer: { derived: { humanconfidence: 'High' } } });
      const { pipeline } = build({ cloud });
      const { flowData } = await run(pipeline,
        { 'header.user-agent': 'Mozilla/5.0 (test)' });

      expect(flowData.derived.humanconfidence.value).toBe('High');
      expect(() => flowData.derived.humanconfidencesource)
        .toThrow(/humanconfidencesource/i);
    });
});

describe('newHumanConfidencePage', () => {
  test('needs a resource key, as the page loads the client script with it',
    () => {
      const engine = new CloudRequestEngine({
        licenseKey: LICENSE,
        requestedProperties: ['derived.HumanConfidence'],
        requestClient: new Cloud()
      });
      expect(() => engine.newHumanConfidencePage()).toThrow(/resourceKey/);
    });
});

describe('DerivedCloudEngine', () => {
  test.each([
    ['carries no sealed result', {}],
    ['carries an empty one', { 'query.humanconfidence': '' }],
    ['carries one outside the query', { 'header.humanconfidence': SEALED }]
  ])('with no Cloud Request Engine, on a request that %s, gives no value ' +
    'and the reason', async (name, more) => {
    const { flowData, rejection } = await run(withoutRequestEngine(),
      Object.assign({ 'header.user-agent': 'Mozilla/5.0 (test)' }, more));

    expect(rejection).toBeUndefined();
    expect(flowData.errors || {}).toEqual({});
    for (const wanted of ['HumanConfidence', 'HumanConfidenceSource']) {
      const property = flowData.derived[wanted.toLowerCase()];
      expect(property.hasValue).toBe(false);
      expect(property.noValueMessage).toBe(util.format(
        errorMessages.missingPropertyNoCloudRequestEngine, wanted, 'derived'));
      expect(property.noValueMessage).toMatch(/no Cloud Request Engine/);
    }
  });

  test('with no Cloud Request Engine, lists the two Properties', () => {
    const engine = new DerivedCloudEngine();
    new PipelineBuilder({ addJavaScriptBuilder: false }).add(engine).build();
    expect(Object.keys(engine.properties))
      .toEqual(['humanconfidence', 'humanconfidencesource']);
  });

  test('refuses a Pipeline with the Cloud Request Engine after it', () => {
    const engine = new CloudRequestEngine({
      resourceKey: RESOURCE, requestClient: new Cloud()
    });
    expect(() => new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(new DerivedCloudEngine()).add(engine).build())
      .toThrow(/No CloudRequestEngine/);
  });

  // The DerivedPropertyElement also gives its Element Data under 'derived'.
  // A Pipeline keeps one element for each data key, so the two would
  // replace each other's data without a word.
  test('refuses a Pipeline that already has an element under derived',
    () => {
      const engine = new CloudRequestEngine({
        resourceKey: RESOURCE, requestClient: new Cloud()
      });
      const other = new FlowElement({ dataKey: 'Derived' });
      expect(() => new PipelineBuilder({ addJavaScriptBuilder: false })
        .add(engine).add(other).add(new DerivedCloudEngine()).build())
        .toThrow(/'derived'/);
    });
});
