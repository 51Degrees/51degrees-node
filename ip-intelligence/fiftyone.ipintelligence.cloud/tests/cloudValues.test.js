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

// The IP Intelligence cloud engine gives each value in the form the
// on-premise engine gives it. ip-intelligence-cloud.md line 60 asks for the
// weighted values the service sends to be parsed into the weighted value
// type, and value-types.md line 129 for a WKT value the service writes as
// {"value": ...} to be read. No key or network is used.

const core = require('fiftyone.pipeline.core');
const { CloudRequestEngine } = require('fiftyone.pipeline.cloudrequestengine');
const IpIntelligenceCloud = require('../ipIntelligenceCloud');

// A request client that answers as the cloud service does, with the JSON
// given for the results and a String property for each of its keys.
class StubClient {
  constructor (json) {
    this.json = json;
  }

  get (url) {
    if (url.includes('evidencekeys')) {
      return Promise.resolve(JSON.stringify(['query.client-ip']));
    }
    const Properties = Object.keys(this.json.ip)
      .filter((name) => name.endsWith('nullreason') === false)
      .map((Name) => ({ Name, Type: 'String', Category: 'Test' }));
    return Promise.resolve(JSON.stringify({
      Products: { ip: { DataTier: 'Test', Properties } }
    }));
  }

  post () {
    return Promise.resolve(JSON.stringify(this.json));
  }
}

const run = async (json) => {
  const pipeline = new core.PipelineBuilder()
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new StubClient(json)
    }))
    .add(new IpIntelligenceCloud())
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.client-ip', '8.8.8.8');
  await flowData.process();
  // Wrapped, because awaiting the Element Data itself would read a "then"
  // Property from it.
  return { ip: flowData.ip };
};

describe('IP Intelligence cloud values', () => {
  test('weighted values are given as value, weight and rawWeight',
    async () => {
      const { ip } = await run({
        ip: {
          mcc: [{ rawweighting: 65535, value: '310' }],
          registeredname: [
            { rawweighting: 32768, value: 'First' },
            { rawweighting: 32767, value: 'Second' }
          ]
        }
      });
      expect(ip.mcc.value)
        .toEqual([{ value: '310', weight: 1, rawWeight: 65535 }]);
      expect(ip.registeredname.value).toEqual([
        { value: 'First', weight: 32768 / 65535, rawWeight: 32768 },
        { value: 'Second', weight: 32767 / 65535, rawWeight: 32767 }
      ]);
    });

  test('a WKT value given as {"value": ...} is read as its text',
    async () => {
      const { ip } = await run({
        ip: {
          areas: [{
            rawweighting: 65535,
            value: { value: 'POLYGON((1 2,3 4,1 2))' }
          }],
          location: { value: 'POINT(2 4)' }
        }
      });
      expect(ip.areas.value).toEqual([{
        value: 'POLYGON((1 2,3 4,1 2))', weight: 1, rawWeight: 65535
      }]);
      expect(ip.location.value).toBe('POINT(2 4)');
    });

  test('other values, and a property with no value, are as the service ' +
    'gave them', async () => {
    const { ip } = await run({
      ip: {
        registeredcountry: 'US',
        accuracyradiusmin: 10,
        town: null,
        townnullreason: 'No town for this address.'
      }
    });
    expect(ip.registeredcountry.value).toBe('US');
    expect(ip.accuracyradiusmin.value).toBe(10);
    expect(ip.town.hasValue).toBe(false);
    expect(ip.town.noValueMessage).toBe('No town for this address.');
  });
});
