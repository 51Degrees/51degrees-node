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
 * @example onpremise/compare-console/compare.js
 *
 * This example takes in a CSV file containing 'known and true' IP-Location
 * records (IP addresses with associated latitudes and longitudes).
 * In this context, 'known and true' refers to real-world data the user
 * has collected that is considered accurate and trustworthy.
 *
 * These records are then used for comparison against an IP intelligence
 * service that can return latitude, longitude and area information
 * for a given IP address.
 * This can be useful for understanding how the results of an IP to
 * location service compare to real-world information, especially when
 * evaluating different solutions.
 *
 * The example will ingest the following fields from a CSV file.
 *
 * Date Time
 * IP address
 * Address Family (optional)
 * Latitude
 * Longitude
 * Continent (optional)
 * Country (optional)
 *
 * The IP intelligence service is used to obtain the latitude and longitude
 * from the IP address. The distance in kilometers is then calculated along
 * with the confidence if available, the total geographic area covered by
 * the area returned, and an indicator as to if the provided latitude and
 * longitude is within the area returned.
 *
 * The output CSV file contains the input truth and the result fields for
 * easy evaluation. The result fields are.
 *
 * LatitudeResult
 * LongitudeResult
 * Confidence
 * DistanceKms
 * SquareKms
 * Geometries
 * Contains
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.onpremise/examples/onpremise/compare-console/compare.js).
 *
 * This example requires an enterprise IP intelligence data file (.ipi).
 * To obtain an enterprise data file for testing, please
 * [contact us](https://51degrees.com/contact-us).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 * - [n-readlines](https://www.npmjs.com/package/n-readlines)
 */

const LineReader = require('n-readlines');
const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(path.join(__dirname, '/../../../../', requestedPackage));
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;
const areas = require(path.join(__dirname, '/../areas'));

// This example requires the enterprise data file as the latitude,
// longitude and area properties used are not available in the lite file.
// To obtain an enterprise data file for testing, please contact us:
// https://51degrees.com/contact-us
const ENTERPRISE_V_4_1_IPI = '51Degrees-EnterpriseIpiV41.ipi';
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// The CSV file containing the 'known and true' records. A version of this
// file is included in the ip-intelligence-data submodule.
const GEOIP_COMPARISON_EVIDENCE_FILE = 'geoip_comparison_evidence.csv';

// Time interval in milliseconds to wait between logging progress.
const LOG_INTERVAL_MS = 30000;

// The fields ingested from the truth CSV file in the order they are
// written to the output.
const TRUTH_FIELDS = [
  'DateTimeUtc',
  'Latitude',
  'Longitude',
  'Ip',
  'AddressFamily',
  'Continent',
  'Country'
];

// The fields added to the output from the IP intelligence results.
const RESULT_FIELDS = [
  'LatitudeResult',
  'LongitudeResult',
  'Confidence',
  'DistanceKms',
  'SquareKms',
  'Geometries',
  'Contains'
];

// Quote a value for CSV output if it contains a comma or quote.
const csvValue = function (value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (text.indexOf(',') !== -1 || text.indexOf('"') !== -1) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
};

// Parse a line of the truth CSV file into an object using the column
// indexes from the header line.
const parseTruth = function (line, columns) {
  const values = line.split(',');
  const truth = {};
  for (const field of TRUTH_FIELDS) {
    const index = columns[field];
    truth[field] = index !== undefined && index < values.length
      ? values[index].trim()
      : '';
  }
  truth.Latitude = parseFloat(truth.Latitude);
  truth.Longitude = parseFloat(truth.Longitude);
  return truth;
};

// Process a single truth record returning the result, or undefined if the
// IP address was not found in the data file.
const processTruth = async function (pipeline, truth) {
  // Get the data for the IP address.
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.client-ip', truth.Ip);
  await flowData.process();
  const ip = flowData.ip;

  // Check if the required properties have values. If not, skip this
  // record as the IP address was not found in the database.
  const latitude = ExampleUtils.getSingleValue(ip, 'latitude');
  const longitude = ExampleUtils.getSingleValue(ip, 'longitude');
  const wkt = ExampleUtils.getSingleValue(ip, 'areas');
  if (latitude === undefined || longitude === undefined ||
    wkt === undefined) {
    return undefined;
  }

  // Set the address family if the source truth does not provide it.
  if (!truth.AddressFamily) {
    truth.AddressFamily = truth.Ip.indexOf(':') !== -1
      ? 'InterNetworkV6'
      : 'InterNetwork';
  }

  // Get the area result for the returned data and the true latitude
  // and longitude.
  const area = areas.getAreas(wkt, truth.Latitude, truth.Longitude);

  // Return the result including the latitude, longitude, and distance
  // in kilometers between the result and the truth.
  return {
    LatitudeResult: Number(latitude),
    LongitudeResult: Number(longitude),
    Confidence: ExampleUtils.getSingleValue(ip, 'locationconfidence', ''),
    DistanceKms: areas.distanceKms(
      truth.Latitude,
      truth.Longitude,
      Number(latitude),
      Number(longitude)),
    SquareKms: area.squareKms,
    Geometries: area.geometries,
    Contains: area.contains
  };
};

const run = async function (dataFile, csvTruthFile, output, progress) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_concepts__configuration__builders__index.html
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the max performance profile for optimal detection speed
    // in this example. See the documentation for more detail on this
    // and other configuration options:
    // https://51degrees.com/documentation/_features__automatic_datafile_updates.html
    // https://51degrees.com/documentation/_features__usage_sharing.html
    performanceProfile: 'MaxPerformance',
    // inhibit sharing usage for this example, usually this should be
    // set 'true'
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  // Write the output header.
  output.write(TRUTH_FIELDS.concat(RESULT_FIELDS).join(',') + '\n');

  // Read the header line of the truth file to get the column indexes.
  const reader = new LineReader(csvTruthFile);
  const header = reader.next().toString('utf-8').trim().split(',');
  const columns = {};
  for (let i = 0; i < header.length; i++) {
    columns[header[i].trim()] = i;
  }

  // Process each unique IP address in the truth file.
  const ips = new Set();
  let processed = 0;
  let nextLog = Date.now() + LOG_INTERVAL_MS;
  let line;
  while ((line = reader.next())) {
    const text = line.toString('utf-8').trim();
    if (text.length === 0) {
      continue;
    }
    const truth = parseTruth(text, columns);
    if (!truth.Ip || ips.has(truth.Ip)) {
      continue;
    }
    ips.add(truth.Ip);
    const result = await processTruth(pipeline, truth);
    if (result !== undefined) {
      output.write(
        TRUTH_FIELDS.map(function (field) {
          return csvValue(truth[field]);
        }).concat(RESULT_FIELDS.map(function (field) {
          return csvValue(result[field]);
        })).join(',') + '\n');
    }
    processed++;
    if (Date.now() >= nextLog) {
      progress.write(`Processed '${processed}' source records\n`);
      nextLog = Date.now() + LOG_INTERVAL_MS;
    }
  }
  progress.write(`Finished processing '${processed}' source records\n`);

  // Finally check the data file used for consistency with the other
  // examples.
  ExampleUtils.checkDataFile(pipeline, dataFile);
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // 51DEGREES_IPI_PATH environment variable, or find the enterprise
  // file in the project space, falling back to the lite file that is
  // included in the repository.
  let dataFile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(ENTERPRISE_V_4_1_IPI);
  if (dataFile === undefined) {
    dataFile = ExampleUtils.findDataFile(LITE_V_4_1_IPI);
    if (dataFile !== undefined) {
      console.warn('Failed to find an enterprise IP intelligence data ' +
        'file. Using the lite file instead. Note that the lite file ' +
        'does not contain the area properties used by this example, ' +
        'so records may be skipped. To obtain an enterprise data file ' +
        'for testing, please contact us: ' +
        'https://51degrees.com/contact-us');
    }
  }

  // Get the CSV file containing the source of truth.
  const csvTruthFile = args.length > 1
    ? args[1]
    : ExampleUtils.findFile(GEOIP_COMPARISON_EVIDENCE_FILE);

  // Get the location for the output file.
  const outputFile = args.length > 2 ? args[2] : 'compare-output.csv';

  if (dataFile !== undefined && csvTruthFile !== undefined) {
    const output = fs.createWriteStream(outputFile);
    run(dataFile, csvTruthFile, output, process.stdout).then(function () {
      output.end();
      console.log(`Output written to '${outputFile}'`);
    });
  } else {
    if (dataFile === undefined) {
      console.error('Failed to find an IP intelligence ' +
        'data file. Make sure the ip-intelligence-data ' +
        'submodule has been updated by running ' +
        '`git submodule update --recursive`. A different file can be ' +
        'specified by supplying the full path as a command line argument');
    }
    if (csvTruthFile === undefined) {
      console.error('Failed to find the comparison evidence file ' +
        `'${GEOIP_COMPARISON_EVIDENCE_FILE}'. Make sure the ` +
        'ip-intelligence-data submodule has been updated by running ' +
        '`git submodule update --recursive`. A different file can be ' +
        'specified by supplying the full path as the second command ' +
        'line argument');
    }
  }
};

module.exports = {
  run
};
