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
 * @example onpremise/metrics-console/metrics.js
 *
 * This example takes all public IP addresses and passes them to the IP
 * intelligence service, recording the average geographic area in square
 * kilometers, the number of polygons that form the area, and the
 * equivalent radius if the area can be represented as a circle.
 *
 * The example can take a long time to complete. The sample of IP
 * addresses used in the metrics can be adjusted as a parameter.
 *
 * This example is primarily designed for those who are interested in
 * verifying the published metrics associated with 51Degrees'
 * IP intelligence service.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence-node/fiftyone.ipintelligence.onpremise/examples/onpremise/metrics-console/metrics.js).
 *
 * This example requires an enterprise IP intelligence data file (.ipi).
 * To obtain an enterprise data file for testing, please
 * [contact us](https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=header).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 */

const fs = require('fs');
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
const areas = require(path.join(__dirname, '/../areas'));

// This example requires the enterprise data file as the area properties
// used are not available in the lite file. To obtain an enterprise data
// file for testing, please contact us:
// https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=enterprise_v_4_1_ipi
const ENTERPRISE_V_4_1_IPI = '51Degrees-EnterpriseIpiV41.ipi';

// The percentage of registered IP addresses to randomly include in the
// metrics sample. 1 is 100%. Higher values will result in longer elapsed
// processing.
const DEFAULT_SAMPLE_PERCENTAGE = 0.1;

// Time interval in milliseconds to wait between logging progress.
const LOG_INTERVAL_MS = 30000;

// The properties that are used to group the metrics.
const KEY_PROPERTIES = [
  'ContinentName',
  'Country',
  'LocationConfidence',
  'ConnectionType',
  'IsVPN',
  'IsProxy',
  'IsTor',
  'IsPublicRouter'
];

// The columns of the output CSV file.
const OUTPUT_FIELDS = KEY_PROPERTIES.concat([
  'IpCount',
  'AreaCount',
  'AverageAreaKm',
  'EquivalentRadiusKm',
  'AveragePolygons'
]);

// Convert an IP address string into an array of bytes. Supports both
// IPv4 dotted decimal and IPv6 colon separated hex formats.
const ipToBytes = function (ip) {
  if (ip.indexOf(':') === -1) {
    return ip.split('.').map(function (part) {
      return parseInt(part, 10);
    });
  }
  // Expand the '::' shorthand to the full eight groups.
  const parts = ip.split('::');
  let groups;
  if (parts.length === 2) {
    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts[1] ? parts[1].split(':') : [];
    groups = head
      .concat(new Array(8 - head.length - tail.length).fill('0'))
      .concat(tail);
  } else {
    groups = ip.split(':');
  }
  const bytes = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    bytes.push((value >> 8) & 0xff);
    bytes.push(value & 0xff);
  }
  return bytes;
};

// Convert an array of bytes back into an IP address string.
const bytesToIp = function (bytes) {
  if (bytes.length === 4) {
    return bytes.join('.');
  }
  const groups = [];
  for (let i = 0; i < bytes.length; i += 2) {
    groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  }
  return groups.join(':');
};

// Increment the IP address bytes by 1. Returns false if the increment
// overflowed (the address was the maximum value).
const tryGetNextAddress = function (bytes) {
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] < 255) {
      bytes[i]++;
      return true;
    }
    bytes[i] = 0;
  }
  return false;
};

// Compare two IP addresses represented as byte arrays.
const ipEquals = function (a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

// Returns the string value of a property, or the no value message where
// no value is available. Used to build the metric group key.
const getKeyValue = function (ip, propertyName) {
  let property;
  try {
    property = ip[propertyName.toLowerCase()];
  } catch (e) {
    return 'Unknown';
  }
  if (property === undefined || property === null) {
    return 'Unknown';
  }
  if (property.hasValue === false) {
    return property.noValueMessage;
  }
  const value = ExampleUtils.getSingleValue(ip, propertyName.toLowerCase());
  return `${value}`;
};

// Build a dictionary that takes a WKT value and returns the geographic
// area in square kms and the number of polygons that form the area. The
// index is built up front as many IP addresses share the same area.
const buildAreaIndex = function (metadata, progress) {
  let areasProperty;
  try {
    areasProperty = metadata.getProperties().getByKey('Areas');
  } catch (e) {
    return undefined;
  }
  if (areasProperty === undefined || areasProperty === null) {
    return undefined;
  }
  const wktAreas = new Map();
  const values = metadata.getValuesForProperty(areasProperty);
  let nextLog = Date.now() + LOG_INTERVAL_MS;
  for (let i = 0; i < values.getSize(); i++) {
    const value = values.getByIndex(i);
    const wkt = value.getName();
    wktAreas.set(wkt, areas.getAreas(wkt, 0, 0));
    if (Date.now() >= nextLog) {
      progress.write(`Mapped '${wktAreas.size}' areas\n`);
      nextLog = Date.now() + LOG_INTERVAL_MS;
    }
  }
  return wktAreas;
};

// Yields the valid IP ranges from the network component profiles. Ranges
// that are registered to an unknown country are excluded.
const validRanges = function * (metadata) {
  const profiles = metadata.getProfiles();
  for (let i = 0; i < profiles.getSize(); i++) {
    const profile = profiles.getByIndex(i);
    const component = metadata.getComponentForProfile(profile);
    if (component.getName().toLowerCase() !== 'network') {
      continue;
    }
    const values = metadata.getValuesForProfile(profile);
    let start;
    let end;
    let registeredCountryUnknown = false;
    for (let j = 0; j < values.getSize(); j++) {
      const value = values.getByIndex(j);
      const property = metadata.getPropertyForValue(value);
      switch (property.getName()) {
        case 'IpRangeStart':
          start = value.getName();
          break;
        case 'IpRangeEnd':
          end = value.getName();
          break;
        case 'RegisteredCountry':
          if (value.getName() === 'Unknown') {
            registeredCountryUnknown = true;
          }
          break;
      }
    }
    if (start !== undefined &&
      end !== undefined &&
      registeredCountryUnknown === false) {
      yield [start, end];
    }
  }
};

// Process a single IP address adding the result to the metric groups.
const processIp = async function (pipeline, wktAreas, groups, ipAddress) {
  // Get the data for the IP address.
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.client-ip', ipAddress);
  await flowData.process();
  const ip = flowData.ip;

  // Get the metric instance for the group key.
  const keyValues = KEY_PROPERTIES.map(function (propertyName) {
    return getKeyValue(ip, propertyName);
  });
  const key = keyValues.join(' ');
  let metric = groups.get(key);
  if (metric === undefined) {
    metric = {
      keyValues,
      ipCount: 0,
      totalAreaKm: 0,
      areaCount: 0,
      // Key is the number of polygons, and the value the number of IPs
      // that have that number of polygons.
      polygons: new Map()
    };
    groups.set(key, metric);
  }

  // Increase the number of IP addresses that relate to this key.
  metric.ipCount++;

  // Increase the total area and number of areas for the metric only
  // where an area is available.
  const wkt = ExampleUtils.getSingleValue(ip, 'areas');
  if (wkt !== undefined && wktAreas.has(wkt)) {
    const area = wktAreas.get(wkt);
    metric.totalAreaKm += area.squareKms;
    metric.polygons.set(
      area.geometries,
      (metric.polygons.get(area.geometries) || 0) + 1);
    metric.areaCount++;
  }
};

// Write the metrics to the provided output in CSV format.
const writeToCsv = function (output, groups) {
  output.write(OUTPUT_FIELDS.join(',') + '\n');
  const metrics = Array.from(groups.values());
  metrics.sort(function (a, b) {
    return a.keyValues.join(' ') < b.keyValues.join(' ') ? -1 : 1;
  });
  for (const metric of metrics) {
    const averageAreaKm = metric.areaCount > 0
      ? Math.floor(metric.totalAreaKm / metric.areaCount)
      : 0;
    const equivalentRadiusKm =
      Math.floor(Math.sqrt(averageAreaKm / Math.PI));
    let averagePolygons = 0;
    if (metric.polygons.size > 0) {
      let weightedSum = 0;
      let total = 0;
      metric.polygons.forEach(function (count, polygons) {
        weightedSum += polygons * count;
        total += count;
      });
      averagePolygons = weightedSum / total;
    }
    const values = metric.keyValues.map(function (value) {
      return value.indexOf(',') !== -1 || value.indexOf('"') !== -1
        ? '"' + value.replace(/"/g, '""') + '"'
        : value;
    }).concat([
      metric.ipCount,
      metric.areaCount,
      averageAreaKm,
      equivalentRadiusKm,
      averagePolygons.toFixed(2)
    ]);
    output.write(values.join(',') + '\n');
  }
};

/**
 * Runs the metrics example.
 *
 * @param {string} dataFile IP intelligence data file to compile metrics
 * for
 * @param {object} output writable stream for the output CSV metrics
 * @param {number} samplePercentage percentage of possible IP addresses to
 * include in the metric where 1 is 100%
 * @param {Function} condition function used to determine if an IP address
 * range should be included, or undefined to include all ranges
 * @param {object} progress writable stream for progress messages
 */
const run = async function (
  dataFile,
  output,
  samplePercentage,
  condition,
  progress) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=run
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the max performance profile for optimal detection speed
    // in this example. See the documentation for more detail on this
    // and other configuration options:
    // https://51degrees.com/documentation/_features__automatic_datafile_updates.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=run
    // https://51degrees.com/documentation/_features__usage_sharing.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=run
    performanceProfile: 'MaxPerformance',
    // inhibit sharing usage for this example, usually this should be
    // set 'true'
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  const engine = pipeline.getElement('ip');
  const metadata = engine.engine.getMetaData();

  // Create the data set structure to rapidly retrieve the data needed
  // to calculate the metrics.
  progress.write('Creating area index\n');
  const wktAreas = buildAreaIndex(metadata, progress);
  if (wktAreas === undefined) {
    progress.write('The data file does not contain the \'Areas\' ' +
      'property. An enterprise IP intelligence data file is required ' +
      'for this example. To obtain an enterprise data file for ' +
      'testing, please contact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=no-areas-property\n');
    return;
  }
  progress.write(`Created index for '${wktAreas.size}' areas\n`);

  // Perform an IP lookup for the sampled IP addresses in the valid
  // ranges and record the results.
  const groups = new Map();
  let ranges = 0;
  let processed = 0;
  let nextLog = Date.now() + LOG_INTERVAL_MS;
  for (const range of validRanges(metadata)) {
    if (condition !== undefined && condition(range) === false) {
      continue;
    }
    const current = ipToBytes(range[0]);
    const end = ipToBytes(range[1]);
    while (ipEquals(current, end) === false) {
      if (Math.random() <= samplePercentage) {
        await processIp(pipeline, wktAreas, groups, bytesToIp(current));
        processed++;
      }
      if (tryGetNextAddress(current) === false) {
        // Overflow, reached the maximum IP address.
        break;
      }
      if (Date.now() >= nextLog) {
        progress.write(`Processed '${ranges}' ranges and '${processed}' ` +
          `IP addresses, most recent '${bytesToIp(current)}'\n`);
        nextLog = Date.now() + LOG_INTERVAL_MS;
      }
    }
    ranges++;
  }
  progress.write(`Finished processing '${ranges}' ranges and ` +
    `'${processed}' IP addresses\n`);

  writeToCsv(output, groups);

  // Finally check the data file used for consistency with the other
  // examples.
  ExampleUtils.checkDataFile(pipeline, dataFile);
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // 51DEGREES_IPI_PATH environment variable, or find the enterprise
  // file in the project space. The lite file does not contain the
  // properties needed by this example.
  const dataFile = args.length > 0
    ? args[0]
    : ExampleUtils.findDataFile(ENTERPRISE_V_4_1_IPI);

  // Get the location for the output file.
  const outputFile = args.length > 1 ? args[1] : 'metrics-output.csv';

  // Get the sample percentage or use the default.
  const samplePercentage = args.length > 2
    ? parseFloat(args[2])
    : DEFAULT_SAMPLE_PERCENTAGE;

  // A condition can be used to limit the ranges included. For example,
  // only include IPv4 ranges as there are too many IPv6 addresses for
  // the metrics example to complete in a short time frame.
  // const condition = (range) => range[0].indexOf('.') !== -1;
  const condition = undefined;

  if (dataFile !== undefined) {
    const output = fs.createWriteStream(outputFile);
    run(
      dataFile,
      output,
      samplePercentage,
      condition,
      process.stdout).then(function () {
      output.end();
      console.log(`Output written to '${outputFile}'`);
    });
  } else {
    console.error('Failed to find an enterprise IP intelligence data ' +
      'file. This example requires an enterprise data file. To obtain ' +
      'one for testing, please contact us: ' +
      'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-metrics-console-metrics.js&utm_term=no-enterprise-data-file. The full path to a data file ' +
      'can be specified as a command line argument');
  }
};

module.exports = {
  run
};
