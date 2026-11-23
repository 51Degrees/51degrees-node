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
 * @example onpremise/performance-console/performance.js
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/performance-console/performance.js).
 *
 * This example requires the module 'js-yaml' to operate. Please install the
 * module before running the example, by using the following command:
 *
 * ```
 * npm install js-yaml
 * ```
 *
 * Expected output:
 *
 * ```
 * Processing [...] evidence records from [...]/20000 Evidence Records.yml
 * Processing
 * Average [...] detections per second.
 * Average [...] ms per User-Agent.
 * ismobile = true : [...]
 * ismobile = false : [...]
 * ismobile = unknown : [...]
 *
 * ```
 *
 */

const events = require('events');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const yaml = require('js-yaml');

const DeviceDetectionOnPremisePipelineBuilder =
  require51('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;

// Package for script standard which describes script args
// https://www.npmjs.com/package/argparse
const { ArgumentParser } = require('argparse');

const parser = new ArgumentParser({
  description: 'Argparse example'
});

parser.add_argument('-df', '--datafile', { help: 'Datafile file name' });
parser.add_argument('-e', '--evidence', { help: 'Evidence file name' });
parser.add_argument('-jo', '--jsonoutput', { help: 'JSON output file name' });

// In this example, by default, the 51degrees "Lite" file needs to be in the
// cxx/data/device-detection folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has
// a small number of Properties. On a free data file the example ends
// by saying what the Enterprise data file adds, with a link to ask for a
// copy.
const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';

// Where to ask for a copy of the Enterprise data file, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-performance-console-performance.js&utm_term=enterprise-data-file';

// Where to go next, printed at the end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/device-detection',
  '\tThe device detection engine: https://github.com/51Degrees/51degrees-cxx',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tDevice detection documentation: https://51degrees.com/documentation/_device_detection__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-performance-console-performance.js&utm_term=find-out-more-documentation',
  '\tData files and pricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-performance-console-performance.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-performance-console-performance.js&utm_term=find-out-more-contact'
].join('\n');

// This file contains evidence records, each with a User-Agent and the
// other HTTP header values sent with it.
const EVIDENCE = '20000 Evidence Records.yml';

const args = parser.parse_args();
const datafile = args.datafile !== undefined ? args.datafile : ExampleUtils.findDataFile(LITE_V_4_1_HASH);
const evidenceFile = args.evidence !== undefined ? args.evidence : ExampleUtils.findFile(EVIDENCE);
const jsonoutput = args.jsonoutput;

// Check if files exists
const fs = require('fs');
if (!fs.existsSync(datafile)) {
  console.error('Failed to find a device detection ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`.');
  throw ("No data file at '" + datafile + "'");
}

if (!fs.existsSync(evidenceFile)) {
  console.error('Failed to find an evidence ' +
      'file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`.');
  throw ("No evidence file at '" + evidenceFile + "'");
}

let userAgentsProcessed = 0;
let isMobileTrue = 0;
let isMobileFalse = 0;
let isMobileUnknown = 0;
let userAgentsCount = 0;
let startExecutionTime;

// Define an event listener for the 'FinishProcessing' event.
// This listener is triggered once the processing of the evidence is completed.
// It calculates and displays benchmark results and, if specified, writes them to a JSON file.
const eventEmitter = new events.EventEmitter();
eventEmitter.on('FinishProcessing', () => {
  const endExecutionTime = process.hrtime(startExecutionTime);

  const executionTimeInSeconds = (endExecutionTime[0] + endExecutionTime[1] / 1e9);
  const executionTimeInMilliseconds = (endExecutionTime[0] * 1e9 + endExecutionTime[1]) / 1e6;

  // Display benchmarks
  console.log(
    'Average ' +
    `${userAgentsCount / executionTimeInSeconds} ` +
    'detections per second per thread.');
  console.log(
    'Average ' +
    `${executionTimeInMilliseconds / userAgentsCount} ` +
    'ms per User-Agent.');
  console.log(`ismobile = true : ${isMobileTrue}`);
  console.log(`ismobile = false : ${isMobileFalse}`);
  console.log(`ismobile = unknown : ${isMobileUnknown}`);

  if (ExampleUtils.isLiteDataFile(pipeline.getElement('device'))) {
    console.log(ExampleUtils.getEnterpriseOffer(CONTACT_US));
  }

  if (jsonoutput) {
    fs.writeFileSync(jsonoutput, JSON.stringify({
      HigherIsBetter: {
        // Detections: userAgentsCount,
        DetectionsPerSecond: userAgentsCount / executionTimeInSeconds
      },
      LowerIsBetter: {
        // RuntimeSeconds: executionTimeInSeconds,
        AvgMillisecsPerDetection: executionTimeInMilliseconds / userAgentsCount
      }
    }, null, 4));
  }

  console.log(FIND_OUT_MORE);
});
eventEmitter.on('WarmupFinished', () => {
  console.log('Warmup finished');
  console.log('-----------------------------------------');
  console.log('Processing started');
  run(function (evidence) {
    processEvidence(evidence, false);
  });
});

// Create the device detection pipeline with the desired settings.
const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
  performanceProfile: 'MaxPerformance',
  dataFile: datafile,
  restrictedProperties: ['ismobile'],
  autoUpdate: false,
  shareUsage: false,
  addJavaScriptBuilder: false
}).build();

// To monitor the pipeline we can put in listeners for various log events.
// Valid types are info, debug, warn, error
pipeline.on('error', console.error);

// Print out the progress report
const progressBar = '========================================';
const reportProgress = function (uaProcessed) {
  const bars = Math.round((uaProcessed / userAgentsCount) * progressBar.length);
  process.stdout.write(progressBar.substring(0, bars) +
    (uaProcessed === userAgentsCount ? '\n' : '\r'));
};

// Here we make a function that gets an evidence record and
// uses the Device Detection Engine to obtain the properties of the
// device.
const processEvidence = async function (evidence, warmup) {
  // Create a FlowData element
  // This is used to add evidence and process it through the
  // FlowElements in the Pipeline.
  const flowData = pipeline.createFlowData();

  // Add the values of the record as evidence
  for (const [key, value] of Object.entries(evidence)) {
    flowData.evidence.add(key, value === null ? '' : value.toString());
  }

  // Run process on the flowData (this returns a promise)
  await flowData.process();

  // Construct the output line
  const ismobile = flowData.device.ismobile;

  if (ismobile.hasValue) {
    if (ismobile.value) {
      isMobileTrue++;
    } else {
      isMobileFalse++;
    }
  } else {
    isMobileUnknown++;
  }

  if (warmup) {
    reportProgress(++userAgentsProcessed);
    if (userAgentsProcessed === userAgentsCount) {
      eventEmitter.emit('WarmupFinished');
    }
  } else {
    // Increment the number of records processed and
    // signal if the required number has been reached
    reportProgress(++userAgentsProcessed);
    if (userAgentsProcessed === userAgentsCount) {
      eventEmitter.emit('FinishProcessing');
    }
  }
};

// The evidence records in the file, each a YAML document of evidence keys
// and values.
const evidenceRecords = yaml.loadAll(fs.readFileSync(evidenceFile, 'utf8'))
  .filter((record) => record);

// Loop through the evidence records
// and execute callback on each one
const run = function (callback) {
  // Reset the processed count and start time
  userAgentsProcessed = 0;
  isMobileTrue = isMobileFalse = isMobileUnknown = 0;
  startExecutionTime = process.hrtime();
  for (const record of evidenceRecords) {
    callback(record);
  }
};

// Get the number of evidence records
userAgentsCount = evidenceRecords.length;
console.log('Processing ' + userAgentsCount + ' evidence records from ' +
  evidenceFile);

// Run warmup for pipeline
console.log('Warmup');
run(function (evidence) {
  processEvidence(evidence, true);
});
