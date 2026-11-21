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

// An aspect dictionary taken from a pool starts with no values and open for
// writing, as all Element Data taken from a pool does.

const core = require('fiftyone.pipeline.core');
const { Engine, AspectDataDictionary } = require('fiftyone.pipeline.engines');

test('an aspect dictionary taken from a pool has no values and is open ' +
  'for writing', async () => {
  // Writes one value, named by the request, into the contents it is given.
  const engine = new Engine({
    dataKey: 'aspect',
    processInternal: function (flowData) {
      const data = this.pooledElementData(() => new AspectDataDictionary({
        flowElement: this, contents: {}
      }));
      data.contents[flowData.evidence.get('query.name')] = 'set';
      flowData.setElementData(data);
    }
  });
  engine.evidenceKeyFilter = new core.BasicListEvidenceKeyFilter(
    ['query.name']);
  const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
    .add(engine)
    .build();
  const run = async (name) => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.name', name);
    await flowData.process();
    const data = flowData.get('aspect');
    const keys = Object.keys(data.contents);
    flowData.dispose();
    return { data, keys };
  };
  const first = await run('first');
  const second = await run('second');
  expect(second.data).toBe(first.data);
  expect(engine.elementDataPool.created).toBe(1);
  expect(first.keys).toEqual(['first']);
  expect(second.keys).toEqual(['second']);
});
