# Crit 9 reflection

Draft for author review, based on development and local playtesting, not a
completed classroom exercise.

## What was the breakthrough that moved the work forward?

My breakthrough was learning to refine mechanics through playtesting. Building
weapons and enemies gave me something concrete to evaluate: a feature could
follow its rules but still feel different from what I intended.

The lance tower made this clear. I wanted a dangerous laser that players could
dodge by moving. The first version felt difficult to escape without cover. I
asked for it to chase behind the player, then clarified that the beam should
stay long while its angle followed slowly. Trying successive versions helped
me communicate the experience more precisely. I judged the feel; the agent
implemented changes and checked damage, cover and shared state.

I also made a multiplayer tradeoff explicit: campaigns require their owner to
remain present. A brief disconnection freezes the room for a 30-second reconnect
window; leaving deliberately saves and closes it. Friends lose the ability to
continue alone, but this supports deliberate sessions in the owner's saved world.
The [decision record](../docs/decisions/001-owner-present-campaigns.md) explains
the alternatives.

## What did this change about who I want to be as a software developer?

I want to judge behavior, communicate corrections and understand the consequences
of design choices. A design guide helps separate agreed rules from future ideas.

I also need to distinguish evidence: playtesting reveals awkward mechanics;
automated checks verify rules and persistence. Our
[local multiplayer rehearsal](../docs/CRIT_9_10_EVIDENCE.md) does not establish
deployed performance. Shared-update checks on Fly and actual peer feedback remain
necessary before claiming the multiplayer experience is successful.
