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

// The element that supplies the source Properties the derived property
// example's scripts read. A real Pipeline puts Device Detection or IP
// Intelligence here, and this small element stands in for them, so the
// example needs no resource key, no data file and no network.

const core = require('fiftyone.pipeline.core');

// The query string parameters each Property is read from.
const EVIDENCE = {
  PagesViewed: 'query.pagesviewed',
  SecondsSincePageLoad: 'query.secondssincepageload',
  PointerMoved: 'query.pointermoved'
};

// How the text of each parameter becomes the Property's value.
const READ = {
  PagesViewed: Number,
  SecondsSincePageLoad: Number,
  PointerMoved: (text) => String(text).toLowerCase() === 'true'
};

/**
 * Gives the Properties PagesViewed, SecondsSincePageLoad and PointerMoved
 * under the key session, each read from a query string parameter. A
 * Property whose parameter the request did not carry has no value, with a
 * message naming the parameter.
 */
class SessionElement extends core.FlowElement {
  constructor () {
    super({
      dataKey: 'session',
      evidenceKeyFilter: new core.BasicListEvidenceKeyFilter(
        Object.values(EVIDENCE)),
      properties: {
        PagesViewed: { name: 'PagesViewed', type: 'int' },
        SecondsSincePageLoad: { name: 'SecondsSincePageLoad', type: 'int' },
        PointerMoved: { name: 'PointerMoved', type: 'bool' }
      }
    });
  }

  /**
   * Writes the three Properties from the request's query string.
   *
   * @param {object} flowData the Flow Data being processed
   */
  processInternal (flowData) {
    const contents = {};
    for (const [name, key] of Object.entries(EVIDENCE)) {
      const given = flowData.evidence.get(key);
      contents[name] = given === undefined
        ? new core.AspectPropertyValue(`The request carried no ${key}.`)
        : new core.AspectPropertyValue(null, READ[name](given));
    }
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents
    }));
  }
}

module.exports = SessionElement;
