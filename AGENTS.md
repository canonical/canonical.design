# Agent instructions

## Commit identity

New agent-created commits must use the configured human name and email as both
author and committer. Never use Codex, Claude, Copilot, Agent, or another tool
identity in either field. Co-author trailers do not replace the human identity.
Check `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` before each
commit; stop and ask the owner if either is missing, abbreviated, or non-human.
Do not use `--author`, `git -c`, or environment overrides to name an agent.
Preserve the original human author when amending or cherry-picking another
person's commit. Verify `git show --no-patch --format=fuller HEAD` before
pushing. Do not rewrite existing authorship or change identity configuration
without explicit approval.