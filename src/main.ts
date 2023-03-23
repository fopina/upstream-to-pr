import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'

async function run(): Promise<void> {
  try {
    //const token: string = core.getInput('token')
    const upstreamRepository: string = core.getInput('upstream-repository')
    const upstreamBranch: string = core.getInput('upstream-branch')

    // these environment variables MUST be defined
    //const currentBranch = process.env.GITHUB_REF_NAME
    //const thisRepo = process.env.GITHUB_REPOSITORY

    core.info(
      `Checking ${upstreamRepository}@${upstreamBranch} for changes ...`
    )

    // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    core.debug(`Debug test`)
    execGit(['fetch', upstreamRepository, upstreamBranch])
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function execGit(
  args: string[],
  allowAllExitCodes = false,
  silent = false,
  customListeners = {}
): Promise<GitOutput> {
  // borrowed from actions/checkout - https://github.com/actions/checkout/blob/main/src/git-command-manager.ts

  const gitPath = await io.which('git', true)
  const result = new GitOutput()

  const defaultListener = {
    stdout: (data: Buffer) => {
      stdout.push(data.toString())
    }
  }

  const mergedListeners = {...defaultListener, ...customListeners}

  const stdout: string[] = []
  const options = {
    silent,
    ignoreReturnCode: allowAllExitCodes,
    listeners: mergedListeners
  }

  result.exitCode = await exec.exec(`"${gitPath}"`, args, options)
  result.stdout = stdout.join('')

  core.debug(result.exitCode.toString())
  core.debug(result.stdout)

  return result
}

class GitOutput {
  stdout = ''
  exitCode = 0
}

run()
