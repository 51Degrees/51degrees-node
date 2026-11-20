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

// A Flow Data is read only once processing has finished, so adding Evidence,
// Element Data or an error to it then throws, and so does processing it
// again. Element Data is written only by the Flow Elements that write it,
// while they process, so a write through it once they have finished throws.

const core = require('fiftyone.pipeline.core');

const FINISHED = 'the flow data has finished processing';
const ELEMENT_FINISHED = 'has finished processing';

// A Flow Element that accepts the User-Agent and adds Element Data holding
// one value.
const adder = (dataKey) => new core.FlowElement({
  dataKey,
  evidenceKeyFilter: new core.BasicListEvidenceKeyFilter(
    ['header.user-agent']),
  processInternal: function (flowData) {
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents: { value: dataKey }
    }));
  }
});

// A Flow Element that writes a field of another's Element Data.
const writer = (dataKey, target) => new core.FlowElement({
  dataKey,
  processInternal: function (flowData) {
    flowData.get(target).written = dataKey;
  }
});

// A Flow Element that writes a value into another's Element Data contents.
const contentsWriter = (dataKey, target) => new core.FlowElement({
  dataKey,
  processInternal: function (flowData) {
    flowData.get(target).contents.written = dataKey;
  }
});

// A Flow Element that throws while it processes.
const failing = (dataKey) => new core.FlowElement({
  dataKey,
  processInternal: function () {
    throw new Error('failed in ' + dataKey);
  }
});

const build = (...elements) => {
  const builder = new core.PipelineBuilder({ addJavaScriptBuilder: false });
  for (const element of elements) {
    if (Array.isArray(element)) {
      builder.addParallel(element);
    } else {
      builder.add(element);
    }
  }
  const pipeline = builder.build();
  pipeline.suppressProcessExceptions = true;
  pipeline.on('error', () => {});
  return pipeline;
};

describe('A finished Flow Data', () => {
  test('throws when Evidence, Element Data or an error is added',
    async () => {
      const element = adder('first');
      const flowData = build(element).createFlowData();
      flowData.evidence.add('header.user-agent', 'before');
      await flowData.process();
      expect(() => flowData.evidence.add('header.user-agent', 'after'))
        .toThrow(FINISHED);
      expect(() => flowData.evidence.addObject({ 'query.a': 'b' }))
        .toThrow(FINISHED);
      expect(() => flowData.setElementData(new core.ElementDataDictionary({
        flowElement: element,
        contents: {}
      }))).toThrow(FINISHED);
      expect(() => flowData.setError(new Error('late'), element))
        .toThrow(FINISHED);
      expect(flowData.evidence.get('header.user-agent')).toBe('before');
      expect(Object.keys(flowData.errors)).toEqual([]);
    });

  // A listener that throws while the error of a failing Flow Element is
  // recorded makes processing reject, alone or in a parallel group.
  test.each([
    ['a Flow Element', (element) => element],
    ['a parallel group', (element) => [adder('member'), element]]
  ])('is finished when an error in %s makes processing reject',
    async (name, place) => {
      const pipeline = build(adder('first'), place(failing('failing')));
      pipeline.on('error', () => { throw new Error('listener failed'); });
      const flowData = pipeline.createFlowData();
      const data = new core.ElementDataDictionary({
        flowElement: adder('caller'),
        contents: {}
      });
      flowData.setElementData(data);
      await expect(flowData.process()).rejects.toThrow('listener failed');
      expect(() => flowData.evidence.add('header.user-agent', 'after'))
        .toThrow(FINISHED);
      expect(() => flowData.setError(new Error('late'), data.flowElement))
        .toThrow(FINISHED);
      expect(() => { data.after = true; }).toThrow(ELEMENT_FINISHED);
      await expect(flowData.process()).rejects.toThrow(
        'The flow data has already been processed.');
    });

  test('is not processed again', async () => {
    const flowData = build(adder('first')).createFlowData();
    await flowData.process();
    await expect(flowData.process()).rejects.toThrow(
      'The flow data has already been processed.');
  });
});

describe('Element Data', () => {
  test('is written by its Flow Element while it processes, and throws ' +
    'once it has finished', async () => {
    const flowData = build(adder('first')).createFlowData();
    await flowData.process();
    expect(() => { flowData.first.written = 'after'; })
      .toThrow(ELEMENT_FINISHED);
    expect('written' in flowData.first).toBe(false);
  });

  test('throws when its contents are written or deleted once it has ' +
    'finished', async () => {
    const flowData = build(adder('first')).createFlowData();
    await flowData.process();
    expect(() => { flowData.first.contents.written = 'after'; })
      .toThrow(ELEMENT_FINISHED);
    expect(() => { flowData.first.contents.value = 'after'; })
      .toThrow(ELEMENT_FINISHED);
    expect(() => { delete flowData.first.contents.value; })
      .toThrow(ELEMENT_FINISHED);
    expect(flowData.first.value).toBe('first');
    expect(Object.keys(flowData.first.contents)).toEqual(['value']);
  });

  test('whose contents a later Flow Element writes is that element\'s ' +
    'error', async () => {
    const flowData = build(adder('first'), contentsWriter('later', 'first'))
      .createFlowData();
    await flowData.process();
    expect(Object.keys(flowData.errors)).toEqual(['later']);
    expect(String(flowData.errors.later)).toContain(ELEMENT_FINISHED);
    expect(Object.keys(flowData.first.contents)).toEqual(['value']);
  });

  test('shared by two Flow Elements has its contents written by each in ' +
    'turn', async () => {
    const flowData = build(adder('shared'),
      contentsWriter('shared', 'shared')).createFlowData();
    await flowData.process();
    expect(flowData.errors).toEqual({});
    expect(flowData.shared.written).toBe('shared');
  });

  test('written by a later Flow Element is that element\'s error',
    async () => {
      const flowData = build(adder('first'), writer('later', 'first'))
        .createFlowData();
      await flowData.process();
      expect(Object.keys(flowData.errors)).toEqual(['later']);
      expect(String(flowData.errors.later)).toContain(ELEMENT_FINISHED);
    });

  test('shared by two Flow Elements is written by each in turn',
    async () => {
      const flowData = build(adder('shared'), writer('shared', 'shared'))
        .createFlowData();
      await flowData.process();
      expect(flowData.errors).toEqual({});
      expect(flowData.shared.written).toBe('shared');
    });

  test('of a parallel group member throws once the member has finished',
    async () => {
      const flowData = build([adder('one'), adder('two')]).createFlowData();
      await flowData.process();
      expect(() => { flowData.one.written = 'after'; })
        .toThrow(ELEMENT_FINISHED);
      expect(() => { flowData.two.written = 'after'; })
        .toThrow(ELEMENT_FINISHED);
    });

  test('the caller adds before processing throws once processing has ' +
    'finished', async () => {
    const element = adder('caller');
    const flowData = build(adder('first')).createFlowData();
    const data = new core.ElementDataDictionary({
      flowElement: element,
      contents: {}
    });
    flowData.setElementData(data);
    data.before = true;
    await flowData.process();
    expect(() => { data.after = true; }).toThrow(ELEMENT_FINISHED);
    expect(data.before).toBe(true);
  });

  test('keeps its own state in names starting with an underscore',
    async () => {
      const flowData = build(adder('first')).createFlowData();
      await flowData.process();
      flowData.first._kept = 'value';
      expect(flowData.first._kept).toBe('value');
    });
});

// A Flow Element whose Element Data has one lazy property, 'value', whose
// task finishes only when the test says.
const lazy = (dataKey) => {
  const work = {};
  work.task = new Promise((resolve, reject) => {
    work.resolve = resolve;
    work.reject = reject;
  });
  // A failure the test causes is never left unhandled.
  work.task.catch(() => {});
  work.element = new core.FlowElement({
    dataKey,
    processInternal: function (flowData) {
      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents: {}
      });
      data.addLazyProperty('value', work.task);
      flowData.setElementData(data);
    }
  });
  return work;
};

// Lets pending promise callbacks run, so processing gets as far as it can.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('A Flow Data with a lazy property', () => {
  test('finishes only once the task has, so a failed task is recorded',
    async () => {
      const work = lazy('lazy');
      const flowData = build(work.element).createFlowData();
      const processing = flowData.process();
      await settle();
      expect(flowData.processed).toBe(false);
      const failure = new Error('the task failed');
      work.reject(failure);
      await processing;
      expect(flowData.processed).toBe(true);
      expect(flowData.errors.lazy).toBe(failure);
      expect(() => flowData.setError(new Error('late'), work.element))
        .toThrow(FINISHED);
    });

  test('finishes only once the task has when processing rejects',
    async () => {
      const work = lazy('lazy');
      const pipeline = build(work.element, failing('failing'));
      pipeline.on('error', () => { throw new Error('listener failed'); });
      const flowData = pipeline.createFlowData();
      const processing = flowData.process();
      processing.catch(() => {});
      await settle();
      expect(flowData.processed).toBe(false);
      work.resolve(42);
      await expect(processing).rejects.toThrow('listener failed');
      expect(flowData.processed).toBe(true);
      expect(flowData.lazy.get('value')).toBe(42);
    });
});
