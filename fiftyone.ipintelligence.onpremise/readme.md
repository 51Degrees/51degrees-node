![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=repository&utm_content=readme_main&utm_campaign=node-open-source "Data rewards the curious") **Node IP Intelligence On-Premise**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=github&utm_medium=repository&utm_content=documentation&utm_campaign=node-open-source "developer documentation")

## Introduction
This project contains 51Degrees IP Intelligence engines that can be used with the [Pipeline API](https://github.com/51Degrees/pipeline-node).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.ipintelligence.onpremise

This package definitions for the on-premise IP intelligence engine. The on-premise engine requires a data file to be supplied. A free 'Lite' data file can be obtained from the [ip-intelligence-data](https://github.com/51Degrees/ip-intelligence-data) repository.

The on-premise engine performs processing using a native library which is built from the C/C++ code in the [ip-intelligence-cxx](https://github.com/51Degrees/ip-intelligence-cxx) repository. Binaries are included with the published NPM package for a set of supported platforms and Node versions. If your platform or Node version is not supported then you can build the native module yourself, see 'Building the native module' below.

It can be used like this:

```js
const IpIntelligenceOnPremisePipelineBuilder =
  require('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
  performanceProfile: 'MaxPerformance',
  dataFile: '51Degrees-LiteV41.ipi',
  autoUpdate: false
}).build();

const flowData = pipeline.createFlowData();
flowData.evidence.add('query.client-ip', '8.8.8.8');
flowData.process().then(function () {
  console.log(flowData.ip.registeredname.value);
});
```

### Installation

To install, use NPM call:

```
npm install fiftyone.ipintelligence.onpremise
```

### Building the native module

The native module is built from the [ip-intelligence-cxx](https://github.com/51Degrees/ip-intelligence-cxx) code which is included in this repository as a git submodule. To build it locally you need:

- Node.js and npm
- node-gyp (`npm install -g node-gyp`)
- A C/C++ tool chain. For example, MSVC build tools on Windows or g++ and make on Linux.

When working inside this repository, run `node ensure-native-module.js` from the repository
root to perform all of the following steps automatically. The script works on Windows, Linux
(including WSL) and MacOS. The manual steps from this directory are:

1. Ensure the `ip-intelligence-cxx` submodule is checked out, including its own submodules.
2. Copy `binding.51d` to `binding.gyp`.
3. Run `node-gyp configure` and `node-gyp build`.
4. Copy the resulting `build/Release/FiftyOneIpIntelligenceIpiV41.node` to `build/FiftyOneIpIntelligenceIpiV41-[platform]-[arch]-[node major version].node`. For example, `build/FiftyOneIpIntelligenceIpiV41-linux-x64-20.node`.

Process for rebuilding SWIG interfaces following an update to the IP intelligence cxx code (This is only intended to be run by 51Degrees developers internally):

1. Ensure Swig 4.3.1 or above is installed.
2. Run the following command in this directory:

```
swig -c++ -javascript -node ipi_node.i
```
