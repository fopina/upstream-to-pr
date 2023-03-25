import {UpstreamToPr} from '../src/upstream-to-pr'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as github from '@actions/github'

describe('test upstream-to-pr', () => {
  const mExec = jest.spyOn(exec, 'exec').mockImplementation()
  const mInfo = jest.spyOn(core, 'info').mockImplementation()
  jest.spyOn(core, 'debug').mockImplementation()
  const firstInfoLine = 'Checking http://example.com/a.git@main for changes...'
  const runArgs: [string, string, string, string] = [
    'http://example.com/a.git',
    'main',
    'xXx',
    'main'
  ]

  it('does nothing if no upstream changes', async () => {
    mExec.mockResolvedValue(0)
    await new UpstreamToPr().run(...runArgs)
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
    await new UpstreamToPr().run(...runArgs)
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
    await new UpstreamToPr().run(...runArgs)
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
      title: 'Upstream revision bababa'
    })
  })
})

describe('show how the runner will run a javascript action with env / stdout protocol', () => {
  it('test runs', () => {
    process.env['INPUT_TOKEN'] = 'xxx'
    process.env['INPUT_UPSTREAM-REPOSITORY'] = '.'
    process.env['INPUT_UPSTREAM-BRANCH'] = 'develop'
    const np = process.execPath
    const ip = path.join(__dirname, '..', 'lib', 'main.js')
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    try {
      console.log(cp.execFileSync(np, [ip], options).toString())
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.stdout.toString()).toContain('Checking .@develop for changes...')
    }
  })
})
