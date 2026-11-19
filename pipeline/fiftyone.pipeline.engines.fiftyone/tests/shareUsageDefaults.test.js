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

// Usage sharing shares every query string and form parameter unless the
// share all query string parameters option is turned off, and shares no
// cookie but those whose names start 51D_, even when all Evidence is shared.

const http = require('http');
const zlib = require('zlib');
const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');
const ShareUsageEvidenceKeyFilter = require('../shareUsageEvidenceKeyFilter');

// The longest to wait for the element to send what it queued.
const SEND_TIMEOUT_MS = 10000;
// How often to look for the message while waiting.
const POLL_INTERVAL_MS = 50;

// The Evidence of one request: a header, two query string or form
// parameters, one of them a 51D_ value, a session cookie, another site
// cookie and a 51D_ cookie.
const EVIDENCE = {
  'header.user-agent': 'agent value',
  'query.campaign': 'campaign value',
  'query.51D_ScreenPixelsWidth': 'width value',
  'cookie.sessionid': 'session value',
  'cookie._ga': 'analytics value',
  'cookie.51D_ProfileIds': 'profile value'
};

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

// Shares one request's Evidence through a usage sharing element built with
// the options given, and gives the message the receiver got.
const messageFor = async (options) => {
  const pipeline = new PipelineBuilder()
    .add(new ShareUsage(Object.assign({
      requestedPackageSize: 1,
      endpoint: `http://127.0.0.1:${port}/`
    }, options)))
    .build();
  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(EVIDENCE)) {
    flowData.evidence.add(key, value);
  }
  await flowData.process();
  const end = Date.now() + SEND_TIMEOUT_MS;
  while (received.length === 0 && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  expect(received.length).toBe(1);
  return received[0];
};

describe('usage sharing by default', () => {
  test('the filter keeps every query string and form parameter', () => {
    const filter = new ShareUsageEvidenceKeyFilter({});

    expect(filter.filterEvidenceKey('query.campaign')).toBe(true);
    expect(filter.filterEvidenceKey('query.Password')).toBe(true);
    expect(filter.filterEvidenceKey('query.51d_screenpixelswidth')).toBe(true);
    expect(filter.filterEvidenceKey('query.id.email')).toBe(false);
  });

  test('the message has every parameter and only the 51D_ cookies',
    async () => {
      const message = await messageFor({});

      expect(message).toContain('campaign value');
      expect(message).toContain('width value');
      expect(message).toContain('profile value');
      expect(message).not.toContain('session value');
      expect(message).not.toContain('analytics value');
    }, SEND_TIMEOUT_MS + 5000);
});

describe('usage sharing with share all query string parameters off', () => {
  test('the filter keeps only 51D_ parameters and those listed', () => {
    const filter = new ShareUsageEvidenceKeyFilter({
      shareAllQueryStringParameters: false,
      queryWhitelist: ['Listed']
    });

    expect(filter.filterEvidenceKey('query.campaign')).toBe(false);
    expect(filter.filterEvidenceKey('query.listed')).toBe(true);
    expect(filter.filterEvidenceKey('query.51d_screenpixelswidth')).toBe(true);
  });

  test('the message has only the 51D_ parameters', async () => {
    const message = await messageFor({ shareAllQueryStringParameters: false });

    expect(message).not.toContain('campaign value');
    expect(message).toContain('width value');
  }, SEND_TIMEOUT_MS + 5000);
});

describe('usage sharing with all Evidence shared', () => {
  test('the filter keeps no cookie but the 51D_ ones', () => {
    const filter = new ShareUsageEvidenceKeyFilter({
      shareAll: true,
      cookie: 'sessionid'
    });

    expect(filter.filterEvidenceKey('cookie.sessionid')).toBe(false);
    expect(filter.filterEvidenceKey('cookie._ga')).toBe(false);
    expect(filter.filterEvidenceKey('cookie.51D_ProfileIds')).toBe(true);
    expect(filter.filterEvidenceKey('server.request-method')).toBe(true);
    expect(filter.filterEvidenceKey('header.cookie')).toBe(false);
  });

  test.each([false, true])(
    'the message has no cookie but the 51D_ ones, sessions tracked %p',
    async (trackSession) => {
      const message = await messageFor({
        shareAll: true,
        cookie: 'sessionid',
        trackSession
      });

      expect(message).toContain('campaign value');
      expect(message).toContain('profile value');
      expect(message).not.toContain('session value');
      expect(message).not.toContain('analytics value');
    }, SEND_TIMEOUT_MS + 5000);
});
