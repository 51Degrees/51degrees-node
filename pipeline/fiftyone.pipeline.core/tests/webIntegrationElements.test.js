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

// Checks the elements the pipeline builder adds for the web integration
// against the Web integration page and the Sequence Element page of the
// pipeline specification.

const path = require('path');

const core = require('fiftyone.pipeline.core');
const FlowElement = core.FlowElement;

const userElement = () => new FlowElement({ dataKey: 'user' });

const dataKeys = (pipeline) => pipeline.flowElementsChain.map(
  (element) => element.dataKey);

describe('web integration elements', () => {
  test('are all added, with the Sequence Element first, by default', () => {
    const pipeline = new core.PipelineBuilder().add(userElement()).build();
    expect(dataKeys(pipeline)).toEqual([
      'sequence', 'user', 'jsonbundler', 'javascriptbuilder', 'set-headers'
    ]);
  });

  test('keep the Sequence Element first when elements come from a ' +
    'configuration', () => {
    const pipeline = new core.PipelineBuilder().buildFromConfigurationFile(
      path.resolve(__dirname, 'config.json'));
    expect(dataKeys(pipeline)[0]).toBe('sequence');
    expect(dataKeys(pipeline)).toContain('configTest');
  });

  test.each([
    ['addSequenceElement', 'sequence'],
    ['addJsonBuilderElement', 'jsonbundler'],
    ['addJavaScriptBuilderElement', 'javascriptbuilder'],
    ['addSetHeadersElement', 'set-headers']
  ])('%s false leaves out only the %s element', (setting, dataKey) => {
    const pipeline = new core.PipelineBuilder({ [setting]: false })
      .add(userElement()).build();
    const expected = [
      'sequence', 'user', 'jsonbundler', 'javascriptbuilder', 'set-headers'
    ].filter((key) => key !== dataKey);
    expect(dataKeys(pipeline)).toEqual(expected);
  });

  test('addJavaScriptBuilder false still leaves out the Sequence, JSON ' +
    'Builder and JavaScript Builder elements and keeps Set Headers', () => {
    const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(userElement()).build();
    expect(dataKeys(pipeline)).toEqual(['user', 'set-headers']);
  });

  test('useSetHeaderProperties false still leaves out Set Headers', () => {
    const pipeline = new core.PipelineBuilder({
      useSetHeaderProperties: false
    }).add(userElement()).build();
    expect(dataKeys(pipeline)).toEqual([
      'sequence', 'user', 'jsonbundler', 'javascriptbuilder'
    ]);
  });

  test('every switch off leaves only the elements added', () => {
    const pipeline = new core.PipelineBuilder({
      addSequenceElement: false,
      addJsonBuilderElement: false,
      addJavaScriptBuilderElement: false,
      addSetHeadersElement: false
    }).add(userElement()).build();
    expect(dataKeys(pipeline)).toEqual(['user']);
  });
});

// The page says each element MUST be present and is added only if not.
describe('web integration elements the caller added', () => {
  const allKeys = [
    'sequence', 'user', 'jsonbundler', 'javascriptbuilder', 'set-headers'
  ];

  test('are not added again, and are the ones the Pipeline uses', () => {
    const sequence = new core.SequenceElement();
    const jsonBundler = new core.JsonBundler();
    const javascriptBuilder = new core.JavascriptBuilder({ endPoint: '/own' });
    const setHeaders = new core.SetHeadersElement();
    const pipeline = new core.PipelineBuilder()
      .add(sequence)
      .add(userElement())
      .add(jsonBundler)
      .add(javascriptBuilder)
      .add(setHeaders)
      .build();
    expect(dataKeys(pipeline)).toEqual(allKeys);
    expect(pipeline.getElement('sequence')).toBe(sequence);
    expect(pipeline.getElement('jsonbundler')).toBe(jsonBundler);
    expect(pipeline.getElement('javascriptbuilder')).toBe(javascriptBuilder);
    expect(pipeline.getElement('set-headers')).toBe(setHeaders);
  });

  test('a JSON Builder the Pipeline lacks goes immediately before the ' +
    'JavaScript Builder the caller added', () => {
    const javascriptBuilder = new core.JavascriptBuilder({});
    const pipeline = new core.PipelineBuilder()
      .add(userElement())
      .add(javascriptBuilder)
      .build();
    expect(dataKeys(pipeline)).toEqual(allKeys);
    expect(pipeline.getElement('javascriptbuilder')).toBe(javascriptBuilder);
  });

  test('one added in parallel with another element counts as present',
    () => {
      const setHeaders = new core.SetHeadersElement();
      const pipeline = new core.PipelineBuilder()
        .addParallel([userElement(), setHeaders])
        .build();
      // It stays where the caller put it, and no other is added.
      expect(pipeline.flowElementsChain.flat()
        .map((element) => element.dataKey)).toEqual([
        'sequence', 'user', 'set-headers', 'jsonbundler', 'javascriptbuilder'
      ]);
      expect(pipeline.getElement('set-headers')).toBe(setHeaders);
    });

  // Keys are compared ignoring case, as access-to-results.md asks of every
  // string comparison.
  test('one whose key differs only in case counts as present', () => {
    const pipeline = new core.PipelineBuilder()
      .add(new FlowElement({ dataKey: 'Sequence' }))
      .add(userElement())
      .add(new FlowElement({ dataKey: 'Set-Headers' }))
      .build();
    expect(dataKeys(pipeline)).toEqual([
      'Sequence', 'user', 'Set-Headers', 'jsonbundler', 'javascriptbuilder'
    ]);
  });

  test('building twice adds none of them twice', () => {
    const builder = new core.PipelineBuilder().add(userElement());
    builder.build();
    expect(dataKeys(builder.build())).toEqual(allKeys);
  });
});

describe('Sequence Element data', () => {
  const run = async (evidence) => {
    const pipeline = new core.PipelineBuilder().add(userElement()).build();
    const flowData = pipeline.createFlowData();
    for (const key in evidence) {
      flowData.evidence.add(key, evidence[key]);
    }
    await flowData.process();
    return flowData;
  };

  test('holds a new session id and a sequence of 1 when there is no ' +
    'session', async () => {
    const flowData = await run({});
    const sessionId = flowData.sequence.get('session-id');
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
    expect(flowData.sequence.get('sequence')).toBe(1);
    expect(flowData.evidence.get('query.session-id')).toBe(sessionId);
    expect(flowData.evidence.get('query.sequence')).toBe(1);
  });

  test('holds the session id given and the sequence plus one', async () => {
    const flowData = await run({
      'query.session-id': 'abc-123',
      'query.sequence': '4'
    });
    expect(flowData.sequence.get('session-id')).toBe('abc-123');
    expect(flowData.sequence.get('sequence')).toBe(5);
    expect(flowData.evidence.get('query.session-id')).toBe('abc-123');
    expect(flowData.evidence.get('query.sequence')).toBe(5);
  });

  test('lists both properties', () => {
    const properties = new core.SequenceElement().getProperties();
    expect(properties['session-id'].type).toBe('string');
    expect(properties.sequence.type).toBe('int');
  });

  test('adds a sequence section to the JSON sent to browsers', async () => {
    const flowData = await run({
      'query.session-id': 'abc-123',
      'query.sequence': '4'
    });
    const json = flowData.jsonbundler.json;
    expect(json.sequence).toEqual({ 'session-id': 'abc-123', sequence: 5 });
  });
});

describe('Sequence Element session id and sequence', () => {
  const run = async (evidence) => {
    const pipeline = new core.PipelineBuilder().add(userElement()).build();
    const flowData = pipeline.createFlowData();
    for (const key in evidence) {
      flowData.evidence.add(key, evidence[key]);
    }
    await flowData.process();
    return flowData;
  };

  const newId = /^[0-9a-f]{32}$/;

  test.each([
    ['5', 6],
    ['00000000005', 6],
    ['0000000000000000000012', 13],
    [5, 6],
    ['0', 1],
    [0, 1],
    ['2147483646', 2147483647]
  ])('a sequence of %p with no session id counts up to %p and gets a new ' +
    'session id', async (given, expected) => {
    const flowData = await run({ 'query.sequence': given });
    expect(flowData.sequence.get('session-id')).toMatch(newId);
    expect(flowData.sequence.get('sequence')).toBe(expected);
  });

  test('a session id with no sequence gives a sequence of 1', async () => {
    const flowData = await run({ 'query.session-id': 'abc-123' });
    expect(flowData.sequence.get('session-id')).toBe('abc-123');
    expect(flowData.sequence.get('sequence')).toBe(1);
  });

  test.each([[''], [[]], [['abc']], [{}], [7], [null]])(
    'a session id of %p counts as absent and gets a new one', async (given) => {
      const flowData = await run({
        'query.session-id': given,
        'query.sequence': '3'
      });
      expect(flowData.sequence.get('session-id')).toMatch(newId);
      expect(flowData.sequence.get('sequence')).toBe(4);
    });

  test.each([
    ['abc'], [''], ['-1'], ['+5'], [' 5'], ['5 '], ['1.5'], ['1e3'], [' 4'],
    ['2147483647'], ['00002147483647'],
    ['99999999999'], [-1], [1.5], [NaN], [Infinity], [2147483647],
    [[]], [['5']], [{}], [null], [true]
  ])('a sequence of %p counts as absent and gives 1', async (given) => {
    const flowData = await run({
      'query.session-id': 'abc-123',
      'query.sequence': given
    });
    expect(flowData.sequence.get('session-id')).toBe('abc-123');
    expect(flowData.sequence.get('sequence')).toBe(1);
    expect(flowData.evidence.get('query.sequence')).toBe(1);
  });
});

describe('JSON Builder exclusions', () => {
  const ElementDataDictionary = core.ElementDataDictionary ||
    require('../elementDataDictionary');

  const elementWith = (dataKey) => new FlowElement({
    dataKey,
    properties: { value: { name: 'value', type: 'string' } },
    processInternal: function (flowData) {
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { value: 'x' }
      }));
    }
  });

  test('leave out the Cloud Request Engine and Usage Sharing and keep ' +
    'other elements', async () => {
    const pipeline = new core.PipelineBuilder()
      .add(elementWith('cloud'))
      .add(elementWith('shareUsage'))
      .add(elementWith('other'))
      .build();
    const flowData = pipeline.createFlowData();
    await flowData.process();
    const keys = Object.keys(flowData.jsonbundler.json);
    expect(keys).toContain('other');
    expect(keys).not.toContain('cloud');
    expect(keys).not.toContain('shareusage');
    expect(keys).not.toContain('shareUsage');
  });
});
