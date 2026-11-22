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

// The Human Confidence web example's passive route, run against the live
// cloud service with a resource key outside the Bespoke product, which gets
// no HumanConfidenceSource. The key is read from
// _51DEGREES_RESOURCE_KEY_BASIC alone. The Cloud 51Did workflow is the only
// place that key is set, so the integration-test script leaves this file
// out, and it is run with jest on its own. It fails rather than skips with
// no key. The key is never printed.

const { demoRoutes } = require('../examples/human-confidence-web/server');
const keys = require('./liveCloudKeys');
const live = require('./humanConfidenceLive');

const BASIC_KEY_NAMES = ['_51DEGREES_RESOURCE_KEY_BASIC'];

const resource = keys.findKey(BASIC_KEY_NAMES);

describe('Human Confidence example with a key outside Bespoke', () => {
  jest.setTimeout(30000);

  test('the passive answer carries no source', async () => {
    if (!resource) {
      throw new Error(keys.noKeyMessage(BASIC_KEY_NAMES, 'Basic',
        'HumanConfidenceSource, to check that a key outside Bespoke gets ' +
        'none'));
    }
    const response = live.fakeResponse();
    await demoRoutes({
      resource, license: '', api: live.api, fetch: live.namingTheProperties
    }).passive(live.visitor, response);

    const answer = JSON.parse(response.body);
    expect(answer.error).toBeUndefined();
    expect(answer.source).toBeNull();
  });
});
