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

// How the engine makes its native engine. It loads the native module built
// for the system it runs on (ip-intelligence-on-premise.md line 50), and
// one given no Property names creates the native engine with no names
// (line 395).

const fs = require('fs');
const os = require('os');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const Engine = require51('fiftyone.ipintelligence.onpremise')
  .IpIntelligenceOnPremise;

// The small ASN data file, which the other tests here use.
const ASN = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
const TIMEOUT_MS = 300000;

// The native module for this system, named for its platform, its
// architecture and the major version of Node.js.
const MODULE = path.join(__dirname, '..', 'build',
  'FiftyOneIpIntelligenceIpiV41-' + os.platform() + '-' + process.arch +
  '-' + process.versions.node.split('.')[0] + '.node');

// An engine on the ASN data file with the options given.
const build = (options) => new Engine({
  dataFilePath: ASN,
  autoUpdate: false,
  fileSystemWatcher: false,
  licenceKeys: '',
  ...options
});

beforeAll(() => {
  if (!fs.existsSync(ASN)) {
    throw new Error(`No data file at '${ASN}'.`);
  }
});

test('the engine loads the native module built for this system', () => {
  expect(build({}).swigWrapper).toBe(require(MODULE));
}, TIMEOUT_MS);

describe('the Property names the native engine is created with', () => {
  const native = require(MODULE);
  const Required = native.RequiredPropertiesConfigSwig;
  let sizes;

  beforeEach(() => {
    sizes = [];
    native.RequiredPropertiesConfigSwig = function (list) {
      sizes.push(list.size());
      return new Required(list);
    };
  });

  afterEach(() => {
    native.RequiredPropertiesConfigSwig = Required;
  });

  test('are none when the engine is given none', () => {
    build({});
    expect(sizes).toEqual([0]);
  }, TIMEOUT_MS);

  test('are those the engine is given', () => {
    const names = Object.keys(build({}).properties).slice(0, 2);
    sizes = [];
    build({ restrictedProperties: names });
    expect(sizes).toEqual([names.length]);
  }, TIMEOUT_MS);
});
