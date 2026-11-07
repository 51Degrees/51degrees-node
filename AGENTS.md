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

- Git.
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
- For the data files, `curl`, `gzip` and `md5sum` (`md5` on macOS) on Linux
  and macOS, where the examples download with the shell script, and Windows
  PowerShell 5.1 or PowerShell 7 on Windows, where they use the PowerShell
  script. The downloads come from `distributor.51degrees.com`.

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

The examples use the free Lite data files, which need no licence key. They are
not stored in this repository. The `cxx` submodule holds the
[data](https://github.com/51Degrees/data) repository as `cxx/data`, which has a
link to each file, and a script downloads them into `cxx/data/device-detection`
and `cxx/data/ip-intelligence`.

On Linux and macOS, run the shell script.

```
sh cxx/data/get-data-files.sh
```

On Windows, run the PowerShell script. Windows PowerShell can refuse to run a
script file under the policy Windows sets by default, so run it the way the
examples do.

```
powershell -NoProfile -ExecutionPolicy Bypass -File cxx/data/get-data-files.ps1
```

Where PowerShell 7 is installed, `pwsh cxx/data/get-data-files.ps1` does the
same on any system. Either script downloads every free file, and keeps a file
that is already there. To download one file, give its name, as in
`sh cxx/data/get-data-files.sh 51Degrees-LiteV4.1.hash`. An example whose free
file is missing runs the script for that file itself.

#### Check the files

- `cxx/data/device-detection/51Degrees-LiteV4.1.hash` is more than 10 MB.
- `cxx/data/ip-intelligence/51Degrees-LiteV41.ipi` is more than 100 MB.

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

An on-premise example reads its free data file from `cxx/data`, by a path
relative to the examples' `exampleUtils.js` (`findFile` in that file), so the
folder it runs in does not matter for that file. When the file is not there,
the example runs the download script for it, with Windows PowerShell on
Windows and `sh` on Linux and macOS. The commands below run each example from
its own folder, as CI runs the web examples.

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

When an example downloads its data file, it first prints
`<file> is missing, so it is being downloaded by running` and the command,
then the script's `Downloading` and `Saved` lines.

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
- **A data file that is not there.** `cxx/data` holds a `.link` for each file
  rather than the file. An example whose file is missing runs the download
  script for it, so it needs the network and the tools under "Prerequisites".
  Check the file sizes as above.
- **Missing submodules.** The example then says it failed to find a data file
  and asks for `git submodule update --init --recursive`, which fetches them.
  A zip download of the repository has no submodules, so clone with Git.
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
  so the lookup above never runs there. `ci/fetch-assets.ps1` links the paid
  Device Detection file in as `tests/51Degrees-LiteV4.1.hash`, which the tests
  look at first, and the paid IP Intelligence file in as
  `51Degrees-LiteV41.ipi`, so CI reads the Lite IP Intelligence file only when
  it has no IP Intelligence licence.

## Package references

`package.json` refers to the other packages here by path, so the workspace links
them. `remote_package.json` is the same manifest as published, and
`ci/build-package.ps1` swaps it in before packing. The build then writes the
package's version, and requires each package here at the version that package
has once the release is out. Change both files when a dependency or a field
changes, and `DependsOn` in `ci/packages.json` when a dependency changes, as the
build stops when they disagree. A package with no in-repository dependency has
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

Tests and examples read data from `cxx/data/device-detection` and
`cxx/data/ip-intelligence`, the folders of the data submodule in `cxx`, by
paths relative to the file. Each free data file there is a `<file>.link` rather
than the file. `cxx/data/get-data-files.sh` and `.ps1` download them, and the
examples run the script for a linked file that is missing.
`ci/fetch-assets.ps1` links the enterprise files in, some under the Lite names,
then runs the script for the rest, which keeps a file that is already there.
Nothing reads the older `cxx/device-detection-data` and
`cxx/ip-intelligence-data` submodules.

## CI

The workflows in `.github/workflows` call the shared workflows in
[common-ci](https://github.com/51Degrees/common-ci), which run the scripts in
`ci/`. `ci/packages.ps1` lists the native modules, and `ci/packages.json` the
packages published to npm.

## Releases

Pull requests go to `rc`, not `main`, and stay drafts until they have been
reviewed, because the nightly merges any pull request into `rc` that is not a
draft and has no review requested. When a release is wanted, one pull request
merges `rc` into `main`, and the "Only rc into main" check fails a pull request
into `main` from any other branch.

## Versions

Each package has its own version, tagged `<package>/<version>`, such as
`fiftyone.pipeline.core/4.5.103`. A publish releases a package when a file
under its `Path` or `ExtraPaths` in `ci/packages.json` changed since its last
tag, other than under its `ExcludePaths`, and releases every package that
depends on it with it. `ci/release-plan.ps1` works this out with common-ci's
`steps/release-plan.ps1`, and only the patch number moves.

A package's examples are in its `ExcludePaths`, so a change only to them
releases nothing. The two `shared` packages are the exception, because their
`index.js` exports their `examples` and `tests` modules.

`ci/check-version-bump.ps1` refuses a major or minor move for any package,
against its own tags and against the version npm installs by default.
`ci/check-release-interval.ps1` holds each package to one release a week. A
package with no tag of its own stops the publish, unless `ci/packages.json`
gives it a `FirstVersion`. The plain tags such as `4.5.102` are the releases
from when every package had one version.
