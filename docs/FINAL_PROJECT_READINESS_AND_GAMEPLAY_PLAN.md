# Frontier: assessment readiness and next gameplay stages

29 October 2026, Australia/Sydney. The author confirmed COMP8020 and the island
spawn formula below. This records a review and a proposed implementation sequence;
new enemy, AA, balance and planet mechanics are not implemented by this document.

## Assessment priorities

The [official final-project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
sets COMP8020 weights at process 35%, deployed application 20%, response 20%,
research note 25%. Shared identity, timely updates and persistence are baseline
requirements; additional features are not a marking checklist. The argument,
harness, tests and actual experience need to agree.

The [assessment guidance](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
suggests README 400–600 words, PROCESS 900–1100 and the research note 600–800.
These are scope guidance, not automatic word-count penalties. Marking uses
1920 x 1080 and 390 x 844. The published deadline is noon 9 November 2026.

Current audit:

| Area | Evidence now | Next action |
| --- | --- | --- |
| Research note | No root `research-note.md` found. | Author chooses and defends a literature-based position on agentic practice. Treat this as a major remaining submission task. |
| Definition of good | README already argues solo viability, useful cooperation, readable power and durable progress. | Condense the dated feature diary; make those few promises and the entry instructions easy to find. |
| README accuracy | Approximately 1,378 whitespace-delimited words. It still says the aerial gunship is unimplemented, multiple planets are deferred and new regions are unpopulated. | Reconcile with the implemented gunship, Caldera/Vesper and seeded fronts; keep balance and live capacity as unproven. |
| Process evidence | PROCESS is approximately 501 whitespace-delimited words. Its cited commits resolve; all three crit reflections exist. | Extend the author's account with selected decisions, alternatives, failures and actual acceptance evidence. Do not invent peer feedback or retroactive commits. |
| Structural evidence check | `pnpm.cmd check:evidence` passed, resolving ten cited commits. | This does not assess prose quality, sources, the missing research note or completeness of classroom playtesting. |
| Release state | There are substantial uncommitted local changes, including the latest economy, dock and rocket controls. | Validate a scoped release, then commit/push/deploy when requested. Record which exact build was played. |
| Public endpoints | Fly `/` and `/readme/` returned HTTP 200 in this review. | This is reachability only. Run real simultaneous gameplay and next-day/restart checks on Fly. |

The README and PROCESS remain the author's argument and account. This audit does
not rewrite either into an agent-authored final submission. The research note
should address a question beyond Frontier alone; project logs can illustrate a
position but cannot replace engagement with literature or its counter-case.

## A focused definition of good to discuss

**A small crew can turn coordinated combat into a foothold worth returning to:
equipment has distinct useful roles, threats and controls are understandable,
progress survives departure, and defeat remains recoverable. Solo play stays viable.**

This sharpens the existing README direction rather than making every planned
vehicle a new promise. It needs two kinds of evidence:

| Promise | Automated protection | Human judgement |
| --- | --- | --- |
| Cooperation helps | Distinct identities; shared orders, resources and outcomes; conflict handling and room isolation. | Two new players choose complementary jobs and can explain how the other person helped. |
| Heavy firepower is readable | Actual aim, cooldowns, hit areas and target eligibility agree across clients. | Players recognise a threat and understand a miss, hit, warning and recovery path during a busy fight. |
| Progress is worth returning to | Saved construction, cargo, accepted attacks, conquest and order receipts survive reload/restart. | Returning players recognise their work and have an understandable next objective. |
| Low entry/control friction | Keyboard, touch, reconnect and resize checks; visible errors and clear admission rules. | Uncoached peers enter from the URL, join the same campaign and complete a small shared objective. |

Use a short playtest sheet: player task, observation, confusion, proposed change,
accept/reject decision and the commit/test that followed. Report unsuccessful
tasks too. The creator's enjoyment is useful feedback, but not independent peer evidence.

## Stage 0: validate multiplayer before adding pressure

Completed locally in this review:

- New `tests/browser/remote-multiplayer.spec.js`: two isolated Chrome contexts,
  desktop and phone; an actual map move reaches the other player's rendered
  remote status. One measured sample was 102 ms, not a latency distribution.
- Shared movement; stale peer Stop rejected, then an informed retry accepted;
  simultaneous same-revision commands have one winner; request replay is safe.
- Browser reconnect and actual local server restart retain the winning ship
  order, actor and retry receipt. Unknown-world IDs are rejected.
- Sixteen existing naval, remote-air and remote-branch HTTP tests passed.
- Separate named-room identity and lifecycle browser checks passed invitations,
  late join, room isolation, tab return and owner freeze/resume. The lifecycle
  fixture's outdated overlapping delivery site was corrected, with no gameplay
  rule changes. Its single local propagation sample was 183 ms.

That remote fixture is a disposable legacy shared world, not a named campaign or
Fly measurement. Current remote and named-room evidence is recorded separately in
[the multiplayer report](testing/multi-user-test-report.md).

Before calling multiplayer ready for marking: two real people use separate
browser profiles on the deployed build, join one named campaign, issue remote
orders while the other moves/fights, contend for an asset, leave/rejoin, and
return after restart. Check a separate room stays isolated. Observe both browser
state and attributed server logs. Repeat with a slow connection and a resize;
reconnection must not silently replay held fire or duplicate accepted orders.

Do not equate multi-user operation with multi-machine replication. The current
course configuration and application use one machine and one persistent volume.
The earlier classroom two-machine scenario remains a separate unresolved topic;
adding another process without a shared-state design is not a load test of this model.

## Stage 1: entry page and assessment-facing clarity

The author supplied detailed planet/menu and wordmark sketches on 30 October.
[Entry visual design](ENTRY_VISUAL_DESIGN.md) records the approved direction:
unboxed rotating Caldera behind login, a brief glitch into New Game / Continue /
Join, different planet-camera compositions for each branch, a striped Frontier
SVG mark, and the Assignment 1 starfield/light reference. It separates current
code-based invitations from account email verification and records acceptance
checks. This is the design for the stage after multiplayer release validation;
the new presentation is not implemented by this record.

Refine the opening page around Continue campaign, Host and Join. Explain the
solo/co-op objective, Demo/email account choice, guest entry and the first useful
action. Keep invitations quick; no mandatory cinematic before joining. Show
loading/reconnect progress and useful failures. Preserve existing save ownership.

The visual direction can become more deliberate through typography, spacing,
one strong illustration and clear hierarchy. Judge it by whether an unfamiliar
player can start and rejoin without coaching, at both viewports. Refresh README
entry instructions and stale implemented/future claims alongside this stage.

## Stage 2: patrols, detection and island pressure

Current baseline, from `public/land-ai.js`, `public/encounter-director.js`,
`public/combat.js`, `public/vesper-world.js` and `public/aquatic-hive.js`:

- Ordinary ground enemies already acquire nearby targets, pursue, remember a
  lost target briefly and return to rally/home. Acquisition is distance-based;
  it is not a general line-of-sight system. Ordinary wandering patrols are absent.
- Natural raid events exist: an initial 3–5 active-minute wait, eight-second
  warning, 60-second surge, 30-second recovery and then a 2–5-minute quiet gap.
  One room-level director currently rotates the event focus.
- Hostile compounds replenish defenders until permanently conquered. Global
  active enemies plus reserved arrivals are capped at 24; sleeping survivors
  retain identity/HP separately. Swimmers and mobile lenses have additional caps.
- Named Vesper campaigns already use the shared director and land AI, plus their
  aquatic hive. It does not need an independent copy of the AI. New behaviors
  must be tested against its rivers, mountains and ocean restrictions.

First add short seeded patrols to an existing ground enemy, with readable states:
patrol -> detect -> pursue -> investigate last position -> return. If we describe
enemies as seeing the player, implement actual visibility tests and define what
blocks sight. Reuse bounded navigation and update sensing on a modest cadence;
do not run a full route search for every enemy every frame. A distinct trooper
type can follow if it has a role the existing roster cannot serve.

The author's confirmed **aggregate island arrival-rate multiplier** is:

`multiplier(n) = 1 + 0.7 * (n - 1)` for n >= 1; no new ambient arrivals for n = 0.

| Connected players on that island | Multiplier |
| --- | --- |
| 1 | 1.0 |
| 2 | 1.7 |
| 3 | 2.4 |
| 4 | 3.1 |

Count unique eligible connected players, not tabs or owned vehicles. Apply the
factor once to the island's total arrival rate, then distribute that allowance
fairly among its sources/player groups. It does not independently multiply every
source, enemy HP, warning frequency and capacity. Keep the global 24 cap initially
and measure normal combat before proposing a higher limit.

Recommended implementation boundaries:

- Use geographic landmass IDs separated by ocean. Rivers and mountain chains
  should not split a Vesper continent into several budgets; building a bridge
  should not merge budgets. Navigation and spawn sites still respect obstacles.
- Separate islands use their own multiplier but draw fairly from the shared
  active/reserved capacity. No accumulated backlog when capacity is full.
- Rotate spawn focus among separated groups on a large island, without applying
  the multiplier again per group. Keep warnings and safe arrival distances.
- Empty islands get no new ambient pressure; retain survivors and committed
  attacks. Do not erase or heal enemies to manufacture room in the budget.
- Aircraft over land can count toward the underlying island. Surface ships use
  the sea context; submerged submarines retain concealment. Air over open ocean
  needs an explicit policy in the aerial-enemy stage.
- Preserve seeded randomness, pause behavior and saved event progress. Conquered
  sites never regenerate or recapture territory as a side effect of patrols.

Acceptance: solo, two together, two apart, four together, duplicate tabs,
leave/rejoin, moving between islands, blocked approaches, restart during a warning,
and Vesper inland-water/mountain cases. Show admissions remain bounded and no
region starves the others. Inspect slow-tick logs and memory on the course machine.

## Stage 3: one aerial enemy and one AA vehicle together

Introduce a small, clearly warned aerial attacker. Its damage eligibility must
explicitly allow robots/vehicles and exclude actual facilities: cores, factories,
docks, runways, outposts and other structures. Recyclers/builders are vehicles even
where existing target plumbing groups them with facilities. Decide whether the
first version also attacks friendly aircraft; avoid silently adding dogfighting.
Submerged submarines should not become visible targets by accident.

The proposed AA vehicle has two clear states:

- **Mobile ground mode:** horizontal heavy machine gun, movement and ground fire.
- **Deployed AA mode:** stops and anchors, raises its weapon, locks aerial targets.
  Unoccupied deployed vehicles provide automatic air defense. Redeploy to move.

Persist mode, transition/lock and reload state. Share visible target/lock feedback.
Reject movement while deployed and avoid double firing when a human boards an
automatic unit. Air target selection, lead, range and rate need one playable
balance pass, not realistic-calibre simulation. Provide a usable counter and
escape response when aerial threats first appear. Keep them inside a measured
population/projectile budget.

## Later stages

1. **Giant encounter:** one distinctive telegraphed attack pattern, weak point or
   interrupt opportunity. Existing Bulwarks and the regenerating aquatic hive
   already fill durable-enemy roles. A larger health bar alone is not enough;
   preserve solo viability and reward coordinated positioning.
2. **Crate and orbital-shell presentation:** refine silhouettes, unfolding,
   launch/impact distinction and effects without changing saved collision or
   authoritative hit geometry. This cosmetic branch can run alongside validation.
3. **Another planet:** after Caldera and Vesper's shared systems and performance
   pass. Give the planet a tactical/environmental reason to exist, not just extra
   terrain. Never regenerate an existing campaign to introduce it.

## Order and stopping rule

Assessment evidence and live multiplayer rehearsal come first. Entry clarity and
patrol/island pressure are the next bounded work. Flying enemy plus AA follows;
bosses and another planet are optional later scope. Cosmetic art can progress
independently when it does not obscure warnings or consume the server budget.

Before the deadline, prefer finishing a trustworthy two-player experience and
the author's written argument over adding an untested unit. No release, live
gameplay validation, new balance rule or new enemy is implied by this plan.
