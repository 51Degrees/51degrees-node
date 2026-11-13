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

const core = require('fiftyone.pipeline.core');

const testEngine = new core.FlowElement({
  dataKey: 'testengine',
  properties: {
    one: {
      type: 'int'
    },
    two: {
      type: 'int'
    },
    three: {
      type: 'javascript'
    },
    four: {
      type: 'string'
    }
  },
  processInternal: function (flowData) {
    const contents = { one: 1, two: 2 };

    const three = new core.AspectPropertyValue();
    three.value = "console.log('ok')";

    contents.three = three;

    contents.four = new core.AspectPropertyValue(
      'This property is not available'
    );

    const data = new core.ElementDataDictionary({
      flowElement: this,
      contents
    });

    flowData.setElementData(data);
  }
});

const pipeline = new core.PipelineBuilder()
  .add(testEngine)
  .build();

const flowData = pipeline.createFlowData();

test('jsonbuilder contents', done => {
  flowData.process().then(function () {
    const json = JSON.stringify(flowData.jsonbundler.json);

    expect(json).toBe(
      JSON.stringify({
        javascriptProperties: ['testengine.three'],
        sequence: {
          'session-id': flowData.evidence.get('query.session-id'),
          sequence: 1
        },
        testengine: {
          one: 1,
          two: 2,
          three: "console.log('ok')",
          four: null,
          fournullreason: 'This property is not available'
        }
      })
    );

    done();
  });
});

test('sequence gives a session id', () => {
  expect(flowData.evidence.get('query.session-id')).toBeTruthy();
});

test('sequence gives a sequence number', () => {
  expect(flowData.evidence.get('query.sequence')).toBe(1);
});

const flowData2 = pipeline.createFlowData();

flowData2.evidence.add('query.session-id', 'test');
flowData2.evidence.add('query.sequence', 10);

test('sequence number for same session id increments', (done) => {
  flowData2.process().then(function () {
    expect(flowData2.evidence.get('query.sequence')).toBe(11);

    done();
  });
});

test('no javascriptProperties when sequence cap met', () => {
  expect(flowData2.jsonbundler.json.javascriptProperties.length).toBe(0);
});

// The script appends the session id and the sequence to its own request,
// after taking the record of that request's inputs. That record decides
// whether a later page view in the same tab can be served from the cached
// response, and a session id is different on every page view, so one named
// in the parameters would put a value in the record that can never match.
// The cache would be thrown away and the snippets would run again on every
// page.
//
// The parameters are only rendered when the builder has somewhere to send
// its request, so this pipeline gives it one.
const parameterPipeline = new core.PipelineBuilder({
  javascriptBuilderSettings: {
    host: 'localhost',
    protocol: 'https',
    endPoint: '/json'
  }
})
  .add(testEngine)
  .build();

const flowData3 = parameterPipeline.createFlowData();

flowData3.evidence.add('query.session-id', 'test-session');
flowData3.evidence.add('query.sequence', 1);
flowData3.evidence.add('query.mark', 'kept');

test('the script parameters leave out the session id and the sequence',
  (done) => {
    flowData3.process().then(function () {
      const script = flowData3.javascriptbuilder.javascript;
      // The one line that assigns the parameters object. The template has
      // called it both "parameters" and "renderedParameters", so naming
      // either would make this pass or fail on which revision of the
      // template is embedded rather than on anything the builder does. The
      // line that assigns it mentions parameters and has a brace; the line
      // that merely calls it has no brace.
      const declaration = script.split(/\r?\n/)
        .filter(line => /parameters\s*=/i.test(line) && line.includes('{'));

      expect(declaration.length).toBe(1);
      expect(declaration[0]).not.toContain('session-id');
      expect(declaration[0]).not.toContain('sequence');
      // Present, or this would pass with no parameters at all.
      expect(declaration[0]).toContain('kept');

      done();
    });
  });

test('JSON bundler - Verify output where delayed execution = false', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        delayexecution: false,
        type: 'javascript'
      },
      two: {
        evidenceproperties: ['jsontestengine']
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({ one: 1, two: 2 });
    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

test('JSON bundler - Verify output where delayed execution = true', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        delayexecution: true,
        type: 'javascript'
      },
      two: {
        evidenceproperties: ['one']
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({
      onedelayexecution: true,
      one: 1,
      twoevidenceproperties: ['jsontestengine.one'],
      two: 2
    });
    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

// The JSON Builder page says delayexecution is added for each property that
// has a value and whose delay execution flag is true.
test('JSON bundler - delayexecution only for a property with a value',
  async () => {
    const engine = new core.FlowElement({
      dataKey: 'jsontestengine',
      properties: {
        one: { delayexecution: true },
        two: { delayexecution: true },
        three: { delayexecution: true }
      },
      processInternal: function (flowData) {
        flowData.setElementData(new core.ElementDataDictionary({
          flowElement: this,
          contents: {
            one: new core.AspectPropertyValue(null, 'script'),
            two: new core.AspectPropertyValue('No script on this request.'),
            three: null
          }
        }));
      }
    });
    const flowData = new core.PipelineBuilder().add(engine).build()
      .createFlowData();

    await flowData.process();

    const json = flowData.jsonbundler.json.jsontestengine;
    expect(json.onedelayexecution).toBe(true);
    expect(json.one).toBe('script');
    expect(json).not.toHaveProperty('twodelayexecution');
    expect(json.two).toBeNull();
    expect(json.twonullreason).toBe('No script on this request.');
    expect(json).not.toHaveProperty('threedelayexecution');
  });

// The bundler keeps each element's delayed properties after the first
// request, so every later request must still mark each element's own.
test('JSON bundler - each element keeps its own delayed properties on ' +
  'later requests', async () => {
  // Each element names its properties after its own key, so reading
  // another element's list loses them.
  const element = (dataKey) => new core.FlowElement({
    dataKey,
    properties: {
      [dataKey + 'script']: { delayexecution: true },
      [dataKey + 'result']: { evidenceproperties: [dataKey + 'script'] }
    },
    processInternal: function (flowData) {
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: {
          [dataKey + 'script']: 'run()',
          [dataKey + 'result']: 'value'
        }
      }));
    }
  });
  const pipeline = new core.PipelineBuilder()
    .add(element('first'))
    .add(element('second'))
    .build();

  for (let request = 1; request <= 2; request++) {
    const flowData = pipeline.createFlowData();
    await flowData.process();
    for (const dataKey of ['first', 'second']) {
      const json = flowData.jsonbundler.json[dataKey];
      expect([request, dataKey, json[dataKey + 'scriptdelayexecution']])
        .toEqual([request, dataKey, true]);
      expect([request, dataKey, json[dataKey + 'resultevidenceproperties']])
        .toEqual([request, dataKey, [dataKey + '.' + dataKey + 'script']]);
    }
  }
});

test('JSON bundler - Verify output where a property has multiple evidence properties', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        evidenceproperties: ['two', 'three']
      },
      two: {
        delayexecution: true
      },
      three: {
        delayexecution: false
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2, three: 3 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({
      oneevidenceproperties: ['jsontestengine.two'],
      one: 1,
      twodelayexecution: true,
      two: 2,
      three: 3
    });

    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

// Check that the addJavaScriptBuilder option is honoured
test('JavaScriptBuilder - Verify minify default setting', (done) => {
  const noJsPipelineBuilder = new core.PipelineBuilder({
    addJavaScriptBuilder: false
  });

  expect(noJsPipelineBuilder.addJavaScriptBuilder).toBe(false);

  done();
});

// Check that the default setting of minify is false
test('JavaScriptBuilder - Verify minify default setting', (done) => {
  expect(flowData.pipeline.flowElements.javascriptbuilder.settings.minify)
    .toBe(false);

  done();
});

// The builders for every language render the same script, and the .NET
// builder is the reference. These tests pin the parts of the script that
// depend on the request, being the callback URL and the parameters object.

// Renders the script for the given evidence and builder settings.
const renderScript = async (settings, evidence) => {
  const renderPipeline = new core.PipelineBuilder({
    javascriptBuilderSettings: settings
  })
    .add(testEngine)
    .build();
  const renderData = renderPipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    renderData.evidence.add(key, value);
  }
  await renderData.process();
  return renderData.javascriptbuilder.javascript;
};

// The URLs the script sends its request to. The template writes the URL
// into a fetch call or an XMLHttpRequest, depending on the browser.
const requestUrls = (script) => {
  const urls = [];
  const pattern = /(?:fetch\(|createCORSRequest\('POST',\s*)'([^']*)'/g;
  let match;
  while ((match = pattern.exec(script)) !== null) {
    urls.push(match[1]);
  }
  return urls;
};

// The object literal the rendered parameters function returns.
const renderedParameters = (script) => {
  const line = script.split(/\r?\n/)
    .find(l => /parameters\s*=/i.test(l) && l.includes('{'));
  const match = /return\s+(\{.*\});\s*\};/.exec(line);
  return JSON.parse(match[1]);
};

const requestEvidence = {
  'header.host': 'localhost',
  'header.protocol': 'https',
  'query.user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'query.client-ip': '192.0.2.1',
  'query.session-id': 'test-session',
  'query.sequence': 1
};

// The request goes to the endpoint alone. The values the page was requested
// with travel in the request body, so none of them, and in particular not
// the visitor's User-Agent or address, are written into the URL.
test('the request URL is the protocol, host and endpoint only', async () => {
  const script = await renderScript({ endPoint: '/json' }, requestEvidence);
  const urls = requestUrls(script);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).toBe('https://localhost/json');
  }
});

// One slash between the host and the endpoint, whichever of them carries it.
test.each([
  ['no slash on either', 'localhost', 'json'],
  ['slash on the host', 'localhost/', 'json'],
  ['slash on both', 'localhost/', '/json'],
  ['slash on the endpoint', 'localhost', '/json']
])('the request URL has one slash - %s', async (name, host, endPoint) => {
  const script = await renderScript(
    { host, protocol: 'https', endPoint },
    {});
  const urls = requestUrls(script);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).toBe('https://localhost/json');
  }
});

// Names and values are encoded as the .NET builder encodes them, because
// the script joins them into the request body as they stand.
test('the parameters are encoded', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'query.user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'query.a b': "x~'y&z=1"
  });
  expect(renderedParameters(script)).toStrictEqual({
    'user-agent': 'Mozilla%2F5.0+(Windows+NT+10.0%3B+Win64%3B+x64)',
    'a+b': 'x%7E%27y%26z%3D1'
  });
});

// A name is everything after the first dot of the evidence key, so a name
// that itself contains a dot, such as id.usage, is kept whole.
test('a parameter name keeps every part after the prefix', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'query.id.usage': 'standard'
  });
  expect(renderedParameters(script)).toStrictEqual({
    'id.usage': 'standard'
  });
});

// Only query evidence becomes a parameter. A header whose name happens to
// contain the word query is not one.
test('only query evidence becomes a parameter', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'header.x-query': 'header value',
    'query.mark': 'kept'
  });
  expect(renderedParameters(script)).toStrictEqual({ mark: 'kept' });
});

// Renders one script for each host given, all through the same element, and
// returns them with the errors the pipeline logged.
const renderScripts = async (hosts) => {
  const renderPipeline = new core.PipelineBuilder({
    javascriptBuilderSettings: { endPoint: '/json' }
  })
    .add(testEngine)
    .build();
  const errors = [];
  renderPipeline.on('error', message => errors.push(message));
  const scripts = [];
  for (const host of hosts) {
    const renderData = renderPipeline.createFlowData();
    renderData.evidence.add('header.host', host);
    await renderData.process();
    scripts.push(renderData.javascriptbuilder.javascript);
  }
  return { scripts, errors };
};

// A host the check refuses gives a script with no callback, and the refusal
// is logged as an error the first time only, whatever the requests in
// between.
test('a refused URL is left out and logged once', async () => {
  const { scripts, errors } = await renderScripts(
    ['exa mple.com', 'exa mple.com', 'localhost', 'exa mple.com']);
  scripts.forEach((script, i) => {
    expect(script).toContain('new fiftyoneDegreesManager()');
    if (i === 2) {
      expect(requestUrls(script)).toContain('https://localhost/json');
    } else {
      expect(requestUrls(script)).toStrictEqual([]);
      expect(script).not.toContain('exa mple.com');
    }
  });
  expect(errors.length).toBe(1);
  expect(errors[0]).toContain('"https://exa mple.com/json"');
});

// The URL is quoted and escaped in the log, so a line break in it cannot
// start a new log line.
test('a refused URL is logged on one line', async () => {
  const { errors } = await renderScripts(['a\nb.com\r\u2028']);
  expect(errors.length).toBe(1);
  expect(errors[0]).not.toMatch(/[\n\r\u2028]/);
  expect(errors[0]).toContain('a\\nb.com\\r\\u2028');
});

// The log never holds what comes before the last '@' of the host value,
// whether the host is configured or comes from the request. Each host has an
// element of its own because a refusal is logged once per element.
test.each([
  ['user:secret@example.com', 'https://***@example.com/json'],
  ['a@b@example.com', 'https://***@example.com/json'],
  ['u@[::1]:80x', 'https://***@[::1]:80x/json'],
  ['user:pa/ss@example.com', 'https://***@example.com/json'],
  ['user:pa?ss@example.com', 'https://***@example.com/json'],
  ['exa mple.com/a@b', 'https://***@b/json']
])('a refused host %j is logged without its user information',
  async (host, logged) => {
    const { scripts, errors } = await renderScripts([host]);
    expect(requestUrls(scripts[0])).toStrictEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('"' + logged + '"');
    expect(errors[0]).not.toContain('secret');
    expect(errors[0]).not.toMatch(/\bpa\b/);
  });

// A host from the configuration is refused and logged the same way.
test('a configured host is logged without its user information',
  async () => {
    const configured = new core.PipelineBuilder({
      javascriptBuilderSettings: {
        host: 'user:secret@example.com',
        endPoint: '/json'
      }
    })
      .add(testEngine)
      .build();
    const errors = [];
    configured.on('error', message => errors.push(message));
    const configuredData = configured.createFlowData();
    await configuredData.process();
    expect(requestUrls(configuredData.javascriptbuilder.javascript))
      .toStrictEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('"https://***@example.com/json"');
    expect(errors[0]).not.toContain('secret');
  });

// A host made only of whitespace is not set, so the script has no callback
// and nothing is logged.
test('a blank host gives no callback and is not logged', async () => {
  const { scripts, errors } = await renderScripts(['  ']);
  expect(requestUrls(scripts[0])).toStrictEqual([]);
  expect(errors).toStrictEqual([]);
});

// A host from the request reaches the script as the check writes it, in
// lower case and with anything that could end the string the script holds
// it in percent-encoded.
test('a host from the request is written as checked', async () => {
  const { scripts } = await renderScripts(["EXAMPLE.com/');alert(1);//"]);
  const urls = requestUrls(scripts[0]);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).toBe('https://example.com/%27);alert(1);//json');
  }
  expect(scripts[0]).not.toContain("');alert(1)");
});

// A protocol given to the builder is used for every request, so one the
// script cannot send its request with is refused when the element is made.
test.each(['ftp', 'ws', 'javascript', 'https ', 'http\u017f'])(
  'a configured protocol %j is refused', protocol => {
    expect(() => new core.JavascriptBuilder({ protocol }))
      .toThrow('protocol is invalid');
  });

test.each(['http', 'https', 'HTTPS'])(
  'a configured protocol %j is accepted', protocol => {
    expect(() => new core.JavascriptBuilder({ protocol })).not.toThrow();
  });

// A protocol from the request that is neither http nor https gives a script
// with no callback, and is logged once like any other URL that is not valid.
test('a refused protocol from the request is left out and logged once',
  async () => {
    const renderPipeline = new core.PipelineBuilder({
      javascriptBuilderSettings: { endPoint: '/json' }
    })
      .add(testEngine)
      .build();
    const errors = [];
    renderPipeline.on('error', message => errors.push(message));
    const renderData = renderPipeline.createFlowData();
    renderData.evidence.add('header.host', 'example.com');
    renderData.evidence.add('header.protocol', 'ftp');
    await renderData.process();
    expect(requestUrls(renderData.javascriptbuilder.javascript))
      .toStrictEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('"ftp://example.com/json"');
  });
