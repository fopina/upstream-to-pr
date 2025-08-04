import * as core from '@actions/core'
import {UpstreamToPr} from './upstream-to-pr'

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token', {required: true})
    const upstreamRepository: string = core.getInput('upstream-repository', {
      required: true
    })
    const upstreamBranch: string = core.getInput('upstream-branch') || 'main'
    const upstreamTag: string = core.getInput('upstream-tag')
    const keepOld: boolean = core.getBooleanInput('keep-old')
    const reviewers: string[] = core
      .getInput('reviewers')
      .split(',')
      .map(s => s.trim())
      .filter(s => s)

    const team_reviewers: string[] = core
      .getInput('team_reviewers')
      .split(',')
      .map(s => s.trim())
      .filter(s => s)
    // github.context does not expose REF_NAME nor HEAD_REF, just use env...
    // try GITHUB_HEAD_REF (set if it is a PR) and fallback to GITHUB_REF_NAME

    const currentBranch =
      process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || ''

    await new UpstreamToPr({
      upstreamRepository,
      upstreamBranch,
      token,
      currentBranch,
      upstreamTag,
      keepOld,
      reviewers,
      team_reviewers
    }).run()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
