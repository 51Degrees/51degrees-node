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
 * @example cloudFlowElement.js
 *
 * This example demonstrates the creation of a Cloud Engine, a flowElement
 * that gets its results from a remote service rather than working them out
 * itself. Like the other star sign examples it takes a birth date as
 * evidence and gives a starsign, but here the starsign comes from a
 * service.
 *
 * In a real Pipeline the remote service is the 51Degrees cloud service. So
 * that this example runs anywhere, with no resource key and no network, it
 * starts a small star sign service of its own on this machine, which
 * answers the routes the Cloud Request Engine calls, and points the Cloud
 * Request Engine at it.
 *
 * The Pipeline has two flowElements:
 * 1. A Cloud Request Engine, which asks the service which evidence it
 *    accepts and which properties it gives, then sends that evidence and
 *    keeps the JSON it gets back.
 * 2. A Cloud Engine for the 'astrology' product, which reads its part of
 *    that JSON and gives it as properties, here starsign.
 */

const http = require('http');
const path = require('path');

// Note that this example is designed to be run from within the source
// repository. If this code has been copied to run standalone then you'll
// need to replace the requires below with the commented out versions below
// them.
const FiftyOnePipelineCore = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core'));
// const FiftyOnePipelineCore = require('fiftyone.pipeline.core');
const FiftyOnePipelineCloud = require(path.resolve(__dirname, '..'));
// const FiftyOnePipelineCloud = require('fiftyone.pipeline.cloudrequestengine');

// Where to go next, printed at the end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tFlow elements of your own: https://51degrees.com/documentation/_pipeline_api__examples__custom_element__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-cloudflowelement.js&utm_term=find-out-more-custom-elements',
  '\tThe cloud service: https://51degrees.com/documentation/_services__cloud__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-cloudflowelement.js&utm_term=find-out-more-cloud',
  '\tBuild your own: https://51degrees.com/build-your-own?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-cloudflowelement.js&utm_term=find-out-more-build-your-own',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-cloudflowelement.js&utm_term=find-out-more-contact'
].join('\n');

// The resource key a real Pipeline gives the Cloud Request Engine. The
// cloud service names its route after it, and the stand-in service does
// the same, though it checks nothing.
const RESOURCE_KEY = 'StarSignExample';

//! [service]
// Gets the star sign for a month and day, which is the work the remote
// service does.
const getStarSign = (month, day) => {
  const signs = [
    [1, 20, 'capricorn'], [2, 18, 'aquarius'], [3, 20, 'pisces'],
    [4, 20, 'aries'], [5, 20, 'taurus'], [6, 20, 'gemini'],
    [7, 22, 'cancer'], [8, 23, 'leo'], [9, 23, 'virgo'],
    [10, 23, 'libra'], [11, 22, 'scorpio'], [12, 21, 'sagittarius']
  ];
  const [, lastDay, sign] = signs[month - 1];
  return day <= lastDay ? sign : signs[month % 12][2];
};

// Sends a value as the JSON body of a response.
const sendJson = (res, value) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(value));
};

// A stand-in for the remote star sign service. Like the 51Degrees cloud
// service it answers the three routes the Cloud Request Engine calls, which
// give the evidence keys it accepts, the properties it gives for each
// product, and the results for the evidence posted as a form.
const starSignService = http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/evidencekeys') {
    sendJson(res, ['query.dateOfBirth']);
  } else if (route === '/accessibleproperties') {
    sendJson(res, {
      Products: {
        astrology: {
          DataTier: 'Example',
          Properties: [{
            Name: 'StarSign',
            Type: 'String',
            Category: 'Astrology',
            Description: "The user's starsign."
          }]
        }
      }
    });
  } else if (route === '/' + RESOURCE_KEY + '.json' && req.method === 'POST') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      // Each evidence value is sent under its name without the prefix.
      const dateOfBirth = new URLSearchParams(body).get('dateOfBirth');
      const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateOfBirth || '');
      sendJson(res, {
        astrology: parts
          ? { starsign: getStarSign(Number(parts[1]), Number(parts[2])) }
          : {
              starsign: null,
              starsignnullreason: 'No date of birth was given.'
            }
      });
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});
//! [service]

//! [class]
// The Cloud Engine for the astrology product. The CloudEngine it extends
// does the work, reading the product named by its dataKey from the JSON the
// Cloud Request Engine got, and taking its properties and evidence keys
// from what the service said it accepts and gives.
class StarSignCloudEngine extends FiftyOnePipelineCloud.CloudEngine {
  constructor () {
    super(...arguments);

    // The product this engine reads from the service's JSON, and the key
    // its results are found under in the flowData.
    this.dataKey = 'astrology';
  }
}
//! [class]

//! [usage]
starSignService.listen(0, '127.0.0.1', async () => {
  const { port } = starSignService.address();

  // The Cloud Request Engine calls the service at baseURL. A real Pipeline
  // leaves baseURL out and gives a resource key of its own, so the
  // 51Degrees cloud service is used.
  const cloudRequestEngine = new FiftyOnePipelineCloud.CloudRequestEngine({
    resourceKey: RESOURCE_KEY,
    baseURL: `http://127.0.0.1:${port}/`
  });

  const pipeline = new FiftyOnePipelineCore.PipelineBuilder()
    .add(cloudRequestEngine)
    .add(new StarSignCloudEngine())
    .build();

  // Errors are written to the console.
  pipeline.on('error', console.error);

  try {
    for (const dateOfBirth of ['1990-12-25', '2019-09-26', undefined]) {
      const flowData = pipeline.createFlowData();
      if (dateOfBirth !== undefined) {
        flowData.evidence.add('query.dateOfBirth', dateOfBirth);
      }
      await flowData.process();

      const starSign = flowData.astrology.starsign;
      console.log(
        (dateOfBirth === undefined
          ? 'No date of birth'
          : 'Date of birth ' + dateOfBirth) +
        ', star sign ' +
        (starSign.hasValue
          ? starSign.value
          : 'unknown (' + starSign.noValueMessage + ')'));
    }
    console.log(FIND_OUT_MORE);
  } finally {
    starSignService.close();
  }
});
//! [usage]
