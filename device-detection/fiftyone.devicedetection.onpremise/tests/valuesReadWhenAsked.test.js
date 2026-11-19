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

// The Element Data reads a Property value from the native results only when
// that Property is asked for, and none while the engine processes the Flow
// Data, as device-detection-on-premise.md lines 152 to 154 ask.

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const Engine = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremise;

const LITE = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection', '51Degrees-LiteV4.1.hash');
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 ' +
  'Safari/604.1';
const TIMEOUT_MS = 300000;

// The native results, recording each call that reads a value, as the name of
// the method and the Property it names.
const recorded = (results, reads) => new Proxy(results, {
  get: (target, name) => {
    const member = target[name];
    if (typeof member !== 'function') {
      return member;
    }
    return (...args) => {
      if (String(name).startsWith('getValue')) {
        reads.push([String(name), String(args[0]).toLowerCase()]);
      }
      return member.apply(target, args);
    };
  }
});

// The native engine, its results recorded.
const recording = (native, reads) => new Proxy(native, {
  get: (target, name) => {
    if (name === 'process') {
      return (evidence) => recorded(target.process(evidence), reads);
    }
    const member = target[name];
    return typeof member === 'function' ? member.bind(target) : member;
  }
});

test('a value is read from the native results only when it is asked for',
  async () => {
    if (!fs.existsSync(LITE)) {
      throw new Error(`No data file at '${LITE}'.`);
    }
    const engine = new Engine({
      dataFilePath: LITE,
      autoUpdate: false,
      fileSystemWatcher: false,
      licenceKeys: ''
    });
    const reads = [];
    engine.engine = recording(engine.engine, reads);
    // Only the engine, so nothing else reads a value while processing.
    const pipeline = new core.PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false
    }).add(engine).build();

    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', USER_AGENT);
    await flowData.process();
    expect(reads).toEqual([]);

    expect(flowData.device.ismobile.value).toBe(true);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every(([, property]) => property === 'ismobile')).toBe(true);
  }, TIMEOUT_MS);
