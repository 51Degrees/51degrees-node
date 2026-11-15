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

// Property metadata comes from the cloud service's answer to discovery, never
// from the Requested Properties (cloud-request-engine.md line 284). Until
// discovery succeeds it is absent rather than an empty result kept for good
// (cloud-request-engine.md line 298 and cloud-aspect-engine.md line 48). A
// Cloud Aspect Engine accepts no Evidence (cloud-aspect-engine.md lines 16
// to 19).

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const CloudEngine = require('../cloudEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const RESOURCE_KEY = 'AAAAAAAAAAAA';
const BASE_URL = 'https://cloud.example/api/v4/';

// The metadata the mock's discovery answer gives the device product.
const ANSWERED = [
  'ismobile',
  'javascripthardwareprofile',
  'screenpixelsheight',
  'screenpixelswidth'
];

// A cloud service whose discovery fails until it is told to answer.
class RecoveringClient extends MockRequestClient {
  constructor () {
    super();
    this.down = true;
  }

  get (url, origin) {
    if (this.down) {
      return Promise.reject({ statusCode: 503, headers: {}, content: '' }); // eslint-disable-line
    }
    return super.get(url, origin);
  }
}

/**
 * A Pipeline of a Cloud Request Engine and a Cloud Aspect Engine for the
 * device product, which records errors rather than throwing them.
 *
 * @param {MockRequestClient} requestClient the stand-in cloud service
 * @param {Array<string>} requestedProperties the Requested Properties
 * @returns {object} the Pipeline and both engines
 */
const build = (requestClient, requestedProperties) => {
  const device = new CloudEngine();
  device.dataKey = 'device';
  const request = new CloudRequestEngine({
    resourceKey: RESOURCE_KEY,
    baseURL: BASE_URL,
    requestClient,
    requestedProperties
  });
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false,
    suppressProcessExceptions: true
  }).add(request).add(device).build();
  return { pipeline, request, device };
};

const processOne = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent');
  await flowData.process();
  return flowData;
};

test('Property metadata is the cloud service\'s, not the Requested Properties',
  async () => {
    const { pipeline, request, device } = build(
      new MockRequestClient(), ['IsMobile', 'NotAProperty']);

    await processOne(pipeline);

    expect(Object.keys(request.flowElementProperties.device).sort())
      .toEqual(ANSWERED);
    expect(request.flowElementProperties.device.ismobile.type)
      .toBe('Boolean');
    expect(Object.keys(device.properties).sort()).toEqual(ANSWERED);
  });

test('metadata is absent while discovery fails and arrives once it succeeds',
  async () => {
    const client = new RecoveringClient();
    const { pipeline, request, device } = build(client);

    const failed = await processOne(pipeline);

    expect(Object.keys(failed.errors).length).toBeGreaterThan(0);
    expect(request.flowElementProperties).toEqual({});
    expect(device.properties).toEqual({});
    expect(request.evidenceKeyFilter.filterEvidenceKey('header.anything'))
      .toBe(true);

    client.down = false;
    const done = await processOne(pipeline);

    expect(Object.keys(done.errors)).toEqual([]);
    expect(Object.keys(device.properties).sort()).toEqual(ANSWERED);
    expect(request.evidenceKeyFilter.filterEvidenceKey('header.anything'))
      .toBeFalsy();
    expect(request.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeTruthy();
  });

test('a Cloud Aspect Engine accepts no Evidence', async () => {
  const { pipeline, device } = build(new MockRequestClient());

  await processOne(pipeline);

  expect(device.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
    .toBeFalsy();
  expect(device.evidenceKeyFilter.filterEvidenceKey(
    'query.51D_ProfileIds')).toBeFalsy();
});
