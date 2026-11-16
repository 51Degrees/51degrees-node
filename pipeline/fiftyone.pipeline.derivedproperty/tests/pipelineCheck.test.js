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
 * The checks run when a pipeline adds the element, following
 * docs/authoring.md of derived-properties, "What the pipeline checks when
 * the element is added", and the tests of the same check in the .NET,
 * Rust and PHP elements.
 */

const core = require('fiftyone.pipeline.core');
const DerivedPropertyElementBuilder =
  require('../derivedPropertyElementBuilder');
const { PipelineConfigurationError } = require('../errors');
const { SourceElement, bandScript } = require('./helpers');

/**
 * The HumanConfidence element.
 *
 * @returns {object} the element.
 */
function humanConfidence () {
  return new DerivedPropertyElementBuilder()
    .addBuiltInScript('HumanConfidence')
    .build();
}

/**
 * The names of the properties HumanConfidence reads under one key.
 *
 * @param {string} key the element data key.
 * @returns {string[]} the property names.
 */
function readByHumanConfidence (key) {
  return humanConfidence().scripts[0].properties
    .map(property => property.name.split('.'))
    .filter(([elementKey]) => elementKey === key)
    .map(([, name]) => name);
}

/**
 * An element supplying properties under a key, with no values.
 *
 * @param {string} key the element data key.
 * @param {string[]} names the property names.
 * @returns {object} the element.
 */
function supplier (key, names) {
  return new SourceElement(key, {}, { supplies: names });
}

/**
 * One derived property element, writing a band from each source.
 *
 * @param {object} scripts the source each script reads, by script name.
 * @returns {object} the element.
 */
function derived (scripts) {
  const builder = new DerivedPropertyElementBuilder();
  for (const [name, source] of Object.entries(scripts)) {
    builder.addScript(name, bandScript(name, source));
  }
  return builder.build();
}

/**
 * The line for a property nothing supplies.
 *
 * @param {string} script the script.
 * @param {string} property the property.
 * @returns {string} the line.
 */
function needs (script, property) {
  return `The script '${script}' needs the property '${property}', and no ` +
    'element in the pipeline supplies it. Either add the element that ' +
    `supplies '${property}', or change the script so that it does not ` +
    `name '${property}'.`;
}

/**
 * The line for a property two elements write.
 *
 * @param {string} script the script.
 * @param {string} output the property.
 * @returns {string} the line.
 */
function writes (script, output) {
  return `The script '${script}' writes the derived property '${output}', ` +
    'and another element in the pipeline already writes a property of ' +
    'that name. One pipeline writes each derived property once.';
}

/**
 * The faults building a pipeline of the elements gives.
 *
 * @param {object[]} elements the elements.
 * @returns {string[]|null} the faults, or null where it was built.
 */
function faults (elements) {
  try {
    // eslint-disable-next-line no-new
    new core.Pipeline(elements);
  } catch (error) {
    expect(error).toBeInstanceOf(PipelineConfigurationError);
    expect(error.message).toBe('The derived property element cannot be ' +
      'used in this pipeline.\n' + error.faults.join('\n'));
    return error.faults;
  }
  return null;
}

test('a pipeline supplying nothing names every property', () => {
  const properties = humanConfidence().scripts[0].properties;
  expect(properties.length).toBeGreaterThan(0);
  expect(faults([humanConfidence()])).toEqual(properties.map(
    property => needs('HumanConfidence', property.name)));
});

test('suppliers may sit anywhere in the pipeline', () => {
  expect(faults([
    supplier('device', readByHumanConfidence('device')),
    humanConfidence(),
    supplier('ip', readByHumanConfidence('ip'))
  ])).toBeNull();
  expect(faults([
    humanConfidence(),
    supplier('device', readByHumanConfidence('device')),
    supplier('ip', readByHumanConfidence('ip'))
  ])).toBeNull();
});

test('elements running in parallel are checked too', () => {
  expect(faults([
    [
      supplier('device', readByHumanConfidence('device')),
      supplier('ip', readByHumanConfidence('ip'))
    ],
    humanConfidence()
  ])).toBeNull();
});

test('keys and names are compared ignoring case', () => {
  expect(faults([
    supplier('DEVICE', readByHumanConfidence('device')
      .map(name => name.toLowerCase())),
    supplier('Ip', readByHumanConfidence('ip')
      .map(name => name.toUpperCase())),
    humanConfidence()
  ])).toBeNull();
});

test('a property listed under another key is not supplied', () => {
  expect(faults([
    supplier('device', readByHumanConfidence('device')),
    supplier('location', readByHumanConfidence('ip')),
    humanConfidence()
  ])).toEqual(readByHumanConfidence('ip')
    .map(name => needs('HumanConfidence', `ip.${name}`)));
});

test('an element listing no properties may supply any of its own', () => {
  // A cloud engine learns its properties from the cloud service after the
  // pipeline is built.
  expect(faults([
    supplier('device', readByHumanConfidence('device')),
    supplier('ip', []),
    humanConfidence()
  ])).toBeNull();
  expect(faults([
    supplier('ip', []),
    humanConfidence()
  ])).toEqual(readByHumanConfidence('device')
    .map(name => needs('HumanConfidence', `device.${name}`)));
});

test('an element whose properties are still to come may supply any', () => {
  const later = supplier('ip', []);
  later.getProperties = () => Promise.resolve({});
  expect(faults([
    supplier('device', readByHumanConfidence('device')),
    later,
    humanConfidence()
  ])).toBeNull();
});

test('two elements writing one derived property are refused', () => {
  expect(faults([
    supplier('src', ['N']),
    derived({ Demo: 'src.N' }),
    derived({ Demo: 'src.N' })
  ])).toEqual([writes('Demo', 'Demo')]);
});

test('a script may read what an earlier script of its element writes', () => {
  expect(faults([
    supplier('src', ['N']),
    derived({ Band: 'src.N', BandIsHigh: 'derived.Band' })
  ])).toBeNull();
  // A later script's property has no value when an earlier one reads it.
  expect(faults([
    supplier('src', ['N']),
    derived({ BandIsHigh: 'derived.Band', Band: 'src.N' })
  ])).toEqual([needs('BandIsHigh', 'derived.Band')]);
  // A script's own property is not there when it runs either.
  expect(faults([derived({ Demo: 'derived.Demo' })]))
    .toEqual([needs('Demo', 'derived.Demo')]);
});

test('another derived element supplies what it writes wherever it sits',
  () => {
    expect(faults([
      supplier('src', ['N']),
      derived({ BandIsHigh: 'derived.Band' }),
      derived({ Band: 'src.N' })
    ])).toBeNull();
  });

test('properties written twice come before those not supplied', () => {
  expect(faults([
    derived({ Demo: 'gone.N' }),
    derived({ Demo: 'src.N' })
  ])).toEqual([writes('Demo', 'Demo'), needs('Demo', 'gone.N')]);
});
