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

// The message for a Property the on-premise engine does not have in its
// results says whether the data file's tier lacks it, in the words of the
// specification's table (properties.md lines 116 to 139), and decides the
// reason in the order lines 141 to 177 give. The engine here stands in for
// the native one, so the test needs no data file.

const path = require('path');

const MissingPropertyService = require(
  path.resolve(__dirname, '..', 'dataFileMissingPropertyService'));

// Stands in for the engine, which the message names by its type.
class DeviceDetectionOnPremise {
  constructor (product) {
    this.dataKey = 'device';
    this.engine = { getProduct: () => product };
    this.properties = {
      ismobile: { dataFiles: ['Lite', 'Premium', 'Enterprise', 'TAC'] },
      hardwarevendor: { dataFiles: ['Premium', 'Enterprise', 'TAC'] },
      nativemodel: { dataFiles: [] }
    };
  }
}

// The message of the error reading the Property threw.
const thrown = (key, product) => {
  try {
    new MissingPropertyService().check(key, new DeviceDetectionOnPremise(product));
  } catch (e) {
    return e.message;
  }
  return undefined;
};

describe('the missing property message', () => {
  test('names the tiers that have a Property the data file lacks', () => {
    expect(thrown('HardwareVendor', 'Lite'))
      .toBe("Property 'HardwareVendor' not found in data for element " +
        "'device'. This is because your license or data file does not " +
        'include this property. It is available with the ' +
        'Premium,Enterprise,TAC license/data for the ' +
        'DeviceDetectionOnPremise. To upgrade, see https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyupgrade.');
  });

  test('leaves the tiers out when the metadata names none', () => {
    expect(thrown('nativemodel', 'Lite'))
      .toBe("Property 'nativemodel' not found in data for element " +
        "'device'. This is because your license or data file does not " +
        'include this property. To see which licenses include it, see https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyupgradenotiers.');
  });

  test('is excluded for a Property the data file\'s tier has', () => {
    expect(thrown('hardwarevendor', 'Enterprise'))
      .toBe("Property 'hardwarevendor' not found in data for element " +
        "'device'. This is because the property has been excluded when " +
        'configuring the engine.');
  });

  test('is unknown for a Property the metadata does not list', () => {
    expect(thrown('nosuchproperty', 'Lite'))
      .toBe("Property 'nosuchproperty' not found in data for element " +
        "'device'. The reason for this is unknown. Please check that the " +
        'aspect and property name are correct.');
  });
});
