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

const DerivedPropertyElement = require('./derivedPropertyElement');
const { ScriptSet } = require('./scriptSet');

/**
 * Builds a DerivedPropertyElement from scripts built into this package,
 * script files, and script text held by code, in any mix. Every fault in
 * every script is reported together when the element is built.
 */
class DerivedPropertyElementBuilder {
  constructor () {
    this.set = new ScriptSet();
  }

  /**
   * Adds a script built into this package.
   *
   * @param {string} name the name of the script in any case, such as
   *   HumanConfidence or IsGdpr.
   * @returns {DerivedPropertyElementBuilder} this builder.
   */
  addBuiltInScript (name) {
    this.set.addBuiltIn(name);
    return this;
  }

  /**
   * Adds a script file, or every file a wildcard in the file name
   * matches. The script's Name must equal the file name without its
   * extension.
   *
   * @param {string} path the path, which may hold `*` or `?` in the
   *   file name.
   * @returns {DerivedPropertyElementBuilder} this builder.
   */
  addScriptFile (path) {
    this.set.addFiles(path);
    return this;
  }

  /**
   * Adds a script held as text by your own code, as YAML or JSON.
   *
   * @param {string} name the name to know the script by, which the
   *   script's own Name must equal.
   * @param {string} text the script.
   * @returns {DerivedPropertyElementBuilder} this builder.
   */
  addScript (name, text) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError('A script added from code needs its name.');
    }
    if (typeof text !== 'string') {
      throw new TypeError(`The script '${name}' added from code needs ` +
        'its text.');
    }
    this.set.addText(name, text);
    return this;
  }

  /**
   * Builds the element.
   *
   * @returns {DerivedPropertyElement} the element.
   * @throws {import('./errors').ScriptValidationError} where any script
   *   does not validate.
   */
  build () {
    return new DerivedPropertyElement({}, this.set.compile());
  }
}

module.exports = DerivedPropertyElementBuilder;
