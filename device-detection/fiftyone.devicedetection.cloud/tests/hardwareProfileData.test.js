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

// Each profile the hardware lookup gives is device data of the kind the
// cloud and on-premise engines give, as device-detection-specification
// data-model.md lines 14 to 24 and hardware-profile-lookup-cloud.md line 52
// ask. So a Property is read from a profile through get, as it is from the
// device data. Each Property is also a member of the profile, which reads as
// a plain object does.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const { AspectPropertyValue, PipelineBuilder } =
  require51('fiftyone.pipeline.core');
const { AspectData } = require51('fiftyone.pipeline.engines');
const { CloudRequestEngine } = require51('fiftyone.pipeline.cloudrequestengine');
const { DeviceDetectionCloud, HardwareProfileCloudEngine } =
  require51('fiftyone.devicedetection.cloud');

const EVIDENCE_KEY = 'query.tac';
const PAID = 'HardwareImages is a paid feature. You need a licence key to ' +
  'retrieve data.';

// An answer of the shape the cloud service gives, with the device data and
// two hardware profiles. HardwareImages has no value, so the service gives
// it once beside the profiles with its reason.
const ANSWER = {
  device: { hardwarevendor: 'Apple', ismobile: true },
  hardware: {
    profiles: [
      {
        hardwarevendor: 'Apple',
        hardwaremodel: 'A1586',
        hardwarename: ['iPhone 6']
      },
      {
        hardwarevendor: 'Apple',
        hardwaremodel: 'A1524',
        hardwarename: ['iPhone 6 Plus']
      }
    ],
    hardwareimages: null,
    hardwareimagesnullreason: PAID
  }
};

// The names each profile holds, in the order the service gives them.
const NAMES = ['hardwarevendor', 'hardwaremodel', 'hardwarename',
  'hardwareimages'];

// A request client that answers as the cloud service does, with the answer
// above and a Property for each of its names, so no key or network is used.
class StubClient {
  get (url) {
    if (url.includes('evidencekeys')) {
      return Promise.resolve(JSON.stringify([EVIDENCE_KEY]));
    }
    const Products = {};
    for (const [product, values] of Object.entries(ANSWER)) {
      Products[product] = {
        DataTier: 'Test',
        Properties: Object.keys(values)
          .map((Name) => ({ Name, Type: 'String', Category: 'Test' }))
      };
    }
    return Promise.resolve(JSON.stringify({ Products }));
  }

  post () {
    return Promise.resolve(JSON.stringify(ANSWER));
  }
}

// The device data and the hardware profiles from one request. They are
// returned wrapped, because awaiting Element Data would read a 'then'
// Property from it.
const results = async () => {
  const pipeline = new PipelineBuilder()
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: new StubClient()
    }))
    .add(new DeviceDetectionCloud())
    .add(new HardwareProfileCloudEngine())
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add(EVIDENCE_KEY, '35925406');
  await flowData.process();
  return {
    device: flowData.get('device'),
    profiles: flowData.get('hardware').get('profiles')
  };
};

// The text of what a function throws, or undefined when it throws nothing.
const thrown = (action) => {
  try {
    action();
  } catch (e) {
    return String(e);
  }
  return undefined;
};

test('each profile is Aspect Data, as the device data is', async () => {
  const { device, profiles } = await results();
  expect(device).toBeInstanceOf(AspectData);
  expect(profiles).toHaveLength(2);
  for (const profile of profiles) {
    expect(profile).toBeInstanceOf(AspectData);
  }
});

test('a Property is read from a profile through get, as from the device ' +
  'data, with its name in any letter case', async () => {
  const { device, profiles } = await results();
  for (const name of ['hardwarevendor', 'HardwareVendor', 'HARDWAREVENDOR']) {
    const fromDevice = device.get(name);
    const fromProfile = profiles[0].get(name);
    expect(fromDevice).toBeInstanceOf(AspectPropertyValue);
    expect(fromProfile).toBeInstanceOf(AspectPropertyValue);
    expect(fromProfile.value).toBe(fromDevice.value);
  }
  expect(profiles[0].get('HardwareModel').value).toBe('A1586');
  expect(profiles[1].get('HardwareModel').value).toBe('A1524');
  expect(profiles[1].get('hardwarename').value).toEqual(['iPhone 6 Plus']);
  // Iterating a profile gives its Property names, as the device data does.
  expect([...device]).toEqual(Object.keys(ANSWER.device));
  expect([...profiles[0]]).toEqual(NAMES);
});

test('a profile gives a Property with no value, and its reason, through ' +
  'get', async () => {
  const { profiles } = await results();
  for (const profile of profiles) {
    const images = profile.get('HardwareImages');
    expect(images).toBeInstanceOf(AspectPropertyValue);
    expect(images.hasValue).toBe(false);
    expect(images.noValueMessage).toBe(PAID);
  }
});

test('a profile refuses through get a Property it does not hold, as the ' +
  'device data does', async () => {
  const { device, profiles } = await results();
  expect(thrown(() => device.get('screenpixelswidth')))
    .toContain('screenpixelswidth');
  expect(thrown(() => profiles[0].get('screenpixelswidth')))
    .toContain('screenpixelswidth');
});

test('each Property is still a member of the profile, which reads as a ' +
  'plain object', async () => {
  const { profiles } = await results();
  const profile = profiles[0];
  expect(profile.hardwarevendor).toBeInstanceOf(AspectPropertyValue);
  expect(profile.hardwarevendor.value).toBe('Apple');
  expect(profile.hardwareimages.noValueMessage).toBe(PAID);
  expect(Object.keys(profile)).toEqual(NAMES);
  expect(Object.keys(JSON.parse(JSON.stringify(profile)))).toEqual(NAMES);
  // A member the profile does not hold is undefined rather than an error,
  // and a profile can be the answer of a promise.
  expect(profile.screenpixelswidth).toBeUndefined();
  expect(await Promise.resolve(profile)).toBe(profile);
});
