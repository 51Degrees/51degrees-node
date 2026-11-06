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

const ShareUsageEvidenceKeyFilter = require('../shareUsageEvidenceKeyFilter');

/**
 * Check that by default headers other than Cookie are shared, cookies,
 * session values and query string parameters only when their names start
 * with 51D_, and any other evidence.
 */
test('share usage filter - default rules', () => {
  const filter = new ShareUsageEvidenceKeyFilter({});

  expect(filter.filterEvidenceKey('header.user-agent')).toBe(true);
  expect(filter.filterEvidenceKey('header.cookie')).toBe(false);
  expect(filter.filterEvidenceKey('cookie.51d_screenpixelswidth')).toBe(true);
  expect(filter.filterEvidenceKey('cookie.51D_ScreenPixelsWidth')).toBe(true);
  expect(filter.filterEvidenceKey('cookie.sessionid')).toBe(false);
  expect(filter.filterEvidenceKey('cookie.a.b')).toBe(false);
  expect(filter.filterEvidenceKey('session.51d_value')).toBe(true);
  expect(filter.filterEvidenceKey('session.org.example.attribute')).toBe(false);
  expect(filter.filterEvidenceKey('query.51d_gethighentropyvalues')).toBe(true);
  expect(filter.filterEvidenceKey('query.password')).toBe(false);
  expect(filter.filterEvidenceKey('query.id.email')).toBe(false);
  expect(filter.filterEvidenceKey('server.client-ip')).toBe(true);
  expect(filter.filterEvidenceKey('nodot')).toBe(true);
});

/**
 * Check that a name containing a dot is matched as a whole against the
 * parameters to share.
 */
test('share usage filter - field is everything after the first dot', () => {
  const filter = new ShareUsageEvidenceKeyFilter({
    queryWhitelist: ['valid.email']
  });

  expect(filter.filterEvidenceKey('query.valid.email')).toBe(true);
  expect(filter.filterEvidenceKey('query.valid')).toBe(false);
  expect(filter.filterEvidenceKey('query.other.name')).toBe(false);
});

/**
 * Check that the headers not to share and the parameters to share are
 * matched without regard to case.
 */
test('share usage filter - lists ignore case', () => {
  const filter = new ShareUsageEvidenceKeyFilter({
    queryWhitelist: ['Campaign'],
    headerBlacklist: ['X-Secret']
  });

  expect(filter.filterEvidenceKey('header.x-secret')).toBe(false);
  expect(filter.filterEvidenceKey('query.campaign')).toBe(true);
  expect(filter.filterEvidenceKey('header.user-agent')).toBe(true);
});

/**
 * Check that null in place of the parameters to share shares every
 * parameter, and an empty list only those starting 51D_.
 */
test('share usage filter - no parameter list shares every parameter', () => {
  const every = new ShareUsageEvidenceKeyFilter({ queryWhitelist: null });
  const prefixed = new ShareUsageEvidenceKeyFilter({ queryWhitelist: [] });

  expect(every.filterEvidenceKey('query.campaign')).toBe(true);
  expect(prefixed.filterEvidenceKey('query.campaign')).toBe(false);
  expect(prefixed.filterEvidenceKey('query.51d_campaign')).toBe(true);
});

/**
 * Check that the session cookie is included only when asked for, and that
 * no other ordinary cookie is.
 */
test('share usage filter - session cookie', () => {
  const kept = new ShareUsageEvidenceKeyFilter({
    cookie: 'SessionId',
    includeSession: true
  });
  const sent = new ShareUsageEvidenceKeyFilter({ cookie: 'SessionId' });

  expect(kept.filterEvidenceKey('cookie.sessionid')).toBe(true);
  expect(sent.filterEvidenceKey('cookie.sessionid')).toBe(false);
  expect(kept.filterEvidenceKey('cookie._ga')).toBe(false);
  expect(sent.filterEvidenceKey('cookie._ga')).toBe(false);
});

/**
 * Check that sharing everything shares the evidence the other rules leave
 * out, apart from the evidence that is never shared.
 */
test('share usage filter - share all', () => {
  const filter = new ShareUsageEvidenceKeyFilter({ shareAll: true });

  expect(filter.filterEvidenceKey('header.cookie')).toBe(true);
  expect(filter.filterEvidenceKey('cookie.sessionid')).toBe(true);
  expect(filter.filterEvidenceKey('query.password')).toBe(true);
  expect(filter.filterEvidenceKey('query.id.usage')).toBe(true);
  expect(filter.filterEvidenceKey('server.request-method')).toBe(true);
  expect(filter.filterEvidenceKey('query.id.email')).toBe(false);
  expect(filter.filterEvidenceKey('header.id.email')).toBe(false);
  expect(filter.filterEvidenceKey('query.id.salt')).toBe(false);
  expect(filter.filterEvidenceKey('header.id.salt')).toBe(false);
  expect(filter.filterEvidenceKey('server.request-query')).toBe(false);
  expect(filter.filterEvidenceKey('server.request-path')).toBe(false);
});

/**
 * Check that the email address, the salt for hashed email identifiers, the
 * query string and the path are never shared, whether bare or after a
 * prefix, and without regard to case.
 */
test('share usage filter - never shared in every mode', () => {
  const filters = [
    new ShareUsageEvidenceKeyFilter({}),
    new ShareUsageEvidenceKeyFilter({ queryWhitelist: null }),
    new ShareUsageEvidenceKeyFilter({ shareAll: true })
  ];
  const keys = [
    'id.email', 'id.salt',
    'query.id.email', 'QUERY.ID.EMAIL',
    'header.id.salt', 'HEADER.ID.SALT',
    'server.request-query', 'SERVER.REQUEST-QUERY',
    'server.request-path', 'SERVER.REQUEST-PATH'
  ];
  for (const filter of filters) {
    for (const key of keys) {
      expect([key, filter.filterEvidenceKey(key)]).toEqual([key, false]);
    }
  }
});

/**
 * Check that a key that only ends with the same letters as a key never
 * shared is treated as an ordinary key.
 */
test('share usage filter - never shared keys match whole parts', () => {
  const named = new ShareUsageEvidenceKeyFilter({
    queryWhitelist: ['valid.email']
  });
  const all = new ShareUsageEvidenceKeyFilter({ shareAll: true });

  expect(named.filterEvidenceKey('query.valid.email')).toBe(true);
  expect(all.filterEvidenceKey('query.valid.email')).toBe(true);
});

/**
 * Check that sharing one parameter does not share the whole query string,
 * which carries every parameter.
 */
test('share usage filter - naming a parameter does not share the query string', () => {
  const filter = new ShareUsageEvidenceKeyFilter({
    queryWhitelist: ['utm_source']
  });

  expect(filter.filterEvidenceKey('query.utm_source')).toBe(true);
  expect(filter.filterEvidenceKey('server.request-query')).toBe(false);
});
