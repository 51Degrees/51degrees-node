![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=repository&utm_content=readme_main&utm_campaign=node-open-source "Data rewards the curious") **Node IP Intelligence**

[Developer Documentation](https://51degrees.com/ip-intelligence-node/index.html?utm_source=github&utm_medium=repository&utm_content=documentation&utm_campaign=node-open-source "developer documentation")

# Running examples

The examples can be run either with modules included in the GitHub repository or with the **IP Intelligence** packages from `npm` repository.

Usage examples are available for Cloud and OnPremise [`fiftyone.ipintelligence`](/fiftyone.ipintelligence/examples), [`fiftyone.ipintelligence.cloud`](/fiftyone.ipintelligence.cloud/examples/cloud) and [`fiftyone.ipintelligence.onpremise`](/fiftyone.ipintelligence.onpremise/examples/onpremise).

## Run with modules in GitHub repository

First of all, you need to build the binaries for the on-premise examples to work as described in the **On-Premise** section of the [readme](/readme.md). **Skip** this part if you just want to run the cloud examples.

The `mixed` examples combine device detection and IP intelligence in a single pipeline. These use the `fiftyone.devicedetection.cloud` and `fiftyone.devicedetection.onpremise` packages, which are installed by `npm install` in the repository root. The on-premise mixed examples also need a device detection data file (`.hash` format). A lite data file is available from the [device-detection-data](https://github.com/51Degrees/device-detection-data) repository, and the path to it can be supplied as a command line argument or placed within the project space.

Then navigate to the root folder that contains the examples that you want to run. This folder can be either [`fiftyone.ipintelligence`](/fiftyone.ipintelligence#readme.md), [`fiftyone.ipintelligence.cloud`](/fiftyone.ipintelligence.cloud#readme.md) or [`fiftyone.ipintelligence.onpremise`](/fiftyone.ipintelligence.onpremise#readme.md)

Install the required packages:

```
npm install
```

Navigate to the sub folder `examples/[cloud|onpremise]` and run the example:

e.g.

```
node gettingStarted.js
```

## Run with npm packages

These examples can also be run with `npm` packages ``fiftyone.ipintelligence.*`` modules.

First of all, create a folder outside of the checkout directory (`npm` does not allow package to be installed under the same package name) and copy the example that you want to run to that folder. For examples where there is an associated `JSON` `51d.json`, you will also need to copy the file.

Create a `package.json` file and make sure to include the package that you wish to use in the `dependencies` section. For examples:

```
  "dependencies": {
      "fiftyone.ipintelligence.cloud": "^1.0.0",
      ...
  }
```

Packages usage:
- [`fiftyone.ipintelligence`](/fiftyone.ipintelligence#readme.md): contains pipeline builder which can be used to build both `Cloud` and `On-Premise` engines pipeline.
- [`fiftyone.ipintelligence.cloud`](/fiftyone.ipintelligence.cloud#readme.md): contains cloud engine and cloud pipeline builder.
- [`fiftyone.ipintelligence.onpremise`](/fiftyone.ipintelligence.onpremise#readme.md): contains on-premise engine and on-premise pipeline builder.

Next, you will need to update the `require` statement, the data file path and the `51d.json` file if the example require to.

The `require` statement will need to pick the corresponding module instead of using the relative path.

Updated the data file path to point to where the data file is stored.

Update the `51d.json` file if required. For example, if the `51d.json` contains:

```
        "Elements": [
        {
            "elementName": "../../ipIntelligenceCloud"
        },
```

It will need to be updated to

```
        ...
        "Elements": [
        {
            "elementName": "fiftyone.ipintelligence.cloud/ipIntelligenceCloud"
        },
    ...
```

If the `51d.json` contains the data file for on-premise example, it will also need to be updated to point to the correct location.

Once you have finished setting up, run the example:

e.g.

```
node gettingStarted.js
```
