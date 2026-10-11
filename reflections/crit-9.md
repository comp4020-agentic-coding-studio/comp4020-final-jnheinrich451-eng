# Crit 9 reflection

Draft for author review, based on my development conversation and local
playtesting. This does not describe a completed classroom exercise.

## What was the breakthrough that moved the work forward?

The breakthrough was learning to refine mechanics through playtesting. At first,
I mainly wanted to introduce more weapons, vehicles and enemy facilities. Having
those components working gave me something to play, but playing also showed me
where the behavior did not match the experience I imagined. A feature could work
according to its rules and still need a different rule.

The lance tower was a useful example. I wanted a dangerous laser that players
could escape through movement. After trying it, I felt that it was too difficult
to dodge without an obstacle. I asked for the laser to chase behind the player.
The agent implemented a moving ground endpoint, but I then clarified that I
wanted the beam to remain long and only its angle to follow slowly. Trying these
versions helped me explain the difference between the effect I wanted and the
first implementation. The agent checked damage, cover and shared state, while I
judged whether the result felt right to play.

Crit 9 also pushed me to make multiplayer behavior explicit. I chose a campaign
that stays open while its owner is present. An unexpected disconnection freezes
the room for up to 30 seconds so the owner can reconnect; an explicit departure
saves and closes it. Friends cannot continue without the owner, which is a real
cost. I accepted that cost because I want deliberate shared sessions in the
owner's saved world. The [decision record](../docs/decisions/001-owner-present-campaigns.md)
compares this with letting members continue or closing immediately.

## What did this work change about who I want to be as a software developer?

I want to become better at judging behavior, rather than only asking whether a
feature has been implemented. I do not need to know every implementation detail
before starting, but I need to describe the intended experience, try the result,
and explain what should change. Keeping a design guide also helps me distinguish
the current rules from ideas we might build later.

I am learning to separate different kinds of evidence. My playtesting can reveal
an awkward mechanic. Automated tests can check that damage, saves and updates
follow the agreed rules. Neither alone proves that several people will have a
good experience on the deployed game. For multiplayer, I also need to check what
other players actually see, how conflicts are resolved, and what survives when
they return.

## Evidence and remaining checks

The [local multiplayer evidence](../docs/CRIT_9_10_EVIDENCE.md) records a
two- and four-participant browser rehearsal on 10 October: 52 observations were
under one second, with a maximum of 437 ms. These are local measurements, not
Fly latency or four-player combat-capacity results. The
[lance stage record](../docs/LASER_TOWER.md) records the later mechanical changes
and checks.

Before treating Crit 9 as complete, I still need deployed shared-update evidence
and the pod's actual response to the multiplayer decision. I have not claimed
those outcomes here.
