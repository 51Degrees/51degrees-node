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

const {
  PipelineBuilder, FlowElement, ElementDataDictionary
} = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');
const http = require('http');
const os = require('os');
const zlib = require('zlib');

const shareUsageVersion = '1.1';

// Data received by the local usage receiver.
let received = [];
// Local server used to capture usage sent.
let server = null;

/**
 * Local server used to capture usage data sent.
 *
 * @param {http.IncomingMessage} req the request
 * @param {http.ServerResponse} res the response
 */
const requestListener = function (req, res) {
  let data = '';
  // Unzip the data.
  const gunzip = zlib.createGunzip();
  req.pipe(gunzip);
  gunzip.on('data', function (chunk) {
    data += chunk;
  });
  gunzip.on('error', (e) => fail(e)); // eslint-disable-line
  // Return an OK response.
  gunzip.on('end', () => {
    received.push(data);
    res.writeHead(200);
    res.end();
  });
};

beforeEach(() => { // eslint-disable-line
  received = [];
  // Set up the local server. This is HTTP rather than HTTPS to avoid
  // having to use local certificates.
  server = http.createServer(requestListener);
  server.listen(8080);
});

afterEach(() => { // eslint-disable-line
  server.close();
});

/**
 * Check that data is received from the share usage element.
 */
test('share usage - data received', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      done();
    }, 2000);
  });
});

/**
 * Check that the data received from the share usage element is correct.
 */
test('share usage - data correct', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received[0]).not.toBeNull();
      expect(received[0].length).toBeGreaterThan(0);
      expect(received[0]).toMatch(new RegExp(`^<Devices version="${shareUsageVersion}"><Device>.*`));
      expect(received[0]).toMatch(/.*<\/Device><\/Devices>$/);
      expect(received[0]).toContain('<Language>Node.JS</Language>');
      expect(received[0]).toContain(`<LanguageVersion>${process.versions.node}</LanguageVersion>`);
      expect(received[0]).toContain(`<Platform>${process.platform} ${os.release()}</Platform>`);
      expect(received[0]).toContain('<FlowElement>ShareUsage</FlowElement>');
      done();
    }, 2000);
  });
});

/**
 * Check that the data received from the share usage element contains the
 * headers which were in the evidence.
 */
test('share usage - includes header', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const uaValue = 'some user agent..';
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', uaValue);

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received[0]).toContain(`<header Name="user-agent">${uaValue}</header>`);
      done();
    }, 2000);
  });
});

/**
 * Check that the data received from the share usage element includes
 * the client IP from the evidence.
 */
test('share usage - includes client ip', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const ip = '1.2.3.4';
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('server.client-ip', ip);

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain(`<ClientIP>${ip}</ClientIP>`);
      done();
    }, 2000);
  });
});

/**
 * Check that a single event is not sent when the requested package
 * size is 2.
 */
test('share usage - two events - first event', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 2,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(0);
      done();
    }, 2000);
  });
});

/**
 * Check that data is sent in a single request when a second request is
 * sent and the requested package size is 2.
 */
test('share usage - two events - second event', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 2,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData1 = pipeline.createFlowData();
  flowData1.evidence.add('header.user-agent', 'ua 1');
  const flowData2 = pipeline.createFlowData();
  flowData2.evidence.add('header.user-agent', 'ua 2');

  flowData1.process().then(() => {
    flowData2.process().then(() => {
      setTimeout(() => {
        expect(received.length).toBe(1);
        expect(received[0]).toContain('ua 1');
        expect(received[0]).toContain('ua 2');
        done();
      }, 2000);
    });
  });
});

/**
 * Check that the share usage element respects the headerBlacklist.
 * When header names are added to the list, values for them should
 * not be included in the data shared.
 */
test('share usage - ignore headers', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    headerBlacklist: ['x-forwarded-for', 'forwarded-for']
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'some user agent');
  flowData.evidence.add('header.x-forwarded-for', '5.6.7.8');
  flowData.evidence.add('header.forwarded-for', '2001::');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).not.toContain('x-forwarded-for');
      expect(received[0]).not.toContain('forwarded-for');
      done();
    }, 2000);
  });
});

test('share usage - queue cleared', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'some user agent');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(usageEngine.shareData.length).toBe(0);
      done();
    }, 2000);
  });
});

/**
 * Check that session and sequence values are included.
 */
test('share usage - session and sequence', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  // The JSON bundler needs a sequence number, which this stand-in gives
  // without touching the evidence.
  const standIn = new FlowElement({
    dataKey: 'sequence',
    processInternal: function (flowData) {
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { 'session-id': '', sequence: 1 }
      }));
    }
  });
  const pipeline = new PipelineBuilder({ addSequenceElement: false })
    .add(standIn)
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.session-id', '1');
  flowData.evidence.add('query.sequence', '1');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<SessionId>1</SessionId>');
      expect(received[0]).toContain('<Sequence>1</Sequence>');
      done();
    }, 2000);
  });
});

/**
 * The Sequence Element runs before the usage sharing element, so the
 * sequence shared is the one it has added one to.
 */
test('share usage - sequence after the Sequence Element', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.session-id', '1');
  flowData.evidence.add('query.sequence', '1');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<SessionId>1</SessionId>');
      expect(received[0]).toContain('<Sequence>2</Sequence>');
      done();
    }, 2000);
  });
});

/**
 * Check that invalid characters are escaped correctly.
 */
test('share usage - invalid char', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const replacementChar = String.fromCharCode(parseInt('0xFFFD', 16));
  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', '1ƌ2');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).not.toContain('ƌ');
      expect(received[0]).toContain(replacementChar);
      expect(received[0]).toContain('replaced="true"');
      expect(received[0]).toContain(`<header Name="user-agent" replaced="true">1${replacementChar}2</header>`);
      done();
    }, 2000);
  });
});

/**
 * Check that long values are truncated correctly.
 */
test('share usage - truncated value', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const ua = 'X'.repeat(1000);
  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', ua);

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('truncated="true"');
      expect(received[0]).not.toContain(ua);
      expect(received[0]).toContain(`<header Name="user-agent" truncated="true">${'X'.repeat(512)}</header>`);
      done();
    }, 2000);
  });
});

/**
 * Check that the queue of data is correctly reset, and used for the
 * next set of requests.
 */
test('share usage - send  more than once', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData1 = pipeline.createFlowData();
  flowData1.evidence.add('header.user-agent', 'ua 1');
  const flowData2 = pipeline.createFlowData();
  flowData2.evidence.add('header.user-agent', 'ua 2');

  flowData1.process().then(() => {
    flowData2.process().then(() => {
      setTimeout(() => {
        expect(usageEngine.shareData.length).toBe(0);
        expect(received.length).toBe(2);
        // HTTP requests are asynchronous, so we can't guarantee the order
        // in which they arrive at the server. Check that each UA appears
        // in exactly one message without assuming order.
        const msg1Contains1 = received[0].includes('ua 1');
        const msg1Contains2 = received[0].includes('ua 2');
        const msg2Contains1 = received[1].includes('ua 1');
        const msg2Contains2 = received[1].includes('ua 2');
        // Each message should contain exactly one UA
        expect(msg1Contains1 !== msg1Contains2).toBe(true);
        expect(msg2Contains1 !== msg2Contains2).toBe(true);
        // Both UAs should be present across the two messages
        expect(msg1Contains1 || msg2Contains1).toBe(true);
        expect(msg1Contains2 || msg2Contains2).toBe(true);
        // Each UA should appear in exactly one message
        expect(msg1Contains1 !== msg2Contains1).toBe(true);
        expect(msg1Contains2 !== msg2Contains2).toBe(true);
        done();
      }, 6000);
    });
  });
}, 15000);

/**
 * Check that small portion sharing is done correctly.
 */
test('share usage - low percentage', function (done) {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 10,
    sharePercentage: 0.1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  let requiredEvents = 0;
  while (received.length === 0 && requiredEvents < 10000) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('server.client-ip', '1.2.3.4');
    flowData.evidence.add('header.user-agent', `ua ${requiredEvents}`);
    usageEngine.processInternal(flowData);
    requiredEvents++;
  }

  // Wait for a few seconds to make sure the requests from usage
  // sharing have completed as they are asynchronous.
  setTimeout(() => {
    // On average, the number of required events should be around
    // 100. However, as it's chance based it can vary
    // significantly. We only want to catch any gross errors so just
    // make sure the value is of the expected order of magnitude.
    expect(received.length).toBeGreaterThan(10);
    expect(received.length).toBeLessThan(1000);
    done();
  }, (3000));
});

/**
 * Check that XML characters are escaped correctly.
 */
test('share usage - XML characters', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', '"\'&><');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('&quot;');
      expect(received[0]).toContain('&apos;');
      expect(received[0]).toContain('&lt;');
      expect(received[0]).toContain('&gt;');
      expect(received[0]).toContain('&amp;');
      done();
    }, 2000);
  });
});

/**
 * Check that with no options the element shares headers and the 51Degrees
 * cookies and parameters, and leaves out other cookies, the Cookie header,
 * and other query string and form parameters.
 */
test('share usage - default shares only accepted evidence', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'some user agent');
  flowData.evidence.add('cookie.51d_screenpixelswidth', '1080');
  flowData.evidence.add('query.51d_gethighentropyvalues', 'hev');
  flowData.evidence.add('cookie.sessionid', 'cookie value');
  flowData.evidence.add('header.cookie', 'sessionid=header value');
  flowData.evidence.add('query.password', 'password value');
  flowData.evidence.add('query.id.email', 'email value');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<header Name="user-agent">some user agent</header>');
      expect(received[0]).toContain('<cookie Name="51d_screenpixelswidth">1080</cookie>');
      expect(received[0]).toContain('<query Name="51d_gethighentropyvalues">hev</query>');
      expect(received[0]).not.toContain('cookie value');
      expect(received[0]).not.toContain('header value');
      expect(received[0]).not.toContain('password value');
      expect(received[0]).not.toContain('email value');
      done();
    }, 2000);
  });
});

/**
 * Check that the email address, the salt for hashed email identifiers, the
 * query string and the path are not shared, though the rules for their
 * prefixes would share them.
 */
test('share usage - never shared evidence', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'some user agent');
  flowData.evidence.add('id.email', 'email value');
  flowData.evidence.add('header.id.salt', 'salt value');
  flowData.evidence.add('server.request-query', 'query string value');
  flowData.evidence.add('server.request-path', 'path value');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('some user agent');
      expect(received[0]).not.toContain('email value');
      expect(received[0]).not.toContain('salt value');
      expect(received[0]).not.toContain('query string value');
      expect(received[0]).not.toContain('path value');
      done();
    }, 2000);
  });
});

/**
 * Check that sharing all evidence shares what the other rules leave out,
 * but not the evidence that is never shared.
 */
test('share usage - share all', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    shareAll: true
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('cookie.sessionid', 'cookie value');
  flowData.evidence.add('query.campaign', 'campaign value');
  flowData.evidence.add('query.id.email', 'email value');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<cookie Name="sessionid">cookie value</cookie>');
      expect(received[0]).toContain('<query Name="campaign">campaign value</query>');
      expect(received[0]).not.toContain('email value');
      done();
    }, 2000);
  });
});

/**
 * Check that a query string parameter whose name contains a dot is matched
 * by its whole name against the parameters to share.
 */
test('share usage - parameter names with dots', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    queryWhitelist: ['valid.email']
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.valid.email', 'valid value');
  flowData.evidence.add('query.valid', 'first part value');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<query Name="valid.email">valid value</query>');
      expect(received[0]).not.toContain('first part value');
      done();
    }, 2000);
  });
});

/**
 * Check that with session tracking on the session cookie is kept in the
 * evidence, but neither it nor any other ordinary cookie is shared.
 */
test('share usage - session cookie', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    cookie: 'sessionid',
    trackSession: true
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'some user agent');
  flowData.evidence.add('cookie.sessionid', 'session value');
  flowData.evidence.add('cookie._ga', 'analytics value');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(usageEngine.evidenceKeyFilter.filterEvidenceKey('cookie.sessionid')).toBe(true);
      expect(received.length).toBe(1);
      expect(received[0]).toContain('some user agent');
      expect(received[0]).not.toContain('session value');
      expect(received[0]).not.toContain('analytics value');
      done();
    }, 2000);
  });
});

/**
 * Check that session tracking is off by default, and that naming the session
 * cookie then has no effect. The cookie is not kept, and evidence already
 * shared is not shared again for a new session.
 */
test('share usage - session cookie without session tracking', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    cookie: 'sessionid'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData1 = pipeline.createFlowData();
  flowData1.evidence.add('header.user-agent', 'repeated user agent');
  flowData1.evidence.add('cookie.sessionid', 'session value 1');
  const flowData2 = pipeline.createFlowData();
  flowData2.evidence.add('header.user-agent', 'repeated user agent');
  flowData2.evidence.add('cookie.sessionid', 'session value 2');

  flowData1.process().then(() => {
    flowData2.process().then(() => {
      setTimeout(() => {
        expect(received.length).toBe(1);
        expect(received[0]).not.toContain('session value');
        expect(usageEngine.evidenceKeyFilter.filterEvidenceKey('cookie.sessionid')).toBe(false);
        expect(usageEngine.trackSession).toBe(false);
        done();
      }, 2000);
    });
  });
});

/**
 * Check that with session tracking on, evidence already shared is shared
 * again for a new session but not for a repeat in the same session, and that
 * the session cookie is not shared.
 */
test('share usage - session tracking', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/',
    cookie: 'sessionid',
    trackSession: true
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData1 = pipeline.createFlowData();
  flowData1.evidence.add('header.user-agent', 'repeated user agent');
  flowData1.evidence.add('cookie.sessionid', 'session value 1');
  const flowData2 = pipeline.createFlowData();
  flowData2.evidence.add('header.user-agent', 'repeated user agent');
  flowData2.evidence.add('cookie.sessionid', 'session value 1');
  const flowData3 = pipeline.createFlowData();
  flowData3.evidence.add('header.user-agent', 'repeated user agent');
  flowData3.evidence.add('cookie.sessionid', 'session value 2');

  flowData1.process().then(() => {
    flowData2.process().then(() => {
      flowData3.process().then(() => {
        setTimeout(() => {
          expect(received.length).toBe(2);
          const all = received.join('\n');
          expect(all.split('repeated user agent').length - 1).toBe(2);
          expect(all).not.toContain('session value');
          done();
        }, 2000);
      });
    });
  });
});

/**
 * Check that a request differing from one already shared only in its
 * session id and sequence number is not shared again.
 */
test('share usage - repeat with new sequence not shared', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData1 = pipeline.createFlowData();
  flowData1.evidence.add('header.user-agent', 'repeated user agent');
  flowData1.evidence.add('query.session-id', 'session 1');
  flowData1.evidence.add('query.sequence', '1');
  const flowData2 = pipeline.createFlowData();
  flowData2.evidence.add('header.user-agent', 'repeated user agent');
  flowData2.evidence.add('query.session-id', 'session 2');
  flowData2.evidence.add('query.sequence', '2');

  flowData1.process().then(() => {
    flowData2.process().then(() => {
      setTimeout(() => {
        expect(received.length).toBe(1);
        expect(received[0]).toContain('<SessionId>session 1</SessionId>');
        done();
      }, 2000);
    });
  });
});
