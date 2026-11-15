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

// What the JSON Builder and JavaScript Builder pages of the pipeline
// specification ask of the JSON they write and the session id and sequence
// the script carries.

const core = require('fiftyone.pipeline.core');

const sessionIdLine = /var sessionId = "(.*)";/;
const sequenceLine = /var sequence = (.*);/;

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
  expect(flowData.errors).toEqual({});
  return flowData;
};

/**
 * An element whose data is the contents given, with each property listed
 * in its metadata.
 *
 * @param {string} dataKey the element's data key
 * @param {object} contents its data
 * @returns {object} the element
 */
const element = (dataKey, contents) => {
  const properties = {};
  for (const name of Object.keys(contents)) {
    properties[name] = { type: 'string' };
  }
  return new core.FlowElement({
    dataKey,
    properties,
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents
      }));
    }
  });
};

const noValue = (reason) => new core.AspectPropertyValue(reason);
const withValue = (value) => new core.AspectPropertyValue(null, value);

describe('JavaScript Builder session id and sequence', () => {
  // javascript-builder.md line 61: "Where there is no Sequence Element, the
  // sequence MUST be rendered as `1` and the session id as an empty string,
  // so the script always parses."
  test('with no Sequence Element the script has sequence 1 and no session id',
    async () => {
      const flowData = await run(build(element('user', { a: 'b' })), {
        'query.session-id': 'abc-123',
        'query.sequence': 3
      });
      const script = flowData.javascriptbuilder.javascript;
      expect(script.match(sessionIdLine)[1]).toBe('');
      expect(script.match(sequenceLine)[1]).toBe('1');
    });

  // Step 5 takes both from the Sequence Element's data.
  test('with a Sequence Element the script carries its session id and ' +
    'sequence', async () => {
    const flowData = await run(build(new core.SequenceElement(),
      element('user', { a: 'b' })), {
      'query.session-id': 'abc-123',
      'query.sequence': '4'
    });
    const script = flowData.javascriptbuilder.javascript;
    expect(script.match(sessionIdLine)[1]).toBe('abc-123');
    expect(script.match(sequenceLine)[1]).toBe('5');
  });
});

describe('JSON Builder values', () => {
  const json = async (contents) => {
    const flowData = await run(build(new core.SequenceElement(),
      element('Hardware', contents)));
    return flowData.jsonbundler.json.hardware;
  };

  // json-builder.md line 76: each item of a list of Element Data is an
  // object whose Properties follow the rules for a Property with no value
  // and for one whose value is null.
  test('a list of profiles is written as plain objects', async () => {
    const written = await json({
      Profiles: [
        {
          HardwareVendor: withValue(['Apple']),
          HardwareName: noValue('The reason.')
        },
        new core.ElementDataDictionary({
          flowElement: { dataKey: 'profile' },
          contents: {
            HardwareVendor: withValue(['Samsung']),
            HardwareModel: null
          }
        })
      ]
    });
    expect(written.profiles).toEqual([
      {
        hardwarevendor: ['Apple'],
        hardwarename: null,
        hardwarenamenullreason: 'The reason.'
      },
      { hardwarevendor: ['Samsung'] }
    ]);
  });

  test('a list of values that are not Element Data is written as it is',
    async () => {
      const written = await json({
        Names: withValue(['iPhone', 'iPhone 15']),
        Weighted: withValue([{ value: 'GB', rawWeighting: 1 }])
      });
      expect(written.names).toEqual(['iPhone', 'iPhone 15']);
      expect(written.weighted).toEqual([{ value: 'GB', rawWeighting: 1 }]);
    });

  // json-builder.md line 52: a Property whose value is null without having
  // been assigned 'no value' has no entry of its own and no nullreason.
  test('a plain null has no entry and no nullreason', async () => {
    const written = await json({ Missing: null, Present: 'yes' });
    expect(Object.keys(written)).not.toContain('missing');
    expect(Object.keys(written)).not.toContain('missingnullreason');
    expect(written.present).toBe('yes');
  });

  // json-builder.md line 59: "These keys MUST be written in lower case."
  test('element and property keys are written in lower case', async () => {
    const flowData = await run(build(new core.SequenceElement(),
      element('MixedCase', { SomeValue: withValue('x'), NoValue: noValue('r') })));
    const written = flowData.jsonbundler.json;
    expect(Object.keys(written)).toContain('mixedcase');
    expect(Object.keys(written)).not.toContain('MixedCase');
    expect(written.mixedcase).toEqual(expect.objectContaining({
      somevalue: 'x',
      novalue: null,
      novaluenullreason: 'r'
    }));
  });
});
