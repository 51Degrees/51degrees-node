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
const path = require('path');

// Every 51Degrees package for Node.js is published under a name that starts
// with this.
const PACKAGE_PREFIX = 'fiftyone.';

// The package that holds the Pipeline.
const PIPELINE_PACKAGE = 'fiftyone.pipeline.core';

/**
 * The name, version and folder of the package a file belongs to, read from
 * the nearest package.json above it.
 *
 * @param {string} file the path of a file
 * @returns {{name: string, version: string, folder: string}|undefined} the
 * package, or undefined when no package.json can be read
 */
function packageOfFile (file) {
  let folder = path.dirname(file);
  for (;;) {
    const manifest = path.join(folder, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const json = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        return { name: json.name, version: json.version, folder };
      } catch (e) {
        return undefined;
      }
    }
    const parent = path.dirname(folder);
    if (parent === folder) {
      return undefined;
    }
    folder = parent;
  }
}

/**
 * The file of the loaded module that defines a class. A module that exports
 * the class itself is preferred to one that exports it among others, so
 * that a package which only passes on another package's class is not
 * named for it.
 *
 * @param {Function} type the class
 * @returns {string|undefined} the file, or undefined when no loaded module
 * exports the class
 */
function moduleFileOf (type) {
  const loaded = Object.keys(require.cache).map((key) => require.cache[key]);
  const direct = loaded.find((module) => module && module.exports === type);
  if (direct) {
    return direct.filename;
  }
  const among = loaded.find((module) => {
    const exported = module && module.exports;
    if (!exported || typeof exported !== 'object') {
      return false;
    }
    try {
      return Object.keys(exported).some((key) => exported[key] === type);
    } catch (e) {
      return false;
    }
  });
  return among ? among.filename : undefined;
}

/**
 * The 51Degrees packages a Pipeline uses, each once: the package that holds
 * the Pipeline, the package that holds each of its Flow Elements and every
 * 51Degrees package those depend on.
 *
 * @param {Array<object>} flowElements the Flow Elements of the Pipeline
 * @returns {Array<{name: string, version: string}>} the packages, ordered by
 * name
 */
function packageVersions (flowElements) {
  const found = new Map();
  const add = (pkg) => {
    if (!pkg || typeof pkg.name !== 'string' ||
      !pkg.name.startsWith(PACKAGE_PREFIX) || found.has(pkg.name)) {
      return;
    }
    found.set(pkg.name, pkg);
    let dependencies = {};
    try {
      dependencies = JSON.parse(fs.readFileSync(
        path.join(pkg.folder, 'package.json'), 'utf8')).dependencies || {};
    } catch (e) {
      dependencies = {};
    }
    Object.keys(dependencies)
      .filter((name) => name.startsWith(PACKAGE_PREFIX))
      .forEach((name) => {
        try {
          add(packageOfFile(require.resolve(`${name}/package.json`,
            { paths: [pkg.folder] })));
        } catch (e) {
          // A dependency that cannot be found is not in use.
        }
      });
  };

  try {
    add(packageOfFile(require.resolve(`${PIPELINE_PACKAGE}/package.json`)));
  } catch (e) {
    // A Pipeline package with no readable manifest cannot be named.
  }
  flowElements.forEach((element) => {
    const file = element ? moduleFileOf(element.constructor) : undefined;
    if (file) {
      add(packageOfFile(file));
    }
  });

  return Array.from(found.values())
    .map(({ name, version }) => ({ name, version: String(version) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

module.exports = packageVersions;
