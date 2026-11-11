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

// Evidence keys ignore letter case, as the Evidence page of the pipeline
// specification says, so header.User-Agent and header.user-agent are the
// same key. A value added under one is read under the other, a key added
// again in other letters replaces the value rather than making a second
// entry, and an element reads what a caller added in whatever letters the
// request carried.

const core = require('fiftyone.pipeline.core');

/**
 * A flow data from a pipeline holding the Sequence Element, which reads
 * query.session-id and query.sequence, so what an element sees can be
 * checked as well as what get returns.
 *
 * @returns {object} a new flow data
 */
function flowData () {
  return new core.PipelineBuilder().build().createFlowData();
}

describe('evidence key case', () => {
  test('a key added in one case is read in any case', () => {
    const data = flowData();
    data.evidence.add('query.Session-Id', 'abc-123');
    expect(data.evidence.get('query.session-id')).toBe('abc-123');
    expect(data.evidence.get('QUERY.SESSION-ID')).toBe('abc-123');
    expect(data.evidence.get('query.Session-Id')).toBe('abc-123');
  });

  test('keys that differ only in case are one key', () => {
    const data = flowData();
    data.evidence.add('query.Session-Id', 'first');
    data.evidence.add('query.session-id', 'second');
    expect(Object.keys(data.evidence.getAll()).length).toBe(1);
    expect(data.evidence.get('query.session-id')).toBe('second');
  });

  test('a key keeps the letters it was first added with', () => {
    const data = flowData();
    data.evidence.add('query.Session-Id', 'first');
    data.evidence.add('query.session-id', 'second');
    expect(Object.keys(data.evidence.getAll())).toEqual(['query.Session-Id']);
  });

  test('an element reads evidence added in other letters', async () => {
    const data = flowData();
    data.evidence.add('QUERY.SESSION-ID', 'abc-123');
    data.evidence.add('Query.Sequence', 5);
    await data.process();
    expect(data.evidence.get('query.sequence')).toBe(6);
  });

  test('the JavaScript Builder keeps a key added in other letters', () => {
    // The JavaScript Builder alone, so its own filter decides whether a key
    // is kept, and that decision ignores letter case as get does. The keys
    // are ones the builder accepts, being a query string parameter and the
    // host it calls back to.
    const data = new core.PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false
    }).add(new core.JavascriptBuilder({})).build().createFlowData();
    data.evidence.add('Query.Client-IP', '192.0.2.1');
    data.evidence.add('HEADER.Host', 'example.com');
    expect(data.evidence.get('query.client-ip')).toBe('192.0.2.1');
    expect(data.evidence.get('header.host')).toBe('example.com');
  });

  test('a key that is not there is still undefined', () => {
    const data = flowData();
    expect(data.evidence.get('query.session-id')).toBeUndefined();
  });
});
