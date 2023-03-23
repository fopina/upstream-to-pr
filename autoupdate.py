#!/usr/bin/env python

import os
import sys
import argparse
import subprocess
import requests


def build_parser():
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('upstream_repo', metavar='update-repository', help='git/http URL for the upstream project')
    parser.add_argument('token', help='github token used to create the pull request')
    parser.add_argument('--branch', default='main', help='upstream branch of the upstream project to monitor')
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)

    # this environment variables MUST be defined
    current_branch = os.environ['GITHUB_REF_NAME']
    this_repo = os.environ['GITHUB_REPOSITORY']

    subprocess.check_call(["git", "fetch", args.upstream_repo, args.branch])
    rev_list = subprocess.check_output(["git", "rev-list", f"{current_branch}..FETCH_HEAD"], text=True)
    if not rev_list:
        print("Nothing new here, move along.")
        return

    rev_head = subprocess.check_output(["git", "rev-parse", "--short", "FETCH_HEAD"], text=True).strip()
    branch = f"upstream-to-pr/rev-{rev_head}"

    # check if branch already exists - this require a clone with full fetch depth
    # `fetch-depth: 0` in github checkout action
    branches = subprocess.check_output(["git", "branch", "-a"], text=True)
    if f"{branch}\n" in branches:
        print("Branch already exists, skipping")
        exit(0)

    subprocess.check_call(["git", "checkout", "-b", branch, "FETCH_HEAD"])
    subprocess.check_call(["git", "push", "-u", "origin", branch])

    title = f"Upstream revision {rev_head}"

    r = requests.post(
        f"https://api.github.com/repos/{this_repo}/pulls",
        headers={
            "Authorization": f"token {args.token}",
        },
        json={
            "title": title,
            "head": branch,
            "base": current_branch,
            "body": "Auto-generated pull request.",
        },
    )
    r.raise_for_status()


if __name__ == "__main__":
    main()
