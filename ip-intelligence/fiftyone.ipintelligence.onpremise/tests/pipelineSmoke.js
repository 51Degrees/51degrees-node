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

// Manual smoke test of the full JS pipeline layer. Not a jest test.
// Run with: node tests/pipelineSmoke.js [dataFilePath]
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const args = process.argv.slice(2);
const dataFile = args.length > 0
  ? args[0]
  : path.join(__dirname, '..', '..', '..', 'cxx',
    'data', 'ip-intelligence', '51Degrees-LiteV41.ipi');

const run = async function () {
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    performanceProfile: 'Balanced',
    shareUsage: false,
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();
  pipeline.on('error', console.error);

  const ipEngine = pipeline.getElement('ip');
  console.log('Data tier:', ipEngine.engine.getProduct());
  console.log('Evidence keys:', ipEngine.evidenceKeyFilter.list.join(', '));
  console.log('Properties:');
  for (const [key, p] of Object.entries(ipEngine.properties)) {
    console.log(`  ${key}: type=${p.type} category=${p.category} component=${p.component.name}`);
  }

  for (const ip of ['8.8.8.8', '194.209.0.1', '2001:4860:4860::8888']) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', ip);
    await flowData.process();
    console.log(`Results for ${ip}:`);
    for (const key of Object.keys(ipEngine.properties)) {
      try {
        const value = flowData.ip[key];
        if (value.hasValue) {
          const v = value.value;
          if (Array.isArray(v)) {
            console.log(`  ${key}: [${v.map(i =>
              (i !== null && typeof i === 'object' && i.value !== undefined)
                ? `${i.value} @${i.weight.toFixed(4)} raw=${i.rawWeight}`
                : i).join(' | ')}]`);
          } else {
            console.log(`  ${key}: ${v}`);
          }
        } else {
          console.log(`  ${key}: NO VALUE (${value.noValueMessage})`);
        }
      } catch (e) {
        console.log(`  ${key}: ERROR ${e}`);
      }
    }
  }
  console.log('Pipeline smoke test complete.');
  process.exit(0);
};

run();
