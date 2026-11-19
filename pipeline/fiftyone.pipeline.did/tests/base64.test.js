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

// The rules for the base64 text of a 51Did, held for both readers. White
// space around the text is ignored, and white space inside it, or
// characters from both alphabets, are refused, as the 51Did specification
// requires:
// https://github.com/51Degrees/specifications/blob/main/did-specification/identifier-layout.md#envelope

const { FodId, FodIdParseError } = require('../index');
const { read } = require('../reader');
const { canonicalPayload, generateKeyPair, signedWith } = require('./envelope');

const { ParseStatus } = FodId;

// The answer the reader gives for a value that is not a 51Did.
const NOT_A_51DID = {
  ok: false, type: null, usage: null, usageIsIndirect: null, terms: null
};

// Every white space character, and U+FEFF, which `trim()` takes although it
// is not white space.
const SHOWN_AS_CODE = /[\p{White_Space}\uFEFF]/u;

// The text with each white space character written as its code, so a test
// name shows where it is.
function show (text) {
  return Array.from(text, (c) => SHOWN_AS_CODE.test(c)
    ? '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
    : c).join('');
}

// A signed envelope whose standard base64 holds both characters that
// differ between the alphabets, so the conversion is exercised. The
// signature is random, so envelopes are signed until one qualifies, which
// takes one or two tries.
async function standardWithBothSpecials () {
  const keyPair = await generateKeyPair();
  for (let attempt = 0; attempt < 100; attempt++) {
    const base64 = await signedWith(keyPair, canonicalPayload());
    if (base64.includes('+') && base64.includes('/')) {
      return base64;
    }
  }
  throw new Error('No signed envelope held both + and / in 100 tries.');
}

// The standard text, and the URL-safe text with and without its padding.
function forms (standard) {
  const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_');
  return [standard, urlSafe, urlSafe.replace(/=+$/, '')];
}

// The text with the white space put in at a number of points spread evenly
// through it, never at either end.
function spaced (text, space, count) {
  let result = text;
  for (let point = count; point >= 1; point--) {
    const at = Math.floor(text.length * point / (count + 1));
    result = result.slice(0, at) + space + result.slice(at);
  }
  return result;
}

// Checks that both readers, and both surfaces of FodId, refuse the text as
// invalid base64.
function expectInvalidBase64 (text) {
  const result = FodId.tryParse(text);
  expect(result.ok).toBe(false);
  expect(result.value).toBeNull();
  expect(result.status).toBe(ParseStatus.INVALID_BASE64);
  expect(() => FodId.fromBase64(text)).toThrow(FodIdParseError);
  expect(() => FodId.fromBase64(text)).toThrow(
    expect.objectContaining({ status: ParseStatus.INVALID_BASE64 }));
  expect(read(text)).toEqual(NOT_A_51DID);
}

describe('base64 text', () => {
  let standard;

  beforeAll(async () => {
    standard = await standardWithBothSpecials();
  });

  test('the standard, URL-safe and unpadded forms read the same', () => {
    expect(read(standard).ok).toBe(true);
    for (const text of forms(standard)) {
      expect(FodId.toStandardBase64(text)).toBe(standard);
      const result = FodId.tryParse(text);
      expect(result.status).toBe(ParseStatus.PARSED);
      expect(result.value.asBase64()).toBe(standard);
      expect(FodId.fromBase64(text).asBase64()).toBe(standard);
      expect(read(text)).toEqual(read(standard));
    }
  });

  test.each([
    ['YQ', 'YQ=='],
    ['YWI', 'YWI='],
    ['YWJj', 'YWJj'],
    ['-_', '+/=='],
    ['+/==', '+/=='],
    ['', ''],
    [' YQ\n', 'YQ=='],
    ['\u3000-_\u3000', '+/=='],
    // U+0085 is white space that `trim()` leaves.
    ['\u0085YQ\u0085', 'YQ==']
  ].map(([input, expected]) => [show(input), input, expected]))(
    'toStandardBase64 restores "%s"', (name, input, expected) => {
      expect(FodId.toStandardBase64(input)).toBe(expected);
    });

  test.each([
    'YW Jj',
    'YW\tJj',
    'YW\r\nJj',
    'YW\u00A0Jj',
    'YW\u3000Jj',
    '+_',
    '-/',
    '+-',
    '/_'
  ].map((input) => [show(input), input]))(
    'toStandardBase64 gives null for "%s"', (name, input) => {
      expect(FodId.toStandardBase64(input)).toBeNull();
    });

  test.each([
    [' ', '\n'],
    ['\t', '\r\n'],
    ['\u00A0', '\u00A0'],
    ['\u3000', '\u3000'],
    ['\u0085', '\u2028']
  ].map(([before, after]) => [show(before), show(after), before, after]))(
    'white space around the text, "%s" before and "%s" after, is ignored',
    (shownBefore, shownAfter, before, after) => {
      for (const text of forms(standard)) {
        const surrounded = before + text + after;
        const result = FodId.tryParse(surrounded);
        expect(result.status).toBe(ParseStatus.PARSED);
        expect(result.value.asBase64()).toBe(standard);
        expect(FodId.fromBase64(surrounded).asBase64()).toBe(standard);
        expect(read(surrounded)).toEqual(read(standard));
      }
    });

  test.each([
    [' ', 1],
    [' ', 2],
    [' ', 3],
    ['\n', 1],
    ['\t', 4],
    ['\r\n', 2],
    ['\u00A0', 4],
    ['\u3000', 1]
  ].map(([space, count]) => [show(space), count, space]))(
    '"%s" inside the text at %i points is invalid base64',
    (shown, count, space) => {
      for (const text of forms(standard)) {
        const inside = spaced(text, space, count);
        expect(FodId.toStandardBase64(inside)).toBeNull();
        expectInvalidBase64(inside);
      }
    });

  test.each([
    ['standard', '+', '-'],
    ['standard', '/', '_'],
    ['URL-safe', '-', '+'],
    ['URL-safe', '_', '/']
  ])('a %s text with one %s changed to %s is invalid base64',
    (form, from, to) => {
      const text = form === 'URL-safe' ? FodId.toBase64Url(standard) : standard;
      const index = text.indexOf(from);
      expect(index).toBeGreaterThanOrEqual(0);
      const mixed = text.slice(0, index) + to + text.slice(index + 1);
      expect(FodId.toStandardBase64(mixed)).toBeNull();
      expectInvalidBase64(mixed);
    });

  test('U+FEFF around the text is not white space, so it is refused', () => {
    // `trim()` takes U+FEFF, which does not have the White_Space property.
    for (const text of forms(standard)) {
      expectInvalidBase64('\uFEFF' + text);
      expectInvalidBase64(text + '\uFEFF');
    }
  });

  test('a string of only white space is missing input', () => {
    for (const value of ['', ' ', '\r\n', '\u00A0', '\u3000', '\u0085\u2028']) {
      expect(FodId.tryParse(value).status).toBe(ParseStatus.MISSING_INPUT);
      expect(() => FodId.fromBase64(value)).toThrow(
        expect.objectContaining({ status: ParseStatus.MISSING_INPUT }));
      expect(read(value)).toEqual(NOT_A_51DID);
    }
  });
});
