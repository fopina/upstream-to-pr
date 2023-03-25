import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'

export class UpstreamToPr {
  gitPath = ''

  async run(
    upstreamRepository: string,
    upstreamBranch: string,
    token: string,
    currentBranch: string
  ): Promise<void> {
    core.info(`Checking ${upstreamRepository}@${upstreamBranch} for changes...`)

    await this.execGit(['fetch', upstreamRepository, upstreamBranch])

    const revList = (
      await this.execGit(['rev-list', `HEAD..FETCH_HEAD`])
    ).stdout.trim()
    // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    core.debug(`revList: [${revList}]`)
    if (!revList) {
      core.info('Nothing new here, move along.')
      return
    }

    const revHead = (
      await this.execGit(['rev-parse', '--short', 'FETCH_HEAD'])
    ).stdout.trim()
    const branch = `upstream-to-pr/rev-${revHead}`

    // check if branch already exists - this require a clone with full fetch depth
    // `fetch-depth: 0` in github checkout action
    const branches = await this.execGit(['branch', '-a'])
    if (branches.stdout.includes(`${branch}\n`)) {
      core.info('Branch already exists, skipping.')
      return
    }

    await this.execGit(['checkout', '-b', branch, 'FETCH_HEAD'])
    await this.execGit(['push', '-u', 'origin', branch])

    const context = github.context
    const octokit = github.getOctokit(token)
    const {data: pullRequest} = await octokit.rest.pulls.create({
      ...context.repo,
      title: `Upstream revision ${revHead}`,
      head: branch,
      base: currentBranch,
      body: `Auto-generated pull request.`
    })
    core.info(`Pull request created: ${pullRequest.url}.`)
  }

  async execGit(
    args: string[],
    allowAllExitCodes = false,
    silent = false,
    customListeners = {}
  ): Promise<GitOutput> {
    // borrowed from actions/checkout - https://github.com/actions/checkout/blob/main/src/git-command-manager.ts
    if (!this.gitPath) {
      this.gitPath = await io.which('git', true)
    }
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

    result.exitCode = await exec.exec(`"${this.gitPath}"`, args, options)
    result.stdout = stdout.join('')

    core.debug(result.exitCode.toString())
    core.debug(result.stdout)

    return result
  }
}

class GitOutput {
  stdout = ''
  exitCode = 0
}
