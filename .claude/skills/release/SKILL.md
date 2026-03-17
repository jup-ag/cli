---
name: release
description: Draft a new release by updating CHANGELOG.md and bumping the version in package.json
disable-model-invocation: true
---

# Release

Draft a new release by updating CHANGELOG.md and bumping the version in package.json.

## Important

- **Do NOT create or push git tags.** CI creates the tag automatically when the version bump lands on `main`.
- **Only modify `CHANGELOG.md` and `package.json`.** Do not touch any other files.

## Steps

### 1. Pre-flight checks

Run these checks before proceeding:

- **Branch check:** Verify the current branch is `main`. If not, stop and tell the user.
- **Clean work tree:** Run `git status` to check for uncommitted changes. If the work tree is dirty, ask the user to confirm they want to ignore the changes before continuing.

### 2. Determine the current and next version

- Read the current version from `package.json`.
- List all git tags matching `v*` sorted by version descending. The latest tag is the current release.
- Gather all commits from the latest tag to HEAD using `git log <latest-tag>..HEAD`. Use the full log (not `--oneline`) so commit bodies are available for writing better descriptions.
- If there are no new commits since the last tag, stop and tell the user there is nothing to release.

### 3. Compute the version bump

This project is pre-v1. Apply these rules based on the actual nature of the changes (not just the commit prefix):

- **Minor bump** (0.x.0): if any commit introduces new functionality or contains `BREAKING CHANGE`
- **Patch bump** (0.x.y): for everything else (bug fixes, docs, CI, refactors, etc.)

Parse the current version from package.json, apply the bump, and determine the new version string.

### 4. Update CHANGELOG.md

If CHANGELOG.md does not exist, create it. If it does, read it first, then prepend the new release section.

The format for each release section:

```markdown
## vX.Y.Z

### Features
- description (commit-hash)

### Bug Fixes
- description (commit-hash)

### Improvements
- description (commit-hash)
```

Group commits into these categories. Use the conventional commit prefix as a starting point, but recategorise based on the actual change if the prefix is misleading:

- Features — new functionality or meaningful changes to existing commands
- Bug Fixes — actual bug fixes
- Improvements — everything else (docs, CI, refactors, chores, etc.)

Omit any category section that has no entries. Exclude version bump commits (e.g. `chore: bump version to vX.Y.Z`). Use the short commit hash (7 chars) in parentheses. Strip the conventional commit prefix from the description — just use the human-readable part. Rephrase descriptions where necessary to be more understandable, capitalised, and properly formatted (e.g. use backticks for command names, file names, and config values).

The file should have a top-level `# Changelog` heading, followed by release sections in reverse chronological order (newest first).

### 5. Bump package.json version

Update the `"version"` field in package.json to the new version string (without the `v` prefix).

### 6. Commit and push

- Stage CHANGELOG.md and package.json with `git add`.
- Show the user the staged diff with `git diff --cached`.
- Tell the user the version bump (e.g. `0.2.2 → 0.3.0`) and ask for confirmation before committing.
- Once confirmed, commit with message `chore: release vX.Y.Z` and push to `main`.
