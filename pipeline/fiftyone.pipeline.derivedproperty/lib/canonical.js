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
 * Prints a validated model as canonical JSON, which the element writes to
 * the debug log at build so that anyone holding the log can see exactly
 * what was evaluated without the file.
 *
 * The form is PascalCase keys in the order of the format reference, two
 * space indent, literal types preserved, and the two things the model
 * adds to the file, being the inferred type of each source property and
 * the computed Dependencies list.
 *
 * This is `tools/canonical.mjs` of derived-properties as CommonJS, with
 * the same output.
 */

const { OUTPUT_KEYS } = require('./validate');

/**
 * Prints a model as canonical JSON.
 *
 * @param {object} model a model from `validate.js`.
 * @returns {string} canonical JSON, without a trailing newline.
 */
function canonical (model) {
  return JSON.stringify(canonicalObject(model), null, 2);
}

/**
 * The canonical form as an object, before it is printed.
 *
 * @param {object} model a model from `validate.js`.
 * @returns {object} the canonical form.
 */
function canonicalObject (model) {
  const result = {
    Format: model.format,
    Name: model.name,
    Version: model.version
  };
  if (model.deprecated) {
    result.Deprecated = true;
    result.DeprecationNote = model.deprecationNote;
  }
  result.Output = canonicalOutput(model.output);

  // The inferred type of every source property, which the file does not
  // carry because it is worked out from the literals compared against.
  result.Properties = {};
  for (const property of model.properties) {
    result.Properties[property.name] = { Type: property.type };
  }

  if (model.checks.length > 0) {
    result.Checks = {};
    for (const check of model.checks) {
      result.Checks[check.name] = canonicalCondition(check.condition, model);
    }
  }

  result.Rules = model.rules.map(rule => canonicalRule(rule, model));

  return result;
}

/**
 * One rule in canonical form.
 *
 * @param {object} rule a rule of the model.
 * @param {object} model the model.
 * @returns {object} the rule.
 */
function canonicalRule (rule, model) {
  if (rule.when === null) {
    return { Else: rule.value };
  }
  return {
    When: canonicalCondition(rule.when, model),
    Then: rule.value
  };
}

/**
 * The Output block in canonical order.
 *
 * @param {object} output the output of the model.
 * @returns {object} the Output block.
 */
function canonicalOutput (output) {
  const result = {};
  for (const key of OUTPUT_KEYS) {
    if (key === 'Values') continue;
    if (output[key] === undefined || output[key] === null) continue;
    result[key] = output[key];
  }
  if (output.Values !== null && output.Values !== undefined) {
    result.Values = output.Values.map(value => value.Description === null
      ? { Name: value.Name }
      : { Name: value.Name, Description: value.Description });
  }
  return result;
}

/**
 * One condition in canonical form.
 *
 * @param {object} condition a condition of the model.
 * @param {object} model the model.
 * @returns {object} the condition.
 */
function canonicalCondition (condition, model) {
  switch (condition.kind) {
    case 'compare':
      return {
        Property: condition.propertyName,
        [condition.op]: condition.operand
      };
    case 'check':
      return { Check: condition.name };
    case 'aggregate':
      return {
        [condition.agg]: canonicalGroup(condition.group, model),
        [condition.op]: condition.operand
      };
    case 'all':
      return { All: condition.items.map(i => canonicalCondition(i, model)) };
    case 'any':
      return { Any: condition.items.map(i => canonicalCondition(i, model)) };
    case 'not':
      return { Not: canonicalCondition(condition.item, model) };
    default:
      throw new Error(`unknown condition kind '${condition.kind}'`);
  }
}

/**
 * A group in canonical form.
 *
 * @param {number[]|null} group the indexes of the checks, or null.
 * @param {object} model the model.
 * @returns {string|string[]} Checks, or the names of the checks.
 */
function canonicalGroup (group, model) {
  if (group === null) return 'Checks';
  return group.map(index => model.checks[index].name);
}

module.exports = { canonical, canonicalObject };
