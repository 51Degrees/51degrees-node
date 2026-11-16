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

// specifications 07e1fce, pipeline-specification/README.md lines 95 to 98:
// "Where both Cloud and On-Premise variants of an Engine are available, they
// MUST arrange that the Properties and values produced are compatible with
// each other so that the Engines can be substituted in the Pipeline without
// alteration to the consuming application."
//
// The same answers, given once by the on-premise engine's Element Data and
// once by the cloud service, give equal values, so code that reads one
// reads the other. The cloud engine keeps rawweighting on each weighted
// value beside rawWeight (ipIntelligenceCloud.js lines 64 to 86), so the
// on-premise engine gives it too. No data file, key or network is used.

const path = require('path');

const core = require('fiftyone.pipeline.core');
const { CloudRequestEngine } = require('fiftyone.pipeline.cloudrequestengine');
const IpIntelligenceCloud = require('fiftyone.ipintelligence.cloud/ipIntelligenceCloud');
const SwigData = require(path.resolve(__dirname, '..', 'swigData'));

// The raw weighting that stands for a weight of 1.
const RAW_WEIGHTING_MAX = 65535;

// The answers, as [value, raw weighting] pairs for weighted Properties and
// as text for the one that is not.
const ANSWERS = {
  registeredname: [['First', 32768], ['Second', 32767]],
  areas: [['POLYGON((1 2,3 4,1 2))', 65535]],
  location: 'POINT(2 4)'
};

// A stand-in for a swig vector of weighted values.
const vectorOf = (pairs) => ({
  size: () => pairs.length,
  get: (i) => ({
    getValue: () => pairs[i][0],
    getWeight: () => pairs[i][1] / RAW_WEIGHTING_MAX,
    getShortRawWeight: () => pairs[i][1]
  })
});

const found = (value) => ({
  hasValue: () => true,
  getValue: () => value
});

// The values the on-premise engine's Element Data gives for the answers.
const onPremise = () => {
  const data = new SwigData({
    flowElement: {
      dataKey: 'ip',
      properties: {
        registeredname: { name: 'RegisteredName', type: 'weightedstring' },
        areas: { name: 'Areas', type: 'weightedwkb' },
        location: { name: 'Location', type: 'wkb' }
      }
    },
    swigResults: {
      getValuesAsWeightedStringList: () =>
        found(vectorOf(ANSWERS.registeredname)),
      getValuesAsWeightedWKTStringList: () => found(vectorOf(ANSWERS.areas)),
      getValueAsString: () => found(ANSWERS.location)
    }
  });
  const values = {};
  for (const name of Object.keys(ANSWERS)) {
    values[name] = data.getInternal(name).value;
  }
  return values;
};

// A request client that answers as the cloud service does, writing each
// WKT value as an object with one member, value.
class StubClient {
  get (url) {
    if (url.includes('evidencekeys')) {
      return Promise.resolve(JSON.stringify(['query.client-ip']));
    }
    const Properties = Object.keys(ANSWERS)
      .map((Name) => ({ Name, Type: 'String', Category: 'Test' }));
    return Promise.resolve(JSON.stringify({
      Products: { ip: { DataTier: 'Test', Properties } }
    }));
  }

  post () {
    const weighted = (pairs, wkt) => pairs.map(([value, rawweighting]) =>
      ({ rawweighting, value: wkt ? { value } : value }));
    return Promise.resolve(JSON.stringify({
      ip: {
        registeredname: weighted(ANSWERS.registeredname, false),
        areas: weighted(ANSWERS.areas, true),
        location: { value: ANSWERS.location }
      }
    }));
  }
}

// The values the cloud engine gives for the answers.
const cloud = async () => {
  const pipeline = new core.PipelineBuilder()
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new StubClient()
    }))
    .add(new IpIntelligenceCloud())
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.client-ip', '8.8.8.8');
  await flowData.process();
  const values = {};
  for (const name of Object.keys(ANSWERS)) {
    values[name] = flowData.ip[name].value;
  }
  return values;
};

describe('IP Intelligence on-premise and cloud values', () => {
  test('are equal for the same answers', async () => {
    expect(onPremise()).toEqual(await cloud());
  });

  test('a weighted value has value, weight, rawWeight and rawweighting',
    () => {
      expect(onPremise().registeredname).toEqual([
        {
          value: 'First',
          weight: 32768 / RAW_WEIGHTING_MAX,
          rawWeight: 32768,
          rawweighting: 32768
        },
        {
          value: 'Second',
          weight: 32767 / RAW_WEIGHTING_MAX,
          rawWeight: 32767,
          rawweighting: 32767
        }
      ]);
    });

  test('a WKT value is its WKT text', () => {
    const values = onPremise();
    expect(values.location).toBe('POINT(2 4)');
    expect(values.areas[0].value).toBe('POLYGON((1 2,3 4,1 2))');
  });
});
