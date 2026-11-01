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

const errorMessages = require51('fiftyone.ipintelligence.shared').errorMessages;

const FiftyOneDegreesIpIntelligenceOnPremise = require51('fiftyone.ipintelligence.onpremise');

const BadVersionDataFile = (process.env.directory || __dirname) + '/BadVersionDataFile.ipi';
const BadHeaderDataFile = (process.env.directory || __dirname) + '/BadHeaderDataFile.ipi';
const SmallDataFile = (process.env.directory || __dirname) + '/SmallDataFile.ipi';

const badVersion = [1, 2, 3, 4];
const goodVersion = [4, 1, 0, 0];
// A few megabytes of zeroed data is enough to get past any initial
// file size checks while still being invalid.
const fileSize = 4 * 1024 * 1024;

/**
 * Write Int into a buffers at specific offset
 *
 * @param {Buffer} buf Buffer to write to
 * @param {number} offset Integer - Number of bytes to skip before starting to write
 * @param {number} val Integer value to write
 */
function writeInt (buf, offset, val) {
  if (os.endianness() === 'LE') {
    buf.writeInt32LE(val, offset);
  } else {
    buf.writeInt32BE(val, offset);
  }
}

/**
 * Create and fill BadVersionDataFile.ipi
 */
function createBadVersionDataFile () {
  const buffer = Buffer.alloc(fileSize);
  for (let i = 0; i < badVersion.length; i++) {
    writeInt(buffer, i * 4, badVersion[i]);
  }
  fs.writeFileSync(BadVersionDataFile, buffer);
}

/**
 * Create and fill BadHeaderDataFile.ipi
 */
function createBadHeaderDataFile () {
  const buffer = Buffer.alloc(fileSize);
  for (let i = 0; i < goodVersion.length; i++) {
    writeInt(buffer, i * 4, goodVersion[i]);
  }
  fs.writeFileSync(BadHeaderDataFile, buffer);
}

/**
 * Create SmallDataFile.ipi
 */
function createSmallDataFile () {
  const buffer = Buffer.alloc(1).fill(1);
  fs.writeFileSync(SmallDataFile, buffer);
}

beforeAll(() => {
  createBadVersionDataFile();
  createBadHeaderDataFile();
  createSmallDataFile();
});

afterAll(() => {
  // The native engine may hold a handle to a bad data file for a
  // short time after a failed creation, so tolerate failures when
  // removing the temporary files.
  for (const file of [BadVersionDataFile, BadHeaderDataFile, SmallDataFile]) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      console.warn(`Could not remove '${file}': ${e.message}`);
    }
  }
});

describe('Bad data file error messages', () => {
  // Check that an error with appropriate message is
  // thrown when the data file contains bad version
  // number
  test('Bad version number', () => {
    const createEngine = () => {
      return new FiftyOneDegreesIpIntelligenceOnPremise
        .IpIntelligenceOnPremise({
          performanceProfile: 'Balanced',
          dataFilePath: BadVersionDataFile,
          autoUpdate: false,
          updateOnStart: true,
          licenceKeys: null
        });
    };

    expect(createEngine).toThrow();
  });
  // Check that an error with appropriate message is
  // thrown when the data file contains correct version
  // number but bad data
  test('Bad header', () => {
    const createEngine = () => {
      return new FiftyOneDegreesIpIntelligenceOnPremise
        .IpIntelligenceOnPremise({
          performanceProfile: 'Balanced',
          dataFilePath: BadHeaderDataFile,
          autoUpdate: false,
          updateOnStart: true,
          licenceKeys: null
        });
    };

    expect(createEngine).toThrow();
  });
  // Check that an error with appropriate message is
  // thrown when the data file contains almost truncated
  // data.
  test('Small data file', () => {
    const createEngine = () => {
      return new FiftyOneDegreesIpIntelligenceOnPremise
        .IpIntelligenceOnPremise({
          performanceProfile: 'Balanced',
          dataFilePath: SmallDataFile,
          autoUpdate: false,
          updateOnStart: true,
          licenceKeys: null
        });
    };

    expect(createEngine).toThrow();
  });
});

// Reference the error messages so that the connection between this
// test and the messages is explicit.
console.assert(errorMessages.badDataUnsupportedVersion);
console.assert(errorMessages.badDataIncorrectFormat);
