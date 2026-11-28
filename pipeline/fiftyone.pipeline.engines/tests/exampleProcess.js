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

// Runs a data file update example in its own process for a test, so that
// the file watcher and the polling it starts end with it. The example's
// output is kept as it comes, each line with the seconds since the process
// started, so a test that fails shows which step was slow. The process is
// stopped when it runs past its time limit, and a test stops it before it
// removes the folder the example wrote to, because Windows does not remove
// a file that a live process holds open.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Settings the example must not take from the environment of the test.
const REMOVED = ['_51DEGREES_LICENSE_KEY', '_51DEGREES_DD_PATH',
  '_51DEGREES_IPI_PATH'];

// Loads the example as a module and runs it with the settings given,
// rather than as a person runs it, which would ask whether to go on.
const SCRIPT = 'const s = JSON.parse(process.argv[2]);' +
  'require(process.argv[1]).run(s.dataFile, s.licenseKey, false, ' +
  'process.stdout, s.product, s.dataUpdateUrl).then(' +
  '() => process.exit(0), (e) => { console.error(e); process.exit(1); });';

class ExampleProcess {
  /**
   * Starts the example.
   *
   * @param {string} example the path of the example's script
   * @param {object} settings the data file, license key, product and data
   * update URL to run it with
   * @param {string} folder the folder for the example's temporary files
   * @param {number} limitMs how long the example may run before it is
   * stopped
   */
  constructor (example, settings, folder, limitMs) {
    this.limitMs = limitMs;
    this.lines = [];
    this.partial = '';
    this.timedOut = false;
    const env = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (!REMOVED.includes(name.toUpperCase())) {
        env[name] = value;
      }
    }
    // The example runs only its module part when this is set.
    env.JEST_WORKER_ID = env.JEST_WORKER_ID || '1';
    env.TMPDIR = env.TMP = env.TEMP = folder;
    this.started = Date.now();
    this.child = childProcess.spawn(process.execPath,
      ['-e', SCRIPT, example, JSON.stringify(settings)],
      { cwd: path.dirname(example), env });
    this.child.stdout.on('data', (data) => this.add(data));
    this.child.stderr.on('data', (data) => this.add(data));
    this.ended = new Promise((resolve) => {
      this.child.on('close', (status, signal) => {
        clearTimeout(this.timer);
        this.add('\n');
        this.seconds = this.elapsed();
        resolve({ status, signal });
      });
    });
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.child.kill();
    }, limitMs);
  }

  elapsed () {
    return (Date.now() - this.started) / 1000;
  }

  // Keeps each whole line of output with the time it arrived.
  add (data) {
    const text = this.partial + data;
    const lines = text.split(/\r?\n/);
    this.partial = lines.pop();
    for (const line of lines) {
      if (line.trim() !== '') {
        this.lines.push({ at: this.elapsed(), line });
      }
    }
  }

  /**
   * Waits for the example to end, and throws with its output when it ran
   * past its limit or did not succeed.
   *
   * @returns {Promise<void>} settles when the example has succeeded
   */
  async finished () {
    const { status, signal } = await this.ended;
    if (this.timedOut || status !== 0) {
      const why = this.timedOut
        ? `did not finish in ${this.limitMs / 1000} s and was stopped`
        : `ended with status ${status}${signal ? ' and ' + signal : ''}`;
      throw new Error(`The update example ${why}. What it wrote, with the ` +
        `seconds since it started:\n${this.output()}`);
    }
  }

  output () {
    return this.lines.map(({ at, line }) =>
      `${at.toFixed(1).padStart(7)} s ${line}`).join('\n');
  }

  /**
   * One line with the time the example took and the time of each line it
   * wrote, short enough for the log of every run.
   *
   * @param {string} name what the run was
   * @returns {string} the line
   */
  timeline (name) {
    const steps = this.lines.map(({ at, line }) =>
      `${at.toFixed(1)} ${line.slice(0, 28)}`);
    return `${name}: ${(this.seconds || this.elapsed()).toFixed(1)} s | ` +
      steps.join(' | ');
  }

  /**
   * Stops the example if it is still running and waits for it to end.
   *
   * @returns {Promise<void>} settles once the process has ended
   */
  async stop () {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill();
    }
    await this.ended;
  }
}

/**
 * Runs the example.
 *
 * @param {string} example the path of the example's script
 * @param {object} settings what to run it with
 * @param {string} folder the folder for its temporary files
 * @param {number} limitMs how long it may run
 * @returns {ExampleProcess} the running example
 */
const start = (example, settings, folder, limitMs) =>
  new ExampleProcess(example, settings, folder, limitMs);

/**
 * Makes a folder for a test of an example that works on the data file.
 * Copies of the data file are written there, so the folder is beside the
 * data file when the system's temporary folder is on another drive, as it
 * is on a Windows runner, where a copy to the system drive is slow.
 *
 * @param {string} dataFile the data file
 * @returns {string} the new folder
 */
const makeFolder = (dataFile) => {
  const near = path.dirname(path.resolve(dataFile));
  const temp = os.tmpdir();
  const sameDrive = path.parse(near).root.toLowerCase() ===
    path.parse(path.resolve(temp)).root.toLowerCase();
  return fs.mkdtempSync(path.join(sameDrive ? temp : near,
    'update-example-'));
};

/**
 * Removes a folder, trying again for a few seconds while Windows still
 * holds a file of a process that has just ended.
 *
 * @param {string} folder the folder
 */
const removeFolder = (folder) => {
  fs.rmSync(folder,
    { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
};

/**
 * Runs each clean-up step, all of them even when one throws, and then
 * throws one error that names every step that failed. A test's own failure
 * is reported before an error thrown in afterEach, so it is not hidden.
 *
 * @param {Array<Function>} steps the steps, each of which may return a
 * promise
 * @returns {Promise<void>} settles when every step has run
 */
const cleanUp = async (steps) => {
  const failures = [];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      failures.push(e.message);
    }
  }
  if (failures.length > 0) {
    throw new Error('Cleaning up after the update example failed: ' +
      failures.join('\n'));
  }
};

module.exports = { start, makeFolder, removeFolder, cleanUp };
