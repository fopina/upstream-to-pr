import {
  UpstreamToPr,
  UpstreamToPrOptions,
  PullRequest
} from '../src/upstream-to-pr'
import * as process from 'process'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as github from '@actions/github'

const mExec = jest.spyOn(exec, 'exec').mockImplementation()
const mInfo = jest.spyOn(core, 'info').mockImplementation()
process.env['GITHUB_REPOSITORY'] = 'xxx'
jest.spyOn(core, 'debug').mockImplementation()

// default options based on action.yaml
const defaultOptions: UpstreamToPrOptions = {
  upstreamRepository: 'http://github.com/god/world.git',
  upstreamBranch: 'main',
  token: 'xXx',
  currentBranch: 'main',
  upstreamTag: '',
  keepOld: false,
  reviewers: [],
  team_reviewers: []
}

function gitMock(opts: {branchList?: string; revParse?: string | null}) {
  return async (...args: any[]) => {
    if (args[1]) {
      switch (args[1][0]) {
        case 'rev-list':
          args[2]?.listeners?.stdout!(Buffer.from('x'))
          break
        case 'rev-parse':
          if (opts.revParse !== null) {
            args[2]?.listeners?.stdout!(Buffer.from(opts.revParse ?? 'bababa'))
          }
          break
        case 'branch':
          args[2]?.listeners?.stdout!(
            Buffer.from(opts.branchList ?? 'upstream-to-pr/rev-\n')
          )
          break
      }
    }
    return 0
  }
}

describe('test upstream-to-pr with branch', () => {
  const firstInfoLine =
    'Checking http://github.com/god/world.git@main for changes...'

  it('does nothing if no upstream changes', async () => {
    mExec.mockResolvedValue(0)
    await new UpstreamToPr(defaultOptions).run()
    // fetch, rev-list
    expect(mExec).toBeCalledTimes(2)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Nothing new here, move along.')
  })

  it('does nothing if branch already exists', async () => {
    mExec.mockImplementation(gitMock({revParse: null}))
    await new UpstreamToPr(defaultOptions).run()
    // fetch, rev-list, rev-parse, branch
    expect(mExec).toBeCalledTimes(4)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Branch already exists, skipping.')
  })

  it('creates PR if branch is new', async () => {
    mExec.mockImplementation(
      gitMock({
        branchList: 'upstream-to-pr/rev-\nother/branch\nupstream-to-pr/rev-xx\n'
      })
    )
    const octoMock = github.getOctokit('x')
    const createMock = jest
      .spyOn(octoMock.rest.pulls, 'create')
      .mockResolvedValue({
        data: {
          url: 'http://git.url/to/pr',
          number: 123
        }
      } as any)
    jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)
    await new UpstreamToPr(defaultOptions).run()
    // fetch, rev-list, rev-parse, branch, checkout, push, push :, push :
    expect(mExec).toBeCalledTimes(8)
    expect(mExec).toHaveBeenNthCalledWith(
      7,
      expect.anything(),
      ['push', 'origin', ':upstream-to-pr/rev-'],
      expect.anything()
    )
    expect(mExec).toHaveBeenNthCalledWith(
      8,
      expect.anything(),
      ['push', 'origin', ':upstream-to-pr/rev-xx'],
      expect.anything()
    )
    expect(mInfo).toBeCalledTimes(4)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(
      2,
      'Pull request created: http://git.url/to/pr.'
    )
    expect(mInfo).toHaveBeenNthCalledWith(
      3,
      'Deleting branch upstream-to-pr/rev-'
    )
    expect(mInfo).toHaveBeenNthCalledWith(
      4,
      'Deleting branch upstream-to-pr/rev-xx'
    )
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from [god/world](https://github.com/god/world) branch main

x`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
  })

  it('creates PR if branch is new and keep old PRs', async () => {
    mExec.mockImplementation(
      gitMock({
        branchList: 'upstream-to-pr/rev-\nother/branch\nupstream-to-pr/rev-xx\n'
      })
    )
    const octoMock = github.getOctokit('x')
    const createMock = jest
      .spyOn(octoMock.rest.pulls, 'create')
      .mockResolvedValue({
        data: {
          url: 'http://git.url/to/pr',
          number: 123
        }
      } as any)
    jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)
    const newRunArgs: UpstreamToPrOptions = {...defaultOptions, keepOld: true}
    await new UpstreamToPr(newRunArgs).run()
    // fetch, rev-list, rev-parse, branch, checkout, push
    expect(mExec).toBeCalledTimes(6)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(
      2,
      'Pull request created: http://git.url/to/pr.'
    )
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from [god/world](https://github.com/god/world) branch main

x`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
  })
})

describe('test upstream-to-pr owner and repo parser', () => {
  it('parses repo and owner from URL', async () => {
    const [owner, repo] = await new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'http://github.com/god/world.git'
    }).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from URL with trailing slash', async () => {
    const [owner, repo] = await new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'http://github.com/god/world/'
    }).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from URL without .git', async () => {
    const [owner, repo] = await new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'http://github.com/god/world'
    }).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from GIT URL', async () => {
    const [owner, repo] = await new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'git@github.com:god/world.git'
    }).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('errors on non-github URL', async () => {
    const promise = new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'git@gitlab.com:god/world.git'
    }).parseOwnerRepo()
    expect(promise).rejects.toThrow(
      `Could not parse git@gitlab.com:god/world.git - only github.com repositories supported for upstream-tag`
    )
  })
})

describe('test upstream-to-pr update-tag', () => {
  const firstInfoLine =
    'Checking http://github.com/god/world.git for newer tags...'
  const octoMock = github.getOctokit('x')
  const requestMock = jest
    .spyOn(octoMock.rest.repos, 'listTags')
    .mockResolvedValue({
      status: 200,
      data: [
        {
          name: 'random/tag'
        },
        {
          name: 'v1.12.1-dev'
        },
        {
          name: 'v1.10.1'
        }
      ]
    } as any)
  jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)

  it('fetches matching tag', async () => {
    await new UpstreamToPr({
      ...defaultOptions,
      upstreamTag: 'v1\\.\\d+\\.\\d+'
    }).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.10.1...')
    // fetch
    expect(mExec).toBeCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith({
      orderBy: {direction: 'desc', field: 'tagger.date'},
      owner: 'god',
      repo: 'world'
    })
  })

  it('fetches any tag', async () => {
    await new UpstreamToPr({
      ...defaultOptions,
      upstreamTag: 'v.*'
    }).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.12.1-dev...')
    // fetch
    expect(mExec).toBeCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith({
      orderBy: {direction: 'desc', field: 'tagger.date'},
      owner: 'god',
      repo: 'world'
    })
  })

  it('skips on missing match', async () => {
    await new UpstreamToPr({
      ...defaultOptions,
      upstreamTag: 'v3..*'
    }).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(
      2,
      'No matching tags found, ignoring.'
    )
    expect(mExec).not.toHaveBeenCalled()
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith({
      orderBy: {direction: 'desc', field: 'tagger.date'},
      owner: 'god',
      repo: 'world'
    })
  })

  it('creates PR if tag is new', async () => {
    mExec.mockImplementation(gitMock({}))
    const createMock = jest
      .spyOn(octoMock.rest.pulls, 'create')
      .mockResolvedValue({
        data: {
          url: 'http://git.url/to/pr',
          number: 123
        }
      } as any)
    await new UpstreamToPr({
      ...defaultOptions,
      upstreamTag: 'v.*'
    }).run()
    // fetch, rev-list, rev-parse, branch, checkout, push
    expect(mExec).toBeCalledTimes(7)
    expect(mExec).toHaveBeenNthCalledWith(
      7,
      expect.anything(),
      ['push', 'origin', ':upstream-to-pr/rev-'],
      expect.anything()
    )
    expect(mInfo).toBeCalledTimes(4)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.12.1-dev...')
    expect(mInfo).toHaveBeenNthCalledWith(
      3,
      'Pull request created: http://git.url/to/pr.'
    )
    expect(mInfo).toHaveBeenNthCalledWith(
      4,
      'Deleting branch upstream-to-pr/rev-'
    )
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from [god/world](https://github.com/god/world) tag v1.12.1-dev

x`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream tag v1.12.1-dev (revision bababa)'
    })
  })
})

describe('test upstream-to-pr createPR', () => {
  const prLine = 'Pull request created: http://git.url/to/pr.'
  const octoMock = github.getOctokit('x')
  jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)
  const createMock = jest
    .spyOn(octoMock.rest.pulls, 'create')
    .mockResolvedValue({
      data: {
        url: 'http://git.url/to/pr',
        number: 123
      }
    } as any)
  const upstreamToPRRequestReviewerMock = jest.spyOn(
    octoMock.rest.pulls,
    'requestReviewers'
  )
  const createPRArgs: [string, string, string] = [
    'branch main',
    'bababa',
    `bababa Hello World
dadead This val#1 fixes #116
`
  ]

  it('branch name', async () => {
    await new UpstreamToPr({
      ...defaultOptions
    }).createPR(...createPRArgs)
    expect(mInfo).toBeCalledTimes(1)
    expect(mInfo).toHaveBeenNthCalledWith(1, prLine)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from [god/world](https://github.com/god/world) branch main

bababa Hello World
dadead This val#1 fixes god/world#116
`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
  })
  it('branch name, non-github', async () => {
    await new UpstreamToPr({
      ...defaultOptions,
      upstreamRepository: 'https://gitlab.com/god/world'
    }).createPR(...createPRArgs)
    expect(mInfo).toBeCalledTimes(1)
    expect(mInfo).toHaveBeenNthCalledWith(1, prLine)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from https://gitlab.com/god/world branch main

bababa Hello World
dadead This val#1 fixes #116
`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
  })
  it('omit commit history when too long', async () => {
    const otherArgs: typeof createPRArgs = [...createPRArgs]
    otherArgs[2] = 'x'.repeat(70000)
    await new UpstreamToPr({
      ...defaultOptions
    }).createPR(...otherArgs)
    expect(mInfo).toBeCalledTimes(1)
    expect(mInfo).toHaveBeenNthCalledWith(1, prLine)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: `Integrating latest changes from [god/world](https://github.com/god/world) branch main

Commit summary omitted as it exceeds maximum message size.`,
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
    expect(upstreamToPRRequestReviewerMock).toBeCalledTimes(0)
  })
  it('reviewers list', async () => {
    const reviewers = ['reviewer1', 'reviewer2']
    const reviewersLine = `Requesting reviewers for pull request: http://git.url/to/pr. Reviewers: reviewer1,reviewer2, team_reviewers: `
    const upstreamMock = new UpstreamToPr({
      ...defaultOptions,
      reviewers
    })

    await upstreamMock.createPR(...createPRArgs)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, prLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, reviewersLine)
    expect(upstreamToPRRequestReviewerMock).toHaveBeenCalledWith({
      owner: 'xxx',
      pull_number: 123,
      repo: undefined,
      reviewers: ['reviewer1', 'reviewer2']
    })
  })
})

describe('test upstream-to-pr requestReviewers', () => {
  const prLine = 'Pull request created: http://git.url/to/pr.'
  const octoMock = github.getOctokit('x')
  jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)
  const requestReviewerMock = jest
    .spyOn(octoMock.rest.pulls, 'requestReviewers')
    .mockResolvedValue({
      data: {
        url: 'http://git.url/to/pr',
        number: 123
      }
    } as any)

  const requestReviewersArgs: PullRequest = {
    url: 'http://git.url/to/pr',
    number: 123
  }

  it('reviewer list', async () => {
    const reviewers = ['reviewer1', 'reviewer2']
    const team_reviewers: string[] = []
    await new UpstreamToPr({
      ...defaultOptions,
      reviewers
    }).requestReviewers(requestReviewersArgs)
    expect(mInfo).toBeCalledTimes(0)
    expect(requestReviewerMock).toHaveBeenCalledWith({
      owner: 'xxx',
      repo: undefined,
      pull_number: 123,
      reviewers
    })
  })
  it('team reviewer list', async () => {
    const reviewers: string[] = []
    const team_reviewers = ['team1', 'team2']
    await new UpstreamToPr({
      ...defaultOptions,
      team_reviewers
    }).requestReviewers(requestReviewersArgs)
    expect(mInfo).toBeCalledTimes(0)
    expect(requestReviewerMock).toHaveBeenCalledWith({
      owner: 'xxx',
      repo: undefined,
      pull_number: 123,
      team_reviewers
    })
  })
})
