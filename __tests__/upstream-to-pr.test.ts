import {UpstreamToPr} from '../src/upstream-to-pr'
import * as process from 'process'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as github from '@actions/github'

const mExec = jest.spyOn(exec, 'exec').mockImplementation()
const mInfo = jest.spyOn(core, 'info').mockImplementation()
jest.spyOn(core, 'debug').mockImplementation()

describe('test upstream-to-pr with branch', () => {
  const firstInfoLine = 'Checking http://example.com/a.git@main for changes...'
  const runArgs: [string, string, string, string, string] = [
    'http://example.com/a.git',
    'main',
    'xXx',
    'main',
    ''
  ]

  it('does nothing if no upstream changes', async () => {
    mExec.mockResolvedValue(0)
    await new UpstreamToPr(...runArgs).run()
    // fetch, rev-list
    expect(mExec).toBeCalledTimes(2)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Nothing new here, move along.')
  })

  it('does nothing if branch already exists', async () => {
    mExec.mockImplementation(async (...args) => {
      if (args[1]) {
        switch (args[1][0]) {
          case 'rev-list':
            args[2]?.listeners?.stdout!(Buffer.from('x'))
            break
          case 'branch':
            args[2]?.listeners?.stdout!(Buffer.from('upstream-to-pr/rev-\n'))
            break
        }
      }
      return 0
    })
    await new UpstreamToPr(...runArgs).run()
    // fetch, rev-list, rev-parse, branch
    expect(mExec).toBeCalledTimes(4)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Branch already exists, skipping.')
  })

  it('creates PR if branch is new', async () => {
    process.env['GITHUB_REPOSITORY'] = 'xxx'
    mExec.mockImplementation(async (...args) => {
      if (args[1]) {
        switch (args[1][0]) {
          case 'rev-list':
            args[2]?.listeners?.stdout!(Buffer.from('x'))
            break
          case 'rev-parse':
            args[2]?.listeners?.stdout!(Buffer.from('bababa'))
            break
          case 'branch':
            args[2]?.listeners?.stdout!(Buffer.from('upstream-to-pr/rev-\n'))
            break
        }
      }
      return 0
    })
    const octoMock = github.getOctokit('x')
    const createMock = jest
      .spyOn(octoMock.rest.pulls, 'create')
      .mockResolvedValue({
        data: {
          url: 'http://git.url/to/pr'
        }
      } as any)
    jest.spyOn(github, 'getOctokit').mockReturnValue(octoMock)
    await new UpstreamToPr(...runArgs).run()
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
      body: 'Auto-generated pull request.',
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream branch main (revision bababa)'
    })
  })
})

describe('test upstream-to-pr owner and repo parser', () => {
  it('parses repo and owner from URL', async () => {
    const [owner, repo] = await new UpstreamToPr(
      'http://github.com/god/world.git',
      '',
      '',
      '',
      ''
    ).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from URL with trailing slash', async () => {
    const [owner, repo] = await new UpstreamToPr(
      'http://github.com/god/world/',
      '',
      '',
      '',
      ''
    ).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from URL without .git', async () => {
    const [owner, repo] = await new UpstreamToPr(
      'git@github.com:god/world',
      '',
      '',
      '',
      ''
    ).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('parses repo and owner from GIT URL', async () => {
    const [owner, repo] = await new UpstreamToPr(
      'git@github.com:god/world.git',
      '',
      '',
      '',
      ''
    ).parseOwnerRepo()
    expect(owner).toBe('god')
    expect(repo).toBe('world')
  })

  it('errors on non-github URL', async () => {
    const promise = new UpstreamToPr(
      'git@gitlab.com:god/world.git',
      '',
      '',
      '',
      ''
    ).parseOwnerRepo()
    expect(promise).rejects.toThrow(
      `Could not parse git@gitlab.com:god/world.git - only github.com repositories supported for upstream-tag`
    )
  })
})

describe('test upstream-to-pr update-tag', () => {
  const firstInfoLine =
    'Checking http://github.com/god/world.git for newer tags...'
  const octoMock = github.getOctokit('x')
  const requestMock = jest.spyOn(octoMock, 'request').mockResolvedValue({
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
    await new UpstreamToPr(
      'http://github.com/god/world.git',
      'main',
      'xXx',
      'main',
      'v1\\.\\d+\\.\\d+'
    ).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.10.1...')
    // fetch
    expect(mExec).toBeCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith('GET /repos/god/world/tags')
  })

  it('fetches any tag', async () => {
    await new UpstreamToPr(
      'http://github.com/god/world.git',
      'main',
      'xXx',
      'main',
      'v.*'
    ).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.12.1-dev...')
    // fetch
    expect(mExec).toBeCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith('GET /repos/god/world/tags')
  })

  it('skips on missing match', async () => {
    await new UpstreamToPr(
      'http://github.com/god/world.git',
      'main',
      'xXx',
      'main',
      'v3..*'
    ).fetchHEAD()
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(
      2,
      'No matching tags found, ignoring.'
    )
    expect(mExec).not.toHaveBeenCalled()
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith('GET /repos/god/world/tags')
  })

  it('creates PR if tag is new', async () => {
    process.env['GITHUB_REPOSITORY'] = 'xxx'
    mExec.mockImplementation(async (...args) => {
      if (args[1]) {
        switch (args[1][0]) {
          case 'rev-list':
            args[2]?.listeners?.stdout!(Buffer.from('x'))
            break
          case 'rev-parse':
            args[2]?.listeners?.stdout!(Buffer.from('bababa'))
            break
          case 'branch':
            args[2]?.listeners?.stdout!(Buffer.from('upstream-to-pr/rev-\n'))
            break
        }
      }
      return 0
    })
    const createMock = jest
      .spyOn(octoMock.rest.pulls, 'create')
      .mockResolvedValue({
        data: {
          url: 'http://git.url/to/pr'
        }
      } as any)
    await new UpstreamToPr(
      'http://github.com/god/world.git',
      'main',
      'xXx',
      'main',
      'v.*'
    ).run()
    // fetch, rev-list, rev-parse, branch, checkout, push
    expect(mExec).toBeCalledTimes(6)
    expect(mInfo).toBeCalledTimes(3)
    expect(mInfo).toHaveBeenNthCalledWith(1, firstInfoLine)
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Updating to tag v1.12.1-dev...')
    expect(mInfo).toHaveBeenNthCalledWith(
      3,
      'Pull request created: http://git.url/to/pr.'
    )
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith({
      base: 'main',
      body: 'Auto-generated pull request.',
      head: 'upstream-to-pr/rev-bababa',
      owner: 'xxx',
      repo: undefined,
      title: 'Upstream tag v1.12.1-dev (revision bababa)'
    })
  })
})
