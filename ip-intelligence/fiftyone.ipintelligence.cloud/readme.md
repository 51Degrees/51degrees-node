![51Degrees](https://51degrees.com/img/logo.png?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=top "Data rewards the curious") **Node IP Intelligence Cloud**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=top "developer documentation")

## Introduction
This project contains 51Degrees IP Intelligence engines that can be used with the [Pipeline API](https://github.com/51Degrees/51degrees-node/tree/main/pipeline).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.ipintelligence.cloud

This package uses the 51Degrees cloud service to determine properties of the network, and location associated with an IP address.

A resource key is needed to use the cloud service. You can obtain one covering everything the examples display from the [51Degrees configurator](https://configure.51degrees.com/hYzn3TV3?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=this-package-fiftyone-ipintelligence-cloud) with a paid subscription. A free key from [this configurator link](https://configure.51degrees.com/Wkqxf3Bs?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=this-package-fiftyone-ipintelligence-cloud) populates only the Country, LocationConfidence, Ip and IpV6 properties.

It can be used like this:

```js
const IpIntelligenceCloudPipelineBuilder =
  require('fiftyone.ipintelligence.cloud').IpIntelligenceCloudPipelineBuilder;

const pipeline = new IpIntelligenceCloudPipelineBuilder({
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
npm install fiftyone.ipintelligence.cloud
```

## Find out more

- [IP Intelligence](https://51degrees.com/ip-intelligence?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=find-out-more-ip-intelligence)
- [IP Intelligence documentation](https://51degrees.com/documentation/_ip_intelligence__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=find-out-more-documentation)
- [Getting started](https://51degrees.com/documentation/_ip_intelligence__quickstart.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=find-out-more-getting-started)
- [Pricing](https://51degrees.com/pricing?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud&utm_term=find-out-more-pricing)
- https://github.com/51Degrees/51degrees-node
