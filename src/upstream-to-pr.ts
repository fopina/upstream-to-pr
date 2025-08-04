import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'

export type PullRequest = {
  url: string
  number: number
}

const BRANCH_PREFIX = 'upstream-to-pr/rev-'
// GitHub PRs messages have a max body size limit of 65536
const PR_BODY_MAX_CHARACTERS = 60000

export interface UpstreamToPrOptions {
  upstreamRepository: string
  upstreamBranch: string
  token: string
  currentBranch: string
  upstreamTag: string
  keepOld: boolean
  reviewers: string[]
  team_reviewers: string[]
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
      await this.execGit(['rev-list', `HEAD..FETCH_HEAD`, '--pretty=oneline'])
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
    const branch = `${BRANCH_PREFIX}${revHead}`

    // check if branch already exists - this require a clone with full fetch depth
    // `fetch-depth: 0` in github checkout action
    const branches = await this.execGit(['branch', '-a'])
    if (branches.stdout.includes(`${branch}\n`)) {
      core.info('Branch already exists, skipping.')
      return
    }

    await this.execGit(['checkout', '-b', branch, 'FETCH_HEAD'])
    await this.execGit(['push', '-u', 'origin', branch])

    await this.createPR(refName, revHead, revList)

    if (!this.options.keepOld) {
      for (const oldBranch of branches.stdout.split('\n')) {
        const c = oldBranch.trim().replace('remotes/origin/', '')
        if (c.startsWith(BRANCH_PREFIX) && c !== branch) {
          core.info(`Deleting branch ${c}`)
          this.execGit(['push', 'origin', `:${c}`])
        }
      }
    }
  }

  async createPR(
    refName: string,
    revHead: string,
    revList: string
  ): Promise<void> {
    const branch = `${BRANCH_PREFIX}${revHead}`
    const context = github.context
    const octokit = github.getOctokit(this.options.token)

    let bodyHeader
    let changeList = revList
    if (changeList.length > PR_BODY_MAX_CHARACTERS)
      changeList = 'Commit summary omitted as it exceeds maximum message size.'

    try {
      const [owner, repo] = await this.parseOwnerRepo()
      bodyHeader = `Integrating latest changes from [${owner}/${repo}](https://github.com/${owner}/${repo}) ${refName}`
      changeList = changeList.replace(
        /(\W)(#\d+)(\b)/g,
        `$1${owner}/${repo}$2$3`
      )
    } catch (e) {
      bodyHeader = `Integrating latest changes from ${this.options.upstreamRepository} ${refName}`
    }
    const {data: pullRequest} = await octokit.rest.pulls.create({
      ...context.repo,
      title: `Upstream ${refName} (revision ${revHead})`,
      head: branch,
      base: this.options.currentBranch,
      body: `${bodyHeader}

${changeList}`
    })
    core.info(`Pull request created: ${pullRequest.url}.`)
    core.setOutput('pull-request-url', pullRequest.url)

    /*
    if (
      this.options.reviewers.length > 0 ||
      this.options.team_reviewers.length > 0
    ) {
      core.info(`Requesting reviewers for pull request: ${pullRequest.url}.`)
      await this.requestReviewers(pullRequest as PullRequest)
    }
    */
  }

  async requestReviewers(pullRequest: PullRequest): Promise<void> {
    const context = github.context
    const octokit = github.getOctokit(this.options.token)
    const reviewers = this.options.reviewers
    const team_reviewers = this.options.team_reviewers

    const review_payload: {reviewers?: string[]; team_reviewers?: string[]} = {}
    if (reviewers.length > 0) {
      review_payload['reviewers'] = reviewers
    }
    if (team_reviewers.length > 0) {
      review_payload['team_reviewers'] = team_reviewers
    }

    await octokit.rest.pulls.requestReviewers({
      ...context.repo,
      pull_number: pullRequest.number,
      ...review_payload
    })

    core.info(
      `Reviewers requested for pull request: ${pullRequest.url}. Reviewers: ${reviewers}, team_reviewers: ${team_reviewers}`
    )
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
    const res = await octokit.rest.repos.listTags({
      owner,
      repo,
      orderBy: {field: 'tagger.date', direction: 'desc'}
    })
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
      return tagName
    } else {
      core.info(`No matching tags found, ignoring.`)
      return ''
    }
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
