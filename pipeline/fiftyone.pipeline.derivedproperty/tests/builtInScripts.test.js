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
 * The scripts built into the package, which are the scripts folder of the
 * derived-properties submodule.
 */

const fs = require('fs');
const path = require('path');
const pkg = require('..');
const { SUBMODULE } = require('./helpers');

const SCRIPTS = path.join(SUBMODULE, 'scripts');

test('the built in scripts are the scripts of the submodule', () => {
  const files = fs.readdirSync(SCRIPTS)
    .filter(file => /\.(ya?ml|json)$/i.test(file))
    .map(file => path.basename(file, path.extname(file)))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  expect(pkg.builtInScriptNames()).toEqual(files);
});

test('the package carries the scripts and only the scripts', () => {
  const manifest = require('../package.json');
  expect(manifest.files).toContain('derived-properties/scripts/');
  expect(manifest.files.filter(file => file.startsWith('derived-properties')))
    .toEqual(['derived-properties/scripts/']);
});

test('every built in script has the shared cases', () => {
  for (const name of pkg.builtInScriptNames()) {
    expect(fs.existsSync(path.join(SUBMODULE, 'tests', `${name}.cases.yaml`)))
      .toBe(true);
  }
});

test('one element runs every built in script', () => {
  const builder = new pkg.DerivedPropertyElementBuilder();
  for (const name of pkg.builtInScriptNames()) {
    builder.addBuiltInScript(name);
  }
  const element = builder.build();
  expect(element.scripts.map(script => script.name))
    .toEqual(pkg.builtInScriptNames());
  expect(element.scripts.map(script => script.source))
    .toEqual(pkg.builtInScriptNames().map(name => `built in ${name}`));
});

test('built in names ignore case', () => {
  const element = new pkg.DerivedPropertyElementBuilder()
    .addBuiltInScript('humanCONFIDENCE')
    .build();
  expect(element.scripts[0].name).toBe('HumanConfidence');
});

test('an unknown built in script names the ones there are', () => {
  expect(() => new pkg.DerivedPropertyElementBuilder()
    .addBuiltInScript('Nope')
    .build())
    .toThrow("there is no script called 'Nope' in this package. The " +
      `scripts in this package are ${pkg.builtInScriptNames().join(', ')}. ` +
      'A script from your own environment is added with scriptFiles ' +
      'rather than scripts');
});
