![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **51Degrees Pipeline Engines**

[Developer Documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines) 

## This package - fiftyone.pipeline.engines

This package extends the `flow element` class created by the [`fiftyone.pipeline.core`](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.core) pacakge into a specialized type of flow element called an engine. This allows for additional features including:

* An auto-updating data file for properties
* A service called when a requested property
* A caching system and implementation of an LRU (least recently used) cache

Engines created by 51Degrees:

- [**fiftyone.devicedetection**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection#readme) - A device detection engine
- [**fiftyone.geolocation**](https://github.com/51Degrees/51degrees-node/tree/main/location#readme) - A geolocation lookup engine

Make use of this package along with the following additional packages:

- [**fiftyone.pipeline.engines.fiftyone**](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.engines.fiftyone) - Functionality specific to 51Degrees engines.
- [**fiftyone.pipeline.cloudrequestengine**](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.cloudrequestengine) - An engine used to make requests to the 51Degrees cloud service.

## Installation

```
npm install fiftyone.pipeline.engines
```

## Examples

Examples can be found in the `examples/` folder. See below for a list of examples.

| Example                                | Description |
|----------------------------------------|-------------|
| [onPremiseFlowElement.js](https://github.com/51Degrees/51degrees-node/blob/main/pipeline/fiftyone.pipeline.engines/examples/onPremiseFlowElement.js)                  |  Demonstrates the creation of an engine that uses an auto-updating datafile to populate properties. |
| [caching.js](https://github.com/51Degrees/51degrees-node/blob/main/pipeline/fiftyone.pipeline.engines/examples/caching.js)                 | Demonstrates a custom cache that makes use of the result caching feature that engines provide. |

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

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines&utm_term=find-out-more-examples)
- https://github.com/51Degrees/51degrees-node
