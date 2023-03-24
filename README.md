# upstream-topr

README WIP

## Example Workflow

This example will daily check https://github.com/surface-security/surface `main` branch and, if latest commit is not part of current tree, it will open a pull request in the current project/fork.

Pull request will be the exact upstream branch without any merging strategy applied, allowing full review in Github UI (or CLI for more complex conflicts).

Standard action `GITHUB_TOKEN` is not allow to open pull requests, so you need to setup a personal access token (`PAT`) in the repository secrets.


```yaml
name: upstream to PR

on:
  schedule:
    - cron: "0 12 * * *"
  workflow_dispatch:
    inputs: {}

jobs:
  autoupdate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}
      - runs: git branch -a
      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
```
