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

/**
 * A source element for the tests, under the 'ip' data key, whose 'known'
 * property has a translation in the test sources and whose 'unknown'
 * property has none. A class, so that a configuration can name this file.
 */
class CountrySourceElement extends core.FlowElement {
  /**
   * Constructor.
   */
  constructor () {
    super();
    this.dataKey = 'ip';
    this.evidenceKeyFilter = new core.BasicListEvidenceKeyFilter([]);
    this.properties = { known: {}, unknown: {} };
  }

  /**
   * Store the two country names.
   *
   * @param {object} flowData the flow data being processed
   */
  processInternal (flowData) {
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents: { known: 'Germany', unknown: 'Atlantis' }
    }));
  }
}

module.exports = CountrySourceElement;
