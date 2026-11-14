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
const { validateText } = require('./lib/validate');
const { ScriptValidationError } = require('./errors');

/**
 * The scripts built into this package, which are the `scripts` folder of
 * the derived-properties submodule. The package carries that folder and
 * nothing else from the submodule.
 */
const BUILT_IN_FOLDER = path.join(__dirname, 'derived-properties', 'scripts');

/** The file names a script may have. */
const SCRIPT_FILE = /\.(ya?ml|json)$/i;

/**
 * The file names of the built in scripts, in order.
 *
 * @returns {string[]|null} the file names, or null where the folder is
 *   not there.
 */
function builtInFiles () {
  if (!fs.existsSync(BUILT_IN_FOLDER)) return null;
  return fs.readdirSync(BUILT_IN_FOLDER)
    .filter(file => SCRIPT_FILE.test(file))
    .sort();
}

/**
 * The name of a script file, being its file name without the extension.
 *
 * @param {string} file the file name or path.
 * @returns {string} the name.
 */
function nameOf (file) {
  return path.basename(file, path.extname(file));
}

/**
 * The names of the scripts built into this package.
 *
 * @returns {string[]} the names, such as HumanConfidence and IsGdpr.
 */
function builtInScriptNames () {
  const files = builtInFiles();
  return files === null ? [] : files.map(nameOf);
}

// The platforms whose default file systems ignore letter case in names.
const CASE_BLIND_PLATFORMS = ['win32', 'darwin'];

/**
 * A regular expression matching a file name against a pattern holding
 * the wildcards `*` and `?`.
 *
 * @param {string} pattern the pattern.
 * @returns {RegExp} the expression.
 */
function wildcard (pattern) {
  const source = pattern
    .split('')
    .map(character => {
      if (character === '*') return '.*';
      if (character === '?') return '.';
      return character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  // Letter case is ignored on Windows and Apple systems, whose default file
  // systems ignore it.
  return new RegExp(`^${source}$`,
    CASE_BLIND_PLATFORMS.includes(process.platform) ? 'i' : '');
}

/**
 * Collects scripts from the three places a script can come from, being
 * the scripts built into this package, files and text held by code, and
 * every fault found in any of them.
 */
class ScriptSet {
  constructor () {
    /** @type {object[]} the models of the scripts that validated */
    this.scripts = [];
    /** @type {object[]} every fault found */
    this.faults = [];
  }

  /**
   * Adds a script built into this package, by its name in any case.
   *
   * @param {string} name the name, such as HumanConfidence.
   */
  addBuiltIn (name) {
    const fault = message => this.faults.push({
      script: typeof name === 'string' ? name : null,
      source: 'built in',
      path: '',
      line: null,
      message
    });
    if (typeof name !== 'string' || name.trim() === '') {
      fault('a built in script name is empty');
      return;
    }
    const files = builtInFiles();
    if (files === null) {
      fault('the built in scripts are not in this copy of the package, ' +
        `because the folder '${BUILT_IN_FOLDER}' does not exist. In a ` +
        'clone of the repository, git submodule update --init fetches ' +
        'them');
      return;
    }
    const lower = name.trim().toLowerCase();
    const file = files.find(f => nameOf(f).toLowerCase() === lower);
    if (file === undefined) {
      const names = files.map(nameOf);
      fault(`there is no script called '${name.trim()}' in this package. ` +
        'The scripts in this package are ' +
        (names.length === 0 ? '(none)' : names.join(', ')) +
        '. A script from your own environment is added with scriptFiles ' +
        'rather than scripts');
      return;
    }
    const text = fs.readFileSync(path.join(BUILT_IN_FOLDER, file), 'utf8');
    this.addText(nameOf(file), text, `built in ${nameOf(file)}`);
  }

  /**
   * Adds a script file, or every file a wildcard in the file name
   * matches, in order of their names. A relative path is read from the
   * current folder.
   *
   * @param {string} filePath the path, which may hold `*` or `?` in the
   *   file name.
   */
  addFiles (filePath) {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      this.faults.push({
        script: null,
        source: 'file',
        path: '',
        line: null,
        message: 'a script file path is empty'
      });
      return;
    }
    const trimmed = filePath.trim();
    if (!/[*?]/.test(trimmed)) {
      this.addFile(trimmed);
      return;
    }
    const folder = path.dirname(trimmed);
    const pattern = wildcard(path.basename(trimmed));
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      this.faults.push({
        script: null,
        source: trimmed,
        path: '',
        line: null,
        message: `the folder '${folder}' does not exist`
      });
      return;
    }
    // Ordered so that a wildcard gives the same element on every machine,
    // whatever order the file system lists in.
    const files = fs.readdirSync(folder)
      .filter(file => pattern.test(file))
      .sort();
    for (const file of files) {
      const full = path.join(folder, file);
      if (fs.statSync(full).isFile()) {
        this.addFile(full);
      }
    }
  }

  /**
   * Adds one script file. The script's Name must equal the file name
   * without its extension.
   *
   * @param {string} filePath the path.
   */
  addFile (filePath) {
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      this.faults.push({
        script: nameOf(filePath),
        source: filePath,
        path: '',
        line: null,
        message: `the file could not be read. ${error.message}`
      });
      return;
    }
    // A byte order mark is not part of the script.
    const body = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    this.addText(nameOf(filePath), body, filePath);
  }

  /**
   * Adds the text of a script, as YAML or JSON.
   *
   * @param {string|null} name the name the script's Name must equal, or
   *   null for no such check.
   * @param {string} text the script.
   * @param {string} [source] where the script came from, for the log
   *   and the fault messages.
   */
  addText (name, text, source = 'code') {
    const { model, faults } = validateText(text, { name, source });
    if (model === null) {
      this.faults.push(...faults);
      return;
    }
    this.scripts.push(model);
  }

  /**
   * The scripts, once every one has validated.
   *
   * @returns {object[]} the models of the scripts.
   * @throws {ScriptValidationError} where any script did not validate.
   */
  compile () {
    if (this.faults.length > 0) {
      throw new ScriptValidationError(this.faults);
    }
    return this.scripts;
  }
}

module.exports = { ScriptSet, builtInScriptNames, BUILT_IN_FOLDER };
