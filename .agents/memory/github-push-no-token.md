---
name: Pushing to GitHub from the agent sandbox
description: Why `git push` over HTTPS cannot be authenticated with the Replit GitHub connector, and what to do instead.
---

The Replit GitHub connection hands out an initialized Octokit client and a
credential-injecting `proxyFetch`, but **not** a usable raw token: the
connection's `settings` object comes back empty and `client.auth()` returns
only `{ type }`. Git over HTTPS needs the literal credential, so
`git push https://x-access-token:<token>@github.com/...` cannot be assembled
from the connector.

GitHub also refuses password authentication for Git operations, so a plain
`git push` fails with "Invalid username or token".

**Why:** the connector deliberately keeps credentials server-side; only API
calls routed through it carry them.

**How to apply:** do not burn turns hunting for the token or asking the user
for a PAT. Either push through the workspace's own Git pane (the user's
action), or, if the change is small, write it through the GitHub API with the
Octokit client. Also worth knowing: a stale
`.git/refs/remotes/<remote>/<branch>.lock` left behind by an old process
blocks `git fetch`; deleting it when no git process is running is safe.
