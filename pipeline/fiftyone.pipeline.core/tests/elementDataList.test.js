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

// A Flow Data keeps its Element Data in a list. The members of a parallel
// group each add their own while the group runs, and every one is found and
// listed in Pipeline order afterwards. An error a member throws is added by
// the group once every member has stopped.

const core = require('fiftyone.pipeline.core');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A Flow Element that waits, then adds Element Data holding its name.
const member = (dataKey, wait, seen) => new core.FlowElement({
  dataKey,
  processInternal: function (flowData) {
    return pause(wait).then(() => {
      if (seen) {
        seen[dataKey] = Object.keys(flowData.errors);
      }
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: { name: dataKey }
      }));
    });
  }
});

// A Flow Element that throws after waiting.
const thrower = (dataKey, wait, error) => new core.FlowElement({
  dataKey,
  processInternal: function () {
    return pause(wait).then(() => { throw error; });
  }
});

// The data keys the Flow Data lists, leaving out the web elements the
// builder adds.
const keys = (flowData) => flowData.listElementData()
  .map((data) => data.flowElement.dataKey)
  .filter((key) => key !== 'set-headers');

describe('The Element Data of a Flow Data', () => {
  test('added by the members of a parallel group are all found and ' +
    'listed in Pipeline order', async () => {
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(member('first', 0))
      .addParallel([member('slow', 40), member('fast', 0),
        member('middle', 20)])
      .add(member('last', 0))
      .build();
    const flowData = pipeline.createFlowData();
    await flowData.process();
    for (const key of ['first', 'slow', 'fast', 'middle', 'last']) {
      expect(flowData.get(key).get('name')).toBe(key);
      expect(flowData.tryGet(key.toUpperCase()).get('name')).toBe(key);
    }
    expect(keys(flowData))
      .toEqual(['first', 'slow', 'fast', 'middle', 'last']);
  });

  test('added again under one key replaces the earlier, in its place',
    async () => {
      const element = member('same', 0);
      const pipeline = new core.PipelineBuilder({
        addJavaScriptBuilder: false
      }).add(element).add(member('after', 0)).build();
      const flowData = pipeline.createFlowData();
      await flowData.process();
      const replacement = new core.ElementDataDictionary({
        flowElement: element,
        contents: { name: 'replaced' }
      });
      flowData.setElementData(replacement);
      expect(flowData.get('same')).toBe(replacement);
      expect(keys(flowData)).toEqual(['same', 'after']);
    });

  test('not there is undefined from tryGet and an error from get, naming ' +
    'the keys there are in Pipeline order', async () => {
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .addParallel([member('slow', 20), member('fast', 0)])
      .build();
    const flowData = pipeline.createFlowData();
    await flowData.process();
    expect(flowData.tryGet('missing')).toBeUndefined();
    expect(() => flowData.get('missing')).toThrow(
      'Available element data keys are: slow, fast, set-headers.');
  });

  test('is still read by key through the deprecated data object',
    async () => {
      const pipeline = new core.PipelineBuilder({
        addJavaScriptBuilder: false
      }).addParallel([member('slow', 20), member('fast', 0)]).build();
      const flowData = pipeline.createFlowData();
      await flowData.process();
      expect(Object.keys(flowData.data))
        .toEqual(['slow', 'fast', 'set-headers']);
      expect(flowData.data.fast.get('name')).toBe('fast');
    });
});

describe('The errors of a parallel group', () => {
  test('thrown by members are added once every member has stopped, in ' +
    'the order the members were added', async () => {
    const seen = {};
    const late = new Error('late');
    const early = new Error('early');
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .addParallel([thrower('late', 20, late), member('watcher', 40, seen),
        thrower('early', 0, early)])
      .build();
    pipeline.suppressProcessExceptions = true;
    pipeline.on('error', () => {});
    const flowData = pipeline.createFlowData();
    await flowData.process();
    expect(seen.watcher).toEqual([]);
    expect(Object.keys(flowData.errors)).toEqual(['late', 'early']);
    expect(flowData.errors.late).toBe(late);
    expect(flowData.errors.early).toBe(early);
    expect(flowData.get('watcher').get('name')).toBe('watcher');
  });

  test('recorded by members themselves are all present afterwards',
    async () => {
      const recorder = (dataKey, wait) => new core.FlowElement({
        dataKey,
        processInternal: function (flowData) {
          return pause(wait).then(() => {
            flowData.setError(new Error(dataKey), this);
          });
        }
      });
      const pipeline = new core.PipelineBuilder({
        addJavaScriptBuilder: false
      }).addParallel([recorder('one', 10), recorder('two', 0),
        recorder('three', 5)]).build();
      pipeline.suppressProcessExceptions = true;
      pipeline.on('error', () => {});
      const flowData = pipeline.createFlowData();
      await flowData.process();
      expect(Object.keys(flowData.errors).sort())
        .toEqual(['one', 'three', 'two']);
    });
});
