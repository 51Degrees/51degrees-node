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

// A Pipeline's Resource Key and License Key, held as the Evidence
// fiftyone.resource-key and fiftyone.license-key, are shared whatever the
// configuration, because usage is counted against them
// (usage-sharing-element.md lines 76 to 79).

const ShareUsage = require('../shareUsage');
const ShareUsageEvidenceKeyFilter = require('../shareUsageEvidenceKeyFilter');

const BILLING_KEYS = ['fiftyone.resource-key', 'fiftyone.license-key'];

// Configurations that each leave out some Evidence.
const CONFIGURATIONS = [
  {},
  { shareAll: true },
  { queryWhitelist: [] },
  { queryWhitelist: null },
  { headerBlacklist: ['user-agent'] },
  { shareAllQueryStringParameters: false, queryWhitelist: [] },
  { cookie: 'sessionid', trackSession: true }
];

describe('the billing keys', () => {
  test.each(CONFIGURATIONS)('pass the share filter with %p', (options) => {
    const filter = new ShareUsageEvidenceKeyFilter(options);
    for (const key of BILLING_KEYS) {
      expect([key, filter.filterEvidenceKey(key)]).toEqual([key, true]);
    }
  });

  test.each(CONFIGURATIONS)('pass the element\'s filters with %p',
    (options) => {
      const element = new ShareUsage(options);
      for (const key of BILLING_KEYS) {
        expect([key, element.dataEvidenceKeyFilter.filterEvidenceKey(key)])
          .toEqual([key, true]);
        expect([key, element.keptEvidenceKeyFilter.filterEvidenceKey(key)])
          .toEqual([key, true]);
      }
    });
});
