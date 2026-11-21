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

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

// The repository root, two levels above this file.
const REPOSITORY_ROOT = path.join(__dirname, '..', '..');

// Both expressions below ignore letter case, because Windows does, so a
// lower-case name reaches the same variable there and is banned too.

// A POSIX shell cannot set a variable whose name starts with a digit, so
// every 51Degrees name carries a leading underscore. This matches the old
// digit-initial form, and only where no word character runs before it, so
// the correct '_51DEGREES_' form and a name holding the text inside a
// longer word are both left alone. The old form is no longer read, and it
// appears only in the deprecated constants that hold it, in the files listed
// below.
const DIGIT_INITIAL_NAME = /(^|[^A-Za-z0-9_])(51DEGREES_[A-Za-z0-9_]*)/gi;

// The files that keep a deprecated constant holding a digit-initial name.
const DIGIT_INITIAL_NAME_FILES = new Set([
  path.join('device-detection', 'fiftyone.devicedetection.onpremise',
    'examples', 'onpremise', 'exampleUtils.js'),
  path.join('ip-intelligence', 'fiftyone.ipintelligence.cloud', 'examples',
    'cloud', 'exampleUtils.js'),
  path.join('ip-intelligence', 'fiftyone.ipintelligence.onpremise',
    'examples', 'onpremise', 'exampleUtils.js')
]);

// The bare RESOURCE_KEY and LICENSE_KEY names are no longer read, so a read
// of one must not appear anywhere. Only a read is matched,
// being the two forms Node offers and the two PowerShell forms, so the
// same text in a placeholder such as '!!YOUR_RESOURCE_KEY!!' or in a
// longer name such as TEST_SUPER_RESOURCE_KEY is left alone. A read is
// what adds a fallback, whereas prose naming the old name cannot.
const FALLBACK_NAME =
  /(?:process\.env\.|process\.env\[\s*['"]|\$env:|\$\{env:)(RESOURCE_KEY|LICENSE_KEY)(?![A-Za-z0-9_])/gi;

// The cloud endpoint is _51DEGREES_CLOUD_ENDPOINT, as in every other
// 51Degrees language. The name it had before is no longer read, so it must
// not appear outside the files listed below, whether read, set or
// described. Only the whole name
// is matched, so a longer name holding it is left alone.
const OLD_NAME = /(^|[^A-Za-z0-9_])(FOD_CLOUD_API_URL)(?![A-Za-z0-9_])/gi;

// The keys come only under their agreed _51DEGREES_ names, which common-ci
// exports from the organization secrets of the same names. So none of these
// may appear anywhere, read, set or described:
// - the names that left the agreed list, which no secret fills: the four
//   header resource keys the Accept-CH tests used, the ACCEPTCH ones, the
//   CloudV5Bespoke license under its long name and the IP Intelligence
//   data file address
// - the old secrets that held keys and addresses
// - the inputs a workflow used to map those secrets to.
// Only the whole name is matched, so a longer name holding one, such as a
// constant naming another variable, is left alone.
const OLD_KEY_NAME = new RegExp('(^|[^A-Za-z0-9_])(' + [
  '_51DEGREES_RESOURCE_KEY_(?:PLATFORM|HARDWARE|BROWSER|NO_SETHEADER)',
  '_51DEGREES_RESOURCE_KEY_ACCEPTCH_[A-Z]+',
  '_51DEGREES_LICENSE_KEY_CLOUDV5BESPOKE',
  '_51DEGREES_IPI_DATA_FILE_URL',
  'DEVICE_DETECTION_KEY', 'DEVICE_DETECTION_URL', 'IP_INTELLIGENCE_KEY',
  'IPI_DATA_FILE_URL', 'CSV_URL', 'ACCEPTCH_[A-Z]+_KEY',
  'Test(?:Super|Platform|Hardware|Browser|NoSetHeader)?ResourceKey',
  'TestLicenseKey', 'DeviceDetectionUrl', 'IpIntelligenceUrl', 'CsvUrl'
].join('|') + ')(?![A-Za-z0-9_])', 'g');

// The files that document that the old cloud endpoint name is no longer
// read.
const OLD_NAME_FILES = new Set([
  path.join('pipeline', 'fiftyone.pipeline.cloudrequestengine', 'readme.md'),
  path.join('pipeline', 'fiftyone.pipeline.did', 'readme.md')
]);

// Reading a binary file as text yields no useful name and wastes time, so
// files that never carry one are skipped by extension.
const SKIPPED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
  '.ttf', '.eot', '.pdf', '.zip', '.gz', '.hash', '.ipi', '.dat', '.node'
]);

// These files name the old forms on purpose, to describe what is banned.
const SKIPPED_FILES = new Set([
  path.join('ci', 'tests', 'environmentVariableNames.test.js'),
  path.join('ci', 'key-names.Tests.ps1')
]);

/**
 * Every file git tracks, which leaves out the cxx submodule and anything
 * a build produced.
 *
 * @returns {string[]} the paths, relative to the repository root
 */
const trackedFiles = () => {
  const output = childProcess.execSync('git ls-files', {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  return output.split('\n').filter((line) => line.length > 0);
};

/**
 * Find every name one expression matches in one file.
 *
 * @param {string} file the path, relative to the repository root
 * @param {RegExp} expression the expression, whose last group is the name
 * @returns {string[]} one entry per occurrence, with its line and name
 */
const namesInFile = (file, expression) => {
  const full = path.join(REPOSITORY_ROOT, file);

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return [];
  }

  const found = [];
  const lines = fs.readFileSync(full, 'utf8').split('\n');

  lines.forEach((line, index) => {
    for (const match of line.matchAll(expression)) {
      found.push(`${file}:${index + 1}: ${match[match.length - 1]}`);
    }
  });

  return found;
};

/**
 * Find every name one expression matches across the whole repository.
 *
 * @param {RegExp} expression the expression, whose last group is the name
 * @param {Set<string>} allowedFiles files that may carry the name, which
 * are not searched
 * @returns {string[]} one entry per occurrence, with its file, line and name
 */
const namesInRepository = (expression, allowedFiles = new Set()) => {
  const found = [];

  for (const file of trackedFiles()) {
    if (SKIPPED_FILES.has(path.normalize(file)) ||
      allowedFiles.has(path.normalize(file))) {
      continue;
    }
    if (SKIPPED_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      continue;
    }
    found.push(...namesInFile(file, expression));
  }

  return found;
};

describe('environment variable names', () => {
  // A file that no longer carries an old name must leave its list, so no
  // list outlasts the deprecated names.
  const unusedFiles = (files, expression) => [...files].filter(
    (file) => namesInFile(file, expression).length === 0);

  it('names a variable that starts with a digit only where read', () => {
    expect(namesInRepository(DIGIT_INITIAL_NAME, DIGIT_INITIAL_NAME_FILES))
      .toEqual([]);
  });

  it('lists no file that names no variable that starts with a digit', () => {
    expect(unusedFiles(DIGIT_INITIAL_NAME_FILES, DIGIT_INITIAL_NAME))
      .toEqual([]);
  });

  it('reads no bare resource key or licence key name', () => {
    expect(namesInRepository(FALLBACK_NAME)).toEqual([]);
  });

  it('names the old cloud endpoint variable only where documented',
    () => {
      expect(namesInRepository(OLD_NAME, OLD_NAME_FILES)).toEqual([]);
    });

  it('lists no file that does not name the old cloud endpoint variable',
    () => {
      expect(unusedFiles(OLD_NAME_FILES, OLD_NAME)).toEqual([]);
    });

  it('names no key that is not under its agreed name', () => {
    expect(namesInRepository(OLD_KEY_NAME)).toEqual([]);
  });

  // A 51Did license redeems only with a resource key of the same account,
  // so the 51DID resource key must come from the secret of its own name.
  // Filled from another key, such as BESPOKE, the licensed redeem answers
  // unreadable.
  it('fills the 51DID resource key only from the secret of that name', () => {
    const assignment = /^\s*_51DEGREES_RESOURCE_KEY_51DID\s*:\s*(.*?)\s*$/;
    const expected = '$' + '{{ secrets._51DEGREES_RESOURCE_KEY_51DID }}';
    const found = [];

    for (const file of trackedFiles()) {
      if (!/^\.github\/workflows\/.*\.ya?ml$/.test(file)) {
        continue;
      }
      const lines = fs.readFileSync(path.join(REPOSITORY_ROOT, file), 'utf8')
        .split('\n');
      lines.forEach((line, index) => {
        const match = line.match(assignment);
        if (match) {
          found.push(`${file}:${index + 1}: ${match[1]}`);
        }
      });
    }

    // The Cloud 51Did workflow fills it, so the test cannot pass by
    // finding nothing.
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((entry) => !entry.endsWith(': ' + expected)))
      .toEqual([]);
  });

  it('matches only a whole old or dropped key name', () => {
    const subject = (text) =>
      [...text.matchAll(OLD_KEY_NAME)].map((match) => match[2]);

    // The agreed names are not a match.
    expect(subject('process.env._51DEGREES_RESOURCE_KEY')).toEqual([]);
    expect(subject('process.env._51DEGREES_RESOURCE_KEY_SUPER')).toEqual([]);
    expect(subject('_51DEGREES_LICENSE_KEY_BESPOKE')).toEqual([]);
    expect(subject('secrets._51DEGREES_RESOURCE_KEY_BESPOKE')).toEqual([]);

    // Neither is a longer name holding an old one, nor a stand-in key.
    expect(subject("const IPI_DATA_FILE_VARIABLE = '_51DEGREES_IPI_PATH';"))
      .toEqual([]);
    expect(subject("const RESOURCE = 'AQTestResourceKey';")).toEqual([]);

    // A dropped name is a match, read, set or in prose.
    expect(subject("browserResourceKeyEnvVar: '_51DEGREES_RESOURCE_KEY_BROWSER'"))
      .toEqual(['_51DEGREES_RESOURCE_KEY_BROWSER']);
    expect(subject('$env:_51DEGREES_RESOURCE_KEY_NO_SETHEADER = $key'))
      .toEqual(['_51DEGREES_RESOURCE_KEY_NO_SETHEADER']);

    // So is an old secret or input, as a workflow or script names it.
    // The dollar sign is kept apart, as above.
    expect(subject('DeviceDetection: $' + '{{ secrets.DEVICE_DETECTION_KEY }}'))
      .toEqual(['DEVICE_DETECTION_KEY']);
    expect(subject('$env:_51DEGREES_RESOURCE_KEY = $TestResourceKey'))
      .toEqual(['TestResourceKey']);
    expect(subject('$Options.Keys.TestPlatformResourceKey'))
      .toEqual(['TestPlatformResourceKey']);
  });

  it('matches only a name that starts with the digit', () => {
    const subject = (text) =>
      [...text.matchAll(DIGIT_INITIAL_NAME)].map((match) => match[2]);

    // The form in use is not a match, in either position.
    expect(subject('_51DEGREES_DD_PATH')).toEqual([]);
    expect(subject('$env:_51DEGREES_RESOURCE_KEY = $key')).toEqual([]);

    // Neither is the text inside a longer word.
    expect(subject('PREFIX51DEGREES_DD_PATH')).toEqual([]);

    // The old form is a match, wherever it sits on the line.
    expect(subject('51DEGREES_DD_PATH')).toEqual(['51DEGREES_DD_PATH']);
    expect(subject("set '51DEGREES_IPI_PATH' now"))
      .toEqual(['51DEGREES_IPI_PATH']);
    expect(subject('51DEGREES_DD_PATH and 51DEGREES_IPI_PATH'))
      .toEqual(['51DEGREES_DD_PATH', '51DEGREES_IPI_PATH']);

    // In any letter case.
    expect(subject('51degrees_dd_path')).toEqual(['51degrees_dd_path']);
  });

  it('matches only the whole old cloud endpoint name', () => {
    const subject = (text) =>
      [...text.matchAll(OLD_NAME)].map((match) => match[2]);

    // The name in use is not a match.
    expect(subject('process.env._51DEGREES_CLOUD_ENDPOINT')).toEqual([]);

    // Neither is a longer name holding the old one.
    expect(subject('process.env.FOD_CLOUD_API_URL_V2')).toEqual([]);
    expect(subject('MY_FOD_CLOUD_API_URL=x')).toEqual([]);

    // The old name is a match, read, set or in prose.
    expect(subject('process.env.FOD_CLOUD_API_URL'))
      .toEqual(['FOD_CLOUD_API_URL']);
    expect(subject("'FOD_CLOUD_API_URL' = 'https://cloud.example/'"))
      .toEqual(['FOD_CLOUD_API_URL']);
    expect(subject('FOD_CLOUD_API_URL=https://cloud.example/ node x.js'))
      .toEqual(['FOD_CLOUD_API_URL']);

    // In any letter case.
    expect(subject('process.env.fod_cloud_api_url'))
      .toEqual(['fod_cloud_api_url']);
  });

  it('matches only a read of the bare name', () => {
    const subject = (text) =>
      [...text.matchAll(FALLBACK_NAME)].map((match) => match[1]);

    // A read of the name in use is not a match.
    expect(subject('process.env._51DEGREES_RESOURCE_KEY')).toEqual([]);
    expect(subject("process.env['_51DEGREES_LICENSE_KEY']")).toEqual([]);
    expect(subject('$env:_51DEGREES_RESOURCE_KEY = $key')).toEqual([]);

    // Neither is a read of a longer name that ends in the same text.
    expect(subject('process.env.TEST_SUPER_RESOURCE_KEY')).toEqual([]);
    expect(subject('process.env._51DEGREES_LICENSE_KEY_51DID')).toEqual([]);

    // Neither is the placeholder, nor prose naming the old name.
    expect(subject("const PLACEHOLDER = '!!YOUR_RESOURCE_KEY!!';")).toEqual([]);
    expect(subject('the RESOURCE_KEY name is no longer read')).toEqual([]);

    // A read of the bare name is a match, in each of the three forms.
    expect(subject('process.env.RESOURCE_KEY')).toEqual(['RESOURCE_KEY']);
    expect(subject("process.env['LICENSE_KEY']")).toEqual(['LICENSE_KEY']);
    expect(subject('$env:RESOURCE_KEY = $TestResourceKey'))
      .toEqual(['RESOURCE_KEY']);

    // PowerShell's braced form is the same read. The dollar sign is kept
    // apart so the text is not read as a template string.
    const braced = (name) => '$' + '{env:' + name + '} = $key';
    expect(subject(braced('LICENSE_KEY'))).toEqual(['LICENSE_KEY']);
    expect(subject(braced('_51DEGREES_LICENSE_KEY'))).toEqual([]);

    // Including a read behind the name in use.
    expect(subject('process.env._51DEGREES_RESOURCE_KEY || ' +
      'process.env.RESOURCE_KEY')).toEqual(['RESOURCE_KEY']);

    // In any letter case.
    expect(subject('process.env.resource_key')).toEqual(['resource_key']);
  });
});
