![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **51Degrees Pipeline Core**

[Developer Documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=top "developer documentation")

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

## Flow Data and threads

A Flow Data holds the Evidence and the results of one request. It must not be used by two threads at once, so create one for each request, process it once, and do not keep it after the request ends or share it with another request. Node.js runs JavaScript on one thread, but the asynchronous work of many requests takes turns on that thread, and worker threads run beside it. A caller that shares a Flow Data between such tasks or threads is responsible for any locking. So read the values you need from a Flow Data into your own variables before you hand them to a worker thread, a timer or any other work that can outlive the request, and pass those values rather than the Flow Data or its Element Data.

```js
const server = http.createServer(async (req, res) => {
  // A Flow Data must not be used by two threads at once, so each request
  // creates its own.
  const flowData = pipeline.createFlowData();
  await flowData.evidence.addFromRequestAsync(req);
  await flowData.process();

  // A value handed to other work is read from the Flow Data first.
  const hardwareVendor = flowData.device.hardwarevendor;
  const vendor = hardwareVendor.hasValue ? hardwareVendor.value : 'Unknown';
  setImmediate(() => recordVisit(vendor));

  res.end(vendor);
});
```

The parallel groups a Pipeline runs are the one case where several tasks use a Flow Data at once. Each member of a group writes only its own Element Data, and the Pipeline adds the errors a member throws once every member has finished. Every web example creates its Flow Data for each request, as the comment above `pipeline.createFlowData()` in each one says.

## Reusing Element Data

Each Flow Element can reuse its Element Data through a bounded pool rather than make new Element Data for every request. Call `flowData.dispose()` once you have finished with a Flow Data, such as when the response to its request has been sent, and its Element Data goes back to the pools it came from. Each web example does this with `res.on('finish', () => flowData.dispose())` straight after it creates the Flow Data for a request. The finish event comes once the whole response has been sent, after every value has been read. Dispose on the close event instead and a client that goes away while its Flow Data is still processing gets its Element Data given back as processing finishes, before your code reads it. Element Data a cache holds stays with the cache, because the cache shares it with other requests. A Flow Data disposed while it is still processing gives its Element Data back once processing has finished. A Flow Data that is never disposed is collected as garbage in the usual way, and its Element Data goes back to no pool.

Keeping a reference to a Flow Data, or to any Element Data it holds, after the Flow Data is disposed is not supported, because a pool may give the instance to another request. Nothing checks for this when the Element Data is read, so read the values you need before you dispose of the Flow Data.

A Flow Element of your own takes its Element Data from its pool with `pooledElementData`, giving a function that makes a new instance when the pool has none. An instance taken from the pool has no values and is open for writing.

```js
processInternal (flowData) {
  const data = this.pooledElementData(() => new ElementDataDictionary({
    flowElement: this,
    contents: {}
  }));
  data.contents = { starSign: 'Aries' };
  flowData.setElementData(data);
}
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

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core&utm_term=find-out-more-examples)
- https://github.com/51Degrees/51degrees-node
