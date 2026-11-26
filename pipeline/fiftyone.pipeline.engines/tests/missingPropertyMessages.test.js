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

// The message for a Property an Engine does not have in its results gives
// the reason in the words of the table in the specification's Missing
// Properties section (properties.md lines 116 to 139), with the reason
// decided in the order its Deciding the reason section gives (lines 141 to
// 177). Names are compared ignoring case.

const path = require('path');

const MissingPropertyService = require(
  path.resolve(__dirname, '..', 'missingPropertyService'));
const AspectDataDictionary = require(
  path.resolve(__dirname, '..', 'aspectDataDictionary'));

// The message of the error reading the Property from the service threw.
const thrown = (key, flowElement) => {
  try {
    new MissingPropertyService().check(key, flowElement);
  } catch (e) {
    return e.message;
  }
  return undefined;
};

// A cloud engine as the service recognises one, by the name of a class it
// extends.
class CloudEngine {}
class TestCloudEngine extends CloudEngine {
  constructor (properties, cloudProperties, errors) {
    super();
    this.dataKey = 'location';
    this.properties = properties;
    this._cloudRequestEngine = { flowElementProperties: cloudProperties };
    if (errors !== undefined) {
      this.errors = errors;
    }
  }
}

describe('the missing property message', () => {
  test('is unknown for a Property no metadata lists', () => {
    expect(thrown('three', { dataKey: 'test', properties: { one: {} } }))
      .toBe("Property 'three' not found in data for element 'test'. The " +
        'reason for this is unknown. Please check that the aspect and ' +
        'property name are correct.');
  });

  test('is excluded for a Property the metadata lists, in any case', () => {
    expect(thrown('One', { dataKey: 'test', properties: { one: {} } }))
      .toBe("Property 'One' not found in data for element 'test'. This is " +
        'because the property has been excluded when configuring the ' +
        'engine.');
  });

  test('is excluded for a Property the engine was told not to give', () => {
    const data = new AspectDataDictionary({
      flowElement: {
        dataKey: 'test',
        restrictedProperties: ['one'],
        properties: { one: {}, two: {} }
      },
      contents: { one: 1, two: 2 }
    });
    expect(data.get('one')).toBe(1);
    let message;
    try {
      data.get('two');
    } catch (e) {
      message = e.message;
    }
    expect(message).toBe("Property 'two' not found in data for element " +
      "'test'. This is because the property has been excluded when " +
      'configuring the engine.');
  });

  test('says a Resource Key has no Property of a cloud engine', () => {
    expect(thrown('country', new TestCloudEngine(undefined, { device: {} })))
      .toBe("Property 'country' not found in data for element 'location'. " +
        'This is because your resource key does not include access to any ' +
        "properties under 'location'. Check or create a resource key with " +
        'the properties you need on the configuration page at ' +
        'https://51degrees.com/configure?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyproduct.');
  });

  test('names the Properties a Resource Key has of a cloud engine', () => {
    const engine = new TestCloudEngine(
      { town: {}, country: {} }, { location: {} });
    expect(thrown('latitude', engine))
      .toBe("Property 'latitude' not found in data for element 'location'. " +
        'This is because your resource key does not include access to this ' +
        "property. The properties included for your key under 'location' " +
        'are town,country. Check or change your key on the configuration ' +
        'page at https://51degrees.com/configure?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertynotincluded.');
  });

  test('says the cloud request failed when the property list did not come',
    () => {
      const engine = new TestCloudEngine({}, {}, new Error('No answer.'));
      expect(thrown('town', engine))
        .toBe("Property 'town' not found in data for element 'location'. " +
          'This is because an upstream cloud request failed, so no data ' +
          'was available to populate the property.');
    });

  test('is unknown for a cloud engine whose property list has not come',
    () => {
      expect(thrown('town', new TestCloudEngine({}, {})))
        .toBe("Property 'town' not found in data for element 'location'. " +
          'The reason for this is unknown. Please check that the aspect ' +
          'and property name are correct.');
    });

  test('is excluded for a Property a cloud engine\'s metadata lists', () => {
    const engine = new TestCloudEngine({ town: {} }, { location: {} });
    expect(thrown('Town', engine))
      .toBe("Property 'Town' not found in data for element 'location'. " +
        'This is because the property has been excluded when configuring ' +
        'the engine.');
  });
});
