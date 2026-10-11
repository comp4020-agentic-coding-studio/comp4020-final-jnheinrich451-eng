# Orbital reclamation unit — future design

11 October 2026. Author request: an orbitally delivered facility/unit that wipes
away traces of destroyed enemy facilities. **Record only; not implemented.**

Purpose: let players visibly reclaim a conquered location after the fighting,
instead of leaving alien ruins under a new human base. Reuse orbital delivery
when this becomes a playable stage.

Recommended boundary: work only on destroyed hostile structures. Persist a
separate cleanup flag; retain the site's ID, conquest history and completed
objective. Cleanup must never revive the site, erase player construction, grant
build permission that conquest already allows, or reset an entire world.

Still to design with the author: stationary facility or mobile worker; footprint,
working radius and time; automatic versus selected targets; whether it also clears
ordinary corpses/craters or restores converted terrain. Costs, salvage rewards,
durability and ownership permissions wait for the appropriate design stages.

The later [environment-modifier stage](ENVIRONMENT_MODIFIER.md) clears that
structure's cosmetic ground coating automatically after conquest. This does not
implement the orbital reclamation unit or remove the central ruin. Other cleanup
targets and salvage behavior remain unresolved.

For now, conquered ruins remain visible and walkable/buildable as before.
