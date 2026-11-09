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

  test('adds no section to the JSON sent to browsers', async () => {
    const flowData = await run({});
    const json = flowData.jsonbundler.json;
    expect(Object.keys(json)).not.toContain('sequence');
    expect(JSON.stringify(json)).not.toContain('session-id');
  });
});
