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
 * @example onpremise/gettingstarted-web/gettingStarted.js
 *
 * This example demonstrates how to use the 51Degrees on-premise IP
 * intelligence engine as part of a simple web server. The IP address of the
 * requesting client is used as evidence and details about the associated
 * network, and location are displayed.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web/gettingStarted.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 * - [pug](https://www.npmjs.com/package/pug)
 *
 * This example can be configured using the 51d.json file. The path to the
 * data file is taken from this configuration, and can be changed by editing
 * the file.
 *
 * The results of the lookup can be accessed by querying the `ip` property of
 * a FlowData object. This can then be used to interrogate the data.
 * ```
 * var flowData = pipeline.createFlowData();
 * flowData.evidence.addFromRequest(request);
 * await flowData.process();
 * var ipData = flowData.ip;
 * var registeredName = ipData.registeredname;
 * ```
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

const fs = require('fs');
const http = require('http');
const pug = require('pug');

const compiledFunction =
  pug.compileFile(path.join(__dirname, '/index.pug'));

const ipi = require51('fiftyone.ipintelligence.onpremise');

const translation = require51('fiftyone.ipintelligence.translation');

const optionsExtension =
  require51('fiftyone.ipintelligence.shared').optionsExtension;

const dataExtension =
  require51('fiftyone.ipintelligence.shared').dataExtension;

const { DATA_FILE_AGE_WARNING, ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, '/../exampleUtils'));

// Pipeline variable to be used
let pipeline;

const setPipeline = (options) => {
  let dataFilePath = optionsExtension.getDataFilePath(options);
  if (!dataFilePath) {
    throw 'A data file must be specified in the 51d.json file.';
  }

  if (!fs.existsSync(dataFilePath)) {
    // Check the 51DEGREES_IPI_PATH environment variable for an explicit
    // path, then search the folder hierarchy for the file name.
    const newDataFilePath =
      ExampleUtils.findDataFile(path.basename(dataFilePath));
    if (newDataFilePath !== undefined) {
      dataFilePath = newDataFilePath;
      console.warn('Failed to find an IP intelligence data file ' +
        `at the specified path '${dataFilePath}'. Use '${newDataFilePath}' ` +
        'instead.');
    } else {
      throw 'Failed to find an IP intelligence data file at ' +
        `'${dataFilePath}'. If using the lite file, then make sure the ` +
        'cxx/data submodule has been fetched by running ' +
        '\'git submodule update --init --recursive\'. Otherwise, ensure ' +
        'that the filename is correct in 51d.json.';
    }
  }

  // Build the on-premise IP intelligence pipeline and append the two country
  // translation engines. The IP intelligence engine emits the weighted lists
  // of country codes; the translation engines turn those into the localized,
  // ordered country name lists that the page binds the dropdown to. The
  // browser language is taken from the request's Accept-Language header (a
  // 'translation' query parameter overrides it).
  pipeline = new ipi.IpIntelligenceOnPremisePipelineBuilder({
    performanceProfile: 'Balanced',
    dataFile: dataFilePath,
    shareUsage: false,
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false,
    suppressProcessExceptions: true
  })
    .add(new translation.CountryCodeTranslationEngineBuilder().build())
    .add(new translation.CountriesTranslationEngineBuilder().build())
    .build();

  // Logging of errors and other messages.
  // Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);
};

// Directory holding the shared pattern-library assets (CSS and JS) that
// are served at '/css/...' and '/js/...'.
const publicDir = path.join(__dirname, '/public');

const server = http.createServer((req, res) => {
  // Serve the shared example assets before running the pipeline. When the
  // request is for one of those files the response is sent here and we
  // return early.
  if (ExampleUtils.serveStaticAsset(req, res, publicDir)) {
    return;
  }

  // FlowData is a data structure that is used to convey
  // information required for detection and the results of the
  // detection through the pipeline.
  // Information required for detection is called "evidence".
  // For IP intelligence the IP address of the requesting client
  // is used. This is added automatically from the request.
  const flowData = pipeline.createFlowData();

  // Extract required evidence from the Http request.
  flowData.evidence.addFromRequest(req);

  flowData.process().then(function () {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    // Obtain all used evidence
    const allEvidence = flowData.evidence.getAll();
    const evidences =
      pipeline.getElement('ip').evidenceKeyFilter.filterEvidence(
        allEvidence);

    // The IP address supplied through the lookup form, used to
    // pre-populate the input on the rendered page.
    const inputIpAddress =
      (allEvidence['query.client-ip'] ||
        allEvidence['header.x-forwarded-for'] || '');

    // Read one of the ordered "All" lists produced by the country
    // translation engine, returning an empty array when it is not present.
    const allList = (key) => {
      try {
        const value = flowData.get('countrynamestranslated').get(key);
        return value && value.hasValue ? value.value : [];
      } catch (e) {
        return [];
      }
    };

    // Read a weighted list from the IP intelligence element data and format
    // each entry as 'value (weight%)' for display, returning an empty array
    // when the property is not present.
    const ipList = (key) => {
      try {
        const value = flowData.ip[key];
        if (value && value.hasValue && Array.isArray(value.value)) {
          return value.value.map((item) => dataExtension.formatValue(item));
        }
        return [];
      } catch (e) {
        return [];
      }
    };

    // A property that the data file does not have is shown as needing the
    // Enterprise data file. The country lists are built from the country
    // codes, which only the Enterprise data file has, so without them each
    // list says so in place of every country in alphabetical order.
    const ipEngine = pipeline.getElement('ip');
    const countriesNeedEnterprise =
      !ExampleUtils.hasProperty(ipEngine, 'CountryCodesGeographical');
    const countries = (list) =>
      countriesNeedEnterprise ? [NEEDS_ENTERPRISE] : list;
    const areas = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'areas');
    const latitude = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'latitude');
    const longitude = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'longitude');
    const located = (value) => value === NEEDS_ENTERPRISE ? '' : value;

    // Compile a response
    res.end(compiledFunction(
      {
        countryCodesGeographical: countries(ipList('countrycodesgeographical')),
        countryCodesPopulation: countries(ipList('countrycodespopulation')),
        countryCodesGeographicalAll:
          countries(allList('countrycodesgeographicalall')),
        countryNamesGeographicalAllTranslated:
          countries(allList('countrynamesgeographicalalltranslated')),
        countryCodesPopulationAll:
          countries(allList('countrycodespopulationall')),
        countryNamesPopulationAllTranslated:
          countries(allList('countrynamespopulationalltranslated')),
        dataFilePublishedTime: new Date().getTime(),
        dataFileAgeWarning: DATA_FILE_AGE_WARNING,
        evidenceUsed: evidences,
        allEvidence,
        inputIpAddress,
        areas,
        mapAreas: located(areas),
        freeDataFile: ExampleUtils.isFreeDataFile(ipEngine),
        registeredName: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredname'),
        registeredOwner: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredowner'),
        registeredCountry: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredcountry'),
        ipRangeStart: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'iprangestart'),
        ipRangeEnd: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'iprangeend'),
        country: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'country'),
        countryCode: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'countrycode'),
        countryCode3: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'countrycode3'),
        region: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'region'),
        state: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'state'),
        town: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'town'),
        latitude,
        longitude,
        mapLatitude: located(latitude),
        mapLongitude: located(longitude),
        accuracyRadius:
          ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'accuracyradiusmin'),
        timeZoneOffset:
          ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'timezoneoffset')
      })
    );
  });
});

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  // Load the configuration options from config file.
  const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

  setPipeline(options);
  const port = 3001;
  const hostname = 'localhost';
  server.listen(port, hostname);
  console.log(`Server listening on: http://${hostname}:${port}`);
};

// Export server object and set pipeline.
module.exports = {
  server,
  setPipeline
};
