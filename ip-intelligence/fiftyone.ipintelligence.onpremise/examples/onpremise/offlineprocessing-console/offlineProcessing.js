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
 * @example onpremise/offlineprocessing-console/offlineProcessing.js
 *
 * Provides an example of processing a YAML file containing evidence for IP intelligence.
 * There are 20,000 examples in the supplied file of evidence representing IP addresses.
 *
 * We create an IP intelligence pipeline to read the data and find out about the associated
 * IP ranges, we write this data to a YAML formatted output stream.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/offlineprocessing-console/offlineProcessing.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 */

const LineReader = require('n-readlines');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const { ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, '/../exampleUtils'));

const DataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;

// In this example, by default, the 51degrees "Lite" file needs to be somewhere in the
// project space, or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has a small number
// of Properties. Each property the example asks for that only the Enterprise data
// file has is written as needing it, with a link to ask for a copy.
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// Where to ask for a copy of the Enterprise data file, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=enterprise-data-file';

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence',
  '\tThe IP Intelligence engine: https://github.com/51Degrees/51degrees-cxx',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tIP Intelligence documentation: https://51degrees.com/documentation/_ip_intelligence__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=find-out-more-documentation',
  '\tData files and pricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=find-out-more-contact'
].join('\n');

// This file contains evidence records that are relevant to IP intelligence.
// In this case each record contains an IP address.
const EVIDENCE = 'evidence.yml';

// Check if files exists
const fs = require('fs');
const yaml = require('js-yaml');

// Properties only the Enterprise data file has.
const ENTERPRISE_PROPERTIES = ['IpRangeStart', 'IpRangeEnd', 'Country'];

const analyzeEvidence = async function (evidence, pipeline, outputFile, outputFunc, missing) {
  // FlowData is a data structure that is used to convey
  // information required for detection and the results of the
  // detection through the pipeline.
  // Information required for detection is called "evidence".
  // For IP intelligence this is usually a single IP address.
  const data = pipeline.createFlowData();
  const document = {};

  // Add the evidence values to the output and add it to output object
  // at the same time
  for (const [key, value] of Object.entries(evidence)) {
    if (value === null) {
      data.evidence.add(key, '');
    } else {
      data.evidence.add(key, value.toString());
    }
    document[key] = value;
  }

  await data.process();

  // Now add the values that we want to store against the record.
  const ip = data.ip;
  document['ip.registeredname'] = DataExtension.getValueHelper(ip, 'registeredname');
  document['ip.registeredcountry'] = DataExtension.getValueHelper(ip, 'registeredcountry');
  for (const name of ENTERPRISE_PROPERTIES) {
    document[`ip.${name.toLowerCase()}`] = missing.includes(name)
      ? NEEDS_ENTERPRISE
      : DataExtension.getValueHelper(ip, name.toLowerCase());
  }
  outputFunc(outputFile, yaml.dump(document));
};

const run = async function (dataFile, evidenceFile, outputFile, outputFunc) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_pipeline_api__concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=run
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the balanced profile as its performance is
    // sufficient for this example. See the documentation for
    // more detail on this and other configuration options:
    // https://51degrees.com/documentation/_pipeline_api__features__automatic_datafile_updates.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=run
    // https://51degrees.com/documentation/_pipeline_api__features__usage_sharing.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=run
    performanceProfile: 'Balanced',
    //  Inhibit sharing usage for this example.
    // In general, off line processing usage should NOT be shared back to 51Degrees.
    // This is because it will not contain the full set of information that is
    // required by our data processing back-end and will be discarded.
    // If you specifically want to share data that is being processed off line
    // in order to help us improve the data, then this additional data will
    // need to be collected and included as evidence to the Pipeline. See
    // https://51degrees.com/documentation/_pipeline_api__features__usage_sharing.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-offlineprocessing-console-offlineprocessing.js&utm_term=run#Low_Level_Usage_Sharing
    // for more details on this.
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  // Find once which of the Enterprise properties the data file does not
  // have, rather than for each record, and say so at the top of the output.
  const engine = pipeline.getElement('ip');
  const missing = ENTERPRISE_PROPERTIES.filter(
    (name) => !ExampleUtils.hasProperty(engine, name));
  if (missing.length > 0) {
    outputFunc(outputFile, `# ${ExampleUtils.getEnterpriseNote(CONTACT_US)}\n`);
  }

  // Create lines reader for the evidence file
  const liner = new LineReader(evidenceFile);
  let buffer, utf8Line, evidence;
  let records = 0;

  // Start reading evidence from file
  let document = '';
  while ((buffer = liner.next())) {
    utf8Line = buffer.toString('utf8').trim();
    if ((utf8Line.match(/^---/) || utf8Line.match(/^\.\.\./)) && document) {
      // Output progress
      records++;
      if (records % 1000 === 0) {
        console.log(`Processed ${records} records`);
      }

      // Write the yaml document separator
      outputFunc(outputFile, '---\n');

      // Load a yaml document
      evidence = yaml.load(document);
      await analyzeEvidence(evidence, pipeline, outputFile, outputFunc, missing);

      // Stop processing if reach end of file
      if (utf8Line.match(/^\.\.\./)) {
        break;
      }

      // Move the document separator to the string buffer
      document = `${utf8Line}\n`;
    } else {
      document += `${utf8Line}\n`;
    }
  }
  // Write the yaml document end marker
  outputFunc(outputFile, '...\n');

  ExampleUtils.checkDataFile(pipeline, dataFile);

  console.log(`Processing complete. See results in: '${outputFile}'`);
  if (missing.length > 0) {
    console.log(ExampleUtils.getEnterpriseNote(CONTACT_US));
  }
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // _51DEGREES_IPI_PATH environment variable, or find the lite
  // file that is included in the repository.
  const dataFile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(LITE_V_4_1_IPI);
  // Do the same for the yaml evidence file
  const evidenceFile = args.length > 1 ? args[1] : ExampleUtils.findFile(EVIDENCE);
  // Finally, get the location for the output file. Use the same location as the
  // evidence if a path is not supplied on the command line.
  const outputFile = args.length > 2
    ? args[2]
    : path.join(path.dirname(path.resolve(evidenceFile)), 'offline-processing-output.yml');

  if (dataFile !== undefined) {
    // Create output file or overwrite the existing one
    fs.writeFileSync(outputFile, '');
    run(
      dataFile,
      evidenceFile,
      outputFile,
      (output, content) => { fs.appendFileSync(output, content); })
      .then(() => console.log(FIND_OUT_MORE));
  } else {
    console.error('Failed to find an IP intelligence ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`.');
    console.log(FIND_OUT_MORE);
  }
};

module.exports = {
  run
};
