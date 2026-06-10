![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=repository&utm_content=readme_main&utm_campaign=node-open-source "Data rewards the curious") **Node IP Intelligence**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=github&utm_medium=repository&utm_content=documentation&utm_campaign=node-open-source "developer documentation")

## Introduction
This project contains 51Degrees IP Intelligence engines that can be used with the [Pipeline API](https://github.com/51Degrees/pipeline-node).

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## IP intelligence

IP intelligence can be performed 'on-premise' using a local data file or via the 51Degrees cloud service.
On-premise provides better performance, while cloud is easier to deploy.

Both options use the same evidence values and expose (almost all) the same properties, so can be swapped out if needed at a later date.

### Packages

- [**fiftyone.ipintelligence.cloud**](/fiftyone.ipintelligence.cloud#readme) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees cloud service. A cloud builder is also included to build a pipeline for the IP intelligence cloud engine.
- [**fiftyone.ipintelligence.onpremise**](/fiftyone.ipintelligence.onpremise#readme) - A Node.js engine which retrieves engine results by consuming data from the 51Degrees data file. An on-premise builder is also included to build a pipeline for the IP intelligence on-premise engine.
- [**fiftyone.ipintelligence.shared**](/fiftyone.ipintelligence.shared#readme) - A Node.js module which contains shared functionality to build cloud and on-premise engines.
- [**fiftyone.ipintelligence**](/fiftyone.ipintelligence#readme) - A Node.js pipeline builder which builds a pipeline for either the cloud or on-premise engine based on the input.

### Dependencies

For runtime dependencies, see our [dependencies](https://51degrees.com/documentation/_info__dependencies.html) page.
The [tested versions](https://51degrees.com/documentation/_info__tested_versions.html) page shows
the Node versions that we currently test against. The software may run fine against other
versions, but additional caution should be applied.

### Data

The API can either use our cloud service to get its data or it can use a local (on-premise) copy of the data.

#### Cloud

You will require a [resource key](https://51degrees.com/documentation/_info__resource_keys.html)
to use the Cloud API. You can create resource keys using our
[configurator](https://configure.51degrees.com/), see our
[documentation](https://51degrees.com/documentation/_concepts__configurator.html) on how to use this.

#### On-Premise

In order to perform IP intelligence on-premise, you will need to use a 51Degrees data file.
A free, 'lite' file can be obtained from the
[ip-intelligence-data](https://github.com/51Degrees/ip-intelligence-data) repository. It has a
significantly reduced set of properties. To obtain a file with a more complete set of
properties see the [51Degrees website](https://51degrees.com/pricing).

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

- Navigate to fiftyone.ipintelligence.onpremise
- Rename the `binding.51d` to `binding.gyp`
- Run `npm install`
  - Alternatively this step can be replaced by the followings:
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
    - FiftyOneIpIntelligenceIpiV41-win32-[ arch ]-[ Node version ].node
      - e.g. FiftyOneIpIntelligenceIpiV41-win32-x64-20.node for Node 20 on x64.
  - Linux:
    - FiftyOneIpIntelligenceIpiV41-linux-[ arch ]-[ Node version ].node
      - e.g. FiftyOneIpIntelligenceIpiV41-linux-x64-20.node for Node 20 on x64.
  - MacOS:
    - FiftyOneIpIntelligenceIpiV41-darwin-[ arch ]-[ Node version ].node
      - e.g. FiftyOneIpIntelligenceIpiV41-darwin-arm64-20.node for Node 20 on Apple silicon.
  - Please see the [tested versions page](https://51degrees.com/documentation/_info__tested_versions.html) for Node versions that we currently test against. The software may run fine against other versions, but extra caution should be applied.
  - You can optionally clear up by removing all the build files and folders except for the *.node file that's been created.
  - `WARNING`: `npm install` removes this copied file, so you will need to do the above steps again after running `npm install`

### Examples

For details of how to run the examples, please refer to [run examples](/run_examples.md).
The tables below describe the examples that are available.

#### Cloud

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingstarted-console](/fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console)                 | How to use the 51Degrees Cloud service to determine details about the network, and location associated with an IP address. |
| [gettingstarted-web](/fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-web)                     | How to use the 51Degrees Cloud service to determine details about the source of a web request as part of a simple web server. |
| [metadata-console](/fiftyone.ipintelligence.cloud/examples/cloud/metadata-console)                       | How to access the meta-data that relates to the IP intelligence algorithm. |

#### On-Premise

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingstarted-console](/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-console)                | How to use the 51Degrees on-premise IP intelligence API to determine details about the network, and location associated with an IP address. |
| [gettingstarted-web](/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web)                     | How to use the 51Degrees on-premise IP intelligence API to determine details about the source of a web request as part of a simple web server. |
| [metadata-console](/fiftyone.ipintelligence.onpremise/examples/onpremise/metadata-console)                       | How to access the meta-data that relates to the IP intelligence algorithm. |
| [offlineprocessing-console](/fiftyone.ipintelligence.onpremise/examples/onpremise/offlineprocessing-console)              | How to process data for later viewing using an IP intelligence data file. |
| [updatedatafile-console](/fiftyone.ipintelligence.onpremise/examples/onpremise/updatedatafile-console)                 | This example illustrates various parameters that can be adjusted when using the on-premise IP intelligence engine, and controls when a new data file is sought and when it is loaded by the IP intelligence software. |

#### IP Intelligence

| Example                                | Description |
|----------------------------------------|-------------|
| [gettingStarted.js](/fiftyone.ipintelligence/examples/gettingStarted.js)                   |  Getting started example of using the 51Degrees IP intelligence algorithm to determine the country of a given IP address.|

## Tests

In this repository, there are tests for the examples.
You will need to install jest to run them:

```
npm install jest --global
```

You will also need to install any required packages for the examples in the **Examples** section.

Add a 51Degrees cloud resource key for cloud tests. You can obtain a resource key from the [51Degrees Cloud Configurator](https://configure.51degrees.com/) and assign it to the environment variable `RESOURCE_KEY` in your test environment.

To run the tests, execute the following command in the root directory or a sub-module directory:

```
npm test
```

## Native code updates

Process for rebuilding SWIG interfaces following an update to the IP intelligence cxx code
(This is only intended to be run by 51Degrees developers internally):

1. Ensure Swig 4.3.1 or above is installed.
2. Update the ip-intelligence-cxx submodule to reference the relevant commit.
3. From terminal, navigate to fiftyone.ipintelligence.onpremise and run:
    a) swig -c++ -javascript -node ipi_node.i
4. Commit changes to repository.
5. Run the nightly publish CI pipeline to produce binaries for all supported platforms.

## TypeScript

Types are generated and exported automatically from JSDoc comments using [this script](https://github.com/51Degrees/common-ci/blob/main/node/generate-types.ps1#L10). Upon generation types are committed into the repository into the package's `types` directory. Calling the generation step is manual for now, but later will be added as part of CI/CD pipeline.
