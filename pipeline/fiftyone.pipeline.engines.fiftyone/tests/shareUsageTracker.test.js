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

const ShareUsageTracker = require('../shareUsageTracker');

const INTERVAL_MILLISECONDS = 60000;
const START = 1000000;

let now = START;

beforeEach(() => {
  now = START;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Track the key as the element does, storing the time when it is shared.
 *
 * @param {ShareUsageTracker} tracker the tracker
 * @param {string} key the key to track
 * @param {number} milliseconds the time after the start
 * @returns {boolean} whether the key is shared
 */
const shareAt = (tracker, key, milliseconds) => {
  now = START + milliseconds;
  const shared = tracker.track(key);
  if (shared) {
    tracker.put(key);
  }
  return shared;
};

test('share usage tracker - repeat inside the interval is not shared', () => {
  const tracker = new ShareUsageTracker({ interval: INTERVAL_MILLISECONDS });
  expect(shareAt(tracker, 'a', 0)).toBe(true);

  expect(shareAt(tracker, 'a', INTERVAL_MILLISECONDS - 1)).toBe(false);
});

test('share usage tracker - repeat at the interval is shared', () => {
  const tracker = new ShareUsageTracker({ interval: INTERVAL_MILLISECONDS });
  expect(shareAt(tracker, 'a', 0)).toBe(true);

  expect(shareAt(tracker, 'a', INTERVAL_MILLISECONDS)).toBe(true);
});

test('share usage tracker - repeat after the interval is shared', () => {
  const tracker = new ShareUsageTracker({ interval: INTERVAL_MILLISECONDS });
  expect(shareAt(tracker, 'a', 0)).toBe(true);

  expect(shareAt(tracker, 'a', INTERVAL_MILLISECONDS + 1)).toBe(true);
});

test('share usage tracker - repeat inside the interval leaves the time', () => {
  const tracker = new ShareUsageTracker({ interval: INTERVAL_MILLISECONDS });
  expect(shareAt(tracker, 'a', 0)).toBe(true);
  expect(shareAt(tracker, 'a', 30000)).toBe(false);

  expect(shareAt(tracker, 'a', INTERVAL_MILLISECONDS)).toBe(true);
});
