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

const util = require('util');
const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const errorMessages = require('../errorMessages');
const sharedValues = require('../sharedValues');

const resourceKey = 'AAAAAAAAAAAA';
const licenseKey = 'LICENSEKEY1234567890';
const requested = ['device.ismobile', 'device.istablet'];
const base = sharedValues.baseURLDefault;

// The cloud service refuses a license key with an error that names it.
const refusal = 'Invalid license key(s) supplied: \'' + licenseKey + '\'';
const maskedLicenseKey = '****************7890';

// Records every request and answers each endpoint with canned data, the
// data request with dataAnswer where one is given. A request whose URL
// contains a key of failures is answered with that status instead.
class RecordingClient {
  constructor (failures, dataAnswer) {
    this.requests = [];
    this.failures = failures || {};
    this.dataAnswer = dataAnswer ||
      JSON.stringify({ device: { ismobile: true } });
  }

  answer (method, url, data) {
    this.requests.push({ method, url, data });
    const lower = url.toLowerCase();
    for (const [part, statusCode] of Object.entries(this.failures)) {
      if (lower.includes(part)) {
        return Promise.reject({ // eslint-disable-line
          statusCode,
          headers: {},
          content: JSON.stringify({ errors: [refusal] })
        });
      }
    }
    if (lower.includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify({
        Products: {
          device: {
            Properties: [{ Name: 'IsMobile', Type: 'Boolean' }]
          }
        }
      }));
    }
    if (lower.includes('evidencekeys')) {
      return Promise.resolve(JSON.stringify(['query.User-Agent']));
    }
    return Promise.resolve(this.dataAnswer);
  }

  get (url, origin) {
    return this.answer('GET', url, null);
  }

  post (url, data, origin) {
    return this.answer('POST', url, data);
  }
}

// Builds the engine in a pipeline, fetches the accessible properties and
// evidence keys as a cloud aspect engine added after it would, then
// processes one request. Everything logged, thrown or requested is given
// back.
const run = async (options, failures) => {
  const client = new RecordingClient(failures);
  const engine = new CloudRequestEngine(
    Object.assign({ requestClient: client }, options));
  // No JavaScript elements, so each request body holds only the credentials
  // and the evidence the test gives. The JSON Builder fails without the
  // Sequence Element, so the two are left out together.
  const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
    .add(engine).build();
  const logged = [];
  pipeline.on('error', (message) => logged.push(message));
  pipeline.on('warn', (message) => logged.push(message));
  const thrown = [];
  await engine.ready().catch((e) => thrown.push(e));
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.User-Agent', 'iPhone');
  await flowData.process().catch((e) => thrown.push(e));
  return { requests: client.requests, logged, thrown, flowData };
};

const dataRequest = (requests) => requests[requests.length - 1];

const propertiesRequest = (requests) => requests.find(
  (request) => request.url.toLowerCase().includes('accessibleproperties'));

describe('accepted combinations', () => {
  test('resource key alone keeps its route and names the key in the body',
    async () => {
      const { requests } = await run({ resourceKey });

      const request = dataRequest(requests);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(base + resourceKey + '.json');
      expect(request.data).toEqual(
        { 'User-Agent': 'iPhone', resource: resourceKey });

      const properties = propertiesRequest(requests);
      expect(properties.method).toBe('GET');
      expect(properties.url).toBe(
        base + 'accessibleproperties?resource=' + resourceKey);
    });

  test('resource key with a license key sends the license key in the body',
    async () => {
      const { requests } = await run({ resourceKey, licenseKey });

      const properties = propertiesRequest(requests);
      expect(properties.method).toBe('POST');
      expect(properties.url).toBe(base + 'accessibleproperties');
      expect(properties.data).toEqual(
        { resource: resourceKey, license: licenseKey });

      const request = dataRequest(requests);
      expect(request.url).toBe(base + resourceKey + '.json');
      expect(request.data).toEqual(
        { 'User-Agent': 'iPhone', resource: resourceKey, license: licenseKey });
    });

  test('resource key, license key and properties sends all three',
    async () => {
      const { requests } = await run({
        resourceKey, licenseKey, requestedProperties: requested
      });

      const request = dataRequest(requests);
      expect(request.url).toBe(base + resourceKey + '.json');
      expect(request.data).toEqual({
        'User-Agent': 'iPhone',
        resource: resourceKey,
        license: licenseKey,
        values: 'device.ismobile,device.istablet'
      });
    });

  test('resource key with properties and no license key sends the list',
    async () => {
      const { requests, thrown } = await run({
        resourceKey, requestedProperties: requested
      });

      expect(thrown).toEqual([]);
      const request = dataRequest(requests);
      expect(request.url).toBe(base + resourceKey + '.json');
      expect(request.data).toEqual({
        'User-Agent': 'iPhone',
        resource: resourceKey,
        values: 'device.ismobile,device.istablet'
      });

      const properties = propertiesRequest(requests);
      expect(properties.method).toBe('GET');
      expect(properties.url).toBe(
        base + 'accessibleproperties?resource=' + resourceKey);
    });

  test('license key with properties sends license and values only',
    async () => {
      const { requests, thrown } = await run({
        licenseKey, requestedProperties: requested
      });

      expect(thrown).toEqual([]);
      const request = dataRequest(requests);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(base + 'json');
      expect(request.data).toEqual({
        'User-Agent': 'iPhone',
        license: licenseKey,
        values: 'device.ismobile,device.istablet'
      });
    });

  test('license key alone discovers properties and evidence keys',
    async () => {
      const { requests, thrown, flowData } = await run({
        licenseKey, requestedProperties: requested
      });

      expect(thrown).toEqual([]);
      const properties = propertiesRequest(requests);
      expect(properties.method).toBe('POST');
      expect(properties.url).toBe(base + 'accessibleproperties');
      expect(properties.data).toEqual({ license: licenseKey });

      const engine = flowData.pipeline.flowElements.cloud;
      expect(engine.flowElementProperties.device).toHaveProperty('ismobile');
      expect(requests.some((request) =>
        request.method === 'GET' && request.url === base + 'evidencekeys'))
        .toBe(true);
      expect(engine.evidenceKeyFilter.list).toEqual(['query.User-Agent']);
    });

  test('a list may be one comma separated string', () => {
    const engine = new CloudRequestEngine({
      licenseKey, requestedProperties: ' device.ismobile , device.istablet,'
    });

    expect(engine.requestedProperties).toEqual(requested);
  });

  // A blank key counts as absent, and any other key is sent as it is
  // given, as .NET and Java send it.
  test('a blank key is absent and any other key is kept as given', () => {
    const engine = new CloudRequestEngine({
      resourceKey: ' ' + resourceKey + '\n',
      licenseKey: '   ',
      requestedProperties: [' ', '']
    });

    expect(engine.resourceKey).toBe(' ' + resourceKey + '\n');
    expect(engine.licenseKey).toBe('');
    expect(engine.requestedProperties).toEqual([]);
  });
});

describe('refused combinations', () => {
  test('license key without properties', () => {
    for (const properties of [undefined, [], '', ' , ']) {
      expect(() => new CloudRequestEngine({
        licenseKey, requestedProperties: properties
      })).toThrow(errorMessages.licenseKeyNeedsProperties);
    }
    expect(errorMessages.licenseKeyNeedsProperties).toContain('400');
  });

  test('no credential, with or without properties', () => {
    for (const options of [
      {},
      { requestedProperties: requested },
      { resourceKey: ' ', licenseKey: '\t', requestedProperties: requested }
    ]) {
      expect(() => new CloudRequestEngine(options))
        .toThrow(errorMessages.noCredential);
    }
    expect(errorMessages.noCredential).toContain('401');
  });
});

describe('the license key stays out of URLs and logs', () => {
  const withLicenseKey = [
    { resourceKey, licenseKey },
    { resourceKey, licenseKey, requestedProperties: requested },
    { licenseKey, requestedProperties: requested }
  ];

  test('no request carries the license key in its URL', async () => {
    for (const options of withLicenseKey) {
      const { requests } = await run(options);
      expect(requests.length).toBeGreaterThan(2);
      for (const request of requests) {
        expect(request.url).not.toContain(licenseKey);
      }
    }
  });

  test('failed requests log and throw nothing holding the license key',
    async () => {
      for (const options of withLicenseKey) {
        // The discovery request, then the data request, which is named by
        // the resource key where there is one.
        const dataPath = options.resourceKey
          ? options.resourceKey.toLowerCase() + '.json'
          : 'v4/json';
        for (const failing of ['accessibleproperties', dataPath]) {
          const { logged, thrown } = await run(options, { [failing]: 403 });
          expect(logged.length + thrown.length).toBeGreaterThan(0);
          const text = util.inspect([logged, thrown], { depth: 10 });
          expect(text).toContain('Invalid license key(s) supplied: \'' +
            maskedLicenseKey + '\'');
          expect(text).not.toContain(licenseKey);
        }
      }
    });
});

describe('requested properties the answer leaves out', () => {
  test('are logged once, ignoring case, and a null counts as answered',
    async () => {
      const client = new RecordingClient({}, JSON.stringify({
        device: {
          ismobile: true,
          istablet: null,
          istabletnullreason: 'No value on this request'
        }
      }));
      const engine = new CloudRequestEngine({
        licenseKey,
        requestedProperties: [
          'Device.IsMobile', 'device.istablet', 'device.iscrawler'],
        requestClient: client
      });
      const pipeline = new PipelineBuilder().add(engine).build();
      const warnings = [];
      pipeline.on('warn', (message) => warnings.push(String(message)));
      await engine.ready();
      for (let i = 0; i < 2; i++) {
        const flowData = pipeline.createFlowData();
        flowData.evidence.add('query.User-Agent', 'iPhone');
        await flowData.process();
      }

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toBe(util.format(
        errorMessages.propertiesNotCovered, 'device.iscrawler'));
    });

  test('with a resource key and no license key, a name left out is not ' +
    'a Property', async () => {
    const client = new RecordingClient({}, JSON.stringify({
      device: {
        ismobile: true,
        hardwarevendor: null,
        hardwarevendornullreason: 'A paid feature that needs a license key'
      }
    }));
    const engine = new CloudRequestEngine({
      resourceKey,
      requestedProperties: [
        'device.ismobile', 'device.hardwarevendor', 'device.notaproperty'],
      requestClient: client
    });
    const pipeline = new PipelineBuilder().add(engine).build();
    const warnings = [];
    pipeline.on('warn', (message) => warnings.push(String(message)));
    await engine.ready();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.User-Agent', 'iPhone');
    await flowData.process();

    expect(warnings).toEqual([util.format(
      errorMessages.propertiesNotProperties, 'device.notaproperty')]);
  });

  test('nothing is logged when every property came back or none was named',
    async () => {
      for (const options of [
        { licenseKey, requestedProperties: ['device.IsMobile'] },
        { resourceKey }
      ]) {
        const { logged, thrown } = await run(options);
        expect(thrown).toEqual([]);
        expect(logged).toEqual([]);
      }
    });
});
