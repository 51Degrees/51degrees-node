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

// Element Data held by a cache is shared with other requests, so it never
// goes back to a pool when a Flow Data that holds it is disposed.

const core = require('fiftyone.pipeline.core');
const { Engine, LruCache } = require('fiftyone.pipeline.engines');

test('Element Data held by a cache never goes back to its pool', async () => {
  let made = 0;
  const engine = new Engine({
    dataKey: 'cached',
    cache: new LruCache({ size: 10 }),
    processInternal: function (flowData) {
      const data = this.pooledElementData(() => {
        made += 1;
        return new core.ElementDataDictionary({
          flowElement: this, contents: {}
        });
      });
      data.contents = { value: flowData.evidence.get('query.value') };
      flowData.setElementData(data);
    }
  });
  engine.evidenceKeyFilter = new core.BasicListEvidenceKeyFilter(
    ['query.value']);
  const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
    .add(engine)
    .build();
  const run = async (value) => {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.value', value);
    await flowData.process();
    const read = flowData.get('cached').get('value');
    flowData.dispose();
    return read;
  };
  expect(await run('a')).toBe('a');
  expect(await run('b')).toBe('b');
  // Served from the cache after its Flow Data was disposed, so its values
  // are still there.
  expect(await run('a')).toBe('a');
  expect(await run('b')).toBe('b');
  expect(made).toBe(2);
  expect(engine.elementDataPool.size).toBe(0);
});
