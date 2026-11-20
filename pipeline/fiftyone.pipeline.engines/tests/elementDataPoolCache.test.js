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

// A promise that settles only when the test says.
const deferred = () => {
  const d = {};
  d.promise = new Promise((resolve) => { d.resolve = resolve; });
  return d;
};

describe('Element Data with a lazy property and an Engine with a cache',
  () => {
    // Specification, resource-cleanup.md: "An instance goes back to its pool
    // only when the Flow Data that holds it is disposed and any lazy task
    // writing it has finished". An instance a cache holds is shared with
    // other requests, so it never goes back.
    test('goes to no pool, even before its lazy task has finished, and is ' +
      'cached once the task succeeds', async () => {
      let made = 0;
      // The lazy task of each request, by its evidence.
      const tasks = {};
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
          const value = flowData.evidence.get('query.value');
          data.contents = { value };
          data.addLazyProperty('answer', tasks[value].promise);
          flowData.setElementData(data);
        }
      });
      engine.evidenceKeyFilter = new core.BasicListEvidenceKeyFilter(
        ['query.value']);
      // A Flow Element after the Engine, reached once the Engine has
      // finished processing, while its lazy task may still be running.
      const reached = deferred();
      const after = new core.FlowElement({
        dataKey: 'after',
        processInternal: () => { reached.resolve(); }
      });
      const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
        .add(engine)
        .add(after)
        .build();
      const start = (value) => {
        const flowData = pipeline.createFlowData();
        flowData.evidence.add('query.value', value);
        // Held as a value, so a failure is seen by the expects below.
        const done = flowData.process().then(() => undefined, (e) => e);
        return { flowData, done };
      };
      const settled = (value) => {
        tasks[value] = deferred();
        tasks[value].resolve(value + ' answer');
      };

      // The first request's lazy task has not finished when the Engine has
      // processed, and its Flow Data is disposed then.
      tasks.a = deferred();
      const a = start('a');
      await reached.promise;
      const data = a.flowData.get('cached');
      expect(data.hasPendingLazyProperties()).toBe(true);
      a.flowData.dispose();
      // The Engine has already marked the instance as shared, so giving it
      // back as dispose does puts it in no pool, though its task is running.
      core.ElementDataPool.release(data);
      expect(engine.elementDataPool.size).toBe(0);

      // The next request is given another instance.
      settled('b');
      const b = start('b');
      expect(await b.done).toBeUndefined();
      expect(b.flowData.get('cached')).not.toBe(data);
      expect(made).toBe(2);
      b.flowData.dispose();

      // The task succeeds, so processing finishes and the disposed Flow
      // Data gives its instances back, but the cached instance goes to no
      // pool.
      tasks.a.resolve('a answer');
      expect(await a.done).toBeUndefined();
      expect(engine.elementDataPool.size).toBe(0);
      settled('c');
      const c = start('c');
      expect(await c.done).toBeUndefined();
      expect(c.flowData.get('cached')).not.toBe(data);
      expect(made).toBe(3);
      c.flowData.dispose();

      // The cache holds it, with the task's value.
      const again = start('a');
      expect(await again.done).toBeUndefined();
      expect(again.flowData.get('cached')).toBe(data);
      expect(data.get('answer')).toBe('a answer');
      expect(made).toBe(3);
      again.flowData.dispose();
      expect(engine.elementDataPool.size).toBe(0);
    });
  });
