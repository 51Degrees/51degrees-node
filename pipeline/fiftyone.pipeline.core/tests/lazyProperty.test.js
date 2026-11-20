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

// A lazy property's value is worked out by one task, which the Flow Element
// starts while it processes. Every reader waits for that task, the work is
// never done twice, and a failed task gives every reader its error. A
// JavaScript read cannot wait, so the Pipeline waits for every task before
// processing finishes, and a read after that has the value.

const core = require('fiftyone.pipeline.core');

// A task that finishes only when the test says, counting how often it was
// started.
const deferred = () => {
  const d = { starts: 0 };
  d.task = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  // A failure the test causes is never left unhandled.
  d.task.catch(() => {});
  return d;
};

// A Flow Element whose Element Data has one lazy property, 'value', whose
// task is the one given.
const lazyElement = (work) => new core.FlowElement({
  dataKey: 'lazy',
  processInternal: function (flowData) {
    work.starts++;
    const data = new core.ElementDataDictionary({
      flowElement: this,
      contents: {}
    });
    data.addLazyProperty('value', work.task);
    flowData.setElementData(data);
  }
});

// A Flow Element after it that reads the lazy property twice while it
// processes, keeping what each read gave.
const readerElement = (reads) => new core.FlowElement({
  dataKey: 'reader',
  processInternal: function (flowData) {
    const data = flowData.get('lazy');
    return Promise.all([data.getAsync('value'), data.getAsync('VALUE')])
      .then((values) => { reads.values = values; },
        (error) => { reads.error = error; });
  }
});

describe('A lazy property', () => {
  test('is worked out once and every reader waits for it', async () => {
    const work = deferred();
    const reads = {};
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(lazyElement(work))
      .add(readerElement(reads))
      .build();
    const flowData = pipeline.createFlowData();
    const processing = flowData.process();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads.values).toBeUndefined();
    work.resolve('worked out');
    await processing;
    expect(work.starts).toBe(1);
    expect(reads.values).toEqual(['worked out', 'worked out']);
    expect(flowData.lazy.get('value')).toBe('worked out');
    expect(flowData.lazy.value).toBe('worked out');
  });

  test('has its value once processing has finished, with no reader',
    async () => {
      const work = deferred();
      const pipeline = new core.PipelineBuilder({
        addJavaScriptBuilder: false
      }).add(lazyElement(work)).build();
      const flowData = pipeline.createFlowData();
      let finished = false;
      const processing = flowData.process().then(() => { finished = true; });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(finished).toBe(false);
      work.resolve(42);
      await processing;
      expect(flowData.get('lazy').get('value')).toBe(42);
      expect(await flowData.get('lazy').getAsync('value')).toBe(42);
    });

  test('gives every waiting reader the error of a failed task, and the ' +
    'failure is recorded once as the error of its Flow Element',
  async () => {
    const work = deferred();
    const reads = {};
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(lazyElement(work))
      .add(readerElement(reads))
      .build();
    const flowData = pipeline.createFlowData();
    const failure = new Error('the task failed');
    const processing = flowData.process().then(() => undefined, (e) => e);
    work.reject(failure);
    const rejection = await processing;
    expect(reads.error).toBe(failure);
    expect(Object.keys(flowData.errors)).toEqual(['lazy']);
    expect(flowData.errors.lazy).toBe(failure);
    expect(rejection).toHaveProperty('name', 'AggregateError');
    expect(rejection.errors).toEqual([failure]);
    expect(() => flowData.lazy.get('value')).toThrow(failure);
    await expect(flowData.lazy.getAsync('value')).rejects.toBe(failure);
  });

  test('is read with getAsync like any other property when it is not lazy',
    async () => {
      const pipeline = new core.PipelineBuilder({
        addJavaScriptBuilder: false
      }).add(new core.FlowElement({
        dataKey: 'plain',
        processInternal: function (flowData) {
          flowData.setElementData(new core.ElementDataDictionary({
            flowElement: this,
            contents: { value: 'plain' }
          }));
        }
      })).build();
      const flowData = pipeline.createFlowData();
      await flowData.process();
      expect(await flowData.plain.getAsync('value')).toBe('plain');
    });
});
