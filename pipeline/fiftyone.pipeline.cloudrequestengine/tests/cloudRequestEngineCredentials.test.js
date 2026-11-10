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

// The combinations of resource key, license key and requested properties
// in the Credentials section of the cloud request engine specification,
// and where each credential travels in the requests the engine makes.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const errorMessages = require('../errorMessages');
const sharedValues = require('../sharedValues');

const resourceKey = 'AAAAAAAAAAAA';
const licenseKey = 'LICENSEKEY1234567890';
const requested = ['device.ismobile', 'device.istablet'];

// Records every request and answers each endpoint with canned data.
class RecordingClient {
  constructor () {
    this.requests = [];
  }

  answer (url) {
    const lower = url.toLowerCase();
    if (lower.includes('accessibleproperties')) {
      return JSON.stringify({
        Products: {
          device: {
            Properties: [{ Name: 'IsMobile', Type: 'Boolean' }]
          }
        }
      });
    }
    if (lower.includes('evidencekeys')) {
      return JSON.stringify(['query.User-Agent']);
    }
    return JSON.stringify({ device: { ismobile: true } });
  }

  get (url, origin) {
    this.requests.push({ method: 'GET', url, data: null });
    return Promise.resolve(this.answer(url));
  }

  post (url, data, origin) {
    this.requests.push({ method: 'POST', url, data });
    return Promise.resolve(this.answer(url));
  }
}

const process = async (options) => {
  const client = new RecordingClient();
  const engine = new CloudRequestEngine(
    Object.assign({ requestClient: client }, options));
  const pipeline = new PipelineBuilder().add(engine).build();
  await engine.ready();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.User-Agent', 'iPhone');
  await flowData.process();
  return client.requests;
};

const dataRequest = (requests) => requests[requests.length - 1];

const propertiesRequest = (requests) => requests.find(
  (request) => request.url.toLowerCase().includes('accessibleproperties'));

describe('accepted combinations', () => {
  test('resource key alone', async () => {
    const requests = await process({ resourceKey });

    const request = dataRequest(requests);
    expect(request.method).toBe('POST');
    expect(request.url).toBe(sharedValues.baseURLDefault + resourceKey + '.json');
    expect(request.data.resource).toBe(resourceKey);
    expect(request.data).not.toHaveProperty('license');
    expect(request.data).not.toHaveProperty('values');
    expect(request.data['User-Agent']).toBe('iPhone');

    const properties = propertiesRequest(requests);
    expect(properties.method).toBe('GET');
    expect(properties.url).toBe(
      sharedValues.baseURLDefault + 'accessibleproperties?resource=' +
      resourceKey);
  });

  test('resource key with a license key sends both in the body', async () => {
    const requests = await process({ resourceKey, licenseKey });

    const properties = propertiesRequest(requests);
    expect(properties.method).toBe('POST');
    expect(properties.data.resource).toBe(resourceKey);
    expect(properties.data.license).toBe(licenseKey);

    const request = dataRequest(requests);
    expect(request.url).toBe(sharedValues.baseURLDefault + resourceKey + '.json');
    expect(request.data.resource).toBe(resourceKey);
    expect(request.data.license).toBe(licenseKey);
    expect(request.data).not.toHaveProperty('values');
  });

  test('license key with properties sends license and values only', async () => {
    const requests = await process({
      licenseKey, requestedProperties: requested
    });

    const request = dataRequest(requests);
    expect(request.method).toBe('POST');
    expect(request.url).toBe(sharedValues.baseURLDefault + 'json');
    expect(request.data).not.toHaveProperty('resource');
    expect(request.data.license).toBe(licenseKey);
    expect(request.data.values).toBe('device.ismobile,device.istablet');
    expect(request.data['User-Agent']).toBe('iPhone');
  });

  test('license key alone discovers properties and evidence keys', async () => {
    const requests = await process({
      licenseKey, requestedProperties: requested
    });

    const properties = propertiesRequest(requests);
    expect(properties.method).toBe('POST');
    expect(properties.url).toBe(
      sharedValues.baseURLDefault + 'accessibleproperties');
    expect(properties.data).toEqual({ license: licenseKey });

    expect(requests.some(
      (request) => request.url.toLowerCase().includes('evidencekeys')))
      .toBe(true);
  });

  test('a license key never appears in a URL', async () => {
    for (const options of [
      { resourceKey, licenseKey },
      { licenseKey, requestedProperties: requested }
    ]) {
      const requests = await process(options);
      for (const request of requests) {
        expect(request.url).not.toContain(licenseKey);
      }
    }
  });

  test('requested properties may be one comma separated string', () => {
    const engine = new CloudRequestEngine({
      licenseKey, requestedProperties: ' Device.IsMobile , device.IsTablet,'
    });

    expect(engine.requestedProperties).toEqual(requested);
  });

  test('surrounding whitespace on a key is trimmed', () => {
    const engine = new CloudRequestEngine({
      resourceKey: ' ' + resourceKey + '\n',
      licenseKey: '   ',
      requestedProperties: [' ', '']
    });

    expect(engine.resourceKey).toBe(resourceKey);
    expect(engine.licenseKey).toBe('');
    expect(engine.requestedProperties).toEqual([]);
  });
});

describe('refused combinations', () => {
  test('license key without properties', () => {
    expect(() => new CloudRequestEngine({ licenseKey }))
      .toThrow(errorMessages.licenseKeyNeedsProperties);
    expect(() => new CloudRequestEngine({
      licenseKey, requestedProperties: []
    })).toThrow(errorMessages.licenseKeyNeedsProperties);
    expect(errorMessages.licenseKeyNeedsProperties).toContain('400');
  });

  test('properties with a resource key, with or without a license key', () => {
    for (const key of [undefined, licenseKey]) {
      expect(() => new CloudRequestEngine({
        resourceKey, licenseKey: key, requestedProperties: requested
      })).toThrow(errorMessages.propertiesIgnoredWithResourceKey);
    }
    expect(errorMessages.propertiesIgnoredWithResourceKey)
      .toContain('ignores the list');
  });

  test('no credential, with or without properties', () => {
    for (const properties of [undefined, requested]) {
      expect(() => new CloudRequestEngine({
        requestedProperties: properties
      })).toThrow(errorMessages.noCredential);
    }
    expect(errorMessages.noCredential).toContain('401');
  });

  test('a license key of only whitespace counts as absent', () => {
    expect(() => new CloudRequestEngine({
      licenseKey: '\t', requestedProperties: requested
    })).toThrow(errorMessages.noCredential);
  });
});
