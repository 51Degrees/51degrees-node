# API Specific CI/CD Approach

This API complies with the `common-ci` approach. The scripts in this
folder are called by the shared workflows in the
[common-ci](https://github.com/51Degrees/common-ci) repository.

The following secrets are required:

- `ACCESS_TOKEN` - GitHub [access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token) for cloning repos, creating PRs, etc.
- `NPM_AUTH_TOKEN` - Token for publishing packages to NPM.

The following secrets are required to run tests:

- `IP_INTELLIGENCE_URL` - URL to download the enterprise IP intelligence data file from.
- `TEST_RESOURCE_KEY` - [Resource key](https://51degrees.com/documentation/_info__resource_keys.html?utm_source=github&utm_medium=readme&utm_campaign=ip-intelligence-node&utm_content=ci-readme.md&utm_term=api-specific-ci-cd-approach) for cloud tests.
- `TEST_LICENSE_KEY` - [License key](https://51degrees.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=ip-intelligence-node&utm_content=ci-readme.md&utm_term=api-specific-ci-cd-approach) for data file update tests.

## Differences from common-ci

The native module build uses the local `build-extension.ps1` script in
this folder rather than the one in `common-ci/node`. This is because the
common-ci script refers to the device detection native module name.
