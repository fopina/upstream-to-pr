import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'

export class UpstreamToPr {
  gitPath = ''
  upstreamRepository: string
  upstreamBranch: string
  token: string
  currentBranch: string
  upstreamTag: string

  constructor(
    upstreamRepository: string,
    upstreamBranch: string,
    token: string,
    currentBranch: string,
    upstreamTag: string
  ) {
    this.upstreamRepository = upstreamRepository
    this.upstreamBranch = upstreamBranch
    this.token = token
    this.currentBranch = currentBranch
    this.upstreamTag = upstreamTag
  }

  async run(): Promise<void> {
    await this.fetchHEAD()

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
    const octokit = github.getOctokit(this.token)
    const {data: pullRequest} = await octokit.rest.pulls.create({
      ...context.repo,
      title: `Upstream revision ${revHead}`,
      head: branch,
      base: this.currentBranch,
      body: `Auto-generated pull request.`
    })
    core.info(`Pull request created: ${pullRequest.url}.`)
  }

  async fetchHEAD(): Promise<void> {
    if (this.upstreamTag) {
      core.info(`Checking ${this.upstreamRepository} for newer tags...`)
      return this.fetchTags()
    } else {
      core.info(
        `Checking ${this.upstreamRepository}@${this.upstreamBranch} for changes...`
      )
      await this.execGit([
        'fetch',
        this.upstreamRepository,
        this.upstreamBranch
      ])
    }
  }

  async parseOwnerRepo(): Promise<[string, string]> {
    const matches =
      this.upstreamRepository.match(
        /github.com:([a-zA-Z0-9_-]+?)\/([a-zA-Z0-9_-]+)/
      ) ||
      this.upstreamRepository.match(
        /github.com\/([a-zA-Z0-9_-]+?)\/([a-zA-Z0-9_-]+)/
      )
    if (!matches) {
      throw new Error(
        `Could not parse ${this.upstreamRepository} - only github.com repositories supported for upstream-tag`
      )
    }
    return [matches[1], matches[2]]
  }

  async fetchTags(): Promise<void> {
    const octokit = github.getOctokit(this.token)
    const [owner, repo] = await this.parseOwnerRepo()
    const res = await octokit.request(`GET /repos/${owner}/${repo}/tags`)
    console.log(res.data)
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
