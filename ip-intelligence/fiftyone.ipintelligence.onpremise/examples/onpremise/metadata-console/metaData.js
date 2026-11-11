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
 * @example onpremise/metadata-console/metaData.js
 *
 * The IP intelligence data file contains meta data that can provide additional information
 * about the various records in the data model.
 * This example shows how to access this data and display the values available.
 *
 * A list of the properties will be displayed, along with some additional information about each
 * property.
 *
 * Finally, the evidence keys that are accepted by IP intelligence are listed. These are the
 * keys that, when added to the evidence collection in flow data, could have some impact on the
 * result returned by the IP intelligence engine.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/metadata-console/metaData.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 *
 */

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

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;

// In this example, by default, the 51degrees "Lite" file needs to be in the
// cxx/data/ip-intelligence folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has
// a small number of Properties. On a free data file the example ends
// by saying what the Enterprise data file adds, with a link to ask for a
// copy.
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// Where to ask for a copy of the Enterprise data file, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metadata-console-metadata.js&utm_term=enterprise-data-file';

const truncateToNl = function (string) {
  const lines = string.split('\n');
  let result = '';
  let i = 0;
  for (; i < lines.length; i++) {
    if (lines[i]) {
      result = lines[i];
      break;
    }
  }

  if (i < lines.length) {
    result += ' ...';
  }
  return result;
};

const outputProperties = function (component, output) {
  const properties = component.getProperties();
  for (const property of properties) {
    output.write(`\x1b[31mProperty - ${property.name}\x1b[89m\x1b[0m\n`);
    output.write(
      `[Category: ${property.category}](${property.type} - ${property.description})\n`);

    let valuesStr = 'Possible values: ';
    const values = property.getValues();
    let count = 0;
    for (const value of values) {
      // add value
      valuesStr += truncateToNl(value.getName());
      // add description if exists
      const description = value.getDescription();
      if (description) {
        valuesStr += `(${description})`;
      }
      valuesStr += ',';
      if (++count >= 20) {
        break;
      }
    }
    if (property.getNumberOfValues() > 20) {
      valuesStr += ` + ${property.getNumberOfValues() - 20} more ...`;
    }
    output.write(valuesStr);
    output.write('\n');
  }
};

const outputComponents = function (engine, output) {
  const components = engine.components;
  for (const value of Object.values(components)) {
    output.write(`\x1b[34mComponent - ${value.name}\x1b[89m\x1b[0m\n`);
    outputProperties(value, output);
    output.write('\n');
  }
};

const outputEvidenceKeyDetails = async function (engine, output) {
  output.write('\n');
  output.write('Accepted evidence keys:\n');
  for (const evidence of engine.evidenceKeyFilter.list) {
    output.write(`\t${evidence}\n`);
  }
};

const run = async function (dataFile, output) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_pipeline_api__concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metadata-console-metadata.js&utm_term=run
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the balanced profile as its performance is
    // sufficient for this example. See the documentation for
    // more detail on this and other configuration options:
    // https://51degrees.com/documentation/_pipeline_api__features__automatic_datafile_updates.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metadata-console-metadata.js&utm_term=run
    // https://51degrees.com/documentation/_pipeline_api__features__usage_sharing.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metadata-console-metadata.js&utm_term=run
    performanceProfile: 'Balanced',
    // inhibit sharing usage for this test, usually this
    // should be set 'true'
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  const ip = pipeline.getElement('ip');
  await outputComponents(ip, output);
  await outputEvidenceKeyDetails(ip, output);

  ExampleUtils.checkDataFile(pipeline, dataFile);

  if (ExampleUtils.isFreeDataFile(ip)) {
    output.write(`\n${ExampleUtils.getEnterpriseOffer(CONTACT_US)}\n`);
  }
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // _51DEGREES_IPI_PATH environment variable, or find the lite
  // file that is included in the repository.
  const dataFile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(LITE_V_4_1_IPI);

  if (dataFile !== undefined) {
    run(dataFile, process.stdout);
  } else {
    console.error('Failed to find an IP intelligence ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`. By default, the \'lite\' file ' +
      'included with this code will be used. A different file can be ' +
      'specified by supplying the full path as a command line argument');
  }
};

module.exports = {
  run
};
