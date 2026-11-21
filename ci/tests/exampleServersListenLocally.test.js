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

// Every example that starts a web server serves only the machine it runs
// on. Each of them tells the person running it to browse to localhost, and
// one of them serves the data file in use, so an example that bound to
// every network interface would offer whatever data file was set to every
// machine that could reach it. Node's listen binds to every interface when
// no host is given, so the host is always named.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['device-detection', 'ip-intelligence', 'location', 'pipeline'];

// Folders that hold no example of ours: installed packages, the scripts a
// page loads and the JavaScript templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'public', 'javascript-templates'];

// The hosts that reach only the machine the example runs on.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

// Every example file, which is every .js and .ts file below an examples
// folder other than a test.
const exampleFiles = () => {
  const found = [];
  const pending = FOLDERS.map((folder) => ({
    dir: path.join(ROOT, folder), inExamples: false
  }));
  while (pending.length > 0) {
    const { dir, inExamples } = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.includes(entry.name)) {
          pending.push({
            dir: full, inExamples: inExamples || entry.name === 'examples'
          });
        }
      } else if (inExamples && /\.(js|ts)$/.test(entry.name) &&
        !/\.test\.(js|ts)$/.test(entry.name)) {
        found.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
};

// The arguments of each listen call in the text, found by counting
// parentheses from the one that opens the call, so that a call written over
// several lines is read whole.
const listenCalls = (text) => {
  const found = [];
  const opener = '.listen(';
  let at = text.indexOf(opener);
  while (at !== -1) {
    let depth = 0;
    let end = at + opener.length - 1;
    for (; end < text.length; end++) {
      if (text[end] === '(') {
        depth++;
      } else if (text[end] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    found.push(text.slice(at + opener.length, end));
    at = text.indexOf(opener, end);
  }
  return found;
};

// The names the file gives to one of the local hosts, so that a call that
// passes the host in a variable is read as naming it.
const localHostNames = (text) => {
  const names = [];
  for (const line of text.split(/\r?\n/)) {
    for (const host of LOCAL_HOSTS) {
      const at = line.indexOf("= '" + host + "'");
      if (at !== -1) {
        const words = line.slice(0, at).trim().split(/\s+/);
        const name = words[words.length - 1];
        if (name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
          names.push(name);
        }
      }
    }
  }
  return names;
};

// True when the arguments of a listen call name one of the local hosts,
// either as the text itself or as a name the file gives to it.
const namesALocalHost = (call, names) =>
  LOCAL_HOSTS.some((host) => call.includes("'" + host + "'")) ||
  call.split(/[^A-Za-z0-9_$]+/).some((word) => names.includes(word));

// Each example that starts a server, with the arguments of each of its
// listen calls and the names its file gives to a local host.
const serving = exampleFiles()
  .map((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return { file, calls: listenCalls(text), names: localHostNames(text) };
  })
  .filter((example) => example.calls.length > 0);

describe('examples that start a web server', () => {
  test('are found', () => {
    expect(serving.length).toBeGreaterThan(0);
  });

  describe.each(serving.map((e) => [e.file, e.calls, e.names]))(
    '%s', (file, calls, names) => {
      test('names a host that reaches only this machine', () => {
        for (const call of calls) {
          expect({ call, local: namesALocalHost(call, names) })
            .toEqual({ call, local: true });
        }
      });
    });
});
