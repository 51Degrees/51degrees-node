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
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console/performance.js).
 *
 * This example require module 'n-readlines' to operate. Please install the module
 * before running the example, by using the following command:
 *
 * ```
 * npm install n-readlines
 * ```
 *
 * Expected output:
 *
 * ```
 * Processing [...] IP addresses from [...]/evidence.csv
 * Processing
 * Average [...] lookups per second.
 * Average [...] ms per IP address.
 * asnname = known : [...]
 * asnname = unknown : [...]
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

const LineReader = require('n-readlines');

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

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

// In this example, by default, the free ASN data file needs to be in the
// cxx/data/ip-intelligence folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter. The example
// measures how fast lookups are rather than what they return, so it uses
// the ASN data file, which is far smaller than the Lite data file.
//
// On a free data file the example ends by saying what the Enterprise data
// file adds, with a link to ask for a copy.
const ASN_V_4_1_IPI = '51Degrees-IPIV4AsnIpiV41.ipi';

// Where to ask for a copy of the Enterprise data file, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-performance-console-performance.js&utm_term=enterprise-data-file';

// This file contains IP addresses to use as evidence.
const EVIDENCE_CSV = 'evidence.csv';

const args = parser.parse_args();
const datafile = args.datafile !== undefined ? args.datafile : ExampleUtils.findDataFile(ASN_V_4_1_IPI);
const evidenceFile = args.evidence !== undefined ? args.evidence : ExampleUtils.findFile(EVIDENCE_CSV);
const jsonoutput = args.jsonoutput;

// Check if files exists
const fs = require('fs');
if (!fs.existsSync(datafile)) {
  console.error('Failed to find an IP intelligence ' +
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

let ipsProcessed = 0;
let nameKnown = 0;
let nameUnknown = 0;
let ipsCount = 0;
let startExecutionTime;

// Define an event listener for the 'FinishProcessing' event.
// This listener is triggered once the processing of IP addresses is completed.
// It calculates and displays benchmark results and, if specified, writes them to a JSON file.
const eventEmitter = new events.EventEmitter();
eventEmitter.on('FinishProcessing', () => {
  const endExecutionTime = process.hrtime(startExecutionTime);

  const executionTimeInSeconds = (endExecutionTime[0] + endExecutionTime[1] / 1e9);
  const executionTimeInMilliseconds = (endExecutionTime[0] * 1e9 + endExecutionTime[1]) / 1e6;

  // Display benchmarks
  console.log(
    'Average ' +
    `${ipsCount / executionTimeInSeconds} ` +
    'lookups per second per thread.');
  console.log(
    'Average ' +
    `${executionTimeInMilliseconds / ipsCount} ` +
    'ms per IP address.');
  console.log(`${nameProperty} = known : ${nameKnown}`);
  console.log(`${nameProperty} = unknown : ${nameUnknown}`);

  if (ExampleUtils.isFreeDataFile(pipeline.getElement('ip'))) {
    console.log(ExampleUtils.getEnterpriseOffer(CONTACT_US));
  }

  if (jsonoutput) {
    fs.writeFileSync(jsonoutput, JSON.stringify({
      HigherIsBetter: {
        DetectionsPerSecond: ipsCount / executionTimeInSeconds
      },
      LowerIsBetter: {
        AvgMillisecsPerDetection: executionTimeInMilliseconds / ipsCount
      }
    }, null, 4));
  }
});
eventEmitter.on('WarmupFinished', () => {
  console.log('Warmup finished');
  console.log('-----------------------------------------');
  console.log('Processing started');
  run(function (ipAddress) {
    processIp(ipAddress, false);
  });
});

// Create the IP intelligence pipeline with the desired settings.
const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
  performanceProfile: 'MaxPerformance',
  dataFile: datafile,
  restrictedProperties: ['registeredname', 'asnname'],
  autoUpdate: false,
  shareUsage: false,
  addJavaScriptBuilder: false
}).build();

// To monitor the pipeline we can put in listeners for various log events.
// Valid types are info, debug, warn, error
pipeline.on('error', console.error);

// The Lite and Enterprise data files have RegisteredName, and the ASN data
// file has AsnName in its place.
const nameProperty = ExampleUtils.hasProperty(pipeline.getElement('ip'), 'RegisteredName')
  ? 'registeredname'
  : 'asnname';

// Print out the progress report
const progressBar = '========================================';
const reportProgress = function (processed) {
  const bars = Math.round((processed / ipsCount) * progressBar.length);
  process.stdout.write(progressBar.substring(0, bars) +
    (processed === ipsCount ? '\n' : '\r'));
};

// Here we make a function that gets an IP address as evidence and
// uses the IP Intelligence Engine to obtain the properties of the
// associated IP range.
const processIp = async function (ipAddress, warmup) {
  // Create a FlowData element
  // This is used to add evidence and process it through the
  // FlowElements in the Pipeline.
  const flowData = pipeline.createFlowData();

  // Add the IP address as evidence
  flowData.evidence.add('query.client-ip', ipAddress);

  // Run process on the flowData (this returns a promise)
  await flowData.process();

  // Construct the output line
  const name = flowData.ip[nameProperty];

  if (name.hasValue) {
    nameKnown++;
  } else {
    nameUnknown++;
  }

  if (warmup) {
    reportProgress(++ipsProcessed);
    if (ipsProcessed === ipsCount) {
      eventEmitter.emit('WarmupFinished');
    }
  } else {
    // Increment the number of IP addresses processed and
    // signal if the required number has been reached
    reportProgress(++ipsProcessed);
    if (ipsProcessed === ipsCount) {
      eventEmitter.emit('FinishProcessing');
    }
  }
};

// Loop through the IP addresses in the file
// and execute callback on each IP address
const run = function (callback) {
  const liner = new LineReader(evidenceFile);
  let line;

  // Reset IP addresses processed count and start time
  ipsProcessed = 0;
  nameKnown = nameUnknown = 0;
  startExecutionTime = process.hrtime();
  line = liner.next();
  while (line) {
    const value = line.toString('utf8').replace(/\r?\n|\r/g, '').trim();
    // Skip empty lines and any header or comment lines.
    if (value.length > 0 && !value.startsWith('#')) {
      callback(value);
    }
    line = liner.next();
  }
};

// Get the number of IP addresses
run(function () {
  ipsCount++;
});
console.log('Processing ' + ipsCount + ' IP addresses from ' + evidenceFile);

// Run warmup for pipeline
console.log('Warmup');
run(function (ipAddress) {
  processIp(ipAddress, true);
});
