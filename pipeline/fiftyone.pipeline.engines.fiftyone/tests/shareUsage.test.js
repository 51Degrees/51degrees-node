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
  // Decode as the chunks arrive, without splitting a character in two.
  gunzip.setEncoding('utf8');
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
 * Sends one request carrying the user-agent given through a usage sharing
 * element and passes the XML that was received to the check.
 *
 * @param {string} userAgent the value of the header.user-agent evidence
 * @param {Function} check called with the XML text received
 * @param {Function} done the test's callback
 */
function sendAndCheck (userAgent, check, done) {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });
  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', userAgent);

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      check(received[0]);
      done();
    }, 2000);
  });
}

/**
 * A character XML 1.0 does not allow is written as \x and its code as four
 * lower case hexadecimal digits, and the element is marked escaped.
 */
test.each([
  ['a control character', '1\u00012', '1\\x00012'],
  ['the unit separator', '1\u001f2', '1\\x001f2'],
  ['U+FFFE', '1\ufffe2', '1\\xfffe2'],
  ['a lone high surrogate', '1\ud8002', '1\\xd8002'],
  ['a lone low surrogate', '1\udc002', '1\\xdc002']
])('share usage - %s is written as \\x and four hex digits', (name, value, written) => {
  return new Promise(resolve => {
    sendAndCheck(value, xml => {
      expect(xml).toContain(
        `<header Name="user-agent" escaped="true">${written}</header>`);
    }, resolve);
  });
});

/**
 * Characters XML 1.0 allows are written as they are, with no attribute.
 */
test('share usage - allowed characters are written as they are', done => {
  const value = 'a\tb\nc\rd\u018ce\u00e9f\ud83d\ude00g';
  sendAndCheck(value, xml => {
    expect(xml).not.toContain('escaped=');
    expect(xml).toContain(
      `<header Name="user-agent">${value}</header>`);
  }, done);
});

/**
 * Values are cut at 10,000 characters and marked truncated.
 */
test('share usage - a value of 10,001 characters is truncated', done => {
  sendAndCheck('X'.repeat(10001), xml => {
    expect(xml).toContain(
      `<header Name="user-agent" truncated="true">${'X'.repeat(10000)}</header>`);
  }, done);
});

test('share usage - a value of 10,000 characters is not truncated', done => {
  sendAndCheck('X'.repeat(10000), xml => {
    expect(xml).not.toContain('truncated=');
    expect(xml).toContain(
      `<header Name="user-agent">${'X'.repeat(10000)}</header>`);
  }, done);
});

/**
 * The limit counts Unicode code points, so a character made of two UTF-16
 * code units counts once and is never cut in two.
 */
test('share usage - an emoji at the limit is kept whole', done => {
  const emoji = '\ud83d\ude00';
  sendAndCheck('X'.repeat(9999) + emoji + 'Y', xml => {
    expect(xml).not.toContain('escaped=');
    expect(xml).toContain(
      '<header Name="user-agent" truncated="true">' +
      `${'X'.repeat(9999)}${emoji}</header>`);
  }, done);
});

test('share usage - a second emoji over the limit is cut whole', done => {
  const emoji = '\ud83d\ude00';
  sendAndCheck('X'.repeat(9999) + emoji + emoji, xml => {
    expect(xml).not.toContain('escaped=');
    expect(xml).toContain(
      '<header Name="user-agent" truncated="true">' +
      `${'X'.repeat(9999)}${emoji}</header>`);
  }, done);
});

test('share usage - 10,000 code points of emoji are not truncated', done => {
  const value = '\ud83d\ude00'.repeat(10000);
  sendAndCheck(value, xml => {
    expect(xml).not.toContain('truncated=');
    expect(xml).toContain(`<header Name="user-agent">${value}</header>`);
  }, done);
});

/**
 * The limit counts the value as it was supplied, before any character is
 * replaced, so the escapes do not count towards it.
 */
test('share usage - escapes do not count towards the limit', done => {
  const value = '1\u00012' + 'X'.repeat(9997);
  sendAndCheck(value, xml => {
    expect(xml).not.toContain('truncated=');
    expect(xml).toContain(
      '<header Name="user-agent" escaped="true">' +
      `1\\x00012${'X'.repeat(9997)}</header>`);
  }, done);
});

/**
 * A value with a character that is not allowed that is also too long is
 * marked both escaped and truncated. The cut is made on the original value.
 */
test('share usage - escaped and truncated value', done => {
  sendAndCheck('1\u00012' + 'X'.repeat(10000), xml => {
    expect(xml).toContain(
      '<header Name="user-agent" escaped="true" truncated="true">' +
      `1\\x00012${'X'.repeat(9997)}</header>`);
  }, done);
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
 * Evidence that is not a string is shared as its text, as .NET writes it.
 */
test.each([
  ['a number', 5, '5'],
  ['zero', 0, '0'],
  ['false', false, 'false']
])('share usage - %s is shared as its text', (name, value, written) => {
  return new Promise(resolve => {
    sendAndCheck(value, xml => {
      expect(xml).toContain(`<header Name="user-agent">${written}</header>`);
    }, resolve);
  });
});

/**
 * Sends one request carrying the evidence given through a usage sharing
 * element and passes the XML that was received to the check.
 *
 * @param {object} evidence the evidence keys and values
 * @param {Function} check called with the XML text received
 * @param {Function} done the test's callback
 */
function sendEvidenceAndCheck (evidence, check, done) {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });
  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    flowData.evidence.add(key, value);
  }

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      check(received[0]);
      done();
    }, 2000);
  });
}

/**
 * The session id and the client IP come from the request, so the XML
 * characters in them are escaped, as they are in evidence values.
 */
test('share usage - XML characters in the session id and client IP',
  done => {
    sendEvidenceAndCheck({
      'query.session-id': 'a<b&c"d',
      'server.client-ip': '1.2.3.4<>'
    }, xml => {
      expect(xml).toContain('<SessionId>a&lt;b&amp;c&quot;d</SessionId>');
      expect(xml).toContain('<ClientIP>1.2.3.4&lt;&gt;</ClientIP>');
    }, done);
  });

/**
 * The name of an evidence entry is written in an attribute, so the XML
 * characters in it are escaped.
 */
test('share usage - XML characters in an evidence name', done => {
  sendEvidenceAndCheck({ 'header.x"y&z<': 'v' }, xml => {
    expect(xml).toContain('<header Name="x&quot;y&amp;z&lt;">v</header>');
  }, done);
});

/**
 * The record always has a ClientIP element, so a request with no client IP
 * has an empty one.
 */
test('share usage - no client IP gives an empty ClientIP', done => {
  sendEvidenceAndCheck({ 'header.user-agent': 'a' }, xml => {
    expect(xml).toContain('<ClientIP></ClientIP>');
    expect(xml).not.toContain('undefined');
  }, done);
});

/**
 * The record has a ServerIP element, being the first address of this server
 * that is not a loopback address, IPv4 before IPv6, or empty when there is
 * none.
 */
test.each([
  ['an IPv4 address before an IPv6 one', {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    eth0: [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '10.1.2.3', family: 'IPv4', internal: false }
    ]
  }, '10.1.2.3'],
  ['an IPv6 address where there is no IPv4 one', {
    lo: [{ address: '::1', family: 'IPv6', internal: true }],
    eth0: [{ address: '2001:db8::5', family: 'IPv6', internal: false }]
  }, '2001:db8::5'],
  ['nothing where there are only loopback addresses', {
    lo: [
      { address: '127.0.0.1', family: 'IPv4', internal: true },
      { address: '::1', family: 'IPv6', internal: true }
    ]
  }, '']
])('share usage - ServerIP is %s', (name, interfaces, written) => {
  const networkInterfaces = jest.spyOn(os, 'networkInterfaces')
    .mockReturnValue(interfaces);
  return new Promise(resolve => {
    sendEvidenceAndCheck({ 'header.user-agent': 'a' }, xml => {
      expect(xml).toContain(`<ServerIP>${written}</ServerIP>`);
    }, resolve);
  }).finally(() => networkInterfaces.mockRestore());
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
      expect(usageEngine.keptEvidenceKeyFilter.filterEvidenceKey('cookie.sessionid')).toBe(true);
      expect(usageEngine.evidenceKeyFilter.filterEvidenceKey('cookie.sessionid')).toBeFalsy();
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
        expect(usageEngine.keptEvidenceKeyFilter.filterEvidenceKey('cookie.sessionid')).toBe(false);
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

/**
 * Evidence keys ignore letter case, so the session id and sequence are
 * written to the record as SessionId and Sequence whatever the letters of
 * their keys.
 */
test('share usage - session id and sequence recorded whatever their case', done => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: 1,
    endpoint: 'http://127.0.0.1:8080/'
  });

  const pipeline = new PipelineBuilder()
    .add(usageEngine)
    .build();

  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent');
  flowData.evidence.add('query.Session-Id', 'the session');
  flowData.evidence.add('query.Sequence', '2');

  flowData.process().then(() => {
    setTimeout(() => {
      expect(received.length).toBe(1);
      expect(received[0]).toContain('<SessionId>the session</SessionId>');
      expect(received[0]).toContain('<Sequence>2</Sequence>');
      done();
    }, 2000);
  });
});
