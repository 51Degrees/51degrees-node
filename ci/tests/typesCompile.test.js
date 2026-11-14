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

// Compiles a TypeScript file that imports every package with types by its
// package name, as a caller does, with the type files themselves checked.
// The file exists only in memory, at the repository root, so the packages
// resolve through the workspace links in node_modules.

const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECK_FILE = path.join(ROOT, 'types-compile-check.ts');
const COMPILE_TIMEOUT_MS = 120000;

const OPTIONS = {
  noEmit: true,
  skipLibCheck: false,
  esModuleInterop: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  moduleResolution: ts.ModuleResolutionKind.Node10
};

const packagesWithTypes = () =>
  require(path.join(ROOT, 'package.json')).workspaces
    .map((folder) => require(path.join(ROOT, folder, 'package.json')))
    .filter((manifest) => manifest.types || manifest.typings)
    .map((manifest) => manifest.name);

const isCheckFile = (fileName) =>
  path.resolve(fileName).toLowerCase() === CHECK_FILE.toLowerCase();

const compile = (source) => {
  const host = ts.createCompilerHost(OPTIONS);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (fileName) =>
    isCheckFile(fileName) || fileExists.call(host, fileName);
  host.readFile = (fileName) =>
    isCheckFile(fileName) ? source : readFile.call(host, fileName);
  host.getSourceFile = (fileName, language, ...rest) =>
    isCheckFile(fileName)
      ? ts.createSourceFile(fileName, source, language)
      : getSourceFile.call(host, fileName, language, ...rest);
  const program = ts.createProgram([CHECK_FILE], OPTIONS, host);
  const formatHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => ROOT,
    getNewLine: () => '\n'
  };
  return ts.getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.formatDiagnostic(diagnostic, formatHost).trim());
};

describe('published types', () => {
  test('every package\'s types compile when a TypeScript caller imports ' +
    'them', () => {
    const names = packagesWithTypes();
    expect(names.length).toBeGreaterThan(0);
    const source = names
      .map((name, i) => `import * as p${i} from '${name}';\nexport { p${i} };`)
      .join('\n');
    expect(compile(source)).toEqual([]);
  }, COMPILE_TIMEOUT_MS);
});
