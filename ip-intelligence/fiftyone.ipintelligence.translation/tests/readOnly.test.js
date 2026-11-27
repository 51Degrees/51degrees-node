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

// The Element Data of CountryCodeTranslationEngine and
// CountriesTranslationEngine is read only once they have finished.

const fs = require('fs');
const path = require('path');
const core = require('fiftyone.pipeline.core');
const CountryCodeTranslationEngineBuilder =
  require('../countryCodeTranslationEngineBuilder');
const CountriesTranslationEngineBuilder =
  require('../countriesTranslationEngineBuilder');

const translationsDir = path.join(__dirname, '..', '..', '..', 'cxx',
  'data', 'ip-intelligence', 'Translations');
const testWithTranslations = fs.existsSync(translationsDir) ? test : test.skip;

const ip = new core.FlowElement({
  dataKey: 'ip',
  evidenceKeyFilter: new core.BasicListEvidenceKeyFilter([]),
  processInternal: function (flowData) {
    const codes = [{ value: 'GB', weight: 1, rawWeight: 65535 }];
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents: {
        countrycodesgeographical: new core.AspectPropertyValue(null, codes),
        countrycodespopulation: new core.AspectPropertyValue(null, codes)
      }
    }));
  }
});

testWithTranslations('the translation engines Element Data is read only ' +
  'once processed', async () => {
  const codes = new CountryCodeTranslationEngineBuilder().build();
  const names = new CountriesTranslationEngineBuilder().build();
  const flowData = new core.PipelineBuilder({ addJavaScriptBuilder: false })
    .add(ip).add(codes).add(names).build().createFlowData();
  await flowData.process();
  for (const key of new Set([codes.dataKey, names.dataKey])) {
    expect(() => { flowData.get(key).probe = 1; })
      .toThrow('has finished processing');
  }
});
