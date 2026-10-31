# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git workflow

- **Work from the `mayordev` branch, always starting from the latest `production`.** At the start of a session, and before starting any new feature or task, check out `mayordev` and pull the latest changes from `production` into it, so work always starts from an up-to-date base. (`production` is the repository's default branch; `main` no longer exists.)
- **Never create a git commit without asking first.** Confirm with the user before running `git commit`, even when a change was made at their explicit request.
- **Always ask which branch to commit to.** Don't assume a branch name without confirming it first.
- **Never push to `production` directly.** All changes reach `production` through a pull request.
- **When a feature or task is done, ask whether to raise a PR to `production`.** Only open the PR once the user says yes, and report the PR link back.
- **After raising a PR, ask whether to merge it into `production`.** Never merge without an explicit yes for that specific PR.

## Verification after each feature or task

- **Run a security check for ID enumeration, IDOR, and authorization bypass.** For every new or changed endpoint, confirm that sequential or guessable IDs can't be used to reach other users' records, that each record lookup checks the requester owns it or is allowed to see it, and that role and permission checks are enforced on the server, not only hidden in the UI. Report the findings with the rest of the work.
- **Run a headless browser test, but confirm before starting.** Once the work is done, ask the user before launching a headless browser test of the affected pages; run it only after they agree, and report what was tested and the results.
