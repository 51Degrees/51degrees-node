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
// against a stand-in for the cloud service on this machine that answers
// every request for the accessible properties with status 500. The example
// cannot tell whether the resource key carries the hardware lookup, so it
// must not say that the key lacks it. It must ask again, then end with a
// message naming the cloud service's error and exit code 1, rather than an
// unhandled rejection. An error that is not from a request to the cloud
// service, such as a resource key the cloud request engine refuses before
// sending anything, must not be described as one. No real key and no network
// are used.

const path = require('path');

const {
  EXAMPLE_FILES,
  JEST_MARGIN_MS,
  TIMEOUT_MS,
  fixture,
  printed,
  runAgainstStandIn
} = require(path.join(__dirname, 'hardwareLookupStandIn.js'));

const SERVER_ERROR = 500;

const ANSWERS = {
  accessibleProperties: SERVER_ERROR,
  evidenceKeys: fixture('evidencekeys.json')
};

// How the example's last line starts when a request to the cloud service
// failed.
const STOPPED = 'The example stopped because the request to the cloud ' +
  'service failed. ';

describe('hardware lookup examples when the cloud service fails', () => {
  for (const [folder, file] of EXAMPLE_FILES) {
    test(`${file} ends with the cloud service's error`, async () => {
      const result = await runAgainstStandIn(folder, file, ANSWERS);
      const text = printed(result);

      // The example failed, and what it printed is shown when it did not.
      expect({
        status: result.status,
        signal: result.signal,
        printed: result.status === 1 ? '' : text
      }).toEqual({ status: 1, signal: null, printed: '' });

      // It does not blame the key, and looks nothing up.
      expect(text).not.toContain('does not include HardwarePlatform.Profiles');
      expect(text.split(/\r?\n/).filter((line) =>
        line.startsWith('Which devices are associated'))).toEqual([]);
      expect(result.requests.filter((request) => request.endsWith('json')))
        .toEqual([]);

      // It asked for the properties again before giving up.
      expect(result.requests.filter((request) =>
        request === 'GET /api/v4/accessibleproperties').length)
        .toBeGreaterThanOrEqual(2);

      // Its last word is a message naming the error, not an unhandled
      // rejection.
      const errors = result.stderr.split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      const last = errors[errors.length - 1] || '';
      expect(last.slice(0, STOPPED.length)).toBe(STOPPED);
      expect(last).toContain('accessibleproperties');
      expect(last).toContain(`(status code ${SERVER_ERROR})`);
      expect(text).not.toContain('UnhandledPromiseRejection');
      expect(text).not.toContain('[object Array]');
      expect(result.stdout.split(/\r?\n/)).toContain('Find out more:');
    }, TIMEOUT_MS + JEST_MARGIN_MS);
  }
});

describe('hardware lookup examples when they fail without a cloud request',
  () => {
    // Not empty, so the example takes it as a key, but blank, so the cloud
    // request engine refuses it before sending anything.
    const BLANK_KEY = ' ';

    // How the example's last line starts when the error did not come from a
    // request to the cloud service.
    const STOPPED_OTHER = 'The example stopped: ';

    for (const [folder, file] of EXAMPLE_FILES) {
      test(`${file} does not call the error a failed cloud request`,
        async () => {
          const result = await runAgainstStandIn(
            folder, file, ANSWERS, BLANK_KEY);
          const text = printed(result);

          // The example failed, and what it printed is shown when it did
          // not.
          expect({
            status: result.status,
            signal: result.signal,
            printed: result.status === 1 ? '' : text
          }).toEqual({ status: 1, signal: null, printed: '' });

          // No request was made, so none is said to have failed.
          expect(result.requests).toEqual([]);
          expect(text).not.toContain(STOPPED);
          const errors = result.stderr.split(/\r?\n/)
            .filter((line) => line.trim() !== '');
          const last = errors[errors.length - 1] || '';
          expect(last.slice(0, STOPPED_OTHER.length)).toBe(STOPPED_OTHER);
          expect(text).not.toContain('UnhandledPromiseRejection');
          expect(result.stdout.split(/\r?\n/)).toContain('Find out more:');
        }, TIMEOUT_MS + JEST_MARGIN_MS);
    }
  });
