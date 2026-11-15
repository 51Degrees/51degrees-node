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

// Each public function of this package that throws says what it throws in
// a JSDoc @throws tag with a type, so an editor and the generated types show
// it, as exception-handling.md lines 17 to 19 ask.

const fs = require('fs');
const path = require('path');

const PACKAGE = path.join(__dirname, '..');

// Each function that throws, as the file it is in, the class it belongs to
// and the line that starts it.
const THROWING = [
  ['aspectPropertyValue.js', 'class AspectPropertyValue', '  get value () {'],
  ['elementData.js', 'class ElementData', '  constructor ({ flowElement }) {'],
  ['elementData.js', 'class ElementData', '  get (key) {'],
  ['flowData.js', 'class FlowData', '  get (flowElementDataKey) {'],
  ['javascriptbuilder.js', 'class JavaScriptBuilderElement', '  constructor ({'],
  ['jsonbundler.js', 'class JSONBundlerElement', '  getSequence (flowData) {'],
  ['pipelineBuilder.js', 'class PipelineBuilder',
    '  buildFromConfigurationFile (configPath) {'],
  ['pipelineBuilder.js', 'class PipelineBuilder',
    '  buildFromConfiguration (config) {']
];

// The JSDoc block that ends on the line before the function, or an empty
// string where there is none.
const jsDocBefore = (file, className, start) => {
  const lines = fs.readFileSync(path.join(PACKAGE, file), 'utf8')
    .split(/\r?\n/);
  const classAt = lines.findIndex((line) => line.startsWith(className + ' '));
  expect(classAt).toBeGreaterThanOrEqual(0);
  const at = lines.indexOf(start, classAt);
  expect(at).toBeGreaterThan(classAt);
  if (lines[at - 1].trim() !== '*/') {
    return '';
  }
  let first = at - 1;
  while (first > 0 && lines[first].trim() !== '/**') {
    first--;
  }
  return lines.slice(first, at).join('\n');
};

describe('a function that throws', () => {
  test.each(THROWING)('%s, %s, %s, has a typed @throws tag',
    (file, className, start) => {
      expect(jsDocBefore(file, className, start)).toMatch(/@throws \{[^}]+\}/);
    });
});
