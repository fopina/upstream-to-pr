import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'

async function run(): Promise<void> {
  try {
    // const token: string = core.getInput('token')
    const upstreamRepository: string = core.getInput('upstream-repository')
    // const upstreamBranch: string = core.getInput('upstream-branch')

    // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    core.info(`Waiting ${upstreamRepository} milliseconds ...`)
    core.debug(`Debug test`)

    // const stdout: string[] = []
    const options = {}
    const gitPath = await io.which('git', true)

    const exitCode = await exec.exec(`"${gitPath}"`, ['status'], options)
    //result.stdout = stdout.join('')

    core.debug(exitCode.toString())
    //core.debug(stdout)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
