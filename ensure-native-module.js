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

// Ensures the on-premise native module exists for the current platform and
// Node version before the tests run. Where the module is missing, a build
// is attempted using node-gyp. The script exits with a clear error where
// the module cannot be built, so that the tests do not fail later with a
// confusing 'module not found' error.

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Node major versions that the SWIG generated binding supports. Newer
// versions removed V8 APIs that the binding depends on.
const SUPPORTED_NODE_MAJOR_VERSIONS = [20, 22];

const nodeMajor = Number(process.version.split('.')[0].replace('v', ''));
const packageDir = path.join(__dirname, 'fiftyone.ipintelligence.onpremise');
const moduleFileName =
  `FiftyOneIpIntelligenceIpiV41-${os.platform()}-${process.arch}-` +
  `${nodeMajor}.node`;
const moduleFilePath = path.join(packageDir, 'build', moduleFileName);

if (fs.existsSync(moduleFilePath)) {
  console.log(`Native module found: ${moduleFilePath}`);
  process.exit(0);
}

console.log(`Native module '${moduleFileName}' not found. ` +
  'Attempting to build it.');

if (SUPPORTED_NODE_MAJOR_VERSIONS.includes(nodeMajor) === false) {
  console.error(
    'ERROR: The on-premise native module does not support Node ' +
    `${nodeMajor}. Supported Node major versions are ` +
    `${SUPPORTED_NODE_MAJOR_VERSIONS.join(' and ')}. Switch version ` +
    '(for example \'nvm use 22\') and run again.');
  process.exit(1);
}

if (fs.existsSync(path.join(
  packageDir, 'ip-intelligence-cxx', 'src')) === false) {
  console.error(
    'ERROR: The ip-intelligence-cxx submodule is missing. Run ' +
    '\'git submodule update --init --recursive\' and run again.');
  process.exit(1);
}

try {
  // The gyp configuration is stored as binding.51d so that npm install
  // does not trigger a build for cloud only users.
  fs.copyFileSync(
    path.join(packageDir, 'binding.51d'),
    path.join(packageDir, 'binding.gyp'));

  // Preserve any existing named native modules. node-gyp rebuild removes
  // the build directory.
  const buildDir = path.join(packageDir, 'build');
  const preserved = new Map();
  if (fs.existsSync(buildDir)) {
    for (const file of fs.readdirSync(buildDir)) {
      if (file.endsWith('.node')) {
        preserved.set(file, fs.readFileSync(path.join(buildDir, file)));
      }
    }
  }

  execSync('npx --yes node-gyp@12 rebuild', {
    cwd: packageDir,
    stdio: 'inherit'
  });

  // Restore the preserved modules and add the newly built one using the
  // expected naming convention.
  for (const [file, content] of preserved) {
    fs.writeFileSync(path.join(buildDir, file), content);
  }
  fs.copyFileSync(
    path.join(buildDir, 'Release', 'FiftyOneIpIntelligenceIpiV41.node'),
    moduleFilePath);

  console.log(`Native module built: ${moduleFilePath}`);
} catch (e) {
  console.error(
    'ERROR: Failed to build the on-premise native module. See the build ' +
    'output above for the reason. The pre-requisites are described in ' +
    'the \'Build from Source On-Premise\' section of the readme. ' +
    `(${e.message})`);
  process.exit(1);
}
