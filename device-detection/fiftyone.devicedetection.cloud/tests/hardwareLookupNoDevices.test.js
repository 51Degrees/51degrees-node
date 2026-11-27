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

// Runs the TAC and native model lookup examples from their own folders
// against a stand-in for the cloud service on this machine, whose list of
// accessible properties includes the hardware lookup and whose lookup
// answer lists no devices, as the cloud service answers for a value that
// matches nothing. Each example must look up every value, say under each
// heading that no devices are associated with it, and end normally, also
// when the first request for the list failed and the example had to ask
// again. No real key and no network are used.

const path = require('path');

const {
  EXAMPLE_FILES,
  JEST_MARGIN_MS,
  TIMEOUT_MS,
  fixture,
  printed,
  runAgainstStandIn
} = require(path.join(__dirname, 'hardwareLookupStandIn.js'));

const ANSWERS = {
  accessibleProperties: fixture('accessibleproperties-with-hardware.json'),
  evidenceKeys: fixture('evidencekeys.json'),
  lookup: fixture('json-no-devices.json')
};

const SERVER_ERROR = 500;

// The first request for the accessible properties fails, and every later
// one gets the answer for a key with the hardware lookup.
const FAIL_ONCE_ANSWERS = Object.assign({}, ANSWERS, {
  accessibleProperties: [SERVER_ERROR, ANSWERS.accessibleProperties]
});

// What each example looks up, by its file.
const LOOKUPS = {
  'tacLookup.js': {
    subject: 'TAC',
    values: ['35925406', '86386802']
  },
  'nativeModelLookup.js': {
    subject: 'native model name',
    values: ['SC-03L', 'iPhone11,8']
  }
};

/**
 * Checks that the example ended normally, looked up every value and said
 * under each heading that no devices are associated with the value.
 *
 * @param {string} file The example's file
 * @param {object} result What runAgainstStandIn gave
 */
const expectNoDevicesForEachValue = function (file, result) {
  const { subject, values } = LOOKUPS[file];

  // What the example printed is shown when it did not end normally.
  expect({
    status: result.status,
    signal: result.signal,
    printed: result.status === 0 ? '' : printed(result)
  }).toEqual({ status: 0, signal: null, printed: '' });

  // Each heading has the one line saying no devices are associated with the
  // value, and nothing else under it.
  const lines = result.stdout.split(/\r?\n/);
  for (const value of values) {
    const heading = 'Which devices are associated with the ' +
      `${subject} '${value}'?`;
    const at = lines.indexOf(heading);
    expect({ heading, found: at >= 0 }).toEqual({ heading, found: true });
    expect(lines[at + 1])
      .toBe(`\tNo devices are associated with this ${subject}.`);
    expect((lines[at + 2] || '').startsWith('\t')).toBe(false);
  }

  // The key carries the lookup, so the example does not say it lacks it.
  expect(lines.filter((line) =>
    line.includes('HardwarePlatform.Profiles'))).toEqual([]);

  // One lookup was made for each value, which is the request for the key's
  // JSON.
  expect(result.requests.filter((request) => request.endsWith('json')))
    .toHaveLength(values.length);
};

describe('hardware lookup examples with a lookup that matches nothing',
  () => {
    for (const [folder, file] of EXAMPLE_FILES) {
      test(`${file} says no devices are associated with each value`,
        async () => {
          const result = await runAgainstStandIn(folder, file, ANSWERS);
          expectNoDevicesForEachValue(file, result);

          // Nothing was logged as an error or with a stack trace.
          expect(result.stderr.split(/\r?\n/)
            .filter((line) => /error|^\s+at\s/i.test(line))).toEqual([]);
        }, TIMEOUT_MS + JEST_MARGIN_MS);

      test(`${file} asks again after a failed request and then looks up ` +
        'each value', async () => {
        const result = await runAgainstStandIn(
          folder, file, FAIL_ONCE_ANSWERS);

        // The failed request is logged, so standard error is not checked.
        expectNoDevicesForEachValue(file, result);

        // The first answer was the failure, so the lookups came from asking
        // again.
        expect(result.requests.filter((request) =>
          request === 'GET /api/v4/accessibleproperties').length)
          .toBeGreaterThanOrEqual(2);
      }, TIMEOUT_MS + JEST_MARGIN_MS);
    }
  });
