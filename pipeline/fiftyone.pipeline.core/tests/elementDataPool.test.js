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

// Element Data is reused through an object pool. An instance goes back to
// its pool only when the Flow Data that holds it is disposed and its
// processing has finished, and one taken from a pool starts with no values
// and open for writing. These tests count the instances made.

const core = require('fiftyone.pipeline.core');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Element Data that counts the instances made.
let made = 0;
class CountedData extends core.ElementDataDictionary {
  constructor (options) {
    super(options);
    made += 1;
  }
}

// A Flow Element that takes its Element Data from its pool, records the
// values the instance held when taken, then writes its own.
const pooled = (dataKey, wait, held) => new core.FlowElement({
  dataKey,
  evidenceKeyFilter: new core.BasicListEvidenceKeyFilter(['query.request']),
  processInternal: function (flowData) {
    const data = this.pooledElementData(
      () => new CountedData({ flowElement: this, contents: {} }));
    if (held) {
      held.push(Object.keys(data.contents));
    }
    flowData.setElementData(data);
    return pause(wait).then(() => {
      data.contents = {
        name: dataKey,
        request: flowData.evidence.get(
          'query.request')
      };
    });
  }
});

// A Pipeline with the elements the builder adds, being the sequence, JSON
// and JavaScript builder elements, and pooled elements alone and in a
// parallel group.
const build = (held) => new core.PipelineBuilder()
  .add(pooled('alone', 0, held))
  .addParallel([pooled('slow', 5), pooled('fast', 0)])
  .build();

// Processes one request and checks the values of each pooled Flow Element
// are its own.
const request = async (pipeline, index,
  keys = ['alone', 'slow', 'fast']) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.request', String(index));
  await flowData.process();
  for (const key of keys) {
    expect(flowData.get(key).get('request')).toBe(String(index));
  }
  return flowData;
};

beforeEach(() => {
  made = 0;
});

describe('Element Data pools', () => {
  test('make one instance for each Flow Element over many requests when ' +
    'each Flow Data is disposed', async () => {
    const held = [];
    const pipeline = build(held);
    for (let i = 0; i < 100; i++) {
      (await request(pipeline, i)).dispose();
    }
    expect(made).toBe(3);
    // Every Flow Element of the Pipeline that pools, including those the
    // builder adds, made one instance.
    const pools = Object.values(pipeline.flowElements)
      .filter((element) => element.elementDataPool !== undefined);
    expect(pools.map((element) => element.dataKey).sort()).toEqual(
      ['alone', 'fast', 'javascriptbuilder', 'jsonbundler', 'sequence',
        'set-headers', 'slow'].sort());
    for (const element of pools) {
      expect(element.elementDataPool.created).toBe(1);
    }
    // An instance taken from a pool held no values.
    expect(held.every((keys) => keys.length === 0)).toBe(true);
  });

  test('take no instance from a Flow Data that is not disposed',
    async () => {
      const pipeline = build();
      const kept = [];
      for (let i = 0; i < 10; i++) {
        kept.push(await request(pipeline, i));
      }
      expect(made).toBe(30);
      kept.forEach((flowData, i) => {
        expect(flowData.get('slow').get('request')).toBe(String(i));
      });
    });

  test('take back an instance from a Flow Data disposed while it ' +
    'processes only once its processing has finished', async () => {
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(pooled('slow', 20))
      .build();
    const first = pipeline.createFlowData();
    first.evidence.add('query.request', 'first');
    // Held as a value, so a failure is seen by the expect below.
    const firstDone = first.process().then(() => undefined, (e) => e);
    first.dispose();
    const second = await request(pipeline, 2, ['slow']);
    expect(await firstDone).toBeUndefined();
    // The first instance was still being written, so the second request
    // made its own.
    expect(made).toBe(2);
    second.dispose();
    (await request(pipeline, 3, ['slow'])).dispose();
    (await request(pipeline, 4, ['slow'])).dispose();
    expect(made).toBe(2);
  });

  test('keep no more instances than their size', () => {
    const element = pooled('bounded', 0);
    const pool = new core.ElementDataPool({ size: 2 });
    const create = () => new CountedData({
      flowElement: element,
      contents: {}
    });
    const taken = [pool.take(create), pool.take(create), pool.take(create)];
    taken.forEach((data) => pool.give(data));
    expect(pool.size).toBe(2);
    expect(made).toBe(3);
    pool.take(create);
    pool.take(create);
    pool.take(create);
    expect(made).toBe(4);
  });

  test('give an instance taken from a pool no values and open it for ' +
    'writing', async () => {
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(pooled('one', 0))
      .build();
    const flowData = await request(pipeline, 1, ['one']);
    const data = flowData.get('one');
    // A finished instance refuses a write.
    expect(() => { data.contents = {}; }).toThrow();
    flowData.dispose();
    const again = pipeline.flowElements.one.elementDataPool.take(
      () => new CountedData({
        flowElement: pipeline.flowElements.one,
        contents: {}
      }));
    expect(again).toBe(data);
    expect(Object.keys(again.contents)).toEqual([]);
    again.contents = { name: 'written' };
    expect(again.get('name')).toBe('written');
  });
});
