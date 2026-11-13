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

const { faultsMessage } = require('./lib/validate');

/**
 * Raised when one or more scripts do not validate. The message lists
 * every fault in every script, one per line, so one failure says
 * everything that has to be fixed.
 */
class ScriptValidationError extends Error {
  /**
   * @param {object[]} faults every fault, each `{ script, source, path,
   *   line, message }`.
   */
  constructor (faults) {
    super('The derived property scripts are not valid.\n' +
      faultsMessage(faults));
    this.name = 'ScriptValidationError';
    this.faults = faults;
  }
}

/**
 * Raised when a pipeline cannot supply what the scripts of a derived
 * property element read, or when two elements write one derived
 * property.
 */
class PipelineConfigurationError extends Error {
  /**
   * @param {string[]} faults one sentence for each problem.
   */
  constructor (faults) {
    super('The derived property element cannot be used in this ' +
      'pipeline.\n' + faults.join('\n'));
    this.name = 'PipelineConfigurationError';
    this.faults = faults;
  }
}

module.exports = { ScriptValidationError, PipelineConfigurationError };
