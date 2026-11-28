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
// staging cloud service with a resource key outside the Bespoke product,
// which gets no HumanConfidenceSource. The example reads a property the
// answer leaves out as null, the same as one the answer gives as null, so
// the test also reads the cloud's own answer. That answer has to carry
// HumanConfidenceSource as null with a reason, which a cloud that does not
// serve the property leaves out. It reads the service from
// CLOUD_STAGING_ENDPOINT and the key from _51DEGREES_RESOURCE_KEY_BASIC
// alone, and fails rather than skips when either is not set. The key is
// never printed.

const { demoRoutes } = require('../examples/human-confidence-web/server');
const keys = require('./liveCloudKeys');
const live = require('./humanConfidenceLive');

const BASIC_KEY_NAME = '_51DEGREES_RESOURCE_KEY_BASIC';

const resource = keys.findKey(BASIC_KEY_NAME);

describe('Human Confidence example on the staging cloud service with a ' +
  'key outside Bespoke', () => {
  jest.setTimeout(30000);

  test('the cloud answers the source as null, with a reason', async () => {
    const api = live.stagingApi();
    if (!resource) {
      throw new Error(live.noKeyMessage(BASIC_KEY_NAME, 'Basic',
        'HumanConfidenceSource, to check that a key outside Bespoke gets ' +
        'none'));
    }
    const cloud = live.keepingAnswers();
    const response = live.fakeResponse();
    await demoRoutes({
      resource, license: '', api, requestClient: cloud.requestClient
    }).passive(live.visitor, response);

    const answer = JSON.parse(response.body);
    expect(answer.error).toBeUndefined();
    expect(answer.source).toBeNull();

    expect(cloud.bodies).toHaveLength(1);
    const derived = JSON.parse(cloud.bodies[0]).derived;
    expect(derived).toHaveProperty('humanconfidencesource', null);
    expect(derived.humanconfidencesourcenullreason)
      .toEqual(expect.stringMatching(/\S/));
  });
});
