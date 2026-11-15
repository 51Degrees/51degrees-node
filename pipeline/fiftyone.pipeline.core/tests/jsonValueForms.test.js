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

// The JSON Builder writes a WKT value as an object with one member, value,
// holding the WKT text (value-types.md lines 123 to 130), and a weighted
// value as a list of objects with the lower-case keys rawweighting and value
// (weighted-values.md lines 45 to 58).

const core = require('fiftyone.pipeline.core');

// The raw weighting that stands for a weight of 1.
const RAW_WEIGHTING_MAX = 65535;

// The JSON written for one element whose Property metadata and data are
// given, with the Sequence Element the JSON Builder needs.
const json = async (properties, contents) => {
  const element = new core.FlowElement({
    dataKey: 'test',
    properties,
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents
      }));
    }
  });
  const pipeline = new core.PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  })
    .add(new core.SequenceElement())
    .add(element)
    .add(new core.JsonBundler())
    .build();
  const flowData = pipeline.createFlowData();
  await flowData.process();
  expect(flowData.errors).toEqual({});
  return flowData.jsonbundler.json.test;
};

const withValue = (value) => new core.AspectPropertyValue(null, value);

// A weighted value as the on-premise engines give one.
const weighted = (value, rawWeight) =>
  ({ value, weight: rawWeight / RAW_WEIGHTING_MAX, rawWeight });

describe('JSON value forms', () => {
  test('a WKT value is an object with one member, value', async () => {
    const written = await json(
      { area: { type: 'wkb' }, place: { type: 'WKBR' } },
      {
        area: withValue('POLYGON((1 2,3 4,1 2))'),
        place: withValue('POINT(2 4)')
      });
    expect(written.area).toEqual({ value: 'POLYGON((1 2,3 4,1 2))' });
    expect(written.place).toEqual({ value: 'POINT(2 4)' });
  });

  test('a weighted value is a list of rawweighting and value', async () => {
    const written = await json(
      { names: { type: 'weightedstring' } },
      { names: withValue([weighted('First', 32768), weighted('Second', 32767)]) });
    expect(written.names).toEqual([
      { rawweighting: 32768, value: 'First' },
      { rawweighting: 32767, value: 'Second' }
    ]);
  });

  test('a weighted WKT value has each value as an object', async () => {
    const written = await json(
      { areas: { type: 'weightedwkb' } },
      { areas: withValue([weighted('POLYGON((1 2,3 4,1 2))', 65535)]) });
    expect(written.areas).toEqual([
      { rawweighting: 65535, value: { value: 'POLYGON((1 2,3 4,1 2))' } }
    ]);
  });

  test('a weighted value that keeps rawweighting is written the same way',
    async () => {
      const written = await json(
        { names: { type: 'WeightedString' } },
        {
          names: withValue([{
            value: 'First', weight: 1, rawWeight: 65535, rawweighting: 65535
          }])
        });
      expect(written.names).toEqual([{ rawweighting: 65535, value: 'First' }]);
    });

  test('a WKT value already in the object form is written as it is',
    async () => {
      const written = await json(
        { area: { type: 'wkb' } },
        { area: withValue({ value: 'POINT(2 4)' }) });
      expect(written.area).toEqual({ value: 'POINT(2 4)' });
    });

  test('other values are written as they are', async () => {
    const written = await json(
      { name: { type: 'string' }, list: { type: 'string[]' } },
      { name: withValue('a'), list: withValue(['x', 'y']) });
    expect(written.name).toBe('a');
    expect(written.list).toEqual(['x', 'y']);
  });
});
