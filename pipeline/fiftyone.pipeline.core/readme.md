![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **51Degrees Pipeline Core**

[Developer Documentation](https://51degrees.com/documentation/_pipeline_api__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=top "developer documentation")

## Introduction
The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines) 

## This package - fiftyone.pipeline.core

This package definds the essential components of the Pipeline API such as `flow elements`, `flow data` and `evidence`. It also packages together JavaScript served by a pipeline and allows for client side requests for additional data populated by evidence from the client side.

It can be used on its own or with the following additional packages.

- [**fiftyone.pipeline.engines**](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.engines) - Adds a specialized type of flow element called an engine which allows for additional features including an auto-updating data file for properties, a service called when a requested property is missing and a caching system.

Engines created by 51Degrees including:

- [**fiftyone.devicedetection**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection#readme) - A device detection engine
- [**fiftyone.geolocation**](https://github.com/51Degrees/51degrees-node/tree/main/location#readme) - A geolocation lookup engine

Make use of the above along with the following additional packages:

- [**fiftyone.pipeline.engines.fiftyone**](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.engines.fiftyone) - Functionality specific to 51Degrees engines.
- [**fiftyone.pipeline.cloudrequestengine**](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.cloudrequestengine) - An engine used to make requests to the 51Degrees cloud service.

## Installation

```
npm install fiftyone.pipeline.core
```

## Examples

Examples can be found in the `examples/` folder. See below for a list of examples.

| Example                                | Description |
|----------------------------------------|-------------|
| [simpleEvidenceFlowElement.js](https://github.com/51Degrees/51degrees-node/blob/main/pipeline/fiftyone.pipeline.core/examples/customFlowElements/simpleEvidenceFlowElement.js)                   |  Demonstrates how to create a custom flow element that takes some evidence (birthdate) and returns something related to that evidence (star sign). |
| [clientSideEvidenceFlowElement.js](https://github.com/51Degrees/51degrees-node/blob/main/pipeline/fiftyone.pipeline.core/examples/customFlowElements/clientSideEvidenceFlowElement.js)                 | Demonstrates how to modify the flow element from the 'simple evidence' example to gather evidence from code running on the client device (i.e. JavaScript). |

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

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-examples)
- https://github.com/51Degrees/51degrees-node
