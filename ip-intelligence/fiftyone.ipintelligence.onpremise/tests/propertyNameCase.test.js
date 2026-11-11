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

// The pipeline compares property names ignoring case, so a read finds a
// property whatever the letter case of the key it is given. The native
// results are stood in for, so the test needs no data file.

const path = require('path');
const SwigData = require(path.resolve(__dirname, '..', 'swigData'));

// Stands in for the native results, answering each read with the name it
// was asked for.
const results = {
  getValueAsString: (name) => ({
    hasValue: () => true,
    getValue: () => 'value of ' + name,
    getNoValueMessage: () => undefined
  })
};

// An engine whose properties are keyed in lower case, as the engine keys
// them when the data file loads.
const element = {
  dataKey: 'ip',
  properties: {
    registeredname: { name: 'RegisteredName', type: 'string' }
  }
};

test('a read finds a property whatever the letter case of its key', () => {
  const data = new SwigData({ flowElement: element, swigResults: results });
  expect(data.get('registeredname').value).toBe('value of RegisteredName');
  expect(data.get('RegisteredName').value).toBe('value of RegisteredName');
  expect(data.get('REGISTEREDNAME').value).toBe('value of RegisteredName');
});
