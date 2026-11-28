![51Degrees](https://raw.githubusercontent.com/51Degrees/51degrees-node/main/.github/images/logo-160.png "Data rewards the curious") **51Degrees Pipeline Cloud Request Engine**

[Developer Documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines).

## This package - fiftyone.pipeline.cloudrequestengine

This package uses the `engines` class created by the [`fiftyone.pipeline.engines`](https://github.com/51Degrees/51degrees-node/tree/main/pipeline/fiftyone.pipeline.engines). It makes available:

* A `Cloud Request Engine` which calls the 51Degrees cloud service to fetch properties and metadata about them based on a provided resource key. A resource key with the free properties used by the tests can be created [here](https://51degrees.com/configure/Wkqxf3Bs?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=this-package-fiftyone-pipeline-cloudrequestengine).
* A `Cloud Engine` template which reads data from the Cloud Request Engine.
* A `Derived Cloud Engine` which reads the `derived` product, including
  Human Confidence.

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

## Discovery

When it is built, the engine asks the cloud service which Evidence keys it
accepts and which properties the keys in use give, and it is ready to
process once both have answered. If the cloud service cannot be reached
then, the engine logs a warning and asks again when it first processes.
Until discovery has answered, the engine accepts no Evidence and keeps what
is added, so nothing is lost.

A host that starts often, or has to start with no network, can save what
discovery fetched and give it to the next engine, which then makes no
discovery request.

```js
const { CloudRequestEngine } = require('fiftyone.pipeline.cloudrequestengine');

const engine = new CloudRequestEngine({ resourceKey });
await engine.ready();
const saved = engine.getDiscoveryState().toJson();

// Later, with the same keys.
const next = new CloudRequestEngine({ resourceKey, discoveryState: saved });
```

The copy holds the accepted Evidence keys and the accessible properties
answer, which depend only on the keys, so keep one copy for each set of
keys. A configuration file can give it as the `discoveryState` parameter of
the engine, as that JSON. A blank value there is the option unset.

## Human Confidence

Human Confidence says how confident the cloud service is that a person is
using the browser. Add a `DerivedCloudEngine` after the
`CloudRequestEngine`, and read two Properties from the `derived` Element
Data.

| Property | Values |
|----------|--------|
| `humanconfidence` | `High`, `Medium` or `Low` |
| `humanconfidencesource` | `Active` or `Passive` |

Where the keys in use do not carry a Property, it has no value, and its
`noValueMessage` says why.

When the page runs the 51Degrees browser tests, the source is `Active`, and
the cloud service gives the page a sealed result that the page cannot read.
The engine redeems it in its normal call to the cloud service. Your code
never redeems it and only reads the two Properties.

1. For each page you serve, call `newHumanConfidencePage()` on the
   `CloudRequestEngine`. It gives a `page` id and a `script` address. The
   engine makes a new transaction for the page and keeps it on the server.
   The script address carries the transaction to the cloud service, which
   binds the page's sealed result to it.
2. Load the 51Degrees client script in the page from `script`, and put the
   `page` id in the page.
3. When the script completes with `humanconfidencesource` set to `Active`,
   the page sends `humanconfidence` to your server as the
   `humanconfidence` parameter, and the page id as the
   `humanconfidencepage` parameter. Add them to the Flow Data as the
   Evidence `query.humanconfidence` and `query.humanconfidencepage`.
4. Process the Flow Data and read the two Properties.

The engine needs a `licenseKey` to redeem, and a `resourceKey` for the
page. The License Key comes from the engine's settings only, never from
Evidence, and the page never sees it. A sealed result redeems once, within
10 seconds, with the transaction kept for its page. The call that redeems
uses the transaction up, so it is never used twice. The engine keeps
transactions in memory, so a server with several instances sends a page's
requests to the instance that started it.

Where a sealed result is not redeemed, `humanconfidence` is `Medium` and
`humanconfidencesource` is `Active`. That happens when the engine has no
License Key, when the request names no page the engine started, when the
page's transaction was used before or has expired, when the call fails,
and when the response gives no `High`, `Medium` or `Low`. In the first
three cases the engine does not send the sealed result. The engine sends
the sealed result only from `query.humanconfidence`, never from a header,
a cookie or any other Evidence. A failed call is recorded once
as the `CloudRequestEngine`'s error, and reading either Property never
throws for it.

A request that carries a sealed result is never served from or stored in
the engine's cache. No log entry or error message holds the sealed result,
the transaction or any part of the License Key. The JavaScript Builder
leaves `query.humanconfidence` and `query.humanconfidencepage` out of its
script.

The `DerivedCloudEngine` gives its Element Data under `derived`, as the
`DerivedPropertyElement` does, so a Pipeline holds one or the other. In a
Pipeline that uses the cloud, the cloud service gives HumanConfidence. The
`DerivedPropertyElement` can't redeem a sealed result, so on a request that
carries one it gives `Medium` and `Active`.

A `DerivedCloudEngine` can also go in a Pipeline with no
`CloudRequestEngine`, such as an on-premise one. Nothing is redeemed there.
A request that carries a sealed result gives `Medium` and `Active`, with no
error and no request, and any other request gives both Properties with no
value and a `noValueMessage` that says why. To get the redeemed value, add
the `CloudRequestEngine` before it.

Naming HumanConfidence delays the client script's complete handlers by the
time the browser tests take and one more request. A page can read the
first response's Properties sooner through its change handlers.

Where a page sets a Content Security Policy, the browser tests need these.

| Directive | Must allow |
|-----------|------------|
| `script-src` | The cloud service's host, and `'unsafe-eval'` |
| `connect-src` | The cloud service's host |
| `worker-src` | `blob:` |

A page whose policy blocks any of these runs no browser tests, and its
source stays `Passive`. The
[Human Confidence web example](examples/human-confidence-web/server.js)
shows the whole flow.

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

The integration tests read the resource key from the
`_51DEGREES_RESOURCE_KEY_BESPOKE` environment variable.

The Human Confidence web example's live tests, whose files end
`.staging.integration.test.js`, call the staging cloud service instead,
because the production cloud does not serve HumanConfidenceSource yet. They
read the API base from `CLOUD_STAGING_ENDPOINT`, the Bespoke key from
`RESOURCE_KEY_BESPOKE_STAGING` and the Basic key from
`_51DEGREES_RESOURCE_KEY_BASIC`. The first two are CI-only names, set by the
Cloud Human Confidence workflow, so `npm run integration-test` at the
repository root leaves these tests out.

## Pointing the engine at another host

The engine calls `https://cloud.51degrees.com/api/v4/` unless the `baseURL`
option is given or the `_51DEGREES_CLOUD_ENDPOINT` environment variable is set,
in which case that value is the API base including the `/api/v4/` segment (a
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
_51DEGREES_CLOUD_ENDPOINT=https://cloud.example.com/api/v4/ _51DEGREES_RESOURCE_KEY=<resource key> node yourExample.js
```

## Find out more

- [Build your own](https://51degrees.com/build-your-own?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-build-your-own)
- [Pipeline API documentation](https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-documentation)
- [Pipeline API examples](https://51degrees.com/documentation/_pipeline_api__examples__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-examples)
- [Cloud service documentation](https://51degrees.com/documentation/_services__cloud__index.html?utm_source=npm&utm_medium=package&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine&utm_term=find-out-more-cloud-service)
- https://github.com/51Degrees/51degrees-node
