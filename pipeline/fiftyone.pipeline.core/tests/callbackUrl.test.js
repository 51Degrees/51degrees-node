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

// Checks the callback URL against the cases every implementation of the
// JavaScript builder shares, in the same order, so that each one refuses and
// writes the same URLs.

const callbackUrl = require('../callbackUrl');

const endPoint = '/51dpipeline/json';

const url = (protocol, host) => callbackUrl(protocol, host, endPoint);

const valid = text => ({ valid: true, url: text });

test('adds a single slash', () => {
  expect(callbackUrl('https', 'example.com', '51dpipeline/json'))
    .toStrictEqual(valid('https://example.com/51dpipeline/json'));
});

test('keeps a single slash on the endpoint', () => {
  expect(callbackUrl('https', 'example.com', '/51dpipeline/json'))
    .toStrictEqual(valid('https://example.com/51dpipeline/json'));
});

test('collapses a double slash', () => {
  expect(callbackUrl('http', 'example.com/', '/json'))
    .toStrictEqual(valid('http://example.com/json'));
});

test('missing when a part is empty', () => {
  expect(callbackUrl('https', '', '/json')).toBeNull();
  expect(callbackUrl('', 'example.com', '/json')).toBeNull();
  expect(callbackUrl('https', 'example.com', '')).toBeNull();
  expect(callbackUrl('https', '  ', '/json')).toBeNull();
});

test.each([
  ['EXAMPLE.com', 'https://example.com/51dpipeline/json'],
  ['example.com:8080', 'https://example.com:8080/51dpipeline/json'],
  ['example.com:', 'https://example.com:/51dpipeline/json'],
  ['example.com:65535', 'https://example.com:65535/51dpipeline/json'],
  ['a_b.com', 'https://a_b.com/51dpipeline/json'],
  ['-ab.com', 'https://-ab.com/51dpipeline/json'],
  ['127.0.0.1:80', 'https://127.0.0.1:80/51dpipeline/json'],
  ['[::1]', 'https://[::1]/51dpipeline/json'],
  ['[::1]:8080', 'https://[::1]:8080/51dpipeline/json'],
  ['[fe80::1%25eth0]', 'https://[fe80::1%25eth0]/51dpipeline/json'],
  ['user:pw@example.com', 'https://user:pw@example.com/51dpipeline/json'],
  ['u x@example.com', 'https://u%20x@example.com/51dpipeline/json'],
  ['u\tx@example.com', 'https://u%09x@example.com/51dpipeline/json'],
  ['example.com.', 'https://example.com./51dpipeline/json'],
  ['example.com/path', 'https://example.com/path/51dpipeline/json'],
  ['example.com?x', 'https://example.com?x/51dpipeline/json'],
  ['example.com/a b', 'https://example.com/a%20b/51dpipeline/json'],
  ['example.com/a%zzb', 'https://example.com/a%25zzb/51dpipeline/json'],
  ['example.com/a%41b', 'https://example.com/a%41b/51dpipeline/json'],
  ['example.com/\u00fc', 'https://example.com/%C3%BC/51dpipeline/json'],
  ['example.com/a\nb', 'https://example.com/a%0Ab/51dpipeline/json'],
  ['example.com/a\u2028b',
    'https://example.com/a%E2%80%A8b/51dpipeline/json']
])('accepts the host %j', (host, expected) => {
  expect(url('https', host)).toStrictEqual(valid(expected));
});

test.each([
  'example.com:65536',
  'example.com:99999',
  'example.com:abc',
  'exa mple.com',
  "example.com');alert(1);//",
  'a"b.com',
  "a'b.com",
  'a<b.com',
  '::1',
  '[::1',
  '[v1.x]',
  '[1.2.3.4]',
  'a@b@example.com',
  'a..b.com',
  '%41.com',
  'a\\b.com',
  'a`b.com',
  'a{b}.com',
  'a|b.com',
  'a^b.com',
  'a(b).com',
  'a;b.com',
  'a,b.com',
  'a!b.com',
  'a*b.com',
  'a+b.com',
  'a=b.com',
  'a$b.com',
  'a&b.com',
  'a~b.com',
  'a\tb.com',
  'a\nb.com',
  ' example.com',
  'example.com ',
  "example.com:8080');alert(1);//"
])('refuses the host %j', host => {
  expect(url('https', host).valid).toBe(false);
});

// Inside the brackets only an IPv6 address, optionally followed by '%25' and
// a zone of unreserved characters, and after them only a port. The zone
// check is what keeps a quote out of the script for a bracketed host.
test.each([
  '[fe80::1%25]',
  "[fe80::1%25'+alert(1)+']",
  '[fe80::1%eth0]',
  '[fe80::1%25eth%0]',
  '[::1]x',
  '[::1]80',
  '[::1]:80x',
  '[::1]]'
])('refuses the zone or the text after the bracket in %j', host => {
  expect(url('https', host).valid).toBe(false);
});

test('accepts a zone followed by a port', () => {
  expect(url('https', '[fe80::1%25eth0]:8080'))
    .toStrictEqual(valid('https://[fe80::1%25eth0]:8080/51dpipeline/json'));
});

// A port goes by its value, so leading zeros are allowed, and a port too
// long to read is refused rather than read as small enough.
test('checks the port by its value', () => {
  expect(url('https', 'example.com:00080'))
    .toStrictEqual(valid('https://example.com:00080/51dpipeline/json'));
  expect(url('https', 'example.com:0065535'))
    .toStrictEqual(valid('https://example.com:0065535/51dpipeline/json'));
  for (const host of [
    'example.com:0065536',
    'example.com:123456',
    'example.com:4294967296',
    'example.com:99999999999999999999'
  ]) {
    expect(url('https', host).valid).toBe(false);
  }
});

// Each character rule 8 lists, in the user information, after the host and
// in the endpoint, and a '%' without two hexadecimal digits after it, even
// at the end.
test('encodes the characters rule 8 lists', () => {
  expect(callbackUrl('https', 'u"^`{|}@example.com/"^`{|}', '/j"^`{|}'))
    .toStrictEqual(valid(
      'https://u%22%5E%60%7B%7C%7D@example.com/%22%5E%60%7B%7C%7D' +
      '/j%22%5E%60%7B%7C%7D'));
  expect(url('https', 'example.com/a%'))
    .toStrictEqual(valid('https://example.com/a%25/51dpipeline/json'));
  expect(url('https', 'example.com/a%4'))
    .toStrictEqual(valid('https://example.com/a%254/51dpipeline/json'));
  expect(url('https', 'example.com/a%41'))
    .toStrictEqual(valid('https://example.com/a%41/51dpipeline/json'));
  expect(callbackUrl('https', 'example.com', '/json%'))
    .toStrictEqual(valid('https://example.com/json%25'));
});

test('the invalid URL is the one built', () => {
  expect(url('https', 'exa mple.com')).toStrictEqual({
    valid: false,
    url: 'https://exa mple.com/51dpipeline/json'
  });
});

// Only http and https, ignoring the case of ASCII letters only, so a letter
// outside ASCII that a case-insensitive comparison can match to an ASCII
// one, such as the long s, is refused.
test('checks the scheme', () => {
  for (const protocol of ['https', 'http', 'HtTp']) {
    expect(url(protocol, 'example.com').valid).toBe(true);
  }
  expect(url('HTTPS', 'example.com'))
    .toStrictEqual(valid('https://example.com/51dpipeline/json'));
  for (const protocol of [
    'ftp',
    'h+t-p.s',
    'ws',
    'javascript',
    'httpx',
    'https ',
    '1http',
    'h t',
    "x');alert(1);//",
    'a://b',
    'http\u017f',
    'HTTP\u017f'
  ]) {
    expect(url(protocol, 'example.com').valid).toBe(false);
  }
});

// A quote, a backslash or a line break never reaches the script, wherever in
// the URL it was given.
test.each([
  "example.com/');alert(1);//",
  "example.com?');alert(1);//",
  "example.com#');alert(1);//",
  "u'x@example.com",
  'u\\x@example.com',
  'example.com/a\\b',
  'example.com/</script>'
])('nothing given can end the string, host %j', host => {
  const result = url('https', host);
  expect(result.valid).toBe(true);
  expect(result.url).not.toMatch(/['"\\<>\n\r\u2028\u2029]/);
});

test('the endpoint is encoded', () => {
  expect(callbackUrl('https', 'example.com', "/json'x"))
    .toStrictEqual(valid('https://example.com/json%27x'));
});

// A host must be ASCII, so an internationalized name is given as A-labels,
// and anything else outside ASCII is refused.
test.each([
  'b\u00fccher.de',
  'a\u00a0b.com',
  'a\u200bb.com',
  'a\u2028b.com'
])('refuses the host outside ASCII %j', host => {
  expect(url('https', host).valid).toBe(false);
});

// Not one of the shared cases, because only some languages' strings can hold
// a lone surrogate. It has no UTF-8 encoding, so it is written as U+FFFD, as
// a browser writes it.
test('a lone surrogate is written as the replacement character', () => {
  expect(url('https', 'example.com/\ud800'))
    .toStrictEqual(valid('https://example.com/%EF%BF%BD/51dpipeline/json'));
});
