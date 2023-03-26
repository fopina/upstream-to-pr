import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

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
