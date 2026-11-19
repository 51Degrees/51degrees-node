![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **Node IP Intelligence Country Translation**

[Developer Documentation](https://51degrees.com/documentation/_ip_intelligence__quickstart.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.translation&utm_term=top "developer documentation")

## Introduction

This project contains 51Degrees IP Intelligence country translation engines that can be used with the [Pipeline API](https://github.com/51Degrees/51degrees-node/tree/main/pipeline).

## This package - fiftyone.ipintelligence.translation

The on-premise IP Intelligence engine returns country information as weighted lists of ISO country codes. This package adds the two translation engines that turn those codes into localized country names and produce complete, ordered lists of every country, so a demo can render a dropdown of countries with the most probable country at the top.

* `CountryCodeTranslationEngine` (element data key `countrynames`) translates the weighted `CountryCodesGeographical` / `CountryCodesPopulation` lists from the IP intelligence engine (element data key `ip`) into the English country names `CountryNamesGeographical` / `CountryNamesPopulation`, preserving the weights.
* `CountriesTranslationEngine` (element data key `countrynamestranslated`) translates the English names into the browser language and builds the ordered "All" lists. For each dimension it produces the weighted translated names (`CountryNames...Translated`), the complete ordered names (`CountryNames...AllTranslated`) and the index-aligned codes (`CountryCodes...All`). The weighted countries lead, ordered by descending weight, followed by every remaining country alphabetically by translated name.

The translation YAML files (`countrycodes.en_GB.yml` and `countries.<locale>.yml`) are read from the `cxx/data/ip-intelligence/Translations` folder of the data submodule that ships with [`fiftyone.ipintelligence.onpremise`](https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence/fiftyone.ipintelligence.onpremise). A different directory can be supplied to a builder via the `translationsPath` option.

This package builds on the generic [`fiftyone.pipeline.translation`](https://github.com/51Degrees/51degrees-node/tree/main/pipeline) base.

It can be used like this:

```js
const {
  CountryCodeTranslationEngineBuilder,
  CountriesTranslationEngineBuilder
} = require('fiftyone.ipintelligence.translation');

const pipeline = new IpIntelligenceOnPremisePipelineBuilder({ dataFile })
  .add(new CountryCodeTranslationEngineBuilder().build())
  .add(new CountriesTranslationEngineBuilder().build())
  .build();

const flowData = pipeline.createFlowData();
flowData.evidence.add('query.client-ip', '8.8.8.8');
flowData.evidence.add('header.accept-language', 'fr-FR');
await flowData.process();

const result = flowData.get('countrynamestranslated');
const codes = result.get('countrycodesgeographicalall').value;
const names = result.get('countrynamesgeographicalalltranslated').value;
```

## Installation

```
npm install fiftyone.ipintelligence.translation
```

## Tests

To run tests you will need to install the `jest` library.

```
npm install jest --global
```

Then, navigate to the module directory and execute:

```
npm test
```

## Find out more

- [IP Intelligence](https://51degrees.com/ip-intelligence?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.translation&utm_term=find-out-more-ip-intelligence)
- [IP Intelligence documentation](https://51degrees.com/documentation/_ip_intelligence__quickstart.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.translation&utm_term=find-out-more-documentation)
- [Getting started](https://51degrees.com/documentation/_ip_intelligence__quickstart.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.translation&utm_term=find-out-more-getting-started)
- [Pricing](https://51degrees.com/pricing?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.translation&utm_term=find-out-more-pricing)
- https://github.com/51Degrees/51degrees-node
