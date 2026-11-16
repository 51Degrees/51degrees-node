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

// The three request line values reach the Evidence exactly as the request
// line carried them, byte for byte, with no decoding and no normalisation,
// and all three are there on every request with the query empty where the
// request line had none (web-integration.md lines 100 to 114).

const PipelineBuilder = require('../pipelineBuilder');
const Constants = require('../constants');

// What the server.http-request view holds after reading a request whose
// request line carried the method and target given.
const read = (method, target) => {
  const flowData = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).build().createFlowData();
  flowData.evidence.addFromRequest({
    method,
    url: target,
    headers: {},
    connection: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1' }
  });
  return flowData.evidence.get(Constants.evidenceHttpRequest);
};

// Each target, with the path and the query the request line carried. None
// of them is decoded or tidied on the way through.
const TARGETS = [
  ['a percent-encoded slash in the path', '/a%2Fb/c?x=1', '/a%2Fb/c', 'x=1'],
  ['a percent-encoded slash in the query', '/p?x=%2F', '/p', 'x=%2F'],
  ['a plus in the query', '/p?y=a+b', '/p', 'y=a+b'],
  ['a space encoded in the path', '/p%20q?r=1', '/p%20q', 'r=1'],
  ['escapes in the case they were written', '/%c3%a9?q=%C3%A9', '/%c3%a9',
    'q=%C3%A9'],
  ['a doubled slash and dot segments', '//a/./b/../c', '//a/./b/../c', ''],
  ['a question mark with nothing after it', '/p?', '/p', ''],
  ['no query string at all', '/p', '/p', ''],
  ['the root on its own', '/', '/', ''],
  ['two question marks', '/p?a=1?2', '/p', 'a=1?2'],
  ['a full URL, whose host is not part of the path', 'http://h.example/p%20q?r=1',
    '/p%20q', 'r=1'],
  ['a semicolon and an equals sign in the query', '/p?a=1;b==2', '/p',
    'a=1;b==2']
];

describe.each(TARGETS)('with %s', (name, target, path, query) => {
  test('the path is the bytes the request line carried', () => {
    expect(read('GET', target)['server.request-path']).toBe(path);
  });

  test('the query is the bytes the request line carried', () => {
    expect(read('GET', target)['server.request-query']).toBe(query);
  });

  test('all three request line values are there', () => {
    const view = read('GET', target);
    expect(Object.keys(view).filter((key) => key.startsWith('server.request-'))
      .sort())
      .toEqual([
        'server.request-method', 'server.request-path', 'server.request-query'
      ]);
  });
});

test('the method is the bytes the request line carried', () => {
  expect(read('get', '/p')['server.request-method']).toBe('get');
  expect(read('POST', '/p')['server.request-method']).toBe('POST');
  expect(read('PATCH', '/p')['server.request-method']).toBe('PATCH');
});

test('a request with no method gives the method as empty, not as absent',
  () => {
    const view = read(undefined, '/p');
    expect(view['server.request-method']).toBe('');
    expect('server.request-method' in view).toBe(true);
  });
