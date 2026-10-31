# 51Degrees Node.js

This repository holds the 51Degrees Node.js packages: the Pipeline API,
Device Detection, IP Intelligence and Location. Each package is still published
to npm under its own name.

## What is where

| Path | Contents |
| --- | --- |
| `pipeline-node` | The Pipeline API packages, `fiftyone.pipeline.*` |
| `device-detection-node` | The Device Detection packages, `fiftyone.devicedetection*` |
| `ip-intelligence-node` | The IP Intelligence packages, `fiftyone.ipintelligence*` |
| `location-node` | The `fiftyone.geolocation` package |
| `cxx` | Submodule of [51degrees-cxx](https://github.com/51Degrees/51degrees-cxx), with the C and C++ code and the data file submodules |
| `ci` | The scripts the shared 51Degrees CI workflows call |

Each folder has its own readme describing its packages and examples.

## Getting the code

```
git clone --recurse-submodules https://github.com/51Degrees/51degrees-node.git
cd 51degrees-node
npm install
```

`npm install` links every package to the others in this repository through
npm workspaces, so a change to one package is seen by the rest straight away.

The free Device Detection Lite data file in `cxx/device-detection-data` is
stored with [Git LFS](https://git-lfs.github.com/). Run `git lfs pull` in that
folder to fetch it.

## Building the native modules

The on-premise packages need a native module, built with
[node-gyp](https://github.com/nodejs/node-gyp). The configuration is stored as
`binding.51d` so that `npm install` does not start a build for cloud users.
In `device-detection-node/fiftyone.devicedetection.onpremise` or
`ip-intelligence-node/fiftyone.ipintelligence.onpremise`, run:

```
cp binding.51d binding.gyp
node-gyp rebuild
```

Then copy `build/Release/<module>.node` to
`build/<module>-<platform>-<arch>-<node major version>.node`, for example
`build/FiftyOneDeviceDetectionHashV4-darwin-arm64-24.node`.

## Tests

From the repository root:

```
npm run unit-test
npm run integration-test
npm run lint
npm run tsc
```

The tests that use the cloud need a resource key, which is read from the
`_51DEGREES_RESOURCE_KEY` environment variable. See each folder's readme for
the keys and data files its tests use.

## Regenerating the SWIG wrappers

The wrappers are generated and must not be edited by hand. Use the
`node-24-holder-this` branch of the
[51Degrees fork of SWIG](https://github.com/51Degrees/swig), and run:

```
cd device-detection-node/fiftyone.devicedetection.onpremise
swig -c++ -javascript -node hash_node.i
cd ../../ip-intelligence-node/fiftyone.ipintelligence.onpremise
swig -c++ -javascript -node ipi_node.i
```

## History

The repositories `pipeline-node`, `device-detection-node`, `location-node` and
`ip-intelligence-node` were brought in with `git subtree add`, without
`--squash`, so commit SHAs match the originals. Use `git log --follow` to trace
a file back through the import.
