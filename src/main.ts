import * as core from '@actions/core'
import {UpstreamToPr} from './upstream-to-pr'

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token', {required: true})
    const upstreamRepository: string = core.getInput('upstream-repository', {
      required: true
    })
    const upstreamBranch: string = core.getInput('upstream-branch') || 'main'
    // github.context does not expose REF_NAME nor HEAD_REF, just use env...
    // try GITHUB_HEAD_REF (set if it is a PR) and fallback to GITHUB_REF_NAME
    const currentBranch =
      process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || ''

    await new UpstreamToPr().run(
      upstreamRepository,
      upstreamBranch,
      token,
      currentBranch
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
