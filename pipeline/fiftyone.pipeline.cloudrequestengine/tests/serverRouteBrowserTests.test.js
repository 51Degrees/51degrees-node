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

// The server route. A publisher's server runs the Pipeline, gives the page
// the client script the JavaScript Builder writes, and the page posts the
// browser test answers back to the server, which passes them on to the
// cloud through the Cloud Request Engine. These tests check that every
// iteration carries the session id, the sequence and the answers to the
// cloud, that the server can supply the visitor's IP address, JA4 and H2,
// and that the cloud's browser tests reach the page.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const { LruCache } = require('fiftyone.pipeline.engines');
const CloudRequestEngine = require('../cloudRequestEngine');
const CloudEngine = require('../cloudEngine');
const MockRequestClient = require('./classes/mockRequestClient');

const RESOURCE_KEY = 'AAAAAAAAAAAA';

const SCRIPT = 'document.cookie = "51D_BrowserTestsAnswer=answer";';

const properties = {
  Products: {
    browserderived: {
      DataTier: 'CloudV4Free',
      Properties: [{
        Name: 'BrowserTestsJavaScript',
        Type: 'JavaScript',
        Category: 'Javascript',
        DelayExecution: false
      }]
    },
    derived: {
      DataTier: 'CloudV4Free',
      Properties: [
        { Name: 'HumanConfidence', Type: 'String', Category: 'Human' },
        { Name: 'HumanConfidenceSource', Type: 'String', Category: 'Human' }
      ]
    },
    FODid: {
      DataTier: 'CloudV4Free',
      Properties: [{ Name: 'IdProbGlobal', Type: 'String', Category: 'Id' }]
    }
  }
};

// The cloud's evidence keys. The browser test answers, the session id and
// the sequence are not among them, as they are not in the list the cloud
// gives today, so these tests also show they are sent all the same.
const keys = [
  'header.User-Agent',
  'query.User-Agent',
  'server.client-ip',
  'query.client-ip',
  'query.ja4',
  'query.h2',
  'query.id.usage'
];

// The first iteration hands out the browser tests and holds the 51Did back.
const handsOutTests = {
  browserderived: { browsertestsjavascript: SCRIPT },
  derived: { humanconfidence: 'Medium', humanconfidencesource: 'Passive' },
  fodid: {
    idprobglobal: null,
    idprobglobalnullreason: 'The browser test answers have not come back yet.'
  },
  javascriptProperties: ['browserderived.browsertestsjavascript']
};

// The iteration carrying the answers makes the 51Did.
const carriesAnswers = {
  browserderived: {
    browsertestsjavascript: null,
    browsertestsjavascriptnullreason: 'The answers have been sent.'
  },
  derived: { humanconfidence: 'sealed', humanconfidencesource: 'Active' },
  fodid: { idprobglobal: 'AQID' },
  javascriptProperties: []
};

// Answers each post with the next body, and keeps what each post sent.
class IterationsClient extends MockRequestClient {
  constructor (bodies) {
    super({ properties, keys, json: bodies[0] });
    this.bodies = bodies;
    this.posts = [];
  }

  post (url, content, origin) {
    this.json = this.bodies[Math.min(this.posts.length, this.bodies.length - 1)];
    this.posts.push({ url, content: Object.assign({}, content) });
    return super.post(url, content, origin);
  }
}

const cloudEngine = (dataKey) => {
  const engine = new CloudEngine();
  engine.dataKey = dataKey;
  return engine;
};

const build = async (client, cache) => {
  const cloud = new CloudRequestEngine({
    resourceKey: RESOURCE_KEY,
    requestClient: client,
    cache
  });
  const pipeline = new PipelineBuilder({
    javascriptBuilderSettings: { endPoint: '/json' }
  })
    .add(cloud)
    .add(cloudEngine('browserderived'))
    .add(cloudEngine('derived'))
    .add(cloudEngine('fodid'))
    .build();
  await cloud.ready();
  return pipeline;
};

// What the publisher's server adds from the visitor's request on every
// iteration, as a CDN such as Fastly would supply it.
const visitor = {
  'header.user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'server.client-ip': '81.2.69.142',
  'query.ja4': 't13d1516h2_8daaf6152771_02713d6af862',
  'query.h2': '1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p',
  'query.id.usage': 'non-marketing',
  'header.host': 'publisher.example',
  'header.protocol': 'https'
};

const iteration = async (pipeline, evidence) => {
  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(Object.assign({}, visitor, evidence))) {
    flowData.evidence.add(key, value);
  }
  await flowData.process();
  return flowData;
};

// The page's next request, as the client script sends it: the session id
// and sequence written into the script, and the browser test answers.
const pageCallback = (first, answers) => Object.assign({
  'query.session-id': first.sequence.get('session-id'),
  'query.sequence': String(first.sequence.get('sequence'))
}, answers);

const answers = {
  'query.51D_BrowserTestsAnswer': 'answer',
  'query.bc-run': 'run-token'
};

describe('server route browser tests', () => {
  test('sends the session id, sequence, IP address, JA4 and H2 on the ' +
    'first iteration', async () => {
    const client = new IterationsClient([handsOutTests]);
    const pipeline = await build(client);
    const first = await iteration(pipeline, {});
    expect(client.posts).toHaveLength(1);
    const sent = client.posts[0].content;
    expect(sent['session-id']).toBe(first.sequence.get('session-id'));
    expect(sent.sequence).toBe(1);
    expect(sent['client-ip']).toBe(visitor['server.client-ip']);
    expect(sent.ja4).toBe(visitor['query.ja4']);
    expect(sent.h2).toBe(visitor['query.h2']);
    expect(sent['user-agent']).toBe(visitor['header.user-agent']);
    expect(sent['id.usage']).toBe('non-marketing');
  });

  test('gives the page the browser tests, the session id and the sequence',
    async () => {
      const client = new IterationsClient([handsOutTests]);
      const pipeline = await build(client);
      const first = await iteration(pipeline, {});
      const json = first.jsonbundler.json;
      expect(json.javascriptProperties)
        .toContain('browserderived.browsertestsjavascript');
      expect(json.browserderived.browsertestsjavascript).toBe(SCRIPT);
      // The 51Did is held back, so the page has none yet.
      expect(json.fodid.idprobglobal).toBeFalsy();
      const script = first.javascriptbuilder.javascript;
      expect(script).toContain(first.sequence.get('session-id'));
      expect(script).toContain('var sequence = 1;');
      expect(script).toContain("'https://publisher.example/json'");
    });

  test('passes the answers, the same session id and a higher sequence on ' +
    'with the iteration that carries them', async () => {
    const client = new IterationsClient([handsOutTests, carriesAnswers]);
    const pipeline = await build(client);
    const first = await iteration(pipeline, {});
    const second = await iteration(pipeline, pageCallback(first, answers));
    expect(client.posts).toHaveLength(2);
    const [one, two] = client.posts.map((post) => post.content);
    expect(two['session-id']).toBe(one['session-id']);
    expect(two.sequence).toBeGreaterThan(one.sequence);
    expect(two['51D_BrowserTestsAnswer']).toBe('answer');
    expect(two['bc-run']).toBe('run-token');
    expect(two['client-ip']).toBe(visitor['server.client-ip']);
    expect(two.ja4).toBe(visitor['query.ja4']);
    expect(two.h2).toBe(visitor['query.h2']);
    expect(second.fodid.idprobglobal.value).toBe('AQID');
    expect(second.derived.humanconfidencesource.value).toBe('Active');
  });

  test('passes answers the page sent as cookies on too', async () => {
    const client = new IterationsClient([handsOutTests, carriesAnswers]);
    const pipeline = await build(client);
    const first = await iteration(pipeline, {});
    await iteration(pipeline, pageCallback(first, {
      'cookie.51D_BrowserTestsAnswer': 'answer'
    }));
    expect(client.posts[1].content['51D_BrowserTestsAnswer']).toBe('answer');
  });

  test('sends every iteration up to the last the script makes', async () => {
    const client = new IterationsClient([handsOutTests]);
    const pipeline = await build(client);
    let previous = await iteration(pipeline, {});
    for (let i = 0; i < 4; i++) {
      previous = await iteration(pipeline, pageCallback(previous, answers));
    }
    const sent = client.posts.map((post) => post.content);
    expect(sent).toHaveLength(5);
    expect(new Set(sent.map((body) => body['session-id'])).size).toBe(1);
    for (let i = 1; i < sent.length; i++) {
      expect(sent[i].sequence).toBeGreaterThan(sent[i - 1].sequence);
    }
  });

  // A cache keyed on the cloud's evidence keys alone would serve the answer
  // to the first iteration again for the iteration that carries the
  // answers, which are not among those keys. And the browser tests and a
  // sealed result are made for one visitor, so no other visitor may be
  // given them.
  test('neither serves nor stores an answer made for one visitor, with a ' +
    'cache', async () => {
    const client = new IterationsClient([handsOutTests, carriesAnswers]);
    const pipeline = await build(client, new LruCache({ size: 10 }));
    const first = await iteration(pipeline, {});
    const second = await iteration(pipeline, pageCallback(first, answers));
    expect(client.posts).toHaveLength(2);
    expect(second.fodid.idprobglobal.value).toBe('AQID');
    // Another visitor with the same evidence gets an answer of their own.
    await iteration(pipeline, {});
    expect(client.posts).toHaveLength(3);
  });

  test('neither serves nor stores browser tests or a sealed result for a ' +
    'call that asked for no 51Did, with a cache', async () => {
    const tests = Object.assign({}, handsOutTests);
    delete tests.fodid;
    const sealed = Object.assign({}, carriesAnswers);
    delete sealed.fodid;
    const client = new IterationsClient([tests, sealed, tests]);
    const pipeline = await build(client, new LruCache({ size: 10 }));
    const first = await iteration(pipeline, {});
    await iteration(pipeline, pageCallback(first, answers));
    expect(client.posts).toHaveLength(2);
    expect(client.posts[1].content['bc-run']).toBe('run-token');
    await iteration(pipeline, {});
    expect(client.posts).toHaveLength(3);
  });

  test('still serves an answer with nothing made for one visitor from the ' +
    'cache', async () => {
    const plain = {
      derived: { humanconfidence: 'Medium', humanconfidencesource: 'Passive' },
      javascriptProperties: []
    };
    const client = new IterationsClient([plain]);
    const pipeline = await build(client, new LruCache({ size: 10 }));
    await iteration(pipeline, {});
    await iteration(pipeline, {});
    expect(client.posts).toHaveLength(1);
  });
});
