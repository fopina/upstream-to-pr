[![build-test](https://github.com/fopina/upstream-to-pr/actions/workflows/test.yml/badge.svg)](https://github.com/fopina/upstream-to-pr/actions/workflows/test.yml) [![codecov](https://codecov.io/gh/fopina/upstream-to-pr/branch/main/graph/badge.svg?token=KPJZVZLXOV)](https://codecov.io/gh/fopina/upstream-to-pr)

# upstream-to-pr

Yet another action to keep your fork in sync with upstream.

Why? Most I could find would either:
*  `--hard-reset` main branch with the upstream one (hey, it's a fork...!)
* merge upstream immediately (or try to) lacking conflict resolution

This one just fetches upstream branch (default to `main`) and pushes it to your fork as a new branch.  
It doesn't try to merge.  
It doesn't replace anything.  
It will open a pull-request and Github UI will allow you to merge it and resolve (simple) conflicts.

## Usage

See [action.yml](action.yml)

### Github Token

Standard action `GITHUB_TOKEN` (with proper configuration) would be enough to create pull request **BUT** it would not trigger other workflows on that PR (such as testing workflows).  
Also, if the rebase contains changes to workflows themselves (or new ones), it would be blocked as that token does not have the `workflow` permission.

You need to generate a personal access token with the following permissions (`secrets.PAT` in the examples below)
* Contents: R/W
* Workflows: R/W
* Pull Requests: R/W

**Also**, as it inspects target branch history (in your fork) to check if there is anything new in upstream, it requires a full checkout: that means `full-depth: 0` with `actions/checkout`

### Basic

```yaml
- uses: fopina/upstream-to-pr@v1
  with:    
    token: ${{ secrets.PAT }}
    upstream-repository: https://github.com/surface-security/surface
```

### Other branch

```yaml
- uses: fopina/upstream-to-pr@v1
  with:    
    token: ${{ secrets.PAT }}
    upstream-repository: https://github.com/surface-security/surface
    upstream-branch: develop
```

## Scenarios

### Daily check upstream

#### Check main branch

This example will check https://github.com/surface-security/surface `main` branch daily. Also allows for manual/API triggered checks (`workflow_dispatch`).

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
```

#### Check other branch

Looking for edge changes, keep fork in sync with upstream `develop`

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-branch: develop
```

### Daily check latest tag

#### Latest stable v1.*

`upstream-tag` matches entire tag name, so `v1.2.3-dev1` is **excluded**, even if it is the latest.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-tag: 'v1\.\d+\.\d+'
```

#### Any v*

`upstream-tag` matches entire tag name, so `v1.2.3-dev1` is **excluded**, even if it is the latest.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-tag: 'v1\..*'
```

#### Requesting reviewers or team reviewers

`reviewers` and `team_reviewers` are optional parameters that expect a comma separated string with usernames or teams respectively.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-tag: 'v1\.\d+\.\d+'
          reviewers: person1,person2
          team_reviewers: team1,team2
```

#### Getting PR API url

Upstream to PR outputs the API URL as the `pull-request-url` variable for the created Pull Request so you can use it in other steps.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        id: auto-pr
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-tag: 'v1\.\d+\.\d+'
          reviewers: person1,person2
          team_reviewers: team1,team2
      
      - name: Display output
        run: |
        echo "Pull Request API URL: ${{ steps.auto-pr.outputs.pull-request-url }}"
```