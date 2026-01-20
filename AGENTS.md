# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Release Workflow (Client Auto-Update)

To ensure clients can automatically update the app, you **MUST** follow these steps exclusively when releasing a new version:

1.  **Update CHANGELOG.md**:
    *   Add a new header `## vX.Y.Z` at the top.
    *   List changes clearly.

2.  **Bump VERSION file**:
    *   Update the file `VERSION` in the root directory to `vX.Y.Z`.
    *   *This is the single source of truth for the update checker.*

3.  **Bump __init__.py**:
    *   Update `__version__ = 'X.Y.Z'` in `attendance_matrix/__init__.py`.
    *   *This is used by Frappe to track the installed app version.*

4.  **Push to GitHub**:
    *   Commit all changes.
    *   Create a tag: `git tag vX.Y.Z` (Optional but recommended).
    *   **PUSH**: `git push origin main --tags`.

**Why?**
The client's valid update logic in `updates.py` checks `raw.githubusercontent.com/.../VERSION`. If this file matches the local version, no update is offered.


