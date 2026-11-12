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

// A license key must never appear in full in a log entry or an error message.
// Only its last 4 characters are shown, with every character before them
// replaced, including in a URL.

const core = require('fiftyone.pipeline.core');

const KEY = 'ABCDEFGH1234';
const MASKED = '********1234';

describe('LicenseKeys.mask', () => {
  const mask = core.LicenseKeys.mask;

  test.each([
    ['LicenseKeys', 'https://h/api/v2/download?LicenseKeys=' + KEY + '&Type=T',
      'https://h/api/v2/download?LicenseKeys=' + MASKED + '&Type=T'],
    ['licensekeys last', 'https://h/d?Type=T&licenseKeys=' + KEY,
      'https://h/d?Type=T&licenseKeys=' + MASKED],
    ['license', 'https://h/x.json?resource=R&license=' + KEY,
      'https://h/x.json?resource=R&license=' + MASKED],
    ['licenseKey', 'a?licenseKey=' + KEY + '#f', 'a?licenseKey=' + MASKED + '#f'],
    ['licenceKeys', 'a?licenceKeys=' + KEY, 'a?licenceKeys=' + MASKED],
    ['two keys', 'a?LicenseKeys=' + KEY + ',ZZZZZZZZ9999&b=1',
      'a?LicenseKeys=' + MASKED + ',********9999&b=1'],
    ['encoded comma', 'a?LicenseKeys=' + KEY + '%2CZZZZZZZZ9999',
      'a?LicenseKeys=' + MASKED + '%2C********9999'],
    ['encoded bar', 'a?LicenseKeys=' + KEY + '%7CZZZZZZZZ9999',
      'a?LicenseKeys=' + MASKED + '%7C********9999'],
    ['encoded bar in lower case', 'a?LicenseKeys=' + KEY + '%7cZZZZZZZZ9999',
      'a?LicenseKeys=' + MASKED + '%7c********9999'],
    ['a short key', 'a?license=abc', 'a?license=***'],
    ['the example', 'a?license=ABCDEFGH', 'a?license=****EFGH'],
    ['a key that ends a sentence', 'Failed from a?licenseKeys=ABCDEFGH. Again.',
      'Failed from a?licenseKeys=****EFGH. Again.'],
    ['a key before a comma', 'a?license=ABCDEFGH, then', 'a?license=****EFGH, then'],
    ['a key in brackets', '(a?license=ABCDEFGH)', '(a?license=****EFGH)'],
    ['a key before other punctuation', 'a?license=ABCDEFGH;:!?',
      'a?license=****EFGH;:!?'],
    ['text around', 'Checking for update from \'a?licenseKeys=' + KEY +
      '\' for Engine \'E\'',
    'Checking for update from \'a?licenseKeys=' + MASKED + '\' for Engine \'E\'']
  ])('masks a key in %s', (name, input, expected) => {
    expect(mask(input)).toBe(expected);
  });

  test('leaves text with no key alone', () => {
    expect(mask('https://h/a?b=1')).toBe('https://h/a?b=1');
    expect(mask('')).toBe('');
  });

  test('leaves a value that holds no key alone', () => {
    const value = { a: 1, b: ['c', { d: 'e' }] };
    expect(mask(value)).toBe(value);
    expect(mask(undefined)).toBeUndefined();
    expect(mask(null)).toBeNull();
    expect(mask(5)).toBe(5);
  });

  test('masks text inside arrays and plain objects', () => {
    const value = {
      source: 'CloudRequestEngine',
      message: ['a?license=' + KEY, { url: 'b?licenseKeys=' + KEY }]
    };
    const masked = mask(value);
    expect(masked).toEqual({
      source: 'CloudRequestEngine',
      message: ['a?license=' + MASKED, { url: 'b?licenseKeys=' + MASKED }]
    });
    expect(value.message[0]).toBe('a?license=' + KEY);
  });

  test('masks an object that refers to itself', () => {
    const value = { text: 'a?license=' + KEY };
    value.self = value;
    const masked = mask(value);
    expect(masked.text).toBe('a?license=' + MASKED);
    expect(masked.self).toBe(masked);
  });

  test('masks every own property of an error', () => {
    const error = new Error('failed for a?license=' + KEY);
    error.errorMessage = 'failed for a?license=' + KEY;
    error.input = 'a?license=' + KEY;
    error.details = { url: 'a?license=' + KEY };
    const masked = mask(error);
    expect(masked).toBeInstanceOf(Error);
    expect(masked.errorMessage).toBe('failed for a?license=' + MASKED);
    expect(masked.input).toBe('a?license=' + MASKED);
    expect(masked.details.url).toBe('a?license=' + MASKED);
    expect(JSON.stringify(masked)).not.toContain(KEY);
  });

  test('masks the errors and the cause an error holds', () => {
    const inner = new Error('a?license=' + KEY);
    const error = new AggregateError([inner], 'failed',
      { cause: new Error('b?license=' + KEY) });
    const masked = mask(error);
    expect(masked).toBeInstanceOf(AggregateError);
    expect(masked.errors[0].message).toBe('a?license=' + MASKED);
    expect(masked.cause.message).toBe('b?license=' + MASKED);
    expect(require('util').inspect(masked, { depth: null }))
      .not.toContain(KEY);
  });

  test('masks a known key wherever it appears', () => {
    const text = 'Invalid license key(s) supplied: \'' + KEY + '\'';
    expect(mask(text)).toBe(text);
    expect(mask(text, KEY))
      .toBe('Invalid license key(s) supplied: \'' + MASKED + '\'');
    expect(mask(text, [null, '', KEY]))
      .toBe('Invalid license key(s) supplied: \'' + MASKED + '\'');
  });

  test('masks a known key that ends a sentence', () => {
    expect(mask('Key ABCDEFGH.', 'ABCDEFGH')).toBe('Key ****EFGH.');
  });

  test('masks each of several known keys', () => {
    const keys = KEY + '|ZZZZZZZZ9999';
    expect(mask('Refused ZZZZZZZZ9999 and ' + KEY, keys))
      .toBe('Refused ********9999 and ' + MASKED);
    expect(mask('Refused ' + keys, keys))
      .toBe('Refused ' + MASKED + '|********9999');
    expect(mask('Refused ' + KEY + ',ZZZZZZZZ9999',
      KEY + ',ZZZZZZZZ9999'))
      .toBe('Refused ' + MASKED + ',********9999');
  });

  test('masks a known key encoded for a URL', () => {
    const key = 'ABCD/EFGH+1234';
    expect(mask('Refused ABCD%2FEFGH%2B1234', key))
      .toBe('Refused ' + encodeURIComponent('**********1234'));
    expect(mask('Refused ABCD%2fEFGH%2b1234', key))
      .toBe('Refused ' + encodeURIComponent('**********1234'));
  });

  test('masks a known key in an error', () => {
    const error = new Error('Invalid license key(s) supplied: \'' + KEY +
      '\'');
    const masked = mask(error, KEY);
    expect(masked.message)
      .toBe('Invalid license key(s) supplied: \'' + MASKED + '\'');
    expect(masked.stack).not.toContain(KEY);
  });

  test('masks the message of an error and keeps the rest', () => {
    const error = new TypeError('failed for a?license=' + KEY);
    const masked = mask(error);
    expect(masked).toBeInstanceOf(TypeError);
    expect(masked.message).toBe('failed for a?license=' + MASKED);
    expect(masked.stack).not.toContain(KEY);
  });

  test('returns an error with no key as it is', () => {
    const error = new Error('plain');
    expect(mask(error)).toBe(error);
  });
});

describe('logs and errors', () => {
  // The pipeline's log is on the path every detection takes, several times
  // over, so a message that is emitted is passed on as it is. The guarantee
  // is kept where a key can reach a message instead, which is the cloud
  // request engine, the data update service and the 51Did client, and each
  // of those has its own test. A message written to the console is still
  // masked, as the test below it shows, because the console is the end of
  // the line and nothing else would.
  test('a pipeline log entry is passed on as it is', () => {
    const pipeline = new core.PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false
    }).build();
    const heard = [];
    pipeline.on('warn', (message) => heard.push(message));
    pipeline.log('warn', 'Failed a?LicenseKeys=' + KEY);
    expect(heard).toEqual(['Failed a?LicenseKeys=' + KEY]);
  });

  test('a pipeline error entry with no listener is masked on the console',
    () => {
      const consoleError = jest.spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const pipeline = new core.PipelineBuilder({
          addJavaScriptBuilder: false,
          useSetHeaderProperties: false
        }).build();
        pipeline.log('error', new Error('Failed a?license=' + KEY));
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0][0].message)
          .toBe('Failed a?license=' + MASKED);
      } finally {
        consoleError.mockRestore();
      }
    });

  test('an error kept on the flow data is masked', async () => {
    const failing = new core.FlowElement({
      dataKey: 'failing',
      processInternal: () => {
        throw new Error('Request to a?license=' + KEY + ' failed');
      }
    });
    const pipeline = new core.PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false,
      suppressProcessExceptions: true
    }).add(failing).build();
    const heard = [];
    pipeline.on('error', (message) => heard.push(String(message)));
    const flowData = pipeline.createFlowData();
    await flowData.process();
    expect(flowData.errors.failing.message)
      .toBe('Request to a?license=' + MASKED + ' failed');
    expect(heard.join('\n')).not.toContain(KEY);
    expect(heard.join('\n')).toContain(MASKED);
  });
});
