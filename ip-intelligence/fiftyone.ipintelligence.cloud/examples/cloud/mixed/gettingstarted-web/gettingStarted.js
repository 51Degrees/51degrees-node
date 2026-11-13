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
 * @example cloud/mixed/gettingstarted-web/gettingStarted.js
 *
 * This example demonstrates using both device detection and IP
 * intelligence from the 51Degrees cloud service as part of a simple web
 * server. The User-Agent and IP address of the requesting client are
 * used as evidence and details about the device, network, and location
 * are displayed.
 *
 * The page also loads the 51Degrees client-side script from
 * '/51Degrees.core.js'. The script gathers evidence in the browser, such
 * as the screen size, and posts that evidence to '/json', which answers
 * with the refined results.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-web/gettingStarted.js).
 *
 * To run this example, you will eventually need to create a resource key.
 * A resource key is used as shorthand to store the particular set of
 * properties you are interested in as well as any associated license keys
 * that entitle you to increased request limits and/or paid-for properties,
 * but it is not yet available for IP intelligence. For now, you can run
 * the onpremise/mixed/gettingstarted-api example to simulate a custom
 * hosted cloud service, and point this example to it by setting the
 * '_51DEGREES_CLOUD_ENDPOINT' environment variable to 'http://localhost:5225/'.
 * Any value can then be used for the resource key.
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.cloudrequestengine](https://www.npmjs.com/package/fiftyone.pipeline.cloudrequestengine)
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.devicedetection.cloud](https://www.npmjs.com/package/fiftyone.devicedetection.cloud)
 * - [fiftyone.ipintelligence.cloud](https://www.npmjs.com/package/fiftyone.ipintelligence.cloud)
 * - [pug](https://www.npmjs.com/package/pug)
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../../node_modules/', requestedPackage));
  } catch (e) {
    try {
      return require(requestedPackage);
    } catch (e2) {
      return require(requestedPackage);
    }
  }
};

const fs = require('fs');
const http = require('http');
const pug = require('pug');

const compiledFunction =
  pug.compileFile(path.join(__dirname, '/index.pug'));

const core = require51('fiftyone.pipeline.core');

const optionsExtension =
  require51('fiftyone.ipintelligence.shared').optionsExtension;

const dataExtension =
  require51('fiftyone.ipintelligence.shared').dataExtension;

const ExampleUtils = require(path.join(__dirname, '/../../exampleUtils'));

// Path the client-side script is served from. The web integrations of the
// other Pipeline APIs serve it at the same path.
const coreJsPath = '/51Degrees.core.js';

// Path the client-side script posts the evidence it gathers to.
const jsonPath = '/json';

// Pipeline variable to be used
let pipeline;

const setPipeline = (options) => {
  const resourceKey = optionsExtension.getResourceKey(options);

  if (!resourceKey || resourceKey.startsWith('!!')) {
    throw 'No resource key specified in the configuration file ' +
      '\'51d.json\' or the environment variable ' +
      `'${ExampleUtils.RESOURCE_KEY_VARIABLE}'. The 51Degrees cloud ` +
      'service is accessed using a \'ResourceKey\'. For more information ' +
      'see ' +
      'https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-web-gettingstarted.js&utm_term=resource-key-required. ' +
      'A resource key with everything this example displays can be ' +
      'created at https://configure.51degrees.com/hYzn3TV3?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-web-gettingstarted.js&utm_term=resource-key-required with a paid ' +
      'subscription. A free key created at ' +
      'https://configure.51degrees.com/Wkqxf3Bs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-web-gettingstarted.js&utm_term=resource-key-required populates only the ' +
      'free properties, which for IP intelligence are Country, ' +
      'LocationConfidence, Ip and IpV6. See ' +
      'https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-web-gettingstarted.js&utm_term=resource-key-required to get a paid subscription with ' +
      'more properties. Once complete, populate the config file or ' +
      'environment variable mentioned at the start of this message ' +
      'with the key.';
  }

  pipeline = new core.PipelineBuilder({
    // Add the elements that build the client-side script and the JSON it
    // fetches.
    addJavaScriptBuilder: true,
    javascriptBuilderSettings: {
      // The route the client-side script posts the evidence it gathers to.
      endPoint: jsonPath
    }
  }).buildFromConfiguration(options);

  // Logging of errors and other messages.
  // Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);
};

// Directory holding the shared pattern-library assets (CSS and JS) that
// are served at '/css/...' and '/js/...'.
const publicDir = path.join(__dirname, '/public');

const server = http.createServer(async (req, res) => {
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
  // The User-Agent and IP address of the requesting client are
  // added automatically from the request.
  const flowData = pipeline.createFlowData();

  // Extract required evidence from the Http request, being its headers,
  // cookies and query string. The client-side script posts the evidence
  // it gathers as a form body, so the body is read first.
  try {
    await flowData.evidence.addFromRequestAsync(req);
  } catch (e) {
    // The request could not be read, for example because the client
    // closed the connection part way through the form body.
    res.statusCode = 400;
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  if (urlPath === jsonPath) {
    // Answer the client-side script with the results of processing the
    // evidence it posted.
    flowData.process().then(function () {
      // Sends the caching headers, and a 304 to a matching If-None-Match.
      core.Helpers.writeClientSideResponse(req, res, flowData,
        'application/json', JSON.stringify(flowData.jsonbundler.json));
    });
    return;
  }

  if (urlPath === coreJsPath) {
    // Serve the client-side script built for this request. The script
    // carries the results of this request's detection, so it is built per
    // request rather than cached.
    flowData.process().then(function () {
      // Sends the caching headers, and a 304 to a matching If-None-Match.
      core.Helpers.writeClientSideResponse(req, res, flowData,
        'application/x-javascript', flowData.javascriptbuilder.javascript);
    });
    return;
  }

  flowData.process().then(function () {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    // Obtain all used evidence
    const allEvidence = flowData.evidence.getAll();
    const evidences =
      pipeline.getElement('cloud').evidenceKeyFilter.filterEvidence(
        allEvidence);

    // The IP address supplied through the lookup form, used to
    // pre-populate the input on the rendered page.
    const inputIpAddress =
      (allEvidence['query.client-ip'] ||
        allEvidence['header.x-forwarded-for'] || '');

    // Compile a response
    res.end(compiledFunction(
      {
        evidenceUsed: evidences,
        allEvidence,
        inputIpAddress,
        coreJsPath,
        areas: dataExtension.getValueHelper(flowData.ip, 'areas'),
        isMobile: dataExtension.getValueHelper(flowData.device, 'ismobile'),
        platformName: dataExtension.getValueHelper(flowData.device, 'platformname'),
        platformVersion: dataExtension.getValueHelper(flowData.device, 'platformversion'),
        browserName: dataExtension.getValueHelper(flowData.device, 'browsername'),
        browserVersion: dataExtension.getValueHelper(flowData.device, 'browserversion'),
        deviceType: dataExtension.getValueHelper(flowData.device, 'devicetype'),
        // The device id combines the profile ids of the hardware, platform,
        // browser and crawler components that were matched.
        deviceId: dataExtension.getValueHelper(flowData.device, 'deviceid'),
        registeredName: dataExtension.getValueHelper(flowData.ip, 'registeredname'),
        registeredOwner: dataExtension.getValueHelper(flowData.ip, 'registeredowner'),
        registeredCountry: dataExtension.getValueHelper(flowData.ip, 'registeredcountry'),
        ipRangeStart: dataExtension.getValueHelper(flowData.ip, 'iprangestart'),
        ipRangeEnd: dataExtension.getValueHelper(flowData.ip, 'iprangeend'),
        country: dataExtension.getValueHelper(flowData.ip, 'country'),
        countryCode: dataExtension.getValueHelper(flowData.ip, 'countrycode'),
        town: dataExtension.getValueHelper(flowData.ip, 'town'),
        latitude: dataExtension.getValueHelper(flowData.ip, 'latitude'),
        longitude: dataExtension.getValueHelper(flowData.ip, 'longitude')
      })
    );
  });
});

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  // Load the configuration options from config file.
  const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

  // Use the resource key from the environment variables if one
  // is not present in the configuration.
  const resourceKeyFromConfig = optionsExtension.getResourceKey(options);
  if (!resourceKeyFromConfig || resourceKeyFromConfig.startsWith('!!')) {
    optionsExtension.setResourceKey(
      options, ExampleUtils.getResourceKeyFromEnv());
  }

  setPipeline(options);
  const port = process.env.PORT || 3001;
  const hostname = 'localhost';
  server.listen(port, hostname);
  console.log(`Server listening on: http://${hostname}:${port}`);
};

// Export server object and set pipeline.
module.exports = {
  server,
  setPipeline
};
