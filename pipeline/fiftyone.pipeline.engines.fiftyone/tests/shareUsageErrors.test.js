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

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// usage-sharing-element.md line 321: "If errors occur then they MUST be
// handled and logged without disrupting anything else the Pipeline is
// doing."

// Nothing is sent in these tests, as no package is ever full.
const NEVER_FULL = 1000000;

let usageEngine = null;

afterEach(() => {
  if (usageEngine) {
    usageEngine.shareData.length = 0;
    clearTimeout(usageEngine.resumeTimer);
    usageEngine = null;
  }
});

const createPipeline = (settings = {}) => {
  usageEngine = new ShareUsage({
    requestedPackageSize: NEVER_FULL,
    endpoint: 'http://127.0.0.1:9/',
    ...settings
  });
  return new PipelineBuilder().add(usageEngine).build();
};

const recordLog = () => {
  const logged = [];
  usageEngine._log = (level, message) => logged.push({ level, message });
  return logged;
};

const processOnce = async (pipeline, ip) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('server.client-ip', ip);
  await flowData.process();
  return flowData;
};

test('repeats shared after the interval never stop processing', async () => {
  // With no interval every repeat is shared, so the tracker's cache, which
  // holds 1000 entries, fills with one request before another arrives.
  const pipeline = createPipeline({ interval: 0 });
  for (let i = 0; i < 620; i++) {
    const ip = i < 600 ? '10.0.0.1' : '10.0.0.3';
    const flowData = await processOnce(pipeline, ip);
    expect(flowData.errors).toEqual({});
  }
});

test('an error in usage sharing is logged and processing goes on',
  async () => {
    const pipeline = createPipeline();
    const logged = recordLog();
    usageEngine.tracker.track = () => {
      throw new Error('the tracker failed');
    };
    const flowData = await processOnce(pipeline, '10.0.0.2');
    expect(flowData.errors).toEqual({});
    expect(logged.filter(entry => entry.level === 'error' &&
      String(entry.message).includes('the tracker failed'))).toHaveLength(1);
  });
