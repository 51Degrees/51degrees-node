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

// Every web example listens on port 5151 unless it is told otherwise. The
// source is read rather than run, so no server is started.

const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 5151;

// The port an example's source chooses, with the variable before it if it
// is read.
const PORT_PATTERN =
  /\b(?:const|let)\s+(?:port|portNum)\s*=\s*(?:Number\(\s*)?(process\.env\._51DEGREES_EXAMPLE_HTTP_PORTS\s*\|\|\s*)?(\d+)/;

// The web examples.
const EXAMPLES = [
  'examples/webIntegration.js'
];

const portOf = (file) => PORT_PATTERN.exec(
  fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));

for (const file of EXAMPLES) {
  test(`${file} listens on port ${DEFAULT_PORT} by default`, () => {
    const match = portOf(file);
    expect(match).not.toBeNull();
    expect(Number(match[2])).toBe(DEFAULT_PORT);
  });
}
