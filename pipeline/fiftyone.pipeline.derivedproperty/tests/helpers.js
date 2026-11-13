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

const fs = require('fs');
const path = require('path');
const core = require('fiftyone.pipeline.core');

/** The derived-properties submodule. */
const SUBMODULE = path.join(__dirname, '..', 'derived-properties');

/**
 * A value as a case file writes it, as a 51Degrees element gives it. A
 * value with a no value message is an AspectPropertyValue without a
 * value, and a weighted list has the value and weight fields the cloud
 * engines give.
 *
 * @param {*} value the value as the case file writes it.
 * @param {boolean} wrap whether a value is wrapped in an
 *   AspectPropertyValue, as the engines give it, or given as it is.
 * @returns {*} the value as an element gives it.
 */
function asElementGives (value, wrap) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if ('NoValue' in value) {
      return new core.AspectPropertyValue(value.NoValue);
    }
    if ('String' in value) {
      return wrap
        ? new core.AspectPropertyValue(null, value.String)
        : value.String;
    }
  }
  if (Array.isArray(value) && wrap) {
    const list = value.map(member =>
      member !== null && typeof member === 'object' && 'Value' in member
        ? { value: member.Value, weight: member.Weight }
        : member);
    return new core.AspectPropertyValue(null, list);
  }
  return wrap ? new core.AspectPropertyValue(null, value) : value;
}

/**
 * An element giving fixed values under one element data key, as plain
 * element data. It lists the properties it supplies, which need not be
 * the ones it has a value for.
 */
class SourceElement extends core.FlowElement {
  /**
   * Holds the values to give.
   *
   * @param {string} dataKey the element data key.
   * @param {object} values the values by property name, as a case file
   *   writes them.
   * @param {object} [options] the options.
   * @param {string[]} [options.supplies] the property names to list,
   *   which default to the names of the values.
   * @param {boolean} [options.wrap] whether values are wrapped in an
   *   AspectPropertyValue, which defaults to true.
   */
  constructor (dataKey, values, { supplies, wrap = true } = {}) {
    super({ dataKey });
    this.values = values;
    this.wrap = wrap;
    this.properties = {};
    for (const name of supplies ?? Object.keys(values)) {
      this.properties[name] = { name, type: 'string' };
    }
  }

  /**
   * Writes the values.
   *
   * @param {object} flowData the flow data being processed.
   */
  processInternal (flowData) {
    const contents = {};
    for (const [name, value] of Object.entries(this.values)) {
      contents[name] = asElementGives(value, this.wrap);
    }
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents
    }));
  }
}

/**
 * The text of a small script reading one source property.
 *
 * @param {string} name the script name, which is also its output.
 * @param {string} property the source property, such as src.N.
 * @param {object} [options] the options.
 * @param {string} [options.version] the script version.
 * @param {string} [options.extra] more top level lines.
 * @returns {string} the script as YAML.
 */
function bandScript (name, property, { version = '1.0.0', extra = '' } = {}) {
  return [
    'Format: 1',
    `Name: ${name}`,
    `Version: ${version}`,
    extra,
    'Output:',
    `  Name: ${name}`,
    '  Description: Whether a number is ten or more.',
    '  ValueType: string',
    '  IsList: false',
    '  Category: Testing',
    'Rules:',
    `  - When: { Property: ${property}, Ge: 10 }`,
    '    Then: High',
    '  - Else: Low',
    ''
  ].filter(line => line !== '').join('\n');
}

/**
 * Builds a pipeline holding the elements given, with nothing added.
 *
 * @param {object[]} elements the elements, in order.
 * @param {object} [settings] more settings for the pipeline builder.
 * @returns {object} the pipeline.
 */
function pipelineOf (elements, settings = {}) {
  const builder = new core.PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false,
    ...settings
  });
  for (const element of elements) builder.add(element);
  return builder.build();
}

/**
 * Processes a request through a pipeline.
 *
 * @param {object} pipeline the pipeline.
 * @returns {Promise<object>} the flow data.
 */
async function processed (pipeline) {
  const flowData = pipeline.createFlowData();
  await flowData.process();
  return flowData;
}

/**
 * Reads a YAML file in the submodule.
 *
 * @param {...string} parts the path within the submodule.
 * @returns {string} the text.
 */
function submoduleText (...parts) {
  return fs.readFileSync(path.join(SUBMODULE, ...parts), 'utf8');
}

module.exports = {
  SUBMODULE,
  SourceElement,
  asElementGives,
  bandScript,
  pipelineOf,
  processed,
  submoduleText
};
