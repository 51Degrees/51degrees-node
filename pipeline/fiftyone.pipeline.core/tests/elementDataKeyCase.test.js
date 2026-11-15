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

// access-to-results.md line 11: "String comparisons MUST be case
// insensitive." That covers the key Element Data is found by, as it does the
// names of Properties.

const core = require('fiftyone.pipeline.core');

const processed = async () => {
  const element = new core.FlowElement({
    dataKey: 'device',
    properties: { ismobile: { type: 'bool' } },
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: { ismobile: true }
      }));
    }
  });
  const pipeline = new core.PipelineBuilder().add(element).build();
  const flowData = pipeline.createFlowData();
  await flowData.process();
  return flowData;
};

describe('Element Data key letter case', () => {
  test.each([['device'], ['Device'], ['DEVICE']])(
    'Element Data is found by the key %s', async (key) => {
      const flowData = await processed();
      expect(flowData.get(key).get('ismobile')).toBe(true);
      expect(flowData[key].IsMobile).toBe(true);
    });

  test('a key no element has is still refused', async () => {
    const flowData = await processed();
    expect(() => flowData.get('location')).toThrow();
  });
});
