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
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const request = require('supertest');

const fs = require('fs');

// Load the example module
const example = require(path.join(__dirname, '/gettingStarted.js'));

const shared = require51('fiftyone.ipintelligence.shared');
const tc = shared.testConstants;
const keyUtils = shared.keyUtils;
const OptionsExtension = shared.optionsExtension;
const CloudRequestEngine =
  require51('fiftyone.pipeline.cloudrequestengine').CloudRequestEngine;

const resourceKeyName = tc.envVars.resourceKeyBespokeVariable;

// An IPv4 address registered to VMCBBUK in the United Kingdom, in the range
// 82.12.34.0 to 82.12.34.255.
const KNOWN_UK_IPV4 = '82.12.34.23';

// The text of the value cell next to a label in the results table, or
// undefined when the page has no such row.
const valueOf = (html, label) => {
  const match = new RegExp('>' + label +
    ':</td>\\s*<td class="c-eg-table__cell">([^<]*)</td>').exec(html);
  return match ? match[1] : undefined;
};

// The test is skipped, and says which variable to set, when there is no
// resource key.
const resourceKey = keyUtils.getResourceKey(resourceKeyName);
const run = resourceKey ? test : test.skip;
const name = 'cloud getting started web';
const title = name +
  (resourceKey ? '' : ` (skipped: '${resourceKeyName}' is not set)`);
if (!resourceKey) {
  console.warn(`Skipping '${name}': set the environment variable ` +
    `'${resourceKeyName}' to a resource key that carries the ip product ` +
    'to run it.');
}

describe('Examples', () => {
  run(title, async () => {
    await keyUtils.requireProduct(
      new CloudRequestEngine({ resourceKey }), 'ip');

    // Load configuration options
    const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

    // Update element path with a full path
    OptionsExtension.updateElementPath(options, __dirname);

    OptionsExtension.setResourceKey(options, resourceKey);

    example.setPipeline(options);
    const response = await request(example.server)
      .get('/?client-ip=' + KNOWN_UK_IPV4);
    expect(response.statusCode).toBe(200);
    const html = response.text;
    expect(html).toContain('Detection results');
    expect(html).toContain(KNOWN_UK_IPV4);
    expect(valueOf(html, 'Registered Name')).toContain('VMCBBUK');
    expect([
      valueOf(html, 'Country'), valueOf(html, 'Country Code')
    ].join(' ')).toMatch(/United Kingdom|GB/);
    expect([
      valueOf(html, 'IP Range Start'), valueOf(html, 'IP Range End')
    ].join(' ')).toMatch(/82\.12\.34\.0\b|82\.12\.34\.255\b/);
  });
});
