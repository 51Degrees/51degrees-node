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

// The Rounding of Azimuth and Declination values section of the value types
// page says IP Intelligence Latitude and Longitude, and the points of Areas,
// are given to 3 decimal places, as a number and in WKT.

const path = require('path');

const SwigData = require(path.resolve(__dirname, '..', 'swigData'));

// A stand-in for a swig vector of weighted values.
const vectorOf = (items) => ({
  size: () => items.length,
  get: (i) => ({
    getValue: () => items[i].value,
    getWeight: () => items[i].weight,
    getShortRawWeight: () => items[i].rawWeight
  })
});

const found = (value) => ({
  hasValue: () => true,
  getValue: () => value
});

const dataFor = (properties, swigResults) => new SwigData({
  flowElement: { properties },
  swigResults
});

const one = (value) => vectorOf([{ value, weight: 1, rawWeight: 65535 }]);

describe('Latitude and Longitude', () => {
  const properties = {
    latitude: { name: 'Latitude', type: 'weightedsingle' },
    longitude: { name: 'Longitude', type: 'weighteddouble' },
    other: { name: 'Other', type: 'weighteddouble' }
  };
  const results = {
    getValuesAsWeightedDoubleList: (name) => found(one({
      Latitude: 18.542741172521133,
      Longitude: -0.0004,
      Other: 18.542741172521133
    }[name]))
  };

  test('are given to 3 decimal places', () => {
    const data = dataFor(properties, results);
    expect(data.getInternal('latitude').value[0].value).toBe(18.543);
    expect(data.getInternal('longitude').value[0].value).toBe(0);
    expect(Object.is(data.getInternal('longitude').value[0].value, -0))
      .toBe(false);
  });

  test('are the number nearest to the rounded decimal', () => {
    const data = dataFor(properties, {
      getValuesAsWeightedDoubleList: () => found(vectorOf([
        { value: 51.5074567, weight: 0.5, rawWeight: 32768 },
        { value: -0.1277583, weight: 0.5, rawWeight: 32767 }
      ]))
    });
    const values = data.getInternal('latitude').value.map((v) => v.value);
    expect(values).toEqual([51.507, -0.128]);
    expect(data.getInternal('latitude').value[0].weight).toBe(0.5);
  });

  test('leave other properties as the engine gives them', () => {
    const data = dataFor(properties, results);
    expect(data.getInternal('other').value[0].value)
      .toBe(18.542741172521133);
  });
});

describe('Areas', () => {
  test('asks for WKT with 3 decimal places', () => {
    const asked = [];
    const data = dataFor({
      areas: { name: 'Areas', type: 'weightedwkb' }
    }, {
      getValuesAsWeightedWKTStringList: (name, places) => {
        asked.push([name, places]);
        return found(one('POINT(18.543 0.001)'));
      }
    });
    expect(data.getInternal('areas').value[0].value)
      .toBe('POINT(18.543 0.001)');
    expect(asked).toEqual([['Areas', 3]]);
  });
});
