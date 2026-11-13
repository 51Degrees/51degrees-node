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

/**
 * How the element reads the values 51Degrees elements give, writes its
 * own, logs, takes its settings and describes its properties.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('fiftyone.pipeline.core');
const DerivedPropertyElement = require('../derivedPropertyElement');
const DerivedPropertyElementBuilder =
  require('../derivedPropertyElementBuilder');
const { ScriptValidationError } = require('../errors');
const { USUAL_CAUSES } = require('../lib/evaluate');
const {
  SourceElement,
  bandScript,
  pipelineOf,
  processed
} = require('./helpers');

/** A script writing true where the band an earlier script wrote is High. */
const BAND_IS_HIGH = [
  'Format: 1',
  'Name: BandIsHigh',
  'Version: 1.0.0',
  'Output:',
  '  Name: BandIsHigh',
  '  Description: Whether the band is high.',
  '  ValueType: bool',
  '  IsList: false',
  'Rules:',
  '  - When: { Property: derived.Band, Eq: "High" }',
  '    Then: true',
  '  - Else: false'
].join('\n');

/**
 * An element running the band script on src.N.
 *
 * @returns {DerivedPropertyElement} the element.
 */
function band () {
  return new DerivedPropertyElementBuilder()
    .addScript('Band', bandScript('Band', 'src.N'))
    .build();
}

/**
 * The band written for a request where src.N has a value, given as it is
 * rather than wrapped in an AspectPropertyValue.
 *
 * @param {*} value the value of src.N.
 * @returns {Promise<object>} the band.
 */
async function bandFor (value) {
  const flowData = await processed(pipelineOf([
    new SourceElement('src', { N: value }, { wrap: false }),
    band()
  ]));
  return flowData.get('derived').get('Band');
}

/**
 * The message for a band with no value, for one reason.
 *
 * @param {string} reason why src.N could not be read.
 * @returns {string} the message.
 */
function noBand (reason) {
  return "Derived property 'Band' has no value because 1 source property " +
    `was not available. 'src.N' (${reason}). ${USUAL_CAUSES}`;
}

/**
 * Waits for the lines the element logs once its pipeline is built.
 *
 * @returns {Promise<void>} resolved after them.
 */
function logged () {
  return new Promise(resolve => setImmediate(resolve));
}

test('a value is read under the derived key whatever the case', async () => {
  const flowData = await processed(pipelineOf([
    new SourceElement('src', { N: 12 }),
    band()
  ]));
  expect(flowData.get('derived').get('Band').value).toBe('High');
  expect(flowData.get('derived').get('band').value).toBe('High');
  expect(flowData.derived.BAND.value).toBe('High');
});

test('a property that cannot be read raises the message when read',
  async () => {
    const flowData = await processed(pipelineOf([
      new SourceElement('src', {}, { supplies: ['N'] }),
      band()
    ]));
    const value = flowData.get('derived').get('Band');
    const message = noBand(
      "element 'src' has no value for 'N': property not present on this " +
      'request');
    expect(value.hasValue).toBe(false);
    expect(value.noValueMessage).toBe(message);
    expect(() => value.value).toThrow(message);
  });

test('the reason an engine gives for a property it lacks is carried',
  async () => {
    class ReasonData extends core.ElementDataDictionary {
      get (key) {
        throw new Error(`The property ${key} is not in the resource key.`);
      }
    }
    class Engine extends SourceElement {
      processInternal (flowData) {
        flowData.setElementData(
          new ReasonData({ flowElement: this, contents: {} }));
      }
    }
    const flowData = await processed(pipelineOf([
      new Engine('src', {}, { supplies: ['N'] }),
      band()
    ]));
    expect(flowData.get('derived').get('Band').noValueMessage).toBe(noBand(
      "element 'src' has no value for 'N': The property N is not in the " +
      'resource key.'));
  });

test('a source value with its own message carries it', async () => {
  const value = await bandFor({ NoValue: 'The JavaScript has not run.' });
  expect(value.noValueMessage).toBe(noBand(
    "element 'src' has no value for 'N': The JavaScript has not run."));
});

test('a source value with no message reads as not present', async () => {
  const value = await bandFor({ NoValue: '' });
  expect(value.noValueMessage).toBe(noBand(
    "element 'src' has no value for 'N': property not present on this " +
    'request'));
});

test('a weighted list gives the heaviest value, the first of two equal',
  async () => {
    // As on-premise IP Intelligence gives a weighted list.
    expect((await bandFor([
      { value: 5, weight: 0.2, rawWeight: 13107 },
      { value: 15, weight: 0.8, rawWeight: 52428 }
    ])).value).toBe('High');
    // As the cloud gives one.
    expect((await bandFor([
      { value: 15, weight: 0.4 },
      { value: 5, weight: 0.6 }
    ])).value).toBe('Low');
    expect((await bandFor([
      { value: 15, rawWeight: 100 },
      { value: 5, rawWeight: 100 }
    ])).value).toBe('High');
  });

test('a list that is not weighted cannot be read', async () => {
  const value = await bandFor([5, 15]);
  expect(value.noValueMessage).toBe(
    noBand('held a list where a single value is needed'));
});

test('a value that is not a number cannot be read as one', async () => {
  const value = await bandFor('Unknown');
  expect(value.noValueMessage).toBe(
    noBand("held 'Unknown' which cannot be read as int"));
});

test('no element data for a source is logged once', async () => {
  // The element supplying src.N runs after the derived property element.
  const pipeline = pipelineOf([
    band(),
    new SourceElement('src', { N: 12 })
  ]);
  const errors = [];
  pipeline.on('error', message => errors.push(message));
  const first = await processed(pipeline);
  await processed(pipeline);
  expect(first.get('derived').get('Band').hasValue).toBe(false);
  expect(errors).toEqual([
    "The script 'Band' reads 'src.N', and the request carried no element " +
    "data 'src' at all, so the script has no value. The usual cause is " +
    'the element that supplies it running after this element rather than ' +
    'before it. This is reported once.'
  ]);
});

test('building the pipeline logs what each script produces', async () => {
  const pipeline = pipelineOf([new SourceElement('src', { N: 1 }), band()]);
  const info = [];
  const debug = [];
  pipeline.on('info', message => info.push(message));
  pipeline.on('debug', message => debug.push(message));
  await logged();
  expect(info).toContain("Derived property script 'Band' version 1.0.0, " +
    "format 1, from code, produces 'derived.Band' as string.");
  const compiled = debug.find(message => message.startsWith(
    "Derived property script 'Band' compiled to "));
  const json = JSON.parse(compiled.slice(compiled.indexOf('{')));
  expect(json.Properties).toEqual({ 'src.N': { Type: 'int' } });
  expect(json.Output.Dependencies).toEqual(['src.N']);
});

test('a deprecated script logs a warning with its note', async () => {
  const element = new DerivedPropertyElementBuilder()
    .addScript('Band', bandScript('Band', 'src.N', {
      extra: 'Deprecated: true\nDeprecationNote: Use BandTwo instead.'
    }))
    .build();
  const pipeline = pipelineOf([new SourceElement('src', { N: 1 }), element]);
  const warnings = [];
  pipeline.on('warn', message => warnings.push(message));
  await logged();
  expect(warnings).toEqual([
    "Derived property script 'Band' is deprecated. Use BandTwo instead."
  ]);
});

test('a later script reads what an earlier one wrote', async () => {
  const element = new DerivedPropertyElementBuilder()
    .addScript('Band', bandScript('Band', 'src.N'))
    .addScript('BandIsHigh', BAND_IS_HIGH)
    .build();
  const flowData = await processed(pipelineOf([
    new SourceElement('src', { N: 12 }),
    element
  ]));
  // A bool output is a boolean.
  expect(flowData.get('derived').get('BandIsHigh').value).toBe(true);
});

describe('settings', () => {
  let folder;

  beforeAll(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'derived-'));
    fs.writeFileSync(path.join(folder, 'Band.yaml'),
      bandScript('Band', 'src.N'));
    fs.writeFileSync(path.join(folder, 'Other.yaml'),
      bandScript('Other', 'src.N'));
    fs.writeFileSync(path.join(folder, 'notes.txt'), 'not a script');
    fs.mkdirSync(path.join(folder, 'with,comma'));
    fs.writeFileSync(path.join(folder, 'with,comma', 'Third.yaml'),
      bandScript('Third', 'src.N'));
  });

  afterAll(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  test('name built in scripts and files, in any case', () => {
    const element = new DerivedPropertyElement({
      Scripts: 'isgdpr, HumanConfidence',
      SCRIPTFILES: `${path.join(folder, '*.yaml')}, ` +
        `"${path.join(folder, 'with,comma', 'Third.yaml')}"`
    });
    expect(element.scripts.map(script => script.name))
      .toEqual(['IsGdpr', 'HumanConfidence', 'Band', 'Other', 'Third']);
    expect(element.scripts[0].source).toBe('built in IsGdpr');
    expect(element.scripts[2].source).toBe(path.join(folder, 'Band.yaml'));
  });

  test('may be lists of strings', () => {
    const element = new DerivedPropertyElement({
      scripts: ['IsGdpr'],
      scriptFiles: [path.join(folder, 'Band.yaml')]
    });
    expect(element.scripts.map(script => script.name))
      .toEqual(['IsGdpr', 'Band']);
  });

  test('a setting the element does not have is refused', () => {
    expect(() => new DerivedPropertyElement({ script: 'IsGdpr' }))
      .toThrow("The derived property element has no setting 'script'. " +
        'Its settings are scripts and scriptFiles.');
  });

  test('a file or folder that is not there is a fault', () => {
    const missing = path.join(folder, 'Missing.yaml');
    expect(() => new DerivedPropertyElement({ scriptFiles: missing }))
      .toThrow(ScriptValidationError);
    expect(() => new DerivedPropertyElement({
      scriptFiles: path.join(folder, 'nowhere', '*.yaml')
    })).toThrow('does not exist');
  });
});

test('a pipeline configuration builds the element', async () => {
  const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
    .buildFromConfiguration({
      PipelineOptions: {
        Elements: [
          { elementName: path.join(__dirname, 'countryElement.js') },
          {
            elementName:
              'fiftyone.pipeline.derivedproperty/derivedPropertyElement',
            elementParameters: { Scripts: 'IsGdpr' }
          }
        ]
      }
    });
  const flowData = await processed(pipeline);
  expect(flowData.get('derived').get('IsGdpr').value).toBe(true);
});

test('faults in every script are reported together', () => {
  let error;
  try {
    new DerivedPropertyElementBuilder()
      .addScript('One', bandScript('One', 'src.N').replace('Ge: 10', 'Gx: 10'))
      .addScript('Two', bandScript('Two', 'N'))
      .addBuiltInScript('Nothing')
      .build();
  } catch (thrown) {
    error = thrown;
  }
  expect(error).toBeInstanceOf(ScriptValidationError);
  expect([...new Set(error.faults.map(fault => fault.script))])
    .toEqual(['One', 'Two', 'Nothing']);
  expect(error.message).toContain("unknown operator 'Gx'");
  expect(error.message).toContain("'N' is not a source property");
  expect(error.message).toContain("there is no script called 'Nothing'");
});

test('an element with no script is refused', () => {
  expect(() => new DerivedPropertyElement())
    .toThrow('At least one script must be configured.');
});

test('two scripts in one element cannot write one property', () => {
  const builder = new DerivedPropertyElementBuilder()
    .addScript('Band', bandScript('Band', 'src.N'))
    .addScript('BandTwo', bandScript('BandTwo', 'src.N')
      .replace('  Name: BandTwo', '  Name: Band'));
  expect(() => builder.build()).toThrow(
    "two scripts in the same element write the property 'Band', being " +
    "'Band' and 'BandTwo'. One element writes each property once");
});

test('the property metadata is the Output block', async () => {
  const element = band();
  expect(element.getProperties()).toEqual({
    Band: {
      name: 'Band',
      type: 'string',
      category: 'Testing',
      description: 'Whether a number is ten or more.',
      isList: false,
      dependencies: ['src.N']
    }
  });
  const pipeline = pipelineOf([new SourceElement('src', { N: 12 }), element]);
  const flowData = await processed(pipeline);
  expect(Object.keys(flowData.getWhere('category', 'Testing')))
    .toEqual(['Band']);
});

test('the JSON bundler carries the values of every derived element',
  async () => {
    const pipeline = pipelineOf([
      new SourceElement('src', { N: 12 }),
      band(),
      new DerivedPropertyElementBuilder()
        .addScript('BandIsHigh', BAND_IS_HIGH)
        .build()
    ], {
      addJavaScriptBuilder: true,
      addJavaScriptBuilderElement: false
    });
    const flowData = await processed(pipeline);
    const json = flowData.get('jsonbundler').get('json');
    // Both derived property elements write one element data, and each
    // gives the properties of both.
    expect(json.derived.band).toBe('High');
    expect(json.derived.bandishigh).toBe(true);
    expect(Object.keys(pipeline.getElement('derived').getProperties()).sort())
      .toEqual(['Band', 'BandIsHigh']);
  });

test('the element accepts no evidence', () => {
  expect(band().evidenceKeyFilter.filterEvidence({
    'header.user-agent': 'x',
    'query.n': '12'
  })).toEqual({});
});
