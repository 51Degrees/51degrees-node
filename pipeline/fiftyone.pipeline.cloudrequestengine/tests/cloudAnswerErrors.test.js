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

// cloud-request-engine.md lines 446 to 458: an answer whose errors array has
// an entry raises an error with that entry's text, an empty answer raises
// "No data in response from cloud service at '[url]'", and an answer whose
// status shows a failure with neither raises "Cloud service at '[url]'
// returned status code '[code]' with content [raw response]".

const path = require('path');
const util = require('util');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const RESOURCE_KEY = 'AAAAAAAAAAAA';
const BASE_URL = 'https://cloud.example/api/v4/';
const DATA_URL = BASE_URL + RESOURCE_KEY + '.json';
const LICENSE_KEY = 'LICENSEKEY1234567890';

// A client that answers discovery as the mock does, and the processing
// request with the body given, or fails it with the response given.
class AnsweringClient extends MockRequestClient {
  constructor (answer) {
    super();
    this.answer = answer;
  }

  post (url, data, origin) {
    if (url.toLowerCase().includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify(this.properties));
    }
    return this.answer.failure !== undefined
      ? Promise.reject(this.answer.failure)
      : Promise.resolve(this.answer.body);
  }
}

// Everything shown of a value, its hidden parts included.
const shown = (value) => util.inspect(value, { depth: null }) + '\n' +
  String(value);

// Processes one request whose answer is the one given, and gives what the
// processing recorded and whether it was rejected.
const answerWith = async (answer, licenseKey) => {
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(new CloudRequestEngine({
    resourceKey: RESOURCE_KEY,
    licenseKey,
    baseURL: BASE_URL,
    requestClient: new AnsweringClient(answer)
  })).build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent');
  const rejected = await flowData.process().then(() => false, () => true);
  return { rejected, errors: flowData.errors.cloud };
};

describe('a cloud answer that the request engine refuses', () => {
  test('one with entries in its errors array raises each entry', async () => {
    const { rejected, errors } = await answerWith({
      body: JSON.stringify({ errors: ['First error.', 'Second error.'] })
    });

    expect(rejected).toBe(true);
    expect(shown(errors)).toContain('First error.');
    expect(shown(errors)).toContain('Second error.');
  });

  test('one with errors and data is refused all the same', async () => {
    const { rejected, errors } = await answerWith({
      body: JSON.stringify({
        errors: ['Only error.'],
        device: { ismobile: false }
      })
    });

    expect(rejected).toBe(true);
    expect(shown(errors)).toContain('Only error.');
  });

  test('an empty one raises the no data message naming the URL',
    async () => {
      const { rejected, errors } = await answerWith({ body: '' });

      expect(rejected).toBe(true);
      expect(shown(errors)).toContain(
        `No data in response from cloud service at '${DATA_URL}'`);
    });

  test('a failed one with no content raises the no data message',
    async () => {
      const { rejected, errors } = await answerWith({
        failure: { statusCode: 503, headers: {}, content: '' }
      });

      expect(rejected).toBe(true);
      expect(shown(errors)).toContain(
        `No data in response from cloud service at '${DATA_URL}'`);
    });

  test('a failed one with no errors raises the status code message',
    async () => {
      const { rejected, errors } = await answerWith({
        failure: {
          statusCode: 503,
          headers: {},
          content: '{"message":"Service Unavailable"}'
        }
      });

      expect(rejected).toBe(true);
      expect(shown(errors)).toContain(
        `Cloud service at '${DATA_URL}' returned status code '503' with ` +
        'content {"message":"Service Unavailable"}');
    });

  test('a failed one that is not JSON raises the status code message',
    async () => {
      const { rejected, errors } = await answerWith({
        failure: {
          statusCode: 502,
          headers: {},
          content: '<html>Bad gateway</html>'
        }
      });

      expect(rejected).toBe(true);
      expect(shown(errors)).toContain(
        `Cloud service at '${DATA_URL}' returned status code '502' with ` +
        'content <html>Bad gateway</html>');
    });

  test('a request that got no answer keeps the reason it failed',
    async () => {
      const { rejected, errors } = await answerWith({
        failure: { content: 'getaddrinfo ENOTFOUND cloud.example' }
      });

      expect(rejected).toBe(true);
      expect(shown(errors)).toContain('getaddrinfo ENOTFOUND cloud.example');
    });

  test('an error naming the license key has the key left out whole',
    async () => {
      const { rejected, errors } = await answerWith({
        body: JSON.stringify({ errors: [`Key ${LICENSE_KEY} is not valid.`] })
      }, LICENSE_KEY);

      expect(rejected).toBe(true);
      expect(shown(errors)).not.toContain(LICENSE_KEY.slice(-4));
    });

  test('one with an empty errors array and data is used', async () => {
    const { rejected, errors } = await answerWith({
      body: JSON.stringify({
        errors: [],
        device: { ismobile: false },
        javascriptProperties: []
      })
    });

    expect(rejected).toBe(false);
    expect(errors).toBeUndefined();
  });
});
