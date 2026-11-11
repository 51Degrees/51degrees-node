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

// Stands in for a native Value.
const nativeValue = (value) => ({
  hasValue: () => true,
  getValue: () => value,
  getNoValueMessage: () => undefined
});

// Stands in for the native results. Each read records what it was asked for
// and answers with the target itself, so a test can see which overload a
// read took.
const recordingResults = () => {
  const asked = [];
  const read = (target) => {
    asked.push(target);
    return nativeValue(target);
  };
  return {
    asked,
    getValueAsBool: read,
    getValueAsString: read,
    getValueAsInteger: read,
    getValueAsDouble: read,
    getValues: read,
    getDeviceId: () => 'device id',
    getDifference: () => 0,
    getIterations: () => 0,
    getMatchedNodes: () => 0,
    getDrift: () => 0,
    getMethod: () => 0,
    getUserAgents: () => 0
  };
};

// An engine built with the names given, holding the properties a data set of
// the given order makes available. The data set's order is deliberately not
// the build order, because the rule is that the index never comes from the
// data set.
const engineBuiltWith = (buildNames, dataSetNames) => {
  const properties = {};
  for (const name of dataSetNames) {
    properties[name.toLowerCase()] = { name, type: 'string' };
  }
  const element = { dataKey: 'device', properties };
  element.buildPropertyNames = buildNames;
  element.propertyIndexes = propertyIndexes.fromNames(buildNames);
  return element;
};

describe('the table from build-time names to indexes', () => {
  test('gives each name its place in the list', () => {
    const indexes = propertyIndexes.fromNames(
      ['BrowserName', 'IsMobile', 'PlatformName']);
    expect(indexes).toEqual(
      { browsername: 0, ismobile: 1, platformname: 2 });
  });

  test('ignores the letter case of a name', () => {
    const indexes = propertyIndexes.fromNames(['IsMobile']);
    expect(indexes.ismobile).toBe(0);
  });

  test('keeps the first place where a name is given twice', () => {
    const indexes = propertyIndexes.fromNames(
      ['IsMobile', 'BrowserName', 'ismobile']);
    expect(indexes.ismobile).toBe(0);
  });

  test('is empty for an engine built with no names', () => {
    expect(propertyIndexes.fromNames([])).toEqual({});
    expect(propertyIndexes.fromNames(undefined)).toEqual({});
  });

  test('gives an index to a name every object already has', () => {
    // A plain object already answers constructor, so a table made from one
    // would skip the name and hand back a function where an index belongs.
    const indexes = propertyIndexes.fromNames(['IsMobile', 'Constructor']);
    expect(indexes.constructor).toBe(1);
  });
});

describe('a read through Element Data', () => {
  test('asks the native results by index, not by name', () => {
    const element = engineBuiltWith(
      ['BrowserName', 'IsMobile'], ['IsMobile', 'BrowserName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    data.getInternal('ismobile');
    expect(results.asked).toEqual([1]);
  });

  test('reads a property named constructor by its index', () => {
    const element = engineBuiltWith(
      ['IsMobile', 'Constructor'], ['Constructor', 'IsMobile']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    data.getInternal('constructor');
    expect(results.asked).toEqual([1]);
  });

  test('reads the right property when the data set order differs', () => {
    // Built in one order, and the data set holds them in another, which is
    // what a reload can do. The index still follows the build order.
    const element = engineBuiltWith(
      ['BrowserName', 'IsMobile', 'PlatformName'],
      ['PlatformName', 'IsMobile', 'BrowserName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('browsername').value).toBe(0);
    expect(data.getInternal('ismobile').value).toBe(1);
    expect(data.getInternal('platformname').value).toBe(2);
  });

  test('reads the right property when the data set is a superset', () => {
    // The reloaded data set holds properties the engine was not built with.
    // Each built name keeps the index it had.
    const element = engineBuiltWith(
      ['BrowserName', 'IsMobile'],
      ['IsMobile', 'BrowserName', 'PlatformName', 'ScreenPixelsWidth']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('browsername').value).toBe(0);
    expect(data.getInternal('ismobile').value).toBe(1);
  });

  test('reads by name a property outside the build-time list', () => {
    // A property the data set makes available but the engine was not built
    // with has no index, so the read goes by name and the native code gives
    // its own no value message.
    const element = engineBuiltWith(
      ['IsMobile'], ['IsMobile', 'PlatformName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('platformname').value).toBe('PlatformName');
    expect(results.asked).toEqual(['PlatformName']);
  });

  test('reads by name when the engine was built with no names', () => {
    // An engine with no names keeps exactly today's behaviour until the
    // native change that gives it indexes is taken up.
    const element = engineBuiltWith([], ['IsMobile', 'BrowserName']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('ismobile').value).toBe('IsMobile');
    expect(results.asked).toEqual(['IsMobile']);
  });

  test('reads a match metric without touching the table', () => {
    const element = engineBuiltWith(['IsMobile'], ['IsMobile']);
    const results = recordingResults();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('deviceID').value).toBe('device id');
    expect(results.asked).toEqual([]);
  });

  test('reads every type by index', () => {
    const buildNames = ['ABool', 'AString', 'AnInt', 'ADouble', 'AList',
      'AScript'];
    const element = engineBuiltWith(buildNames, buildNames);
    element.properties.abool.type = 'bool';
    element.properties.anint.type = 'int';
    element.properties.adouble.type = 'double';
    element.properties.ascript.type = 'javascript';
    element.properties.alist.type = 'string[]';
    // A list value is turned into an array, so the stand in gives a vector.
    const results = recordingResults();
    const listRead = results.getValues;
    results.getValues = (target) => {
      results.asked.push(target);
      return {
        hasValue: () => true,
        getValue: () => ({ size: () => 1, get: () => String(target) }),
        getNoValueMessage: () => undefined
      };
    };
    expect(listRead).toBeDefined();
    const data = new SwigData({ flowElement: element, swigResults: results });
    expect(data.getInternal('abool').value).toBe(0);
    expect(data.getInternal('astring').value).toBe(1);
    expect(data.getInternal('anint').value).toBe(2);
    expect(data.getInternal('adouble').value).toBe(3);
    expect(data.getInternal('alist').value).toEqual(['4']);
    expect(data.getInternal('ascript').value).toBe(5);
    expect(results.asked).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('carries the no value message through an index read', () => {
    const element = engineBuiltWith(['IsMobile'], ['IsMobile']);
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
    const result = data.getInternal('ismobile');
    expect(result.noValueMessage).toBe('no value at index 0');
    expect(results.asked).toEqual([0]);
  });
});
