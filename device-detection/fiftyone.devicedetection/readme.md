![51Degrees](https://51degrees.com/img/logo.png?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=top "Data rewards the curious") **Node Device Detection**

[Developer Documentation](https://51degrees.com/device-detection-node/index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=top "developer documentation")

## Introduction
This project contains 51Degrees Device Detection engines that can be used with the [Pipeline API](https://github.com/51Degrees/51degrees-node/tree/main/pipeline).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.devicedetection

This package provides a generic `DeviceDetectionPipelineBuilder` which check the input arguments to determine the type of Device Detection engine to be used in the resulting pipeline. The engine can be either Cloud or On-Premise.

This package requires the following additional packages:

- [**fiftyone.devicedetection.cloud**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection/fiftyone.devicedetection.cloud) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees cloud service. A cloud builder is also included to build a pipeline for device detection cloud engine.
- [**fiftyone.devicedetection.onpremise**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection/fiftyone.devicedetection.onpremise) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees data file. A on-premise builder is also included to build a pipeline for device detection on-premise engine.
- [**fiftyone.devicedetection.shared**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection/fiftyone.devicedetection.shared) - A Node.js module which contains shared functionality to build cloud and on-premise engines.

### Installation

Using NPM call:

```
npm install fiftyone.devicedetection
```

### Examples

For details of how to run the examples, please refer to [run examples](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/run_examples.md).
The tables below describe the examples that are available.

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingStarted.js](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/fiftyone.devicedetection/examples/gettingStarted.js)                   |  Getting started example of using the 51Degrees device detection 'Hash' algorithm to determine whether a given User-Agent corresponds to a mobile device or not.|

## Tests

In this repository, there are tests for the examples.
You will need to install jest to run them:

```
npm install jest --global
```

You will also need to install any required packages for the examples in the **Examples** section.

You need to obtain a 51Degrees cloud resource key from the [51Degrees Cloud Configurator](https://configure.51degrees.com/?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=tests) and assign it to the environment variable `_51DEGREES_RESOURCE_KEY` in your test environment.

To run the tests, navigate to the module directory and execute:

```
npm test
```

## Find out more

- [Device Detection](https://51degrees.com/device-detection?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=find-out-more-device-detection)
- [Device Detection documentation](https://51degrees.com/documentation/_device_detection__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=find-out-more-documentation)
- [Getting started](https://51degrees.com/documentation/_device_detection__quickstart.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=find-out-more-getting-started)
- [Pricing](https://51degrees.com/pricing?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection&utm_term=find-out-more-pricing)
- https://github.com/51Degrees/51degrees-node
