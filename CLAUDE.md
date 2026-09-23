# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git workflow

- **Never create a git commit without asking first.** Confirm with the user before running `git commit`, even when a change was made at their explicit request.
- **Always ask which branch to commit to.** Don't assume a branch name (including reusing a previous one like `new`) without confirming it first.
- **Pull requests always target `main`, and are never merged by Claude.** Open the PR and stop — leave the merge to the user or another reviewer, even if asked to "push to main" or similar. Report the PR link back to the user instead of merging it.
