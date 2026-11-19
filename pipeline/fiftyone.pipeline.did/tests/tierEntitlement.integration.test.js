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

// What each tier of resource key is entitled to from the live cloud. A
// Basic tier key gets a 51Did for the non-marketing usage and is refused
// the marketing usages, which need the CloudV5FODiD product. The Basic key
// is read from _51DEGREES_RESOURCE_KEY_BASIC alone, because a key of any
// other tier would get different answers. The Cloud 51Did workflow is the
// only place that key is set, so the integration-test script leaves this
// file out. The endpoint follows _51DEGREES_CLOUD_ENDPOINT as the client does.

const { FodId, DidClient, Usage } = require('../index');
const keys = require('./liveCloudKeys');

const BASIC_KEY_NAMES = ['_51DEGREES_RESOURCE_KEY_BASIC'];

// What the cloud answers a Basic tier key that asks for a marketing usage.
const MARKETING_REFUSED = 'Can not form IdProbGlobal. For marketing ' +
  '(personalized or standard) usages a CloudV5FODiD product needs to be a ' +
  'part of the license.';

const basicKey = keys.findKey(BASIC_KEY_NAMES);

const noKey = keys.noKeyMessage(BASIC_KEY_NAMES, 'FODid',
  'a 51Did for each usage, to check what a Basic tier key is given', true);

// Asks the json endpoint for the global 51Did with the given usage and
// returns the fodid element of the answer.
const fodidFor = async (usage) => {
  const client = new DidClient({ resourceKey: basicKey });
  const url = client.endpoint + 'json?resource=' +
    encodeURIComponent(basicKey) + '&id.usage=' + encodeURIComponent(usage) +
    '&values=FODiD.IdProbGlobal';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'fiftyone.pipeline.did tests' }
  });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`json answered HTTP ${response.status}: ${body}`);
  }
  return JSON.parse(body).fodid;
};

describe('What a Basic tier key is entitled to', () => {
  jest.setTimeout(30000);

  test('a 51Did for the non-marketing usage', async () => {
    if (!basicKey) {
      throw new Error(noKey);
    }
    const fodid = await fodidFor('non-marketing');
    if (!fodid || typeof fodid.idprobglobal !== 'string') {
      throw new Error(keys.missingMessage(
        'a 51Did for id.usage=non-marketing',
        fodid && fodid.idprobglobalnullreason, 'FODid'));
    }
    expect(FodId.fromBase64(fodid.idprobglobal).usage)
      .toBe(Usage.NON_MARKETING);
  });

  test.each(['standard', 'personalized'])(
    'no 51Did for the %s usage, with the reason', async (usage) => {
      if (!basicKey) {
        throw new Error(noKey);
      }
      const fodid = await fodidFor(usage);
      expect(fodid).toBeDefined();
      expect(fodid.idprobglobal).toBeFalsy();
      expect(fodid.idprobglobalnullreason).toBe(MARKETING_REFUSED);
    });
});
