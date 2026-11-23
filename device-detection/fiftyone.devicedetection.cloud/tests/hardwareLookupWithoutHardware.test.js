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

// Runs the TAC and native model lookup examples from their own folders, as a
// person runs them, against a stand-in for the cloud service on this
// machine. The stand-in's list of accessible properties has no hardware
// element, as for a resource key without the hardware lookup. Each example
// must say so in one line and end normally without making a lookup, also
// when the first request for that list failed and the example had to ask
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
  accessibleProperties: fixture('accessibleproperties-no-hardware.json'),
  evidenceKeys: fixture('evidencekeys.json')
};

const SERVER_ERROR = 500;

// The first request for the accessible properties fails, and every later
// one gets the answer for a key without the hardware lookup.
const FAIL_ONCE_ANSWERS = {
  accessibleProperties: [SERVER_ERROR, ANSWERS.accessibleProperties],
  evidenceKeys: ANSWERS.evidenceKeys
};

// The line the example prints, with its links tagged with the example's
// file.
const expectedLine = (folder, file) => {
  const query = '?utm_source=code&utm_medium=example' +
    '&utm_campaign=51degrees-node' +
    '&utm_content=fiftyone.devicedetection.cloud-examples-cloud-' +
    `${folder}-${file.toLowerCase()}&utm_term=no-hardware-lookup`;
  return 'The resource key does not include HardwarePlatform.Profiles, the ' +
    'hardware lookup this example needs, so no devices are listed. Create ' +
    'a resource key that includes it at ' +
    `https://51degrees.com/configure/QKyYH5XT${query}, or contact us ` +
    `about it at https://51degrees.com/contact-us${query}.`;
};

describe('hardware lookup examples with a key that has no hardware lookup',
  () => {
    for (const [folder, file] of EXAMPLE_FILES) {
      test(`${file} says what the key needs and makes no lookup`, async () => {
        const result = await runAgainstStandIn(folder, file, ANSWERS);

        // What the example printed is shown when it did not end normally.
        expect({
          status: result.status,
          signal: result.signal,
          printed: result.status === 0 ? '' : printed(result)
        }).toEqual({ status: 0, signal: null, printed: '' });

        // Nothing was logged as an error or with a stack trace.
        expect(result.stderr.split(/\r?\n/)
          .filter((line) => /error|^\s+at\s/i.test(line))).toEqual([]);

        const lines = result.stdout.split(/\r?\n/);
        expect(lines.filter((line) =>
          line.includes('HardwarePlatform.Profiles')))
          .toEqual([expectedLine(folder, file)]);
        expect(lines.filter((line) =>
          line.startsWith('Which devices are associated'))).toEqual([]);
        expect(lines).toContain('Find out more:');

        // The example asked the stand-in for the properties, and made no
        // lookup, which is the request for the key's JSON.
        expect(result.requests).toContain('GET /api/v4/accessibleproperties');
        expect(result.requests.filter((request) => request.endsWith('json')))
          .toEqual([]);
      }, TIMEOUT_MS + JEST_MARGIN_MS);

      test(`${file} asks again after a failed request and then says what ` +
        'the key needs', async () => {
        const result = await runAgainstStandIn(
          folder, file, FAIL_ONCE_ANSWERS);

        // What the example printed is shown when it did not end normally.
        // The failed request is logged, so standard error is not checked.
        expect({
          status: result.status,
          signal: result.signal,
          printed: result.status === 0 ? '' : printed(result)
        }).toEqual({ status: 0, signal: null, printed: '' });

        const lines = result.stdout.split(/\r?\n/);
        expect(lines.filter((line) =>
          line.includes('HardwarePlatform.Profiles')))
          .toEqual([expectedLine(folder, file)]);
        expect(lines.filter((line) =>
          line.startsWith('Which devices are associated'))).toEqual([]);
        expect(lines).toContain('Find out more:');

        // The first answer was the failure, so the line came from asking
        // again.
        expect(result.requests.filter((request) =>
          request === 'GET /api/v4/accessibleproperties').length)
          .toBeGreaterThanOrEqual(2);
        expect(result.requests.filter((request) => request.endsWith('json')))
          .toEqual([]);
      }, TIMEOUT_MS + JEST_MARGIN_MS);
    }
  });
