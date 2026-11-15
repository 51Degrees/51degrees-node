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

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

const CloudEngine = require('fiftyone.pipeline.cloudrequestengine').CloudEngine;

const AspectPropertyValue = require('fiftyone.pipeline.core').AspectPropertyValue;
const AspectDataDictionary = require('fiftyone.pipeline.engines').AspectDataDictionary;
const MissingPropertyService =
  require('fiftyone.pipeline.engines').MissingPropertyService;

// The suffix the cloud service adds to a property name to carry the reason
// that property has no value, for example 'hardwarevendornullreason'.
const NULL_REASON_SUFFIX = 'nullreason';

const missingPropertyService = new MissingPropertyService();

/**
 * One device profile from a hardware lookup. It is Aspect Data, read through
 * get as the device data of the cloud and on-premise engines is, and each
 * Property is also a member of the profile.
 */
class HardwareProfileData extends AspectDataDictionary {
  /**
   * Makes the data for one profile. It is made without ElementData's
   * constructor, whose proxy throws for a name the data does not hold, so an
   * absent member reads as undefined and JSON.stringify and await treat the
   * profile as a plain object. Only the Properties are enumerable.
   *
   * @param {HardwareProfileCloudEngine} flowElement the engine the profile
   * is from
   * @param {object} values Property name to AspectPropertyValue
   * @returns {HardwareProfileData} the profile
   */
  static create (flowElement, values) {
    const profile = Object.create(HardwareProfileData.prototype);
    Object.defineProperties(profile, {
      flowElement: { value: flowElement },
      contents: { value: values },
      missingPropertyService: { value: missingPropertyService }
    });
    Object.entries(values).forEach(function ([name, value]) {
      // A name the profile uses itself, such as get, is read through get.
      if (!(name in profile)) {
        profile[name] = value;
      }
    });
    return profile;
  }
}

/**
 * Build the aspect level property values from the 'hardware' section of a
 * cloud response, pairing each null value with the reason the service gave
 * for it.
 *
 * @param {object} hardware The 'hardware' section of the cloud response
 * @returns {object} Property name to AspectPropertyValue
 */
const buildAspectValues = function (hardware) {
  const values = {};

  Object.entries(hardware).forEach(function ([key, value]) {
    if (key === 'profiles' || key.endsWith(NULL_REASON_SUFFIX)) {
      return;
    }

    if (value === null || value === undefined) {
      const reason = hardware[key + NULL_REASON_SUFFIX];

      values[key] = (typeof reason === 'string' && reason.length > 0)
        ? new AspectPropertyValue(reason)
        : new AspectPropertyValue();
    } else {
      values[key] = new AspectPropertyValue(null, value);
    }
  });

  return values;
};

/**
 * This Cloud Aspect Engine enables the parsing of 'hardware profile'
 * responses from the 51Degrees cloud service.
 */
class HardwareProfileCloudEngine extends CloudEngine {
  /**
   * Constructor for HardwareProfileCloudEngine
   */
  constructor () {
    super(...arguments);
    this.dataKey = 'hardware';
  }

  /**
   * Process internal FlowData cloud data for devices,
   * set them as FlowData elements
   *
   * @param {FlowData} flowData The FlowData object
   */
  processInternal (flowData) {
    const engine = this;

    let cloudData = flowData.get('cloud').get('cloud');

    cloudData = JSON.parse(cloudData);

    const hardware = (cloudData && cloudData.hardware) || {};

    // Properties the resource key is not entitled to are returned by the
    // cloud service at the aspect level rather than inside each profile,
    // with a companion '<name>nullreason' saying why there is no value.
    // Collect those so the reason can travel with every profile instead of
    // being thrown away.
    const aspectValues = buildAspectValues(hardware);

    const devices = [];

    Object.entries(hardware.profiles || {}).forEach(function ([i, deviceValues]) {
      const device = {};

      Object.entries(deviceValues).forEach(function ([propertyKey, propertyValue]) {
        device[propertyKey] = new AspectPropertyValue();

        device[propertyKey].value = propertyValue;
      });

      // Add the properties the service could not supply, carrying the
      // reason it gave, so a caller reading a profile gets an explanation
      // rather than nothing at all.
      Object.entries(aspectValues).forEach(function ([propertyKey, value]) {
        if (device[propertyKey] === undefined) {
          device[propertyKey] = value;
        }
      });

      devices.push(HardwareProfileData.create(engine, device));
    });

    // The aspect level values are exposed alongside the profiles so a
    // caller with no matching profiles can still read the reason.
    const result = Object.assign({}, aspectValues, { profiles: devices });

    const data = new AspectDataDictionary(
      {
        flowElement: engine,
        contents: result
      });

    flowData.setElementData(data);
  }
}

module.exports = HardwareProfileCloudEngine;
