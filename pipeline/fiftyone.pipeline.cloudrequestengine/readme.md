![51Degrees](https://51degrees.com/img/logo.png?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=top "Data rewards the curious") **51Degrees Pipeline Cloud Request Engine**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines).

## This package - fiftyone.pipeline.cloudrequestengine

This package uses the `engines` class created by the [`fiftyone.pipeline.engines`](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.engines). It makes available:

* A `Cloud Request Engine` which calls the 51Degrees cloud service to fetch properties and metadata about them based on a provided resource key. A resource key with the free properties used by the tests can be created [here](https://configure.51degrees.com/Wkqxf3Bs?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=this-package-fiftyone-pipeline-cloudrequestengine).
* A `Cloud Engine` template which reads data from the Cloud Request Engine.

It is used by the cloud versions of the following 51Degrees engines:

- [**fiftyone.devicedetection**](https://github.com/51Degrees/51degrees-node/tree/main/device-detection#readme) - A device detection engine
- [**fiftyone.geolocation**](https://github.com/51Degrees/51degrees-node/tree/main/location#readme) - A geolocation lookup engine

## Credentials

The `Cloud Request Engine` takes a `resourceKey`, a `licenseKey`, or both.

- A `resourceKey` on its own gives the properties the key carries.
- A `licenseKey` may be given beside a `resourceKey`, or on its own.
- `requestedProperties` names the properties wanted, as fully qualified
  names such as `device.ismobile`, in a list or one comma separated string.
  It is required with a `licenseKey` on its own. Beside a `resourceKey` the
  cloud service adds them to the properties the resource key carries.

The engine refuses to build with no key at all, or with a `licenseKey` and
no `resourceKey` or `requestedProperties`, because the cloud service refuses
every request made that way. A license key is sent in the body of each
request and never in a URL.

## Installation

```
npm install fiftyone.pipeline.cloudrequestengine
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

The integration tests read the resource key from the aligned
`_51DEGREES_RESOURCE_KEY` environment variable first, then the legacy
`RESOURCE_KEY` variable.

## Pointing the engine at another host

The engine calls `https://cloud.51degrees.com/api/v4/` unless the `baseURL`
option is given or the `FOD_CLOUD_API_URL` environment variable is set, in
which case that value is the API base including the `/api/v4/` segment (a
missing trailing slash is added). Every engine and example built on this
package, in this repository and in the device detection and geolocation
packages, inherits that choice, so setting the variable once points all of
them at the same place.

A host other than `cloud.51degrees.com` would be used to (a) use an on
premise web server, or (b) use a privately hosted version of the 51Degrees
cloud for performance reasons. This is the private hosting option of the
51Degrees cloud service. Both run the same service, so an example works
unchanged.

```bash
FOD_CLOUD_API_URL=https://cloud.example.com/api/v4/ _51DEGREES_RESOURCE_KEY=<resource key> node yourExample.js
```

## Find out more

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-examples)
- [Cloud service documentation](https://51degrees.com/documentation/_services__cloud__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-cloud-service)
- https://github.com/51Degrees/51degrees-node
