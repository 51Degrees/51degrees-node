param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

# The enterprise data file used in CI is 5.7GB and the update tests
# make a temporary copy of it, which does not fit in the space left on
# the hosted Linux runners. Remove preinstalled toolchains this build
# never uses to make room.
if ($IsLinux -and $env:GITHUB_ACTIONS -eq "true") {
    Write-Output "Freeing runner disk space"
    sudo rm -rf /usr/local/lib/android /usr/share/dotnet /usr/local/.ghcup /usr/share/swift
    df -h /
}

Push-Location $RepoName

$packageJSON = @"
{
  "name": "ip-intelligence-node",
  "version": "1.0.0",
  "description": "Temporary package to allow all tests to run using the local code as dependencies",
  "main": "index.js",
  "directories": {
    "test": "tests"
  },
  "scripts": {
    "pretest": "node ensure-native-module.js",
    "test": "node --expose-gc node_modules/jest/bin/jest.js --ci --reporters=default --runInBand --forceExit --testPathIgnorePatterns=\"performance.test.js\"",
    "preunit-test": "node ensure-native-module.js",
    "unit-test": "node --expose-gc node_modules/jest/bin/jest.js --ci --reporters=jest-junit --reporters=default --runInBand --forceExit --coverage --coverageReporters=cobertura --testPathIgnorePatterns=\"(examples/*|performance.test.js)\"",
    "preintegration-test": "node ensure-native-module.js",
    "integration-test": "node --expose-gc node_modules/jest/bin/jest.js --ci --reporters=jest-junit --reporters=default --runInBand --forceExit --coverage --coverageReporters=cobertura --testPathPattern=\"(examples/*)\" --testPathIgnorePatterns=\"(performance.test.js|tests/*)\"",
    "lint": "eslint . --ext .js",
    "tsc": "tsc -b --force"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/51Degrees/ip-intelligence-node"
  },
  "jest-junit": {
    "outputName": "test_results.xml"
  },
  "author": "51Degrees Engineering <engineering@51degrees.com>",
  "dependencies": {
    "fiftyone.devicedetection.cloud": "^4.5.52",
    "fiftyone.devicedetection.onpremise": "^4.5.52",
    "fiftyone.pipeline.cloudrequestengine": "^4.4.7",
    "fiftyone.pipeline.core": "^4.4.7",
    "fiftyone.pipeline.engines": "^4.4.7",
    "fiftyone.pipeline.engines.fiftyone": "^4.4.7",
    "js-yaml": "^4.1.0",
    "n-readlines": "^1.0.1",
    "pug": "^3.0.2",
    "supertest": "^6.1.6"
  },
  "devDependencies": {
    "eslint": "8.57.0",
    "eslint-config-standard": "^17.0.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-jest": "^26.2.2",
    "eslint-plugin-jsdoc": "^38.1.6",
    "eslint-plugin-n": "^15.0.0",
    "eslint-plugin-node": "^11.1.0",
    "eslint-plugin-promise": "^6.0.0",
    "jest": "^28.1.0",
    "jest-junit": "^13.2.0",
    "typescript": "^5.4.5"
  },
  "license": "EUPL-1.2",
  "bugs": {
    "url": "https://github.com/51Degrees/ip-intelligence-node/issues"
  },
  "files": [
    "*.js"
  ],
  "jest": {
    "testRunner": "jest-circus",
    "setupFilesAfterEnv": [
      "./setup.js"
    ]
  }
}
"@

New-Item -ItemType File -Path "package.json" -Force | Out-Null
Set-Content -Path "package.json" -Value $packageJSON
Write-Output "Package configuration file created successfully."

Pop-Location

$env:RESOURCE_KEY = $Options.Keys.TestResourceKey
$env:TEST_SUPER_RESOURCE_KEY = $Options.Keys.TestSuperResourceKey
$env:TEST_IPI_RESOURCE_KEY = $Options.Keys.TestIpiResourceKey
$env:TEST_LICENSE_KEY = $Options.Keys.TestLicenseKey


./node/setup-environment.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
