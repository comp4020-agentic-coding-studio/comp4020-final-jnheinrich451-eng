# Frontier: fill-in design worksheet

Started 9 October 2026. Your answers feed into [GAME_DESIGN.md](GAME_DESIGN.md).
This is a conversation aid, not a requirement to design the entire game before
we build another stage. Answers become implementation scope after we resolve
contradictions and identify a small playable step.

Write naturally in English or Chinese. Fragments, comparisons with games you
like, "not sure" and "suggest something for me" are enough. Numbers can wait:
"fast but fragile" or "a small group every so often" is useful input. Leave
unneeded sections blank. Examples below are suggestions, not your decisions.

## Start here: four short answers

Only fill this section first if the rest feels too long.

1. **Describe one fight you want to experience.** What do you see, choose to
   deploy, fight, and accomplish? A few sentences are enough.

   My answer: Okay, then some cases
   First, the landing, this part we can choose freely, and we can design there are like sentinels enemies on this land already, and if we can design algorithm, after the player choose the site, we generate some enemies around this area? And if we will have a default vision area? We can use this vision scope, you mentioned it will change according to resolution, if we can just build on this adaptation to spawn sparse enemy. 

   And the player can use a zoom out scene, to view the planet, if we can build the map into a sphere? And can drag the map to check the terrain. And we use the red mask area, half transparent to mark the enemy territories, and those are acquired by the spaceship in orbit(lore).

   The first landing I think if can in this same, we check the sphere, to check the resistance difficulty, we express by the area and transparency, the bigger red mask means the occupied area is larger, and darker red means there are more enemies inside. And we can design some types of the enemy facilities.

   And the combat experience is player should head to those areas proactively, and find enemies and clear them out, and destroy the facilities. Facilities the robot cannot destroy, must use cannons of HE type. And we can design the patrols, but in low rate, and number is not much, and outside of the view, but will get close to player.

   Enemies will get hostile when players on sight, will attack player without fear.

2. **What exactly completes the first hostile site?** For example, destroy one
   nest, destroy several nest entrances, or interact with a sabotaged machine.

   My answer: We can design some types. Like their own environment modifier, their biological facility will convert the natural land of the target planet to their own. We can present those areas in a different color and texture, different from the natural land.
   And second maybe their outposts, if we can design the biological weapon of theirs? Like a mortar, in first version. Will blast like corrosive liquid shells.
   And third, their alert station, if we enter the area of sight area of the station, they will send reinforcement. And if we don't destroy, resinforcement will be called in a fixed time interval, the reinforcement will only be called by this facility.
   And last, their city, maybe occupy the biggest area, we design their living area, and with small outputs scattered inside.
   Art style maybe it is the one we need to consider.

3. **What should its enemies make you worry about?** For example, catching your
   robot, surrounding a sentry, or a slow attacker capable of breaking its armor.

   My answer: Oh your suggestions are appealing, if we can design all of them? Catch the robot, breaking the tank, and some can throw corrosive or radiative shells to players, and if we can design the splatting damage and hit damage to target? And we can design an algorithm to consider the armor of the tank, facility, robot, ships? We use an algorithm to apply mitigated damage to our units, and we count the enemies attack into a peneration index? And we design this algorithm.

4. **When an enemy gives up chasing, what should it do?** Return to its site,
   stay nearby, or look for another nearby target? We already agreed it should
   stop following a player who gets sufficiently far away.

   My answer: Yes stop following, hmm, if we just design it wanders? Or if you can handle rest logics, like it will back to nest or city if have one nearby? We can use some units as their facilities as well. 

## Already settled: edit only if you want to change these

- Combat supports conquering a large planet. Hostile sites and map feedback
  provide visible progress.
- A conquered site stays conquered. No recapture or site-regeneration timer.
- Facilities can be deployed globally where terrain, footprint and platform
  rules permit. Conquest is not a construction permission gate.
- Enemies can destroy facilities. Losing one does not undo conquered sites.
- Facilities will have HP and numeric armor. Enemy penetration below armor
  deals zero damage; equal or greater penetration permits normal attack damage.
  Armor 2 versus penetration 2 is an example, not final balancing.
- Friendly weapons do not damage friendly players, vehicles or facilities.
- Distant enemies give up pursuit. Exact distance and subsequent behavior need
  a design choice; losing sight of them on screen is not itself a distance rule.
- One to four players is the intended experience; measured capacity is pending.
- The server currently uses 256 MB. You report that a justified RAM increase can
  be discussed with the teaching team; no new size or approval is recorded yet.

## Card A: one hostile site

Copy this card for another type later. For the first pass, one site is enough.
Candidate families: nest destruction, facility sabotage, environmental conversion.

- **Working name and appearance:**
- **Why should the player care about this place?**
- **Where is it?** Land, coast, water, or another terrain feature:
- **What must the player actually do to conquer it?**
- **How does the player recognise that objective?**
- **Who defends it?** Use an enemy name or role from Card B:
- **What starts enemy spawning?** Examples: approaching, attacking, or a visible
  alarm; say whether guards already exist before the player arrives:
- **How much pressure should spawning create?** Describe the feel before choosing
  exact intervals. Spawn speed and the maximum living population are separate:
- **What permanently changes when conquered?** Examples: the nest stops spawning,
  a defensive weapon stops operating, or the landscape changes appearance:
- **What happens to surviving enemies after completion?**
- **What should remain if players leave an unfinished fight and return?**
- **What does the map show before and after conquest?** Red fading, blue, an icon,
  and the size/shape of the area represented:

## Card B: one enemy

Copy for each important role. Start with one or two; a hunter and a facility
breaker are suggestions, not a required full roster.

- **Working name and silhouette:**
- **Main job:** What decision should it force the player to make?
- **Preferred targets:** Robot, vehicle, facility, or a priority order:
- **Movement:** Slow/fast, land/water/air, and how it approaches:
- **Attack:** Melee, projectile, or another readable action:
- **Warning and counterplay:** How can the player anticipate or avoid it?
- **Penetration:** Which facilities should it be able to hurt? Relative answers
  are enough; no need to settle all armor numbers now:
- **Durability:** Fragile, ordinary, tough; intended weapon interactions:
- **Pursuit limit:** How far feels reasonable? Is the limit measured from its
  home site, its target, or both? "Suggest a starting value" is acceptable:
- **After giving up:** What does it do, and when may it acquire a new target?
- **Spawn source and frequency:** Which site produces it, and alone or in groups?
- **Death feedback:** What makes defeating it satisfying and readable?

Exact HP, damage, speed, ranges and population caps: **leave for initial tuning**
unless you already have a preference. Any exception to the current lethal fire
and gas behavior needs an explicit decision, not an incidental armor change.

## Card C: one facility

An existing sentry is a good starting candidate; a new building is optional.

- **Name or existing facility:**
- **Its one main purpose:** Defense, recovery, bombardment, support, or another role:
- **What problem does it solve that existing equipment does not?**
- **Deployment:** Terrain, approximate footprint and any prerequisite:
- **Operation:** Automatic, directly controlled, or selectable modes:
- **Targets / support recipients:**
- **Durability:** What should threaten it? Armor tier and HP can remain tentative:
- **Range, reload or other weakness:** Qualitative descriptions are enough:
- **Enemy hit or blocked-hit feedback:**
- **At zero HP:** What stops working? What remains on the ground?
- **If someone is operating it when destroyed:** What happens to the player?
- **Replacement or repair:** Available immediately, after a delay, or later work?

If this is a recovery core, answer **how a player returns when every core is
destroyed** before enabling that failure. If it supports aircraft, also describe
what happens to a pilot whose airbase is lost.

## Later decisions: leave blank for now if you prefer

- **Planet completion:** Which set of accomplishments should count as victory?
- **Site variety:** Which additional objective would change the way we fight?
- **Map feel:** Land/coast/ocean balance, useful landmarks, travel between sites:
- **Cooperation:** What might two players do differently during the same fight?
- **Resources/economy:** Free deployment for now, passive resources, objective
  rewards, or another preference? This is separate from CPU/RAM costs:
- **Visual/audio reference:** A description, asset path or link, and specifically
  what you like about it. New art is not required to test a rule:

## Performance and a possible RAM request

You do not need to estimate programming costs. Describe the scene you want:

- **What should be happening together?** For example, a robot near a nest,
  several sentries, and a teammate bombarding from a ship:
- **Will teammates often fight in separate regions?**
- **If performance becomes tight, what matters most to preserve?** Enemy numbers,
  simultaneous fronts, responsive combat, effect density, or another priority:
- **Teaching-team guidance, if available:** What limit or increase did they say
  is possible, what justification do they want, and was anything approved?

The agent will prepare the technical evidence: current configuration, repeatable
workload, peak memory, CPU/tick time, shared-update delay, and optimizations tried.
Only then propose a RAM size and explain what player experience needs it. More
RAM does not by itself fix expensive routing or a saturated CPU. Distant-enemy
disengagement, sleeping simulation and despawning are separate design choices;
stopping pursuit does not mean disappearing, healing, or resetting a conquered site.

## What happens after you fill this in

We turn the answers into one stage brief: agreed rules, remaining questions,
affected states, save behavior, placeholder feedback and observable checks.
We build and review that stage before treating the remaining cards as a queue
of approved work. The agent handles technical state machines and test details;
your main job here is to describe the experience and consequences you want.
