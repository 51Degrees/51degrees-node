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

const core = require('fiftyone.pipeline.core');
const { evaluate } = require('./lib/evaluate');
const { canonical } = require('./lib/canonical');
const { ScriptSet } = require('./scriptSet');
const DerivedPropertyData = require('./derivedPropertyData');
const {
  ScriptValidationError,
  PipelineConfigurationError
} = require('./errors');

const FlowElement = core.FlowElement;
const AspectPropertyValue = core.AspectPropertyValue;
const ElementData = core.ElementData;

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 */

/** The element data key every derived property element writes under. */
const DATA_KEY = 'derived';

/** The settings the element takes, matched without regard to case. */
const SETTINGS = ['scripts', 'scriptFiles'];

/** The reason given where a source property is simply not there. */
const NOT_PRESENT = 'property not present on this request';

/**
 * The Output fields given in each property's metadata beyond the name,
 * type, category, description and isList every element gives, with the
 * names the metadata uses for them.
 */
const OUTPUT_METADATA = [
  ['StoredValueType', 'storedValueType'],
  ['DefaultValue', 'defaultValue'],
  ['IsMandatory', 'isMandatory'],
  ['IsObsolete', 'isObsolete'],
  ['IsPopular', 'isPopular'],
  ['ExportValues', 'exportValues'],
  ['Url', 'url'],
  ['DisplayOrder', 'displayOrder'],
  ['PropertyId', 'propertyId'],
  ['VendorIds', 'vendorIds'],
  ['Dependencies', 'dependencies'],
  ['Values', 'values']
];

/**
 * Computes new properties from properties other elements have already
 * put into the flow data, following one or more scripts in the format of
 * the derived-properties repository. Every script writes one property
 * under the element data key `derived`.
 *
 * The element holds no data file, sends no request and reads no evidence,
 * so it accepts no evidence.
 */
class DerivedPropertyElement extends FlowElement {
  /**
   * Builds the element from its settings, as a pipeline configuration
   * file gives them, and from scripts a builder has already read.
   *
   * @param {object} [settings] `scripts` names scripts built into this
   *   package and `scriptFiles` gives paths to script files, where a file
   *   name may hold a wildcard. Each is a list of strings, or one string
   *   with commas between the entries, where an entry holding a comma is
   *   wrapped in double quotes. The names are matched without regard to
   *   case, and any other setting is refused.
   * @param {object[]} [scripts] scripts read by
   *   DerivedPropertyElementBuilder.
   * @throws {ScriptValidationError} where a script does not validate, or
   *   two scripts write one property.
   */
  constructor (settings = {}, scripts = []) {
    super({ dataKey: DATA_KEY });
    const set = new ScriptSet();
    readSettings(settings, set);
    this.scripts = set.compile().concat(scripts);
    if (this.scripts.length === 0) {
      throw new Error('At least one script must be configured. Name the ' +
        'scripts built into this package with the scripts setting, give ' +
        'script files with scriptFiles, or use ' +
        'DerivedPropertyElementBuilder.');
    }
    checkOutputNamesAreUnique(this.scripts);

    /**
     * The metadata of the properties this element writes, which is the
     * Output block of each script.
     *
     * @type {object}
     */
    this.scriptProperties = {};
    for (const script of this.scripts) {
      this.scriptProperties[script.output.Name] = metadata(script);
    }
    this.properties = this.scriptProperties;

    // The scripts that have reported a missing element data, as that is
    // reported once rather than on every request.
    this.reported = new Set();
  }

  /**
   * The properties written under `derived`, being those of every derived
   * property element in the pipelines this one is in. They all write one
   * element data, which the pipeline knows by its key, so each element
   * gives them all.
   *
   * @returns {object} the metadata of each property, by name.
   */
  getProperties () {
    const properties = {};
    for (const pipeline of this.pipelines) {
      for (const element of flatten(pipeline.flowElementsChain)) {
        if (element !== this && isDerivedElement(element)) {
          Object.assign(properties, element.scriptProperties);
        }
      }
    }
    return Object.assign(properties, this.scriptProperties);
  }

  /**
   * Refuses a pipeline that cannot supply a property a script reads, or
   * in which another element writes a property a script writes, then
   * logs what each script produces.
   *
   * @param {Pipeline} pipeline the pipeline the element is added to.
   * @param {FlowElement} flowElement this element.
   * @throws {PipelineConfigurationError} where the pipeline cannot be
   *   used.
   */
  onRegistration (pipeline, flowElement) {
    super.onRegistration(pipeline, flowElement);
    this.checkPipeline(pipeline);
    // The pipeline is still being built, so nothing can be listening to
    // its log yet. The lines are written once the code that built it has
    // had the chance to add its listeners.
    process.nextTick(() => this.logScripts(pipeline));
  }

  /**
   * Runs every script in order, so a script can read what an earlier
   * one wrote.
   *
   * @param {FlowData} flowData the flow data being processed.
   */
  processInternal (flowData) {
    // Every derived property element in a pipeline writes one element
    // data, as the properties of all of them are under `derived`.
    let data = flowData.data[DATA_KEY];
    if (!(data instanceof DerivedPropertyData)) {
      data = new DerivedPropertyData({ flowElement: this, contents: {} });
      flowData.setElementData(data);
    }
    this.scripts.forEach((script, index) => {
      const properties = {};
      for (const property of script.properties) {
        const value = this.readSource(flowData, script, index, property);
        if (value !== undefined) {
          properties[property.name] = value;
        }
      }
      const result = evaluate(script, properties);
      data.contents[script.output.Name] = result.value === undefined
        ? new AspectPropertyValue(result.message)
        : new AspectPropertyValue(null, result.value);
    });
  }

  // -------------------------------------------------------------------
  // Reading source properties.
  // -------------------------------------------------------------------

  /**
   * Reads one source property for one request, in the form the evaluator
   * takes. A value with no value of its own becomes `{ NoValue: reason }`
   * and a weighted list becomes a list of `{ Value, Weight }`.
   *
   * @param {FlowData} flowData the flow data being processed.
   * @param {object} script the script reading the property.
   * @param {number} index the position of the script in the element.
   * @param {object} property the source property.
   * @returns {*} the value, or undefined where there is no element data
   *   for the property at all.
   */
  readSource (flowData, script, index, property) {
    const dot = property.name.indexOf('.');
    const key = property.name.slice(0, dot);
    const name = property.name.slice(dot + 1);

    const elementData = findElementData(flowData, key);
    if (elementData === undefined) {
      this.reportMissingElementData(flowData, script, index, property, key);
      return undefined;
    }

    let raw;
    try {
      raw = elementData.get(name);
    } catch (error) {
      // An element that does not have the property says why where it can,
      // and that reason is carried. Plain element data only says the
      // property is not there.
      const message = messageOf(error);
      const plain = elementData.get === ElementData.prototype.get;
      return { NoValue: plain || message === '' ? NOT_PRESENT : message };
    }

    // A source value with its own no value state hands its message on,
    // so the reason reaches back to the element that knows it.
    if (isAspectPropertyValue(raw)) {
      if (!raw.hasValue) {
        const message = typeof raw.noValueMessage === 'string'
          ? raw.noValueMessage
          : '';
        return { NoValue: message === '' ? NOT_PRESENT : message };
      }
      raw = raw.value;
    }
    if (Array.isArray(raw)) {
      return weighted(raw);
    }
    return raw;
  }

  /**
   * Reports, once for each script, that a request carried no element data
   * at all under a key the pipeline has an element for, which means that
   * element ran after this one.
   *
   * @param {FlowData} flowData the flow data being processed.
   * @param {object} script the script.
   * @param {number} index the position of the script in the element.
   * @param {object} property the source property.
   * @param {string} key the element data key.
   */
  reportMissingElementData (flowData, script, index, property, key) {
    if (this.reported.has(index)) return;
    this.reported.add(index);
    flowData.pipeline.log('error',
      `The script '${script.name}' reads '${property.name}', and the ` +
      `request carried no element data '${key}' at all, so the script has ` +
      'no value. The usual cause is the element that supplies it running ' +
      'after this element rather than before it. This is reported once.');
  }

  // -------------------------------------------------------------------
  // Building the pipeline.
  // -------------------------------------------------------------------

  /**
   * Logs one line for each script at information level, a warning for a
   * deprecated one, and the compiled script as canonical JSON at debug
   * level.
   *
   * @param {Pipeline} pipeline the pipeline.
   */
  logScripts (pipeline) {
    for (const script of this.scripts) {
      pipeline.log('info',
        `Derived property script '${script.name}' version ` +
        `${script.version}, format ${script.format}, from ${script.source}, ` +
        `produces '${DATA_KEY}.${script.output.Name}' as ` +
        `${script.output.ValueType}.`);
      if (script.deprecated) {
        pipeline.log('warn',
          `Derived property script '${script.name}' is deprecated. ` +
          script.deprecationNote);
      }
      pipeline.log('debug',
        `Derived property script '${script.name}' compiled to ` +
        canonical(script));
    }
  }

  /**
   * The checks run when the pipeline adds the element. Where an element
   * sits is not judged, because a pipeline holding elements that run in
   * parallel does not say what runs before what.
   *
   * @param {Pipeline} pipeline the pipeline.
   * @throws {PipelineConfigurationError} where the pipeline cannot be
   *   used.
   */
  checkPipeline (pipeline) {
    const others = flatten(pipeline.flowElementsChain)
      .filter(element => element !== this);
    const faults = [];

    for (const script of this.scripts) {
      const outputName = script.output.Name;
      const collides = others.some(element =>
        sameKey(element.dataKey, DATA_KEY) &&
        supplies(element, outputName) === true);
      if (collides) {
        faults.push(`The script '${script.name}' writes the derived ` +
          `property '${outputName}', and another element in the pipeline ` +
          'already writes a property of that name. One pipeline writes ' +
          'each derived property once.');
      }
    }

    this.scripts.forEach((script, index) => {
      for (const property of script.properties) {
        if (this.isSupplied(others, property, index)) continue;
        // Every property a script names is needed, so a pipeline that
        // cannot supply one would give no value on every request.
        faults.push(`The script '${script.name}' needs the property ` +
          `'${property.name}', and no element in the pipeline supplies it. ` +
          `Either add the element that supplies '${property.name}', or ` +
          'change the script so that it does not name ' +
          `'${property.name}'.`);
      }
    });

    if (faults.length > 0) {
      throw new PipelineConfigurationError(faults);
    }
  }

  /**
   * Whether a source property has an element to supply it.
   *
   * @param {FlowElement[]} others the other elements in the pipeline.
   * @param {object} property the source property.
   * @param {number} index the position of the script reading it.
   * @returns {boolean} whether it is supplied.
   */
  isSupplied (others, property, index) {
    const dot = property.name.indexOf('.');
    const key = property.name.slice(0, dot);
    const name = property.name.slice(dot + 1);
    // A script can read what an earlier script of this element writes,
    // and nothing that a later one writes, as the scripts run in order.
    if (sameKey(key, DATA_KEY)) {
      for (let i = 0; i < index; i++) {
        if (sameKey(this.scripts[i].output.Name, name)) return true;
      }
    }
    return others.some(element =>
      sameKey(element.dataKey, key) && supplies(element, name) !== false);
  }
}

/** The element data key every derived property element writes under. */
DerivedPropertyElement.DATA_KEY = DATA_KEY;

// ---------------------------------------------------------------------
// Settings and metadata.
// ---------------------------------------------------------------------

/**
 * Adds the scripts the settings name.
 *
 * @param {object} settings the settings.
 * @param {ScriptSet} set the scripts so far.
 */
function readSettings (settings, set) {
  if (settings === null || settings === undefined) return;
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('The settings of a derived property element are ' +
      'an object holding scripts and scriptFiles.');
  }
  for (const key of Object.keys(settings)) {
    const setting = SETTINGS.find(
      name => name.toLowerCase() === key.toLowerCase());
    if (setting === undefined) {
      // A setting written wrongly would otherwise leave its scripts out
      // without a word.
      throw new Error(`The derived property element has no setting '${key}'. ` +
        `Its settings are ${SETTINGS.join(' and ')}.`);
    }
    for (const entry of listSetting(setting, settings[key])) {
      if (setting === 'scripts') {
        set.addBuiltIn(entry);
      } else {
        set.addFiles(entry);
      }
    }
  }
}

/**
 * The entries of a list setting.
 *
 * @param {string} name the setting.
 * @param {*} value a list of strings, or one string with commas between
 *   the entries.
 * @returns {string[]} the entries.
 */
function listSetting (name, value) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : split(value);
  }
  if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) {
    return value;
  }
  throw new TypeError(`The ${name} setting must be a list of strings, or ` +
    'one string with commas between the entries.');
}

/**
 * Splits a setting on its commas, where an entry wrapped in double quotes
 * may hold a comma, and two double quotes inside the quotes are one.
 *
 * @param {string} value the setting.
 * @returns {string[]} the entries, trimmed.
 */
function split (value) {
  const entries = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (character === '"') {
      if (quoted && value[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      entries.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  entries.push(current.trim());
  return entries;
}

/**
 * Refuses two scripts in one element writing one property.
 *
 * @param {object[]} scripts the scripts.
 * @throws {ScriptValidationError} where two write one property.
 */
function checkOutputNamesAreUnique (scripts) {
  const seen = new Map();
  const faults = [];
  for (const script of scripts) {
    const key = script.output.Name.toLowerCase();
    if (seen.has(key)) {
      faults.push({
        script: script.name,
        source: script.source,
        path: 'Output.Name',
        line: null,
        message: 'two scripts in the same element write the property ' +
          `'${script.output.Name}', being '${seen.get(key)}' and ` +
          `'${script.name}'. One element writes each property once`
      });
      continue;
    }
    seen.set(key, script.name);
  }
  if (faults.length > 0) {
    throw new ScriptValidationError(faults);
  }
}

/**
 * The metadata of the property a script writes, with the keys the other
 * elements give followed by the rest of the Output block.
 *
 * @param {object} script the script.
 * @returns {object} the metadata.
 */
function metadata (script) {
  const output = script.output;
  const result = {
    name: output.Name,
    type: output.ValueType,
    category: output.Category ?? '',
    description: output.Description,
    isList: false
  };
  for (const [field, key] of OUTPUT_METADATA) {
    if (output[field] !== undefined && output[field] !== null) {
      result[key] = output[field];
    }
  }
  return result;
}

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

/**
 * Every element in a pipeline's chain, with the groups that run in
 * parallel opened out.
 *
 * @param {Array} chain the chain.
 * @returns {FlowElement[]} the elements.
 */
function flatten (chain) {
  const elements = [];
  for (const item of chain || []) {
    if (Array.isArray(item)) {
      elements.push(...flatten(item));
    } else if (item) {
      elements.push(item);
    }
  }
  return elements;
}

/**
 * Whether an element is a derived property element, from this copy of
 * the package or another.
 *
 * @param {FlowElement} element the element.
 * @returns {boolean} whether it is.
 */
function isDerivedElement (element) {
  return sameKey(element.dataKey, DATA_KEY) &&
    element.scriptProperties !== null &&
    typeof element.scriptProperties === 'object';
}

/**
 * Whether two names are the same without regard to case.
 *
 * @param {*} a a name.
 * @param {*} b another name.
 * @returns {boolean} whether they are the same.
 */
function sameKey (a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    a.toLowerCase() === b.toLowerCase();
}

/**
 * Whether an element gives a property, or null where it does not know
 * yet. A cloud engine learns its properties from the cloud service after
 * the pipeline is built, so an element listing no properties may give any
 * property under its key.
 *
 * @param {FlowElement} element the element.
 * @param {string} name the property name.
 * @returns {boolean|null} whether it gives the property, or null.
 */
function supplies (element, name) {
  let properties;
  try {
    // Another derived property element is asked only for what it writes
    // itself.
    properties = isDerivedElement(element)
      ? element.scriptProperties
      : element.getProperties();
  } catch (error) {
    return null;
  }
  if (properties === null || typeof properties !== 'object' ||
    typeof properties.then === 'function') {
    return null;
  }
  const keys = Object.keys(properties);
  if (keys.length === 0) return null;
  return keys.some(key => sameKey(key, name) ||
    (properties[key] !== null && typeof properties[key] === 'object' &&
      sameKey(properties[key].name, name)));
}

/**
 * The element data under a key, matched without regard to case.
 *
 * @param {FlowData} flowData the flow data.
 * @param {string} key the element data key.
 * @returns {object|undefined} the element data.
 */
function findElementData (flowData, key) {
  const data = flowData.data;
  if (data[key] !== undefined) return data[key];
  const found = Object.keys(data).find(dataKey => sameKey(dataKey, key));
  return found === undefined ? undefined : data[found];
}

/**
 * Whether a value is an AspectPropertyValue, from this copy of the
 * pipeline core or another.
 *
 * @param {*} value the value.
 * @returns {boolean} whether it is.
 */
function isAspectPropertyValue (value) {
  return value instanceof AspectPropertyValue ||
    (value !== null && typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'hasValue'));
}

/**
 * A list as the evaluator takes it. A list of weighted values, whose
 * members each carry a value and a weight as 51Degrees elements give
 * them, becomes a list of `{ Value, Weight }`, using the raw weight where
 * there is one. Any other list is left as it is, which the evaluator
 * refuses where a single value is needed.
 *
 * @param {Array} list the list.
 * @returns {Array} the list for the evaluator.
 */
function weighted (list) {
  const members = list.length > 0 && list.every(member =>
    member !== null && typeof member === 'object' && !Array.isArray(member) &&
    ('value' in member || 'Value' in member));
  if (!members) return list;
  return list.map(member => ({
    Value: 'Value' in member ? member.Value : member.value,
    Weight: weightOf(member)
  }));
}

/**
 * The weight of a member of a weighted list.
 *
 * @param {object} member the member.
 * @returns {number} the raw weight where there is one, else the weight,
 *   else zero.
 */
function weightOf (member) {
  for (const key of ['rawWeight', 'Weight', 'weight']) {
    if (typeof member[key] === 'number') return member[key];
  }
  return 0;
}

/**
 * The text of something thrown.
 *
 * @param {*} error what was thrown.
 * @returns {string} its message, or an empty string.
 */
function messageOf (error) {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return '';
}

module.exports = DerivedPropertyElement;
