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

// Every Flow Element this package offers advertizes the Evidence keys it can
// use, publicizes the Properties it populates and exposes the string Data Key
// its Element Data is found under (conceptual-overview.md lines 73 to 80).

const core = require('../index');
const FlowElement = require('../flowElement');
const EvidenceKeyFilter = require('../evidenceKeyFilter');

// The Property each element populates, from the Element Data table of its
// own specification page, keyed by the name this package exports it under.
const POPULATES = {
  JsonBundler: ['json'],
  JavascriptBuilder: ['javascript'],
  SequenceElement: ['sequence', 'session-id'],
  SetHeadersElement: ['responseheadersdictionary']
};

// Every export of this package that is a Flow Element, other than the base
// class, built with no options.
const elements = Object.entries(core)
  .filter(([, value]) => typeof value === 'function' &&
    value !== FlowElement && value.prototype instanceof FlowElement)
  .map(([name, Element]) => [name, new Element({})]);

test('every Flow Element this package exports is covered', () => {
  expect(elements.map(([name]) => name).sort())
    .toEqual(Object.keys(POPULATES).sort());
});

describe.each(elements)('%s', (name, element) => {
  test('advertizes the Evidence keys it can use', () => {
    expect(element.evidenceKeyFilter).toBeInstanceOf(EvidenceKeyFilter);
    expect(typeof element.evidenceKeyFilter.filterEvidenceKey)
      .toBe('function');
  });

  test('publicizes the Properties it populates', () => {
    expect(Object.keys(element.getProperties()).sort())
      .toEqual(POPULATES[name].slice().sort());
  });

  test('exposes the string Data Key of its Element Data', () => {
    expect(typeof element.dataKey).toBe('string');
    expect(element.dataKey.length).toBeGreaterThan(0);
  });
});
