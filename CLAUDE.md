# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git workflow

- **Work from the `mayordev` branch.** At the start of a session, check out `mayordev` and pull the latest `main` into it before making any changes, so work always starts from an up-to-date base.
- **Never create a git commit without asking first.** Confirm with the user before running `git commit`, even when a change was made at their explicit request.
- **Always ask which branch to commit to.** Don't assume a branch name without confirming it first.
- **Pull requests always target `main`, and are never merged by Claude.** Open the PR and stop — leave the merge to the user or another reviewer, even if asked to "push to main" or similar. Report the PR link back to the user instead of merging it.
