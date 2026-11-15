![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **51Degrees Pipeline Derived Properties**

[Developer Documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.derivedproperty&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.pipeline.derivedproperty

This package provides the derived property `flow element`. It computes new properties from properties other elements have already put into the flow data, such as HumanConfidence from Device Detection and IP Intelligence properties, and IsGdpr from the country of an IP address. It holds no data file, sends no request and reads no evidence.

Each property is defined by a script in the format the [derived-properties](https://github.com/51Degrees/derived-properties) repository describes, written in YAML or JSON. The scripts that repository holds are built into this package, and the same scripts give the same answers in every 51Degrees language, which the case files in that repository prove. Every script writes one property under the element data key `derived`.

Where a property a script reads is not available, the derived property has no value, and reading it raises a message naming every property that was missing and why.

## Scripts

A script built into the package is named by its name. A script of your own is given as a file, where the file name may hold a wildcard, or as text held by your code. The script's `Name` must equal its file name without the extension, or the name given with the text.

```js
const core = require('fiftyone.pipeline.core');
const { DerivedPropertyElementBuilder, builtInScriptNames } =
  require('fiftyone.pipeline.derivedproperty');

console.log(builtInScriptNames()); // [ 'HumanConfidence', 'IsGdpr' ]

const derived = new DerivedPropertyElementBuilder()
  // A script built into this package.
  .addBuiltInScript('IsGdpr')
  // A file, or several files, from your own environment.
  .addScriptFile('derived/*.yaml')
  // The text of a script held by your own code, YAML or JSON.
  .addScript('MyProperty', scriptText)
  .build();

// Add the element after the elements that supply what its scripts read.
const pipeline = new core.PipelineBuilder()
  .add(ipIntelligenceEngine)
  .add(derived)
  .build();

const flowData = pipeline.createFlowData();
flowData.evidence.addFromRequest(request);
await flowData.process();
const isGdpr = flowData.derived.IsGdpr;
if (isGdpr.hasValue) {
  console.log(isGdpr.value);
} else {
  console.log(isGdpr.noValueMessage);
}
```

Every fault in every script is reported together when the element is built, in a `ScriptValidationError` whose `faults` list each one.

## Configuration

A pipeline configuration file names the element as `fiftyone.pipeline.derivedproperty/derivedPropertyElement`. Its settings are `scripts`, naming scripts built into the package, and `scriptFiles`, giving paths to script files. Each is a list of strings, or one string with commas between the entries, where an entry holding a comma is wrapped in double quotes. The setting names are matched without regard to case, so `Scripts` and `ScriptFiles` as the other languages write them work too, and any other setting is refused.

```json
{
  "PipelineOptions": {
    "Elements": [
      {
        "elementName": "fiftyone.ipintelligence.onpremise/ipIntelligenceOnPremise",
        "elementParameters": { "dataFilePath": "<an IP Intelligence data file with CountryCode>" }
      },
      {
        "elementName": "fiftyone.pipeline.derivedproperty/derivedPropertyElement",
        "elementParameters": { "scripts": "IsGdpr", "scriptFiles": "derived/*.yaml" }
      }
    ]
  }
}
```

IsGdpr reads `ip.CountryCode`, which the free Lite IP Intelligence data file does not have, so the element refuses a pipeline built on that file, as the next section describes. The cloud service and the paid data files have it.

## When the pipeline is built

The element refuses, with a `PipelineConfigurationError`, a pipeline in which no element supplies a property a script reads, or in which another element already writes a property a script writes. Where an element sits in the pipeline is not judged, so an element supplying a property that runs after this one builds, and on each request the derived property then has no value. That is logged once, at error level.

Once the pipeline is built, the element logs one line for each script at information level, naming the script, its version, its format, where it came from and the property it writes, a warning for a script marked deprecated, and the compiled script as JSON at debug level. Add listeners to the pipeline straight after building it to receive them.

## Installation

The package is not yet published to npm. To use it from this repository, clone the repository with its submodules, because the built in scripts are the `scripts` folder of the `derived-properties` submodule.

```
git clone --recurse-submodules https://github.com/51Degrees/51degrees-node.git
```

## Tests

The tests run every case file in the `tests` folder of the `derived-properties` submodule, including the scripts under `tests/invalid` that every language must refuse, with `npm run unit-test` from the repository root.

## Find out more

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.derivedproperty&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.derivedproperty&utm_term=find-out-more-documentation)
- https://github.com/51Degrees/derived-properties
- https://github.com/51Degrees/51degrees-node
