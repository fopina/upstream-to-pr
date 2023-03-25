import {run} from '../src/upstream-to-pr'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as exec from '@actions/exec'
import * as core from '@actions/core'

describe('test upstream-to-pr', () => {
  const mExec = jest.spyOn(exec, 'exec')
  const mInfo = jest.spyOn(core, 'info')

  it('empty stdout', async () => {
    mExec.mockResolvedValue(0)
    await run('http://example.com/a.git', 'main', 'xXx', 'main')
    expect(mExec).toBeCalledTimes(2)
    expect(mInfo).toBeCalledTimes(2)
    expect(mInfo).toHaveBeenNthCalledWith(
      1,
      'Checking http://example.com/a.git@main for changes ...'
    )
    expect(mInfo).toHaveBeenNthCalledWith(2, 'Nothing new here, move along.')
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
      expect(e.stdout.toString()).toContain(
        'Checking .@develop for changes ...'
      )
    }
  })
})
