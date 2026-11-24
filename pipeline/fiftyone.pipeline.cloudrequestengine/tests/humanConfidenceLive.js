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

// What the live Human Confidence tests share. They call the staging cloud
// service, because the production cloud does not serve
// HumanConfidenceSource yet. They share the names they read, the staging
// API base, a visitor's request, a response to write to, and a fetch that
// names the two properties in the request for the passive level, so the
// answer carries both whatever the key's own list of properties holds.
// Another fetch also keeps the cloud's answer to that request, for a test
// that has to see the answer as the cloud sent it. The visitor's evidence
// is passed on as it is.
//
// Only CI sets the staging names, in the Cloud Human Confidence workflow,
// so the integration-test script leaves out these tests, whose files end
// .staging.integration.test.js.

// The CI-only name of the staging cloud's API base, ending /api/v4/.
const ENDPOINT_NAME = 'CLOUD_STAGING_ENDPOINT';

// The CI-only name of a Bespoke resource key the staging cloud resolves.
const BESPOKE_KEY_NAME = 'RESOURCE_KEY_BESPOKE_STAGING';

// The properties the tests name in their request.
const PROPERTIES = 'derived.humanconfidence,derived.humanconfidencesource';

const visitor = {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 ' +
      'Safari/537.36'
  },
  socket: {}
};

/**
 * The staging cloud's API base, ending in one slash. There is no default,
 * so a test never calls another cloud service by mistake.
 *
 * @returns {string} the API base
 * @throws {Error} when the name is not set
 */
function stagingApi () {
  const endpoint = (process.env[ENDPOINT_NAME] || '').trim();
  if (!endpoint) {
    throw new Error('This test calls the staging cloud service, because ' +
      'the production cloud does not serve HumanConfidenceSource yet, and ' +
      `there is nothing to fall back on. ${ENDPOINT_NAME} is not set. Set ` +
      'it to the staging cloud\'s API base, ending /api/v4/.');
  }
  return endpoint.replace(/\/+$/, '') + '/';
}

/**
 * The message a staging test fails with when no resource key is set.
 *
 * @param {string} name the environment variable name
 * @param {string} product the product the key has to carry
 * @param {string} asksFor what the test asks the cloud service for
 * @returns {string} the message
 */
function noKeyMessage (name, product, asksFor) {
  return 'This test calls the staging cloud service, so it needs a ' +
    'resource key the staging cloud resolves, and there is nothing to ' +
    `fall back on. ${name} is not set. The key has to carry the ` +
    `${product} product, because the test asks the service for ` +
    `${asksFor}. To see the products a key carries, open ` +
    `accessibleproperties?resource=<key> under ${ENDPOINT_NAME}.`;
}

/**
 * A response for a route to write to, keeping the status and the body.
 *
 * @returns {object} the response
 */
function fakeResponse () {
  return {
    status: null,
    body: '',
    writeHead (status) { this.status = status; },
    end (body) { this.body = body === undefined ? '' : String(body); }
  };
}

/**
 * Whether a request is the route's request for the passive level.
 *
 * @param {string} url the address
 * @param {object} options the fetch options
 * @returns {boolean} true for the passive request
 */
function isPassiveRequest (url, options) {
  return options.method === 'POST' && String(url).endsWith('.json');
}

/**
 * The global fetch, adding the properties to the route's request for the
 * passive level.
 *
 * @param {string} url the address
 * @param {object} [options] the fetch options
 * @returns {Promise<Response>} the answer
 */
function namingTheProperties (url, options = {}) {
  if (isPassiveRequest(url, options)) {
    const body = new URLSearchParams(options.body);
    body.set('values', PROPERTIES);
    options = Object.assign({}, options, { body });
  }
  return fetch(url, options);
}

/**
 * A fetch that names the properties as namingTheProperties does and keeps
 * the body of each answer to the request for the passive level, so a test
 * can read the cloud's answer as well as the route's. The route reads its
 * own copy of the answer.
 *
 * @returns {{fetch: Function, bodies: string[]}} the fetch, and the bodies
 * it has kept
 */
function keepingAnswers () {
  const bodies = [];
  return {
    bodies,
    async fetch (url, options = {}) {
      const answer = await namingTheProperties(url, options);
      if (isPassiveRequest(url, options)) {
        bodies.push(await answer.clone().text());
      }
      return answer;
    }
  };
}

module.exports = {
  BESPOKE_KEY_NAME,
  stagingApi,
  noKeyMessage,
  visitor,
  fakeResponse,
  namingTheProperties,
  keepingAnswers
};
