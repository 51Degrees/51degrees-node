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

// The cloud engine's Element Data is Aspect Data, as
// device-detection-specification/data-model.md line 10 asks, and gives a
// Property by name as an AspectPropertyValue, as the on-premise engine's
// does (cloud-aspect-engine.md line 24).

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const { AspectPropertyValue, PipelineBuilder } =
  require51('fiftyone.pipeline.core');
const { AspectData } = require51('fiftyone.pipeline.engines');
const { CloudRequestEngine } = require51('fiftyone.pipeline.cloudrequestengine');
const Engine = require51('fiftyone.devicedetection.cloud').DeviceDetectionCloud;

const DATA_KEY = 'device';
const EVIDENCE_KEY = 'header.user-agent';
const EVIDENCE_VALUE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const TYPE = 'Boolean';

// A request client that answers as the cloud service does, with the JSON
// given for the results and a Property of each of its names, so no key or
// network is used.
class StubClient {
  constructor (json) {
    this.json = json;
  }

  get (url) {
    if (url.includes('evidencekeys')) {
      return Promise.resolve(JSON.stringify([EVIDENCE_KEY]));
    }
    const Products = {};
    for (const [product, values] of Object.entries(this.json)) {
      Products[product] = {
        DataTier: 'Test',
        Properties: Object.keys(values)
          .map((Name) => ({ Name, Type: TYPE, Category: 'Test' }))
      };
    }
    return Promise.resolve(JSON.stringify({ Products }));
  }

  post () {
    return Promise.resolve(JSON.stringify(this.json));
  }
}

// The Element Data the cloud engine gives for the answer given. It is
// returned wrapped, because awaiting Element Data would read a 'then'
// Property from it.
const elementData = async (json) => {
  const pipeline = new PipelineBuilder()
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new StubClient(json)
    }))
    .add(new Engine())
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add(EVIDENCE_KEY, EVIDENCE_VALUE);
  await flowData.process();
  return { data: flowData.get(DATA_KEY) };
};

test('the cloud Element Data is Aspect Data of AspectPropertyValues',
  async () => {
    const { data } = await elementData({ device: { ismobile: true } });
    expect(data).toBeInstanceOf(AspectData);
    const isMobile = data.get('ismobile');
    expect(isMobile).toBeInstanceOf(AspectPropertyValue);
    expect(isMobile.hasValue).toBe(true);
    expect(isMobile.value).toBe(true);
  });
