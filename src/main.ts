import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')
    const upstreamRepository: string = core.getInput('upstream-repository')
    const upstreamBranch: string = core.getInput('upstream-branch')
    const context = github.context;

    core.info(
      `Checking ${upstreamRepository}@${upstreamBranch} for changes ...`
    )

    await execGit(['fetch', upstreamRepository, upstreamBranch])
    
    const revList = (await execGit(["rev-list", `${context.ref}..FETCH_HEAD`])).stdout.trim()
    // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    core.debug(`revList: [${revList}]`)
    if (!revList) {
      core.info("Nothing new here, move along.")
      return
    }

    const revHead = (await execGit(["rev-parse", "--short", "FETCH_HEAD"])).stdout.trim()
    const branch = `upstream-to-pr/rev-${revHead}`

    // check if branch already exists - this require a clone with full fetch depth
    // `fetch-depth: 0` in github checkout action
    const branches = await execGit(["branch", "-a"])
    if (branches.stdout.indexOf(`${branch}\n`) >= 0) {
      core.info("Branch already exists, skipping")
      return
    }

    await execGit(["checkout", "-b", branch, "FETCH_HEAD"])
    await execGit(["push", "-u", "origin", branch])

    
    const octokit = github.getOctokit(token)
    const { data: pullRequest } = await octokit.rest.pulls.create({
      ...context.repo,
      title: `Upstream revision ${revHead}`,
      head: branch,
      base: context.ref,
      body: `Auto-generated pull request.`
    });
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
