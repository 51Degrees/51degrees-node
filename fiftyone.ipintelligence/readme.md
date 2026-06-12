![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence-readme.md&utm_term=top "Data rewards the curious") **Node IP Intelligence**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence-readme.md&utm_term=top "developer documentation")

## Introduction
This project contains 51Degrees IP Intelligence engines that can be used with the [Pipeline API](https://github.com/51Degrees/pipeline-node).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.ipintelligence

This package includes a pipeline builder that can toggle between the cloud and on-premise IP intelligence engines with simple parameter changes.

- If a `resourceKey` is supplied then a cloud pipeline is created. A resource key can be obtained from the [51Degrees configurator](https://configure.51degrees.com/1QWJwHxl?utm_source=github&utm_medium=readme&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence-readme.md&utm_term=this-package-fiftyone-ipintelligence).
- If a `dataFile` is supplied then an on-premise pipeline is created. A free 'Lite' data file can be obtained from the [ip-intelligence-data](https://github.com/51Degrees/ip-intelligence-data) repository.

It can be used like this:

```js
const IpIntelligencePipelineBuilder =
  require('fiftyone.ipintelligence').IpIntelligencePipelineBuilder;

const pipeline = new IpIntelligencePipelineBuilder({
  resourceKey: 'your-resource-key'
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
npm install fiftyone.ipintelligence
```
