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
@example webIntegration.js

@include{doc} example-web-integration-location.txt

This example is available in full on [GitHub](https://github.com/51Degrees/location-node/blob/master/examples/webIntegration.js).

@include{doc} example-require-resourcekey.txt
 */

const FiftyOneDegreesLocation = require((process.env.directory || __dirname) + '/../');

// Obtain a resource key with the properties required to test this
// example for free: https://configure.51degrees.com/v399y42f?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-webintegration.js&utm_term=top
// The properties used in this example are:
// Country, State, County, Town, JavaScript
const myResourceKey = process.env.RESOURCE_KEY || '!!YOUR_RESOURCE_KEY!!';
// We need 'server' to be defined here so that, when this example
// is executed as part of a unit test, the server can be closed
// once the test is complete.
let server;

if (myResourceKey.substring(0, 2) === '!!') {
  console.log('You need to create a resource key at ' +
        'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-webintegration.js&utm_term=resource-key-required and paste it into the code, ' +
        'replacing !!YOUR_RESOURCE_KEY!!');
} else {
  // Create a new pipeline and set the config.
  // You need to create a resource key at https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-webintegration.js&utm_term=top
  // and paste it into the code.
  // The JavaScriptBuilderSettings allow you to provide an endpoint
  // which will be requested by the client side JavaScript.
  // This should return the contents of the JSONBundler element which
  // is automatically added to the Pipeline.
  const pipeline = new FiftyOneDegreesLocation.GeoLocationPipelineBuilder({
    resourceKey: myResourceKey,
    javascriptBuilderSettings: {
      endPoint: '/json'
    }
  }).build();

  // Logging of errors and other messages.
  // Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);

  const http = require('http');

  server = http.createServer((req, res) => {
    const flowData = pipeline.createFlowData();

    // Add any information from the request
    // (headers, cookies and additional client side provided information)
    flowData.evidence.addFromRequest(req);

    flowData.process().then(function () {
      res.statusCode = 200;

      if (req.url.startsWith('/json')) {
        // Return the json to the client.
        res.setHeader('Content-Type', 'application/json');

        res.end(JSON.stringify(flowData.jsonbundler.json));
      } else {
        res.setHeader('Content-Type', 'text/html');

        let output = '';

        const data = flowData.location;
        console.log(data);
        // Print results of client side processing to the page.
        output += `<h2>Example</h2>

<div id="content">
    <p>
        The following values are determined sever-side on the first request.
        As the server has no location information to work from, these 
        values will all be unknown:
    </p>
    <dl>
        <dt><strong>Country</strong></dt>
        <dv>` + (data && data.country && data.country.hasValue
            ? data.country.value
            : ('Unknown (' + (data && data.country ? data.country.noValueMessage : 'no data') + ')')) + `</dv>
        <dt><strong>State</strong></dt>
        <dv>` + (data && data.state && data.state.hasValue
            ? data.state.value
            : ('Unknown (' + (data && data.state ? data.state.noValueMessage : 'no data') + ')')) + `</dv>          
        <dt><strong>County</strong></dt>
        <dv>` + (data && data.county && data.county.hasValue
            ? data.county.value
            : ('Unknown (' + (data && data.county ? data.county.noValueMessage : 'no data') + ')')) + `</dv>
        <dt><strong>Town/City</strong></dt>
        <dv>` + (data && data.town && data.town.hasValue
            ? data.town.value
            : ('Unknown (' + (data && data.town ? data.town.noValueMessage : 'no data') + ')')) + `</dv>
    </dl>
    <p>
        When the button below is clicked, JavaScript running on the client-side 
        will be used to obtain additional evidence (i.e. the location information 
        from the device). If no additional information appears then it may 
        indicate an external problem such as JavaScript being disabled in 
        your browser.
    </p>
    <p>
        Note that the accuracy of the information is dependent on the accuracy 
        of the location data returned by your device. Any device that lacks GPS 
        is likely to return a highly inaccurate result. Among devices with GPS, 
        some have a significantly lower margin of error than others.
    </p>
    <button type="button" onclick="buttonClicked()">Use my location</button>
</div>

<script>
    buttonClicked = function () {
        // This function will fire when the JSON data object is updated
        // with information from the server.
        // The sequence is:
        // 1. Response contains JavaScript property 'JavaScript'. This is not executed immediately on the client as it will prompt the user to allow access to location.
        // 2. When the button is clicked, the fod.complete function is called, passing 'location' as the second parameter. This lets the code know that we want to execute
        // any JavaScript needed to obtain the location data that is needed to determine the user's postal address details.
        // 3. The execution of the location JavaScript triggers a background callback to the webserver that includes the new evidence (i.e. lat/lon).
        // 4. The web server responds with new JSON data that contains the updated property values based on the new evidence.
        // 5. The JavaScript integrates the new JSON data and fires the 'complete' callback function below, which then displays the results.
        fod.complete(function (data) {
            let fieldValues = [];
            if (data.location) {
                fieldValues.push(["Country", data.location.country]);
                fieldValues.push(["State", data.location.state]);
                fieldValues.push(["County", data.location.county]);
                fieldValues.push(["Town/City", data.location.town]);
            }
            else {
                fieldValue.push(["Location data is empty. This probably means that something has gone wrong with the JavaScript evaluation.", ""])
            }
            displayValues(fieldValues);
        }, 'location');
    }

    function displayValues(fieldValues) {
        var list = document.createElement("dl");
        fieldValues.forEach(function (entry) {
            var name = document.createElement("dt");
            var value = document.createElement('dv');
            var bold = document.createElement('strong');
            var fieldname = document.createTextNode(entry[0]);
            var fieldvalue = document.createTextNode(entry[1]);
            bold.appendChild(fieldname);
            name.appendChild(bold);
            value.appendChild(fieldvalue);
            list.appendChild(name);
            list.appendChild(value);
        });

        var element = document.getElementById("content");
        element.appendChild(list);
    }
</script>`;

        // Get JavaScript to put inside the page to gather extra evidence
        const js = `<script>${flowData.javascriptbuilder.javascript}</script>`;

        res.end(js + output);
      }
    });
  });

  const port = 3000;
  server.listen(port);
  console.log('Server listening on port: ' + port);
}
