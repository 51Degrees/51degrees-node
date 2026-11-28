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

// The Human Confidence web example's passive route, run against the
// staging cloud service with a Bespoke resource key the staging cloud
// resolves. The answer has to carry HumanConfidenceSource as Passive,
// because no browser tests have run, and a plain level. The production
// cloud does not serve HumanConfidenceSource yet, so the test reads the
// service from CLOUD_STAGING_ENDPOINT and the key from
// RESOURCE_KEY_BESPOKE_STAGING. It fails rather than skips when either is
// not set, because a cloud test that passes without calling the cloud has
// proved nothing. The key is never printed.

const { demoRoutes } = require('../examples/human-confidence-web/server');
const keys = require('./liveCloudKeys');
const live = require('./humanConfidenceLive');

const resource = keys.findKey(live.BESPOKE_KEY_NAME);

// Every value the level has.
const LEVELS = ['High', 'Medium', 'Low', 'Unknown'];

describe('Human Confidence example against the staging cloud service', () => {
  jest.setTimeout(30000);

  test('the passive answer carries the source Passive and a level',
    async () => {
      const api = live.stagingApi();
      if (!resource) {
        throw new Error(live.noKeyMessage(live.BESPOKE_KEY_NAME,
          'Bespoke', 'HumanConfidence and HumanConfidenceSource'));
      }
      const response = live.fakeResponse();
      await demoRoutes({ resource, license: '', api })
        .passive(live.visitor, response);

      const answer = JSON.parse(response.body);
      expect(answer.error).toBeUndefined();
      expect(answer.source).toBe('Passive');
      expect(LEVELS).toContain(answer.humanConfidence);
    });
});
