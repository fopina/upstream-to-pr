import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    // const token: string = core.getInput('token')
    const upstreamRepository: string = core.getInput('upstream-repository')
    // const upstreamBranch: string = core.getInput('upstream-branch')

    // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    core.info(`Waiting ${upstreamRepository} milliseconds ...`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
