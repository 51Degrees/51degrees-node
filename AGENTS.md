# Working in this repository

If you have been asked to get an example running, follow
[Run the examples](#run-the-examples). It gives every step in order, from a
fresh clone to the output. The sections after it are notes on what is not
obvious from the code, for changing it. Keep them short and current. The
[README](README.md) describes the build, the tests and the layout.

## Run the examples

Run each command from the repository root unless the step says otherwise.
Device Detection's on-premise `gettingstarted-console` is the quickest example
to show, because its data file is about 35 MB. IP Intelligence's on-premise
`gettingstarted-console` needs a download of about 230 MB that unpacks to
about 460 MB, so run it second.

The examples use the packages in this repository, which `npm install` links
together through npm workspaces, not the packages published to npm. So each
on-premise package needs its native module built from the C code in `cxx`
before its examples can run. The cloud examples need no native module.

### Prerequisites

- Git, and [Git LFS](https://git-lfs.github.com/) for the Device Detection
  data file.
- Node.js 22 or 24, with npm. CI tests these two (`ci/options.json`), and
  `ip-intelligence/ensure-native-module.js` refuses to build for any other.
  The build uses node-gyp 12, which needs Node.js 22.9 or later on the 22 line.
- A C and C++ toolchain for [node-gyp](https://github.com/nodejs/node-gyp).
  On Windows, Visual Studio 2019 or later, or the
  [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/),
  with Platform Toolset `v142` and Windows SDK `10.0.18362.0` or later. On
  Linux, `sudo apt-get install g++ make libatomic1`, which CI also runs. On
  macOS, the compilers that come with Xcode. node-gyp also needs Python 3, as
  its README says.
- For the IP Intelligence data file, PowerShell 7 (`pwsh`) on any system, or
  `curl`, `gunzip` and `md5sum` (`md5` on macOS) for the shell script on Linux
  and macOS.

Clone the repository with its submodules.

```
git clone --recurse-submodules https://github.com/51Degrees/51degrees-node.git
cd 51degrees-node
```

In a clone made without `--recurse-submodules`, fetch the submodules.

```
git submodule update --init --recursive
```

### Data files

The examples use the free Lite data files, which need no licence key. They
come from the `cxx` submodule, and two layouts exist. Read the "Getting the
code" section of `README.md` in your checkout to find out which one applies.

- **The README says to run `git lfs pull`.** This is the layout on `rc` and
  `main` today. The files are in `cxx/device-detection-data` and
  `cxx/ip-intelligence-data`. Follow "Without cxx/data".
- **The README says to run `cxx/data/get-data-files.sh`.** The draft pull
  request [#22](https://github.com/51Degrees/51degrees-node/pull/22) moves the
  examples to the [data](https://github.com/51Degrees/data) repository, which
  cxx carries as `cxx/data`. Once it is merged, follow "With cxx/data".

Go by the README rather than by whether `cxx/data` exists, because the folder
can arrive with a newer `cxx` before the examples here read it.

#### Without cxx/data

The Device Detection Lite file is stored with Git LFS. Install Git LFS, for
example with `sudo apt-get install git-lfs` on Ubuntu, then pull the file in
its submodule.

```
git lfs install
cd cxx/device-detection-data
git lfs pull
cd ../..
```

A script in `cxx/ip-intelligence-data` downloads the IP Intelligence Lite
file. Run it from inside that folder, because it saves the file in the folder
it runs from.

```
cd cxx/ip-intelligence-data
pwsh ./get-lite-file-from-azure.ps1
cd ../..
```

On Linux and macOS, `./get-lite-file-from-azure.sh` in the same folder does
the same. Either script also downloads the Asn file over the copy committed in
the submodule, so `git status` then shows the submodule as modified, which is
expected.

#### With cxx/data

```
sh cxx/data/get-data-files.sh
```

In PowerShell, run `./cxx/data/get-data-files.ps1` instead. Either script
downloads every free file into `cxx/data/device-detection` and
`cxx/data/ip-intelligence`, and keeps a file that is already there. In this
layout an example whose free file is missing runs the script for that file
itself.

#### Check the files

- `cxx/device-detection-data/51Degrees-LiteV4.1.hash` is more than 10 MB. A
  file of about 130 bytes that starts with
  `version https://git-lfs.github.com/spec/v1` is a Git LFS pointer, which
  means Git LFS has not pulled the file.
- `cxx/ip-intelligence-data/51Degrees-LiteV41.ipi` is more than 100 MB.

With `cxx/data`, the same files are in `cxx/data/device-detection` and
`cxx/data/ip-intelligence`.

### Build

Install the packages first, from the repository root.

```
npm install
```

Then build the Device Detection native module, as `ci/build-extension.ps1`
does.

```
cd device-detection/fiftyone.devicedetection.onpremise
cp binding.51d binding.gyp
npx --yes node-gyp@12 configure
npx --yes node-gyp@12 build
```

node-gyp writes `build/Release/FiftyOneDeviceDetectionHashV4.node`, but the
engine loads `build/FiftyOneDeviceDetectionHashV4-<platform>-<arch>-<major>.node`,
named for the system and the major version of Node.js. This command prints
that middle part, for example `linux-x64-24`, `win32-x64-24` or
`darwin-arm64-22`.

```
node -p "process.platform + '-' + process.arch + '-' + process.versions.node.split('.')[0]"
```

Copy the module to that name, then go back to the root. For Node.js 24 on
Linux x64 these are the commands.

```
cp build/Release/FiftyOneDeviceDetectionHashV4.node build/FiftyOneDeviceDetectionHashV4-linux-x64-24.node
cd ../..
```

For IP Intelligence, one script in the repository does the same steps,
including the copy.

```
node ip-intelligence/ensure-native-module.js
```

It prints `Native module built:` and the path when it is done.

### Run

An on-premise example finds its data file by searching the folder it runs in
and its subfolders, then each folder above it in turn, for up to 10 seconds
(`privateFindFile` in the example folder's `exampleUtils.js`). Run each example
from its own folder, as CI runs the web examples.

```
cd device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/gettingstarted-console
node gettingStarted.js
cd ../../../../..
```

```
cd ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-console
node gettingStarted.js
cd ../../../../..
```

To use another data file, give its path as the first argument, or set
`51DEGREES_DD_PATH` for Device Detection or `51DEGREES_IPI_PATH` for IP
Intelligence. The names start with a digit, so in a Linux shell set them with
`env`, for example `env 51DEGREES_IPI_PATH=/path/to/file.ipi node gettingStarted.js`.

### Correct output

The Device Detection example processes five sets of evidence. For each it
prints `Input values:` and the evidence, then `Results:` with `Mobile Device`,
`Platform Name`, `Platform Version`, `Browser Name` and `Browser Version`.
After the last set it names the data file, and warns that the Lite file is for
illustration.

```
Using a Lite data file created <date> from location <path>
This example is using the 'Lite' data file. This is used for illustration, ...
```

The IP Intelligence example looks up five addresses, being `194.209.0.1`,
`91.183.0.1`, `77.119.0.1`, `5.1.0.1` and
`2001:0db8:085a:0000:0000:8a2e:0370:7334`. For each it prints `Input values:`
with the address, then `Results:` with `Registered Name`, `Registered Owner`,
`Registered Country`, `IP Range Start`, `IP Range End`, `Country`,
`Country Code`, `Town`, `Latitude` and `Longitude`. The Lite file has only
RegisteredCountry, RegisteredName and RegisteredOwner. The example reads each
value through `getValueHelper` in
`ip-intelligence/fiftyone.ipintelligence.shared/examples/dataExtension.js`,
which catches the error a missing property raises, so the lines for the other
properties read `Unknown (...)` and the example carries on. It ends with the
same two lines about the data file.

The paid data files have many more properties, as the
[pricing page](https://51degrees.com/pricing?utm_source=github&utm_medium=docs&utm_campaign=51degrees-node&utm_content=agents.md&utm_term=correct-output)
describes.

### Cloud examples

The cloud examples need a resource key, which a person creates in the
configurator, so ask for one if none is set. A key with the free properties
the examples use can be created
[here](https://configure.51degrees.com/Wkqxf3Bs?utm_source=github&utm_medium=docs&utm_campaign=51degrees-node&utm_content=agents.md&utm_term=cloud-examples),
and one that adds the paid properties they show
[here](https://configure.51degrees.com/hYzn3TV3?utm_source=github&utm_medium=docs&utm_campaign=51degrees-node&utm_content=agents.md&utm_term=cloud-examples),
as `device-detection/readme.md` and `ip-intelligence/readme.md` say.

The Device Detection cloud example reads `51d.json` from the folder it runs
in, so run it from its own folder. It takes the key as its first argument, or
from `_51DEGREES_RESOURCE_KEY`.

```
cd device-detection/fiftyone.devicedetection.cloud/examples/cloud/gettingstarted-console
node gettingStarted.js <resource key>
cd ../../../../..
```

The output has the same `Input values:` and `Results:` blocks. With a key that
has only the free properties, the platform and browser lines read
`Unknown (...)`, and the example ends by saying that some properties are not
available with a free resource key. The IP Intelligence cloud example, in
`ip-intelligence/fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console`,
reads its key from `51DEGREES_RESOURCE_KEY` instead.

### Pitfalls

- **No native module.** Without the build step the engine stops with
  `There is no directory at '...'` or `Failed to load native module '...'`.
  Build the module with the same Node.js version that runs the example,
  because its name holds the major version.
- **`npm install` after the build.** The product readmes warn that
  `npm install` removes the copied module, so build again after it.
- **A Git LFS pointer instead of the data file.** The engine cannot load it,
  so the example fails before it prints any results. Check the file sizes as
  above.
- **Missing submodules.** The example then says it failed to find a data file
  and suggests `git submodule update --recursive`, which does not fetch
  submodules that were never initialised. Run
  `git submodule update --init --recursive` instead.
- **The search gives up after 10 seconds.** Run the example from its own
  folder, or set `51DEGREES_DD_PATH` or `51DEGREES_IPI_PATH`.
- **Windows line endings.** Git for Windows usually checks files out with
  `core.autocrlf=true`, and `cxx/ip-intelligence-data` has no
  `.gitattributes`, so its shell script gets Windows line endings and the
  shell cannot run it. Use the PowerShell script on Windows.
- **Warnings are errors on Windows.** Both `binding.51d` files set
  `win_warn_as_error`, so a compiler newer than the one CI uses can stop the
  build on a new warning.
- **An older node-gyp.** Use node-gyp 12 through `npx`, as above. The comment
  in `ci/build-extension.ps1` says older versions do not recognise Visual
  Studio 2026.
- **WSL on a Windows drive.** `ip-intelligence/readme.md` says reading the
  data file from a drive such as `/mnt/d` is much slower than from the Linux
  file system.
- **What CI does not test.** CI runs the console examples through their jest
  tests, which call each example's `run` with a path from the test helpers,
  so the file search above never runs there. `ci/fetch-assets.ps1` links the
  paid Device Detection file in as `tests/51Degrees-LiteV4.1.hash`, which the
  tests look at first, and the paid IP Intelligence file in as
  `51Degrees-LiteV41.ipi`, so the Lite IP Intelligence file is never used in
  CI.

## Package references

`package.json` refers to the other packages here by path, so the workspace links
them. `remote_package.json` is the same manifest with the versions consumers
install, and `ci/build-package.ps1` swaps it in before packing. Change both when
a dependency or a field changes. A package with no in-repository dependency has
no `remote_package.json`.

## Everything hoists to the root

npm installs into the root `node_modules`, which has three effects:

- Do not write a path into a package's own `node_modules`. Use the package
  name: the `require51` helpers fall back to a plain `require`, and `elementName`
  in `51d.json` is a package path.
- `npm pack` bundles from the package's own `node_modules`, so
  `fiftyone.pipeline.did`'s bundled `owid` has to be installed there first.
  `ci/build-package.ps1` does this.
- A rule in the root `.gitignore` also applies to what `npm pack` puts in a
  workspace package. Anchoring it with `/` does not stop that.

Every sibling now resolves, so a JSDoc type import between packages is a real
reference. `fiftyone.pipeline.core` must not import types from a package which
depends on it, or `tsc` reports TS5055 for overwriting its own output.

## Native modules

Each module compiles its own copy of common from `cxx`, as the two products
need it built differently. IP Intelligence's definitions are in its
`binding.51d`, so keep them out of Device Detection's. The wrappers include
through `cxx/`, so `binding.51d` adds the repository root as an include
directory.

All native modules loaded into one Node process must be generated by the same
SWIG version, so regenerate both wrappers together.

## Data files

Tests and examples read data from `cxx/device-detection-data` and
`cxx/ip-intelligence-data`, by paths relative to the file. `ci/fetch-assets.ps1`
links the enterprise files there.

## CI

The workflows in `.github/workflows` call the shared workflows in
[common-ci](https://github.com/51Degrees/common-ci), which run the scripts in
`ci/`. `ci/packages.ps1` lists the native modules and the packages published to
npm.

## Releases

Pull requests go to `rc`, not `main`, and stay drafts until they have been
reviewed, because the nightly merges any pull request into `rc` that is not a
draft and has no review requested. When a release is wanted, one pull request
merges `rc` into `main`, and the "Only rc into main" check fails a pull request
into `main` from any other branch.

## Versions

The repository has one version, tagged as a plain version such as `4.5.97`.
`ci/get-next-package-version.ps1` moves only the patch number.
