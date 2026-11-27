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

// Every detection runs process() and reads values from Element Data, so a
// cost added there is paid on every request. These tests count what that
// path makes, which is the same on every machine, rather than timing it,
// and fail if a change makes more: a Proxy for each read or each set of
// values, or more promises for each process().

const asyncHooks = require('async_hooks');
const core = require('..');

// Three Flow Elements that write dictionaries, the last reading the first,
// as the engines of a detection do.
const writer = (dataKey, count) => new core.FlowElement({
  dataKey,
  processInternal: function (flowData) {
    const contents = {};
    for (let i = 0; i < count; i++) {
      contents['p' + i] = i;
    }
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this, contents
    }));
  }
});
const reader = new core.FlowElement({
  dataKey: 'reader',
  processInternal: function (flowData) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += flowData.get('first').get('p' + i);
    }
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this, contents: { sum }
    }));
  }
});
const build = () => new core.PipelineBuilder()
  .add(writer('first', 30))
  .add(writer('second', 10))
  .add(reader)
  .build();

// The promises process() makes for this Pipeline, with no lazy property,
// as measured on Node.js 20, 22 and 24 when this test was written: 39, of
// which this test's own wait makes one. Before the dictionaries stopped
// wrapping their values and process() stopped waiting when nothing was
// lazy, it was 79. A change that adds a step to every process() makes more.
const PromisesPerProcess = 39;

/**
 * Counts the Proxies made while work runs.
 *
 * @param {Function} work what to run
 * @returns {Promise<number>} how many Proxies were made
 */
async function countProxies (work) {
  const RealProxy = global.Proxy;
  let made = 0;
  global.Proxy = new RealProxy(RealProxy, {
    construct: (target, args) => {
      made += 1;
      return Reflect.construct(target, args);
    }
  });
  try {
    await work();
  } finally {
    global.Proxy = RealProxy;
  }
  return made;
}

/**
 * Counts the promises made while work runs.
 *
 * @param {Function} work what to run
 * @returns {Promise<number>} how many promises were made
 */
async function countPromises (work) {
  let made = 0;
  const hook = asyncHooks.createHook({
    init: (id, type) => {
      if (type === 'PROMISE') {
        made += 1;
      }
    }
  });
  hook.enable();
  try {
    await work();
  } finally {
    hook.disable();
  }
  return made;
}

test('process makes one Proxy for each Element Data and none for values',
  async () => {
    const pipeline = build();
    await pipeline.createFlowData().process();
    const flowData = pipeline.createFlowData();
    const made = await countProxies(() => flowData.process());
    // The Pipeline Builder adds its web integration elements, so there are
    // more Element Data than the three Flow Elements here.
    expect(made).toBe(flowData.listElementData().length);
  });

test('reading values once processing has finished makes no Proxy',
  async () => {
    const flowData = build().createFlowData();
    await flowData.process();
    const made = await countProxies(() => {
      for (let round = 0; round < 100; round++) {
        for (let i = 0; i < 30; i++) {
          expect(flowData.first.get('p' + i)).toBe(i);
        }
        expect(flowData.reader.sum).toBe(45);
      }
    });
    expect(made).toBe(0);
  });

test('process makes no more promises than it needs', async () => {
  const pipeline = build();
  await pipeline.createFlowData().process();
  const counts = [];
  for (let i = 0; i < 5; i++) {
    const flowData = pipeline.createFlowData();
    counts.push(await countPromises(() => flowData.process()));
  }
  // The same every time, so any change in the count is the code's.
  expect(new Set(counts).size).toBe(1);
  expect(counts[0]).toBeLessThanOrEqual(PromisesPerProcess);
});
