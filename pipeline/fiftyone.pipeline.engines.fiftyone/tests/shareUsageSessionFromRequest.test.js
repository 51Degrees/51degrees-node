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

// With session tracking on, the session cookie is read from the web request
// supplied as server.http-request as well as from the Evidence, so a cookie
// found only in the web request still tells sessions apart
// (usage-sharing-element.md lines 81 to 90).

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// More records than the requests here make, so nothing is sent and the
// queue shows what was shared.
const PACKAGE_SIZE = 10;

/**
 * Processes one request whose user agent is in the Evidence and whose
 * session cookie is only in the web request.
 *
 * @param {object} pipeline the Pipeline
 * @param {string} session the session cookie's value
 * @returns {Promise} resolved once processed
 */
const processRequest = (pipeline, session) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'repeated user agent');
  flowData.evidence.add('server.http-request', {
    'header.user-agent': 'repeated user agent',
    'cookie.sessionid': session
  });
  return flowData.process();
};

test('a session cookie only in the web request tells sessions apart',
  async () => {
    const usageEngine = new ShareUsage({
      requestedPackageSize: PACKAGE_SIZE,
      endpoint: 'http://127.0.0.1/',
      cookie: 'sessionid',
      trackSession: true
    });
    const pipeline = new PipelineBuilder().add(usageEngine).build();

    await processRequest(pipeline, 'session value 1');
    await processRequest(pipeline, 'session value 1');
    await processRequest(pipeline, 'session value 2');

    // The repeat in the first session is not shared, and the same request in
    // a new session is, with the cookie itself never in a record.
    expect(usageEngine.shareData.length).toBe(2);
    expect(usageEngine.shareData.join('')).not.toContain('session value');
  });
