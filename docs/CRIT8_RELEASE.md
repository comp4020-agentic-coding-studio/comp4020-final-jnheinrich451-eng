# Crit 8 release verification

Date: 5 October 2026. First deployed checkpoint: `cce694c`.
Live app: https://comp4020-final-jnheinrich451-eng.fly.dev/

## Verified

- All 161 domain/HTTP tests and type checking passed before release. The evidence
  checker resolves the real baseline and prototype checkpoint references.
- The Docker image passed the supplied root/README invariants and course
  page/asset verifier under a 256 MB local memory limit.
- First Fly deployment created one shared-CPU machine in Sydney with 256 MB RAM
  and one 1 GB `data` volume mounted at `/data`, using the unchanged course config.
- The course `verify-deploy.sh` found HTTP 200 for the live page, `/app.js` and
  `/style.css`. Browser checks found no page errors, and the complete live README
  matched the repository file.
- Two separate guest browser contexts opened the live game at 1920x1080 and
  390x844. Screenshots were inspected; neither viewport required page scrolling.
- A test guest placed one sentry at tile (28, 18). The second guest received the
  construction through SSE without reloading. This one observation took 16 ms
  from initiating the write; it is not a latency benchmark or capacity result.
- The same guest and construction were retained through reload, a new browser
  context with the saved cookie, and a restart of the Fly machine. The sentry was
  left in the live world as the verified saved trace.

These were agent-driven checks, not independent human playtesting. Sustained
combined-forces load, campaign balance and four-player capacity remain unproven.
Local screenshots and session-bearing test artifacts stay in ignored
`.local/release-check/`; no guest cookie is published.

## Publication status

The author explicitly approved publication on 5 October 2026, and the
[course repository](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng)
is now public. The final shipping step runs checks and deploys through the
[checks workflow](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/actions/workflows/checks.yml).
The `crit-8` tag is created on the deployed commit after successful verification;
GitHub's run and tag records identify that exact release without inventing
earlier development history. The installed plugin reports
version 0.14.23 with 0.14.27 available; update before the next release.

The course secret scan reviewed the publishable worktree and branch/remote/tag
history. Its sole heuristic match was the expression that reads a session token
from a request cookie; it is not an embedded credential. The local Fly token is
excluded by both `.gitignore` and `.dockerignore`. Pattern scanning cannot
guarantee absence of every possible secret.
