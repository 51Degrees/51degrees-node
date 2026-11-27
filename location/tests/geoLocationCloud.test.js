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

const path = require('path');

const GeoLocation = require(path.resolve(__dirname, '..'));
// These tests call the live cloud service, so each fails rather than skips
// when no resource key is set.
const resourceKeyName = '_51DEGREES_RESOURCE_KEY_BESPOKE';
const currentResourceKey = (process.env[resourceKeyName] || '').trim();
const myResourceKey = currentResourceKey || '!!YOUR_RESOURCE_KEY!!';
const noResourceKey = 'This test calls the live 51Degrees cloud service, ' +
  'so it needs a resource key and there is nothing to fall back on. ' +
  resourceKeyName + ' is not set. The ' +
  'key has to carry the location product, because the test asks the ' +
  'service for the location properties of a latitude and longitude. To ' +
  'see the products a key carries, open ' +
  'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>. ' +
  'Create a key at https://51degrees.com/configure?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.geolocation-tests-geolocationcloud.test.js&utm_term=resource-key-required.';

const TestLat = '51.4578261';
const TestLon = '-0.975922996290084';

// Check that if no evidence is yet available for location
// engine, accessing a valid property will return HasValue=false
// and a correct error message.
test('No evidence error message', done => {
  if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
    throw new Error(noResourceKey);
  }

  const pipeline = new GeoLocation.GeoLocationPipelineBuilder({
    resourceKey: myResourceKey
  }).build();
  const flowData = pipeline.createFlowData();

  flowData.process().then(function () {
    const country = flowData.location.country;
    expect(country.hasValue).toBe(false);

    // The key has to carry the location product, so a key without it fails
    // here, showing the message the service gave in its place.
    expect(country.noValueMessage).toContain('This property requires ' +
      'evidence values from JavaScript running on the client. It ' +
      'cannot be populated until a future request is made that ' +
      'contains this additional data.');

    done();
  });
});

test('Available Properties 51Degrees', async done => {
  if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
    throw new Error(noResourceKey);
  }

  const pipeline = new GeoLocation.GeoLocationPipelineBuilder({
    resourceKey: myResourceKey,
    locationProvider: 'fiftyonedegrees'
  }).build();
  const engine = pipeline.flowElements.location;

  await testAvailableProperties(done, pipeline, engine);
});

test('Value Types 51Degrees', async done => {
  if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
    throw new Error(noResourceKey);
  }

  const pipeline = new GeoLocation.GeoLocationPipelineBuilder({
    resourceKey: myResourceKey,
    locationProvider: 'fiftyonedegrees'
  }).build();
  const engine = pipeline.flowElements.location;

  await testValueTypes(done, pipeline, engine);
});

// Checks that every property the resource key carries for the engine comes
// back with a value or a reason for having none. The key decides which
// properties these are, as in the other languages' location tests.
async function testAvailableProperties (done, pipeline, engine) {
  const flowData = pipeline.createFlowData();

  flowData.evidence.add('query.51D_Pos_latitude', TestLat);
  flowData.evidence.add('query.51D_Pos_longitude', TestLon);

  await flowData.process();

  const keyProperties = getKeyProperties(done, engine);
  if (keyProperties === null) {
    return;
  }

  keyProperties.forEach(key => {
    try {
      const apv = flowData[engine.dataKey][key];
      if (apv === undefined) {
        done.fail(new Error(`Aspect property value for ${key} should not be undefined.`));
      }
      expect(apv).not.toBeNull();
      expect(apv).toBeDefined();
      if (apv.hasValue === true) {
        if (apv.value == null || apv.value === undefined) {
          done.fail(new Error(`${key}.value should not be null`));
        }
      } else {
        if (apv.noValueMessage == null || apv.noValueMessage === undefined) {
          done.fail(new Error(`${key}.noValueMessage should not be null`));
        }
      }
    } catch (err) {
      done.fail(err);
    }
  });
  done();
}

// Checks that every property the resource key carries for the engine has a
// value of the type the cloud service gives for it, or a reason for having
// none, as in the other languages' location tests.
async function testValueTypes (done, pipeline, engine) {
  const flowData = pipeline.createFlowData();

  flowData.evidence.add('query.51D_Pos_latitude', TestLat);
  flowData.evidence.add('query.51D_Pos_longitude', TestLon);

  await flowData.process();

  const keyProperties = getKeyProperties(done, engine);
  if (keyProperties === null) {
    return;
  }

  keyProperties.forEach(key => {
    const expectedType = engine.properties[key].type;
    const apv = flowData[engine.dataKey][key];

    expect(apv).not.toBeNull();
    expect(apv).toBeDefined();
    if (apv.hasValue === true) {
      expect(apv.value).toBe51DType(key, expectedType);
    } else {
      expect(apv.noValueMessage, 'No value and no reason for \'' + key + '\'.')
        .toBeTruthy();
    }
  });

  done();
}

// Gives the names of the properties the resource key carries for the engine.
// Where the key carries none, it fails the test with a message that names
// the variable holding the key, and gives null.
function getKeyProperties (done, engine) {
  const keyProperties = Object.keys(engine.properties || {});
  if (keyProperties.length === 0) {
    done.fail(new Error('The resource key in ' + resourceKeyName +
      ' carries no ' + engine.dataKey + ' properties, so there is nothing ' +
      'to check. To see the products a key carries, open ' +
      'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>.'));
    return null;
  }
  return keyProperties;
}

expect.extend({
  // Method to validate a given value has the expected type.
  toBe51DType (received, name, fodType) {
    const valueType = typeof received;
    let valid = false;

    switch (fodType) {
      case 'Boolean':
        valid = valueType === 'boolean';
        break;
      case 'String':
        valid = valueType === 'string';
        break;
      case 'JavaScript':
        valid = valueType === 'string';
        break;
      case 'Int32':
        valid = valueType === 'number';
        break;
      case 'Double':
        valid = valueType === 'number';
        break;
      case 'Array':
        valid = valueType === 'object' && Array.isArray(received);
        break;
      default:
        valid = false;
        break;
    }

    if (valid) {
      return {
        message: () =>
          `${name}: expected node type '${valueType}' not to be equivalent to fodType '${fodType}' for value: '${received}'`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `${name}: expected node type '${valueType}' to be equivalent to fodType '${fodType}' for value: '${received}'`,
        pass: false
      };
    }
  }
});
