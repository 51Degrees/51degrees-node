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

// From a built Pipeline alone, without holding the elements that were
// added to it, the metadata of every Property every one of its elements
// can populate is reachable, and a Property can be found by one of its
// metadata values (properties.md lines 70 to 72).

const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const SequenceElement = require('../sequenceElement');
const JsonBundler = require('../jsonbundler');
const JavascriptBuilder = require('../javascriptbuilder');
const SetHeadersElement = require('../setHeadersElement');

// An element with two Properties of its own, both in one category, so a
// lookup by a metadata value has more than one answer to find.
const extraElement = () => new FlowElement({
  dataKey: 'extra',
  properties: {
    size: { name: 'size', type: 'int', category: 'Testing' },
    colour: { name: 'colour', type: 'string', category: 'Testing' }
  }
});

// A Pipeline holding one element of each kind the core package offers,
// with the builder adding nothing of its own.
const build = () => new PipelineBuilder({
  addJavaScriptBuilder: false,
  useSetHeaderProperties: false
})
  .add(extraElement())
  .add(new SequenceElement())
  .add(new JsonBundler())
  .add(new JavascriptBuilder({}))
  .add(new SetHeadersElement())
  .build();

// The Properties of every element of the Pipeline, read from the Pipeline
// and not from the elements the test built.
const propertiesFromPipeline = (pipeline) => {
  const found = {};
  for (const [dataKey, element] of Object.entries(pipeline.flowElements)) {
    found[dataKey] = Object.keys(element.getProperties()).sort();
  }
  return found;
};

// The Pipeline fills its index of Properties by metadata key and value
// without waiting for it, so a reader asks it to fill the index for each
// element and waits for that.
const indexed = async (pipeline) => {
  await Promise.all(Object.values(pipeline.flowElements)
    .map((element) => pipeline.updatePropertyDataBaseForElement(element)));
  return pipeline.propertyDatabase;
};

test('the Pipeline gives the Properties of every element it holds', () => {
  expect(propertiesFromPipeline(build())).toEqual({
    extra: ['colour', 'size'],
    sequence: ['sequence', 'session-id'],
    jsonbundler: ['json'],
    javascriptbuilder: ['javascript'],
    'set-headers': ['responseheadersdictionary']
  });
});

test('every element of the Pipeline is reachable by its Data Key', () => {
  const pipeline = build();
  for (const dataKey of Object.keys(pipeline.flowElements)) {
    expect(pipeline.getElement(dataKey).dataKey).toBe(dataKey);
    expect(Object.keys(pipeline.getElement(dataKey).getProperties()))
      .toEqual(Object.keys(pipeline.flowElements[dataKey].getProperties()));
  }
});

test('the metadata of a Property names the element that populates it',
  async () => {
    const byCategory = (await indexed(build())).category;
    expect(Object.keys(byCategory.testing).sort()).toEqual(['colour', 'size']);
    expect(byCategory.testing.size)
      .toEqual({ propertyName: 'size', flowElementKey: 'extra' });
  });

test('a Property is found at the Pipeline level by a metadata value',
  async () => {
    const byType = (await indexed(build())).type;
    expect(byType.int.size)
      .toEqual({ propertyName: 'size', flowElementKey: 'extra' });
    expect(byType.string.javascript).toEqual({
      propertyName: 'javascript', flowElementKey: 'javascriptbuilder'
    });
  });
