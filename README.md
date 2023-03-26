# upstream-to-pr

Yet another action to keep your fork in sync with upstream.

Why? Most I could find would either:
*  `--hard-reset` main branch with the upstream one (hey, it's a fork...!)
* merge upstream immediately (or try to) lacking conflict resolution

This one just fetches upstream branch (default to `main`) and pushes it to your fork as a new branch.  
It doesn't try to merge.  
It doesn't replace anything.  
It will open a pull-request and Github UI will allow you to merge it and resolve (simple) conflicts.

To open the pull request, standard action `GITHUB_TOKEN` is not enough, so personal access token with enough access needs to be provided.

As it inspects target branch history (in your fork) to check if there is anything new in upstream, it requires a full checkout: that means `full-depth: 0` with `actions/checkout`



## Usage

See [action.yml](action.yml)

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
      - uses: actions/checkout@v3
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
      - uses: actions/checkout@v3
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
      - uses: actions/checkout@v3
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
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          token: ${{ secrets.PAT }}

      - uses: fopina/upstream-to-pr@v1
        with:
          token: ${{ secrets.PAT }}
          upstream-repository: https://github.com/surface-security/surface
          upstream-tag: 'v1\..*'
```


