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

// A property's index is its place in the list of names the engine was built
// with, so the same index names the same property after any reload. These
// tests drive the Element Data with a stand in for the native results, which
// records whether each read asked for an index or a name.

const path = require('path');
const SwigData = require(path.resolve(__dirname, '..', 'swigData'));
const propertyIndexes = require(
  path.resolve(__dirname, '..', 'propertyIndexes'));

// A weighted list value the stand in gives back, holding one entry whose
// value is the target the read asked for.
const weightedList = (target) => ({
  hasValue: () => true,
  getValue: () => ({
    size: () => 1,
    get: () => ({
      getValue: () => target,
      getWeight: () => 1,
      getShortRawWeight: () => 65535
    })
  }),
  getNoValueMessage: () => undefined
});

// Stands in for the native results. Each read records what it was asked for.
const recordingResults = () => {
  const asked = [];
  const plain = (target) => {
    asked.push(target);
    return {
      hasValue: () => true,
      getValue: () => target,
      getNoValueMessage: () => undefined
    };
  };
  const weighted = (target) => {
    asked.push(target);
    return weightedList(target);
  };
  return {
    asked,
    getValueAsBool: plain,
    getValueAsString: plain,
    getValueAsInteger: plain,
    getValueAsDouble: plain,
    getValues: (target) => {
      asked.push(target);
      return {
        hasValue: () => true,
        getValue: () => ({ size: () => 1, get: () => String(target) }),
        getNoValueMessage: () => undefined
      };
    },
    getValuesAsWeightedBoolList: weighted,
    getValuesAsWeightedIntegerList: weighted,
    getValuesAsWeightedDoubleList: weighted,
    getValuesAsWeightedStringList: weighted,
    // The native method takes the index first and the decimal places
    // second, so the test records both.
    getValuesAsWeightedWKTStringList: (target, decimalPlaces) => {
      asked.push(target);
      asked.push(decimalPlaces);
      return weightedList(target);
    }
  };
};

const engineBuiltWith = (buildNames, dataSetNames, types) => {
  const properties = {};
  dataSetNames.forEach((name) => {
    properties[name.toLowerCase()] = {
      name,
      type: (types && types[name]) || 'string'
    };
  });
  const element = { dataKey: 'ip', properties };
  element.buildPropertyNames = buildNames;
  element.propertyIndexes = propertyIndexes.fromNames(buildNames);
  return element;
};

describe('the table from build-time names to indexes', () => {
  test('gives each name its place in the list', () => {
    expect(propertyIndexes.fromNames(['RegisteredName', 'IpRangeStart']))
      .toEqual({ registeredname: 0, iprangestart: 1 });
  });

  test('is empty for an engine built with no names', () => {
    expect(propertyIndexes.fromNames([])).toEqual({});
  });
});

describe('a read through Element Data', () => {
  test('asks the native results by index, not by name', () => {
    const element = engineBuiltWith(
      ['RegisteredName', 'RegisteredOwner'],
      ['RegisteredOwner', 'RegisteredName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    data.getInternal('registeredowner');
    expect(results.asked).toEqual([1]);
  });

  test('reads the right property when the data set order differs', () => {
    const element = engineBuiltWith(
      ['RegisteredName', 'RegisteredOwner', 'IpRangeStart'],
      ['IpRangeStart', 'RegisteredOwner', 'RegisteredName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('registeredname').value).toBe(0);
    expect(data.getInternal('registeredowner').value).toBe(1);
    expect(data.getInternal('iprangestart').value).toBe(2);
  });

  test('reads the right property when the data set is a superset', () => {
    const element = engineBuiltWith(
      ['RegisteredName', 'RegisteredOwner'],
      ['RegisteredOwner', 'RegisteredName', 'IpRangeStart', 'Mcc']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('registeredname').value).toBe(0);
    expect(data.getInternal('registeredowner').value).toBe(1);
  });

  test('reads by name a property outside the build-time list', () => {
    const element = engineBuiltWith(
      ['RegisteredName'], ['RegisteredName', 'IpRangeStart']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('iprangestart').value).toBe('IpRangeStart');
    expect(results.asked).toEqual(['IpRangeStart']);
  });

  test('reads by name when the engine was built with no names', () => {
    const element = engineBuiltWith([], ['RegisteredName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('registeredname').value).toBe('RegisteredName');
    expect(results.asked).toEqual(['RegisteredName']);
  });

  test('reads each weighted type by index', () => {
    const buildNames = ['AWeightedBool', 'AWeightedInt', 'AWeightedDouble',
      'AWeightedString'];
    const element = engineBuiltWith(buildNames, buildNames, {
      AWeightedBool: 'weightedbool',
      AWeightedInt: 'weightedint',
      AWeightedDouble: 'weighteddouble',
      AWeightedString: 'weightedstring'
    });
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('aweightedbool').value[0].value).toBe(0);
    expect(data.getInternal('aweightedint').value[0].value).toBe(1);
    expect(data.getInternal('aweighteddouble').value[0].value).toBe(2);
    expect(data.getInternal('aweightedstring').value[0].value).toBe(3);
    expect(results.asked).toEqual([0, 1, 2, 3]);
  });

  test('gives the WKT read the index first and the decimal places second',
    () => {
      const element = engineBuiltWith(
        ['First', 'AWeightedWkb'], ['First', 'AWeightedWkb'],
        { AWeightedWkb: 'weightedwkb' });
      const results = recordingResults();
      const data = new SwigData(
        { flowElement: element, swigResults: results });
      expect(data.getInternal('aweightedwkb').value[0].value).toBe(1);
      // The index, then the number of decimal places the engine asks for.
      expect(results.asked).toEqual([1, 16]);
    });

  test('reads MCC as a weighted string by index', () => {
    // MCC is a list of weighted strings even though its metadata type is a
    // plain string, and the index read has to follow the same route.
    const element = engineBuiltWith(['First', 'Mcc'], ['First', 'Mcc']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('mcc').value[0].value).toBe(1);
    expect(results.asked).toEqual([1]);
  });

  test('reads an unknown type by index through the default route', () => {
    const element = engineBuiltWith(
      ['First', 'Odd'], ['First', 'Odd'], { Odd: 'something new' });
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('odd').value).toBe(1);
    expect(results.asked).toEqual([1]);
  });

  test('carries the no value message through an index read', () => {
    const element = engineBuiltWith(['RegisteredName'], ['RegisteredName']);
    const results = recordingResults();
    results.getValueAsString = (target) => {
      results.asked.push(target);
      return {
        hasValue: () => false,
        getValue: () => undefined,
        getNoValueMessage: () => 'no value at index ' + target
      };
    };
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('registeredname').noValueMessage)
      .toBe('no value at index 0');
  });
});
