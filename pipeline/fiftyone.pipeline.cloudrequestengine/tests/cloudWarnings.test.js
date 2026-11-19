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

// cloud-request-engine.md line 461: "Similarly to the `errors` array, any
// entries in the `warnings` array in the response MUST be logged as
// warnings." That holds for the discovery requests made at start-up as for
// the requests made while processing.

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const LICENSE_KEY = 'LICENSEKEY1234567890';

const properties = {
  Products: {
    device: {
      DataTier: 'CloudV4Free',
      Properties: [
        { Name: 'IsMobile', Type: 'Boolean', Category: 'Device' }
      ]
    }
  }
};

const json = { device: { ismobile: false }, javascriptProperties: [] };

// Answers the discovery POST a license key alone makes, as well as the
// requests the mock client already answers.
class LicenseKeyClient extends MockRequestClient {
  post (url, data, origin) {
    if (url.toLowerCase().includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify(this.properties));
    }
    return super.post(url, data, origin);
  }
}

/**
 * Processes one request through a pipeline holding only the request engine
 * and returns the warnings and errors it logged.
 *
 * @param {object} engineOptions the request engine's options
 * @returns {Promise<{warnings: string[], errors: string[]}>} what was logged
 */
const logged = async (engineOptions) => {
  const pipeline = new PipelineBuilder()
    .add(new CloudRequestEngine(engineOptions))
    .build();
  const warnings = [];
  const errors = [];
  pipeline.on('warn', (message) => warnings.push(String(message)));
  pipeline.on('error', (message) => errors.push(String(message)));
  await pipeline.createFlowData().process();
  return { warnings, errors };
};

describe('cloud warnings', () => {
  test('each warning in a response to a request is logged as a warning',
    async () => {
      const { warnings, errors } = await logged({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: new MockRequestClient({
          properties,
          json: Object.assign({ warnings: ['First.', 'Second.'] }, json)
        })
      });
      expect(warnings).toEqual(expect.arrayContaining(['First.', 'Second.']));
      expect(errors).toEqual([]);
    });

  test('each warning in the discovery response is logged as a warning',
    async () => {
      const { warnings, errors } = await logged({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: new MockRequestClient({
          properties: Object.assign({ warnings: ['At discovery.'] },
            properties),
          json
        })
      });
      expect(warnings).toEqual(expect.arrayContaining(['At discovery.']));
      expect(errors).toEqual([]);
    });

  test('a license key a warning names is masked', async () => {
    const { warnings } = await logged({
      licenseKey: LICENSE_KEY,
      requestedProperties: ['device.ismobile'],
      requestClient: new LicenseKeyClient({
        properties,
        json: Object.assign(
          { warnings: ['The key ' + LICENSE_KEY + ' expires soon.'] }, json)
      })
    });
    const warning = warnings.find((text) => text.startsWith('The key '));
    expect(warning).toBeDefined();
    expect(warning).not.toContain(LICENSE_KEY);
  });

  test('a response with no warnings logs none', async () => {
    const { warnings } = await logged({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new MockRequestClient({ properties, json })
    });
    expect(warnings).toEqual([]);
  });
});
