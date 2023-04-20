import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'

export interface UpstreamToPrOptions {
  upstreamRepository: string
  upstreamBranch: string
  token: string
  currentBranch: string
  upstreamTag: string
  keepOld: boolean
}

export class UpstreamToPr {
  gitPath = ''
  options: UpstreamToPrOptions

  constructor(options: UpstreamToPrOptions) {
    this.options = options
  }

  async run(): Promise<void> {
    const refName = await this.fetchHEAD()

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
    const octokit = github.getOctokit(this.options.token)
    const {data: pullRequest} = await octokit.rest.pulls.create({
      ...context.repo,
      title: `Upstream ${refName} (revision ${revHead})`,
      head: branch,
      base: this.options.currentBranch,
      body: `Auto-generated pull request.`
    })
    core.info(`Pull request created: ${pullRequest.url}.`)

    if (!this.options.keepOld) {
      for (const oldBranch of branches.stdout.split('\n')) {
        const c = oldBranch.trim().replace('remotes/origin/', '')
        if (c.startsWith('upstream-to-pr/rev-') && c !== branch) {
          core.info(`Deleting branch ${c}`)
          this.execGit(['push', 'origin', `:${c}`])
        }
      }
    }
  }

  async fetchHEAD(): Promise<string> {
    if (this.options.upstreamTag) {
      core.info(`Checking ${this.options.upstreamRepository} for newer tags...`)
      return `tag ${await this.fetchTags()}`
    } else {
      core.info(
        `Checking ${this.options.upstreamRepository}@${this.options.upstreamBranch} for changes...`
      )
      await this.execGit([
        'fetch',
        this.options.upstreamRepository,
        this.options.upstreamBranch
      ])
      return `branch ${this.options.upstreamBranch}`
    }
  }

  async parseOwnerRepo(): Promise<[string, string]> {
    const matches =
      this.options.upstreamRepository.match(
        /github.com:([a-zA-Z0-9_-]+?)\/([a-zA-Z0-9_-]+)/
      ) ||
      this.options.upstreamRepository.match(
        /github.com\/([a-zA-Z0-9_-]+?)\/([a-zA-Z0-9_-]+)/
      )
    if (!matches) {
      throw new Error(
        `Could not parse ${this.options.upstreamRepository} - only github.com repositories supported for upstream-tag`
      )
    }
    return [matches[1], matches[2]]
  }

  async fetchTags(): Promise<string> {
    const octokit = github.getOctokit(this.options.token)
    const [owner, repo] = await this.parseOwnerRepo()
    const res = await octokit.request(`GET /repos/${owner}/${repo}/tags`)
    const re = new RegExp(`${this.options.upstreamTag}$`)
    let tagName = null
    for (const tag of res.data) {
      if (tag.name.match(re)) {
        tagName = tag.name
        break
      }
    }
    if (tagName) {
      core.info(`Updating to tag ${tagName}...`)
      await this.execGit(['fetch', this.options.upstreamRepository, tagName])
    } else {
      core.info(`No matching tags found, ignoring.`)
    }
    return tagName
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
