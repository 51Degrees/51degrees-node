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
// Data, as ip-intelligence-on-premise.md lines 128 to 130 ask.

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
const Engine = require51('fiftyone.ipintelligence.onpremise')
  .IpIntelligenceOnPremise;

// The small ASN data file, which the other tests here use.
const ASN = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
const IP_ADDRESS = '8.8.8.8';
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
    if (!fs.existsSync(ASN)) {
      throw new Error(`No data file at '${ASN}'.`);
    }
    const engine = new Engine({
      dataFilePath: ASN,
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
    flowData.evidence.add('query.client-ip', IP_ADDRESS);
    await flowData.process();
    expect(reads).toEqual([]);

    const name = Object.keys(engine.properties)[0];
    flowData.ip.get(name);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every(([, property]) => property === name.toLowerCase()))
      .toBe(true);
  }, TIMEOUT_MS);
