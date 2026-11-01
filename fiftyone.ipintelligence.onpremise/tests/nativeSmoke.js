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

// Quick manual smoke test for the native module. Not a jest test.
// Run with: node tests/nativeSmoke.js
const os = require('os');
const path = require('path');

const nodeVersion = Number(process.version.match(/^v(\d+\.)/)[1]);
const moduleName = path.join(__dirname, '..', 'build',
  `FiftyOneIpIntelligenceIpiV41-${os.platform()}-${process.arch}-${nodeVersion}.node`);
const swig = require(moduleName);

const dataFile = path.join(__dirname, '..', 'ip-intelligence-cxx',
  'ip-intelligence-data', '51Degrees-LiteV41.ipi');

const propertiesList = new swig.VectorStringSwig();
const requiredProperties = new swig.RequiredPropertiesConfigSwig(propertiesList);
const config = new swig.ConfigIpiSwig();
config.setBalanced();
config.setUseUpperPrefixHeaders(false);

console.log('Creating engine...');
const engine = new swig.EngineIpiSwig(dataFile, config, requiredProperties);
console.log('Engine created.');
console.log('Product:', engine.getProduct());
console.log('Type:', engine.getType());
console.log('Published:', engine.getPublishedTime().getYear());

const keys = engine.getKeys();
const keyArr = [];
for (let i = 0; i < keys.size(); i++) keyArr.push(keys.get(i));
console.log('Evidence keys:', keyArr.join(', '));

const metadata = engine.getMetaData();
const props = metadata.getProperties();
console.log('Property count:', props.getSize());
const types = {};
for (let i = 0; i < props.getSize(); i++) {
  const p = props.getByIndex(i);
  types[p.getName()] = p.getType() + (p.getAvailable() ? '' : ' (unavailable)');
}
console.log(JSON.stringify(types, null, 2));

const components = metadata.getComponents();
console.log('Component count:', components.getSize());
for (let i = 0; i < components.getSize(); i++) {
  console.log('Component:', components.getByIndex(i).getName());
}

const evidence = new swig.EvidenceIpiSwig();
evidence.set('query.client-ip', '8.8.8.8');
const results = engine.process(evidence);
console.log('Available properties in results:', results.getAvailableProperties());
const resultProps = results.getProperties();
for (let i = 0; i < resultProps.size(); i++) {
  const name = resultProps.get(i);
  const type = types[name] || 'unknown';
  let display;
  try {
    if (type.startsWith('weighted') || name.toUpperCase() === 'MCC') {
      let value;
      if (type === 'weightedint') {
        value = results.getValuesAsWeightedIntegerList(name);
      } else if (type === 'weightedbool') {
        value = results.getValuesAsWeightedBoolList(name);
      } else if (type === 'weighteddouble' || type === 'weightedsingle') {
        value = results.getValuesAsWeightedDoubleList(name);
      } else {
        value = results.getValuesAsWeightedStringList(name);
      }
      if (value.hasValue()) {
        const list = value.getValue();
        const arr = [];
        for (let j = 0; j < list.size(); j++) {
          const item = list.get(j);
          arr.push(`${item.getValue()} @${item.getWeight().toFixed(4)}`);
        }
        display = arr.join(', ');
      } else {
        display = `NO VALUE (${value.getNoValueMessage()})`;
      }
    } else {
      const value = results.getValueAsString(name);
      display = value.hasValue() ? value.getValue() : `NO VALUE (${value.getNoValueMessage()})`;
    }
  } catch (e) {
    display = `ERROR: ${e}`;
  }
  console.log(`  ${name} [${type}]: ${display}`);
}
console.log('Smoke test complete.');
