# Crit 10 reflection

Draft for author review, based on development and playtesting. The classroom
log-narration exercise is still pending.

## What was the breakthrough that moved the work forward?

My breakthrough was recognising that seeing a game work is different from being
able to explain what happened inside it. As Frontier grew into a multiplayer
game, identity, permissions and shared resources became as important as weapons.

Testing two Demo accounts in normal browser tabs exposed a problem: they shared
robot control instead of behaving as separate players. I reported the behaviour
and clarified the setup; the agent investigated session handling. This made
distinct player identity a concrete requirement rather than just a login screen.

The bridge also looked impossible to build until I understood which resource
pool it needed. Having orbital supplies did not mean the shared ground pool
could afford it. This was a reminder to check the actual rule before changing
the mechanic again.

Server logs provide another view: actor, campaign, action and accepted or denied
outcome. Frequent inputs are grouped to keep them readable. However, a disabled
button sends no request, so server logs alone cannot explain every confusing
interface state.

## What did this change about who I want to be as a software developer?

I want to understand and explain the systems I direct an agent to build. My role
includes defining rules, testing the experience and questioning whether the
evidence supports the result, rather than accepting visible success alone.

For Crit 10, I still need two classmates to enter from the deployed URL in
separate browser profiles while I narrate their actions from Fly's server logs.
That rehearsal will test whether our instrumentation tells a useful story. I
will add actual peer findings afterwards; local checks do not replace them.
