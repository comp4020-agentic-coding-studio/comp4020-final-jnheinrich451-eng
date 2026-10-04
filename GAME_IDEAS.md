# Game ideas - conversational draft

Write naturally, in English or Chinese. Fragments, comparisons, contradictions,
and "I don't know yet" are welcome. Start with the first prompt; everything else
is optional. This is brainstorming, not an approved implementation spec.

## Direction expressed so far

- A multiplayer war game that remains enjoyable with one player.
- Shells, bullets, explosions, and fighting alongside other people.
- Helldivers 2 is an inspiration; which aspects matter still needs describing.
- Ground, air, naval, and space forces, with meaningful attention to air and navy.
- Interest in territory expansion and building.
- Confirmed 2026-10-01: pure overhead 2D projection, square terrain tiles, and
  units produced stage by stage. Isometric presentation is excluded.
- Kenney's top-down tank assets look convenient.
- Aim for HD through a well-executed game and evidence of the design process.
- Combat direction recorded 2026-10-01: survival against alien monsters, strong
  hit/kill feedback, and distinct HE, incendiary and gas shells. See
  [COMBAT_DESIGN.md](COMBAT_DESIGN.md) for the user's intent, suggested rules,
  unresolved choices and a staged prototype. This is concept work, not implemented
  shell behavior or permission to build every feature immediately.

Cooperative enemies, a specific player count, tank-only controls, and support-only
air/naval/space forces have been suggested but are not settled requirements.

## Tell one short story of playing

I open the website. What do I see and control? What do I do in the first two
minutes? Someone joins: what can we now do together? Describe the exciting moment
you most want, without worrying about implementation.

Your thoughts: I think we can create account by email and password, the SMTP, which I used in Crit-7. It maybe the first thing the player will see. And the design is a video(optional) to tell the lore, short. You(player) connects the brain to a military spaceship, fully automatic, exclude the captain(you), you are the one who are assigned to a planet, to change the environment, wipe out hostile creatures, and take over the planet to make military adaptation, and wait for the later agriculture, industry teams to inbound. And you control the drop pod to land the robot avatar on the planet with some machines, weapons(I plan to use a flamethrower in this video), and after land the cool robot stand up, with a red light in the optics, with flamethrower in hand, and terrain modifier(machine) lands on the back.

Then for video
first scene: from dark, a fully covered head(yes only a head), with mask and helmet, connected with cables, red warning lights light it.
second scene: angle shifts from the head, to cables(the spaceship without normal bridge, life support system, with full of devices, weapons, made from steel!) to the belly of the bridge, and we can see the planet underneath, with edges glowing with solar light.
third scene: from land, 2 drop pods are sent from sky, and with the compact in landing. And the robot stands up facing camera, with red light on optics, and holds a flamethrower, swing heads to inspect. And maybe after 0.5 seconds, the larger drop pod lands, with a big machine expand.

After the video, we enter the 2D playing scene, on this planet. And for the overall design, I want to design two control systems, first the robot, how about a name? I prefer a normal name, not for war haha, kind of satire. Maybe Hatchling? Those type of words, and different players have different. Oh, I just realize, players can define their names. So it has no problem. Then first line is for robot controling, it can walk, control vehicles, including tanks, armored vehicles, battleships, bombers. And it can move and fire at it will. And second is the controling the defense or attack facilities, yes, can control cannons, missile launcher, maybe laser cannon to attack and defense. And after the destruction of robot, will change to the facility control automatically. And this bring to a design, if the robot, player doesn't build the replicator, to produce robot, then it will wait for a relatively long time, maybe 30 seconds to land, in this process player can only control existing facilities, and after completion of replicator, can revive in 2 seconds. 

And the core of the game is not about negotiate, it is about pure occupy and conquer. For humanity, the targets are not human, like bugs, or monsters, wipe them out cannot trigger sympathy.

The logic of the game is, I plan with no resource or single resource setting, for we need to build and expand, and we need to restrict the speed, at least cannot expand unlimited. Then with the time flow, and the killing number as credit to buy facility? This design is not fixed. And use all methods of ways, including ground, air, navy, space, there is no unlock system, only the price, player can choose what they prefered way to play, to expand. I think we can build a ball, planet, allows some players to land, and I plan to set multiple planets, player can select to land on each planet and begin the conquer, and the landing site on the planet is arbitrary, even on water is fine, there will be like oil rig platform on ocean for player to expand. 

And this game, if it needs an end? Actually, the expand itself is a meter, after fully conquered, this planet is secured. We can discuss it.


## What do the different forces let me do?

For ground, air, navy, and space, describe what you want to feel or accomplish.
Do I directly pilot a unit, command units, request support, switch between roles,
or mix those approaches? Which force should receive the most player attention?

Your thoughts:
Ground, let me think, some units, the infantry as robots, they can by applied as defense, sentinels and attackers. But I think the logic of attackers maybe complicated? So this function is in consideration. And cannons, big one, and the use of it is in a big range, we can use an aim mark to assign the fire spot. And I plan to add 3 shells, HE, incendiary shell, and gas shell. And missile launchers, but I think if they collide? Same in the map, we assign a spot, and it covers the area, oh cover the area, the fire mode is different. Then missile is for area control. And I plan to set those facilities will fire in its time cooling, in loop at the last assigned spot. And tank, we cancel armored vehicle, only tank, the tank has two types, first ordinary main gun with a machine gun, second is a flaming tank with gas tank launch, can launcher to farther position and expand into a gas area. And next facility, machine gun / flamer / gas shell launcher, in a fixed area, as sentinel. And here a question, if we add the automatically find and shot, the AI system for machine gun, will burden the RAM? If so, then only to manual control. 

List: facilities: missile launcher, big cannon, machine gun tower all 360 degree. vehicle: tank

Air, I think hostile has no air force, then all about air to ground jets. Hmm, I am thinking about two modes? First player control jets, and we don't need the realistic flight, but can have some like radius for turning based on speed? And drop bombs to enemies. And two types of jets, first is bomber, still three shells, and maybe some modes on drop bombs? The big bomb in a precise area, and carpet bombing, I think for incendiary and gas bomb, the second type maybe effective. And the aim, I plan to design the bombing area aim before the jet, for save a time for player to react the target to bomb. And second is like A-10 or AC-130 type, hover or dive use machine gun to bomb and shoot the targets, you can fully refer on the two famous jets attack logic. And I think the AC-130 style is quite fun, hover in the sky, and attack from above haha. And the logic, I think if you can pick one? First we set the enemy can anti air, then we need to set HP for jets, and second, we set fuel and ammo for them, when fuel is off, then it crashes, we print a new robot for player, so it is a penalty before you build the replicator to play air force. And next, if I can design the logic like cannon bombing? We assign a place, farther, and the bomber, A-10, and AC-130 like jets will bomb the area. And the radius is around an airport, the airport can be deployed by the spaceship, so it is global deployment, on a planet, but can be destroyed.

List: bomber, A-10 like, AC-130 like.

Navy: Haha first I think about aircraft carrier, it is as a water based airport, so no other logic, it can move, and can be set as a fly point for air force. And then the battleships, with cannons, the range is shorter than ground big cannon, and I think we disable the map lock, it can only attack the object in the screen. And if I can design the rotation of the turrets? The turrets need time to move to aimed angle? And the movement, hmm, now I want to add some traits for those vehicles, more works, like for tanks, it can turn in its place unlike car. And I am thinking if we need aquatic enemies? No for now? 

List: aircraft carrier, battleship

Space: I think it does not need the physical spaceship in this stage, just we order orbital strikes. Fully global, but need to wait a time based on distance, for spaceship needs to move on to that area. And all fire barrage, big area, and still 3 types of shells! 

List: one spaceship without entity.

And overall rule I expect but don't know if feasible, if we can make effect like ballistic and bombed effect, like fire and gas area? 
## How do fighting, building, and territory connect?

What are we fighting for? What changes when we capture somewhere? What can we
build, and how does it help? Are enemies computer-controlled, other players, or both?

Your thoughts:
We are fighting for the occupation and threat neutralization of hostile creatures, and for concise, we set all creatures are hostile. Buildings, if we can build in tiles? Square or hexagon? And I think they should have different sizes based on the power, we can design them later. The captured areas can be built on our facilities. So the orbital strike's one function, is to clear an area, and let airport to be deployed. And those area can be taken back by hostiles, but the concrete logic is not settled, for I think we can express in multiple ways, a value, or actual attacks by hostiles can result in the lose of the lands. And for ocean, the question as before, if there will be aquatic enemies, if so then use same logic, if not, then there are free lanes on ocean. I think we set enemies as computer-controlled, the logic is the same, they repel anything out of the planet, will destroy anything from player, the territory, infantries. 

## Alone, together, and returning later

What remains fun alone? What becomes different with teammates? What should be
saved after leaving? Should the world pause when empty, and what happens after defeat?

Your thoughts:
I plan to set each one can play alone, and can join or set the room as private or public. If join, they can select different planet, or the same planet as other players, and we need to restrict maximum players in one room. I think there will be minimal difference, they fight for enemies together, and maybe we can set the difficulty harder if there are multiple players in one planet. Saved, I think the current facilities, and location on the planet, other player cannot destroy the facilities of other players, and infantry will vanish, rest like tank, I think can preserve to the leaving location. But states will be saved only on the save of the host, the host can see the saved state after re-enter the room. Defeat, I think there is no real defeat, but if you mean it, then all facilities are destroyed, can only use orbital strike to open the site and play again.

## What matters most, and what can wait?

Name up to three things that would make this feel like your game. Name anything
you would happily simplify. Mention visual references and control preferences,
including how you imagine playing on a phone.

Your thoughts:
Simplification, I think there will be many, you can discuss with me! And on phone, then like left area is moving, right is attacking? We see buttoms for shell type change, attack, left a button to control direction of movement? And we can open map, it can navigate long range to bombardment, we move fingers on screen, and in devtool of chrome, we click and hold, and drag to move the area?

## Constraints to carry into a later spec

- The [course brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
  requires multi-user shared state, updates within about one second, persistence,
  and the published portfolio. Combat responsiveness needs separate evaluation.
- [fly.toml](fly.toml) fixes one shared-cpu-1x machine with 256 MB RAM and a
  persistent volume at /data. Capacity has not been measured.
- A personal 16 GB mini-PC is available. Using it as a required production
  backend is not established as permitted by the course contract. It could be
  useful for development and controlled testing without that dependency.
- After discussing these ideas, derive a bounded game design, technical choices,
  acceptance checks, and explicit deferred features. Do not treat examples here
  as implementation authorization.
