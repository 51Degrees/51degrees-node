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

// A promise reads 'then' from every value it resolves with, and the
// Pipeline resolves one with the Flow Data at each of its elements. 'then'
// is never Element Data, so it is answered without looking for any, which
// would otherwise run the lookup for a key no element has on every request.

const core = require('fiftyone.pipeline.core');

const pipelineOf = () => new core.PipelineBuilder()
  .add(new core.FlowElement({
    dataKey: 'first',
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: { value: 1 }
      }));
    }
  }))
  .add(new core.FlowElement({
    dataKey: 'second',
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: { value: 2 }
      }));
    }
  }))
  .build();

describe('A Flow Data read as a promise', () => {
  let get;

  beforeEach(() => {
    get = jest.spyOn(core.FlowData.prototype, 'get');
  });

  afterEach(() => {
    get.mockRestore();
  });

  test('has no then', () => {
    const flowData = pipelineOf().createFlowData();
    expect(flowData.then).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  test('is processed and awaited without looking for Element Data ' +
    'called then', async () => {
    const flowData = pipelineOf().createFlowData();
    await flowData.process();
    await Promise.resolve(flowData);
    expect(get.mock.calls.map(([key]) => key)).not.toContain('then');
  });

  test('still gives its Element Data by key, in any case', async () => {
    const flowData = pipelineOf().createFlowData();
    await flowData.process();
    get.mockClear();
    expect(flowData.first.get('value')).toBe(1);
    expect(flowData.SECOND.get('value')).toBe(2);
    expect(get.mock.calls.map(([key]) => key)).toEqual(['first', 'SECOND']);
  });
});
