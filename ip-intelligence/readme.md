![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=top "Data rewards the curious") **Node IP Intelligence**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=top "developer documentation")

## Introduction
This project contains 51Degrees IP Intelligence engines that can be used with the [Pipeline API](https://github.com/51Degrees/51degrees-node/tree/main/pipeline).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## IP intelligence

IP intelligence can be performed 'on-premise' using a local data file or via the 51Degrees cloud service.
On-premise provides better performance, while cloud is easier to deploy.

Both options use the same evidence values and expose (almost all) the same properties, so can be swapped out if needed at a later date.

### Packages

- [**fiftyone.ipintelligence.cloud**](fiftyone.ipintelligence.cloud) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees cloud service. A cloud builder is also included to build a pipeline for the IP intelligence cloud engine.
- [**fiftyone.ipintelligence.onpremise**](fiftyone.ipintelligence.onpremise) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees data file. An on-premise builder is also included to build a pipeline for the IP intelligence on-premise engine.
- [**fiftyone.ipintelligence.shared**](fiftyone.ipintelligence.shared) - A Node.js module which contains shared functionality to build cloud and on-premise engines.
- [**fiftyone.ipintelligence**](fiftyone.ipintelligence) - A Node.js pipeline builder which builds a pipeline for either the cloud or on-premise engine based on the input.

### Dependencies

For runtime dependencies, see our [dependencies](https://51degrees.com/documentation/_info__dependencies.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=dependencies) page.
The [tested versions](https://51degrees.com/documentation/_product_summaries__tested_versions.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=dependencies) page shows
the Node versions that we currently test against. The software may run fine against other
versions, but additional caution should be applied.

### Data

The API can either use our cloud service to get its data or it can use a local (on-premise) copy of the data.

#### Cloud

You will require a [resource key](https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud)
to use the Cloud API. You can create resource keys using our
[configurator](https://configure.51degrees.com/hYzn3TV3?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud), see our
[documentation](https://51degrees.com/documentation/_services__configurator.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud) on how to use this.

The cloud property tiers changed in May 2026. The examples and this documentation
now reflect what is free and what needs a paid subscription. The free tier includes
the following IP intelligence properties: Country, LocationConfidence, Ip and IpV6.
A resource key that selects these free properties can be created at
[this configurator link](https://configure.51degrees.com/Wkqxf3Bs?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud).

The paid IP intelligence properties used by the examples are: CountryCode,
CountryCode3, Region, State, Town, TimeZoneOffset, RegisteredName, RegisteredOwner,
RegisteredCountry, IpRangeStart, IpRangeEnd, Latitude, Longitude and
AccuracyRadiusMin. A resource key that selects the free properties plus these paid
properties, covering everything the examples display, can be created at
[this configurator link](https://configure.51degrees.com/hYzn3TV3?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud).
See https://51degrees.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=cloud to get a paid subscription with more properties.

When running the cloud examples, the resource key can be supplied in the
`51DEGREES_RESOURCE_KEY` environment variable. The legacy `RESOURCE_KEY`
name is still supported and is checked second.

#### On-Premise

In order to perform IP intelligence on-premise, you will need to use a 51Degrees data file.
A free, 'lite' file is linked from the [data](https://github.com/51Degrees/data) repository,
which is the 'cxx/data' submodule of this repository, and its scripts download it. It has a
significantly reduced set of properties. To obtain a file with a more complete set of
properties see the [51Degrees website](https://51degrees.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=on-premise).

The on-premise examples locate the IP intelligence data file in the following order:

1. The `51DEGREES_IPI_PATH` environment variable, which can be set to an explicit path to
   the data file. The mixed examples also need a device detection data file, for which the
   `51DEGREES_DD_PATH` environment variable can be set in the same way.
2. For a file the 'cxx/data' submodule links to, such as the free 'Lite' data file, the
   'cxx/data/ip-intelligence' or 'cxx/data/device-detection' folder of this repository. When
   the file is missing there, the example downloads it with the submodule's
   `get-data-files.sh` script, or `get-data-files.ps1` on Windows. Make sure submodules have
   been fetched by running `git submodule update --init --recursive`.
3. For any other file, a search of the folder hierarchy, walking up from the working
   directory, for the expected data file name.

### Installation

Using NPM call:

```
npm install fiftyone.ipintelligence

npm install fiftyone.ipintelligence.cloud

npm install fiftyone.ipintelligence.onpremise
```

### Build from Source On-Premise

IP intelligence on-premise uses a native binary. (i.e. compiled from C code to target a specific
platform/architecture) The NPM package contains several binaries for common platforms. However,
in some cases, you'll need to build the native binaries yourself for your target platform. This
section explains how to do this.

#### Pre-requisites

- Install Node.js.
- Install node-gyp by running.
  - `npm install node-gyp --global`
- Install C build tools:
  - Windows:
    - You will need either Visual Studio 2019 (or later) or the [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) installed.
      - Minimum platform toolset version is `v142`
      - Minimum Windows SDK version is `10.0.18362.0`
  - Linux/MacOS:
    - `sudo apt-get install g++ make libatomic1`
- Pull git submodules:
  - `git submodule update --init --recursive`

#### Build Steps

When working inside this repository, the whole build can be performed with a single command
from the repository root. The script copies `binding.51d` to `binding.gyp`, runs `node-gyp`
and stages the resulting module in `build` using the naming convention described below. It
works on Windows, Linux (including WSL) and MacOS.

```
node ensure-native-module.js
```

The manual steps are as follows.

- Navigate to fiftyone.ipintelligence.onpremise
- Rename the `binding.51d` to `binding.gyp`
- Run `npm install`
  - Alternatively this step can be replaced by the following:
    - Create a folder named `build`.
    - Run `node-gyp configure`
    - Run `node-gyp build`
  - Platform specific:
    - Windows
      - By default this will look for Visual Studio 2019 and a minimum Windows SDK version `10.0.18362.0`.
      - This can be overwritten by include `--msvs_version=[VS version]` and `--msvs_target_platform_version=[Windows SDK Version]` as part of the `npm install` command.
        - **NOTE**: This is not recommended. Also, some time the latest SDK version is selected instead, as observed in environment with multiple SDK versions installed. Thus, only install the correct Visual Studio version and the minimum required Windows SDK version as recommended.
- This will build the `FiftyOneIpIntelligenceIpiV41.node` under `build/Release` folder.
- Copy the `FiftyOneIpIntelligenceIpiV41.node` to `build` directory (which is one level up) and rename it using the following convention.
  - Windows:
    - FiftyOneIpIntelligenceIpiV41-win32-[ arch ]-[ Node major version ].node
  - Linux:
    - FiftyOneIpIntelligenceIpiV41-linux-[ arch ]-[ Node major version ].node
  - MacOS:
    - FiftyOneIpIntelligenceIpiV41-darwin-[ arch ]-[ Node version ].node
      - e.g. FiftyOneIpIntelligenceIpiV41-darwin-arm64-20.node for Node 20 on Apple silicon.
  - Please see the [tested versions page](https://51degrees.com/documentation/_product_summaries__tested_versions.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=build-steps) for Node versions that we currently test against. The software may run fine against other versions, but extra caution should be applied.
  - You can optionally clear up by removing all the build files and folders except for the *.node file that's been created.
  - `WARNING`: `npm install` removes this copied file, so you will need to do the above steps again after running `npm install`

### Examples

For details of how to run the examples, please refer to [run examples](run_examples.md).
The tables below describe the examples that are available.

#### Cloud

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingstarted-console](fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console)                 | How to use the 51Degrees Cloud service to determine details about the network, and location associated with an IP address. |
| [gettingstarted-web](fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-web)                     | How to use the 51Degrees Cloud service to determine details about the source of a web request as part of a simple web server. |
| [getallproperties-console](fiftyone.ipintelligence.cloud/examples/cloud/getallproperties-console)               | How to retrieve and enumerate all the IP intelligence properties available from the 51Degrees Cloud service. |
| [metadata-console](fiftyone.ipintelligence.cloud/examples/cloud/metadata-console)                       | How to access the meta-data that relates to the IP intelligence algorithm. |
| [mixed/gettingstarted-console](fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-console)            | How to use both device detection and IP intelligence from the 51Degrees Cloud service in a single pipeline. |
| [mixed/gettingstarted-web](fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-web)                | How to use both device detection and IP intelligence from the 51Degrees Cloud service as part of a simple web server. |

#### On-Premise

| Example                                | Description |
|----------------------------------------|-------------|
| [automaticupdates/dataFileSystemWatcher.js](fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/dataFileSystemWatcher.js) | How to configure automatic updates using the file system watcher to monitor for changes to the data file. |
| [automaticupdates/updateOnStartUp.js](fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/updateOnStartUp.js)    | How to configure the Pipeline to automatically update the IP intelligence data file on startup. |
| [automaticupdates/updatePollingInterval.js](fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/updatePollingInterval.js) | How to configure and verify the various automatic data file update settings. |
| [compare-console](fiftyone.ipintelligence.onpremise/examples/onpremise/compare-console)                        | How to compare the results of the IP intelligence service against a CSV file of known and true IP-Location records. |
| [gettingstarted-console](fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-console)                | How to use the 51Degrees on-premise IP intelligence API to determine details about the network, and location associated with an IP address. |
| [gettingstarted-web](fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web)                     | How to use the 51Degrees on-premise IP intelligence API to determine details about the source of a web request as part of a simple web server. |
| [metadata-console](fiftyone.ipintelligence.onpremise/examples/onpremise/metadata-console)                       | How to access the meta-data that relates to the IP intelligence algorithm. |
| [metrics-console](fiftyone.ipintelligence.onpremise/examples/onpremise/metrics-console)                        | How to compile metrics describing the geographic areas returned for public IP addresses. Used to verify the published metrics for the IP intelligence service. |
| [mixed/gettingstarted-console](fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-console)            | How to use both device detection and IP intelligence engines in a single pipeline. |
| [mixed/gettingstarted-web](fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-web)                | How to use both device detection and IP intelligence engines as part of a simple web server. |
| [mixed/gettingstarted-api](fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-api)                | How to run a local version of the 51Degrees cloud API using the device detection and IP intelligence on-premise engines. |
| [offlineprocessing-console](fiftyone.ipintelligence.onpremise/examples/onpremise/offlineprocessing-console)              | How to process data for later viewing using an IP intelligence data file. |
| [performance-console](fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console)                    | How to run a simple performance test against an IP intelligence data file. |
| [suspicious-console](fiftyone.ipintelligence.onpremise/examples/onpremise/suspicious-console)                     | How to combine IP intelligence properties to determine whether an IP is likely to be the source of suspicious requests. |
| [updatedatafile-console](fiftyone.ipintelligence.onpremise/examples/onpremise/updatedatafile-console)                 | This example illustrates various parameters that can be adjusted when using the on-premise IP intelligence engine, and controls when a new data file is sought and when it is loaded by the IP intelligence software. |

#### IP Intelligence

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingStarted.js](fiftyone.ipintelligence/examples/gettingStarted.js)                   |  Getting started example of using the 51Degrees IP intelligence algorithm to determine the country of a given IP address.|

## Tests

In this repository, there are tests for the examples.
Install the dependencies, which include jest, by running the following
command in the root directory:

```
npm install
```

Add a 51Degrees cloud resource key for cloud tests. You can obtain a resource key covering everything the examples display from the [51Degrees Cloud Configurator](https://configure.51degrees.com/hYzn3TV3?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=tests) and assign it to the environment variable `51DEGREES_RESOURCE_KEY` in your test environment. The legacy `RESOURCE_KEY` name is still supported and is checked second.

The on-premise tests use the native module, which is built for the current Node.js LTS versions targeted for testing, see the [tested versions page](https://51degrees.com/documentation/_product_summaries__tested_versions.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=tested-versions). Make sure one of these versions is active (`nvm list` shows the active version) before running the tests.

The tests also run on Linux and on WSL. When the repository is on a Windows drive mounted in WSL (for example under `/mnt/d`), reading the large data file is considerably slower than on a native Linux filesystem, so engine initialisation can take tens of seconds per test. The test timeouts allow for this. Copy the repository to the Linux filesystem where faster runs are needed.

To run the tests, execute the following command in the root directory or a sub-module directory:

```
npm test
```

This runs the unit tests and the example tests together. They can also be run separately with `npm run unit-test` and `npm run integration-test`.

## Native code updates

Process for rebuilding SWIG interfaces following an update to the IP intelligence cxx code
(This is only intended to be run by 51Degrees developers internally):

1. Ensure Swig is installed.
   1. Use the 51Degrees fork of Swig, built from source from the `node-24-holder-this` branch of https://github.com/51Degrees/swig.
   2. The fork is required because Swig releases still emit V8 API calls that were removed in the V8 shipped with recent Node versions, in particular `FunctionCallbackInfo::Holder()`, which the fork replaces with `This()`. The generated code must compile against the Node.js LTS versions targeted for testing, see the [tested versions page](https://51degrees.com/documentation/_product_summaries__tested_versions.html?utm_source=github&utm_medium=readme&utm_campaign=51degrees-node&utm_content=readme.md&utm_term=tested-versions).
   3. All native modules loaded into one Node process must be generated by the same Swig version. Mixing modules generated by different Swig versions (for example this package and fiftyone.devicedetection.onpremise) can crash the process, so regenerate and release them together.
2. Update the `cxx` submodule at the root of the repository to reference the relevant commit.
3. From terminal, navigate to fiftyone.ipintelligence.onpremise and run:
    a) swig -c++ -javascript -node ipi_node.i
4. Commit changes to repository.
5. Run the nightly publish CI pipeline to produce binaries for all supported platforms.

## TypeScript

Types are generated and exported automatically from JSDoc comments using [this script](https://github.com/51Degrees/common-ci/blob/main/node/generate-types.ps1#L10). Upon generation types are committed into the repository into the package's `types` directory. Calling the generation step is manual for now, but later will be added as part of CI/CD pipeline.
