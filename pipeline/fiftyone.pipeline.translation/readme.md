![51Degrees](https://51degrees.com/img/logo.png?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.translation&utm_term=top "Data rewards the curious") **51Degrees Pipeline Translation**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.translation&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.pipeline.translation

This package provides a generic translation `flow element`. A translation engine reads string based properties from an upstream element and writes translated values under its own element data key. The supported value shapes are a string, a list of strings and a weighted list of strings (the `{ value, weight, rawWeight }` shape surfaced by 51Degrees engines), as well as an `AspectPropertyValue` wrapping any of those. The shape of an output property matches its input, and the weights of a weighted list are preserved.

Translations are supplied as YAML files, where the file name defines the locale contained in the file (for example `countries.fr_FR.yml`). The language to translate to can be fixed, or resolved from the evidence using the `query.translation`, `query.accept-language` and `header.accept-language` keys (in that precedence order). English is treated as the base language: when it is the highest priority language no translation is performed and the source values are returned unchanged.

This package is used by [`fiftyone.ipintelligence.translation`](https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence) to turn weighted country code lists into localized country names.

## Options

The options use the names the [Translation Engine specification](https://github.com/51Degrees/specifications/blob/main/pipeline-specification/pipeline-elements/translation-engine.md) gives them.

```js
const { TranslationEngine, MissingTranslationBehavior } =
  require('fiftyone.pipeline.translation');

const engine = new TranslationEngine({
  sourceElementDataKey: 'ip',
  translations: [{ source: 'country', destination: 'countrytranslated' }],
  sources: { 'countries.fr_FR.yml': 'Germany: Allemagne\n' },
  fixedLanguage: 'fr_FR',
  missingTranslationBehavior: MissingTranslationBehavior.Original
});
```

`missingTranslationBehavior` takes the `MissingTranslationBehavior` enum or text naming one of its values in any case, being `Original` (the default), `EmptyString` or `FlowError`, so a configuration file can give it as text. Any other value is refused when the engine is built. The older names `sourceDataKey` and `behavior` still work but are deprecated, and where both names are given the specification's name wins.

## Installation

```
npm install fiftyone.pipeline.translation
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

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.translation&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.translation&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.translation&utm_term=find-out-more-examples)
- https://github.com/51Degrees/51degrees-node
