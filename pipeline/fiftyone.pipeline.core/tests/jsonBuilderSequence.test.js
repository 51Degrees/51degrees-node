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

// The JSON Builder page says the Element fails with an error, and sets no
// JSON, when no Sequence Element has produced a sequence number.

const core = require('fiftyone.pipeline.core');

const userElement = () => new core.FlowElement({ dataKey: 'user' });

// A pipeline with the JSON and JavaScript builders and nothing else added by
// the builder, so the Sequence Element is only there if the test adds it.
const build = (...elements) => {
  const builder = new core.PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false,
    suppressProcessExceptions: true
  });
  elements.forEach((element) => builder.add(element));
  return builder
    .add(new core.JsonBundler())
    .add(new core.JavascriptBuilder({}))
    .build();
};

const run = async (pipeline, evidence = {}) => {
  const flowData = pipeline.createFlowData();
  for (const key in evidence) {
    flowData.evidence.add(key, evidence[key]);
  }
  await flowData.process();
  return flowData;
};

const noSequenceMessage = /Sequence Element/;

describe('JSON Builder with no sequence number', () => {
  test('fails with an error and sets no JSON', async () => {
    const flowData = await run(build(userElement()));
    expect(flowData.errors.jsonbundler).toBeDefined();
    expect(String(flowData.errors.jsonbundler.message ||
      flowData.errors.jsonbundler)).toMatch(noSequenceMessage);
    expect(() => flowData.get('jsonbundler')).toThrow();
  });

  test.each([['3'], [''], ['abc'], [3.5], [null]])(
    'fails where query.sequence is %p, which is not a whole number',
    async (given) => {
      const flowData = await run(build(userElement()), {
        'query.sequence': given
      });
      expect(flowData.errors.jsonbundler).toBeDefined();
      expect(() => flowData.get('jsonbundler')).toThrow();
    });

  test('accepts a whole number a caller added to query.sequence',
    async () => {
      const flowData = await run(build(userElement()), {
        'query.sequence': 3
      });
      expect(flowData.errors.jsonbundler).toBeUndefined();
      expect(flowData.jsonbundler.json).toBeDefined();
    });

  test('works when a Sequence Element comes first', async () => {
    const flowData = await run(build(new core.SequenceElement(),
      userElement()));
    expect(flowData.errors.jsonbundler).toBeUndefined();
    expect(flowData.jsonbundler.json).toBeDefined();
  });

  test('works in a default pipeline', async () => {
    const pipeline = new core.PipelineBuilder().add(userElement()).build();
    const flowData = await run(pipeline);
    expect(flowData.errors.jsonbundler).toBeUndefined();
    expect(flowData.jsonbundler.json).toBeDefined();
  });
});
