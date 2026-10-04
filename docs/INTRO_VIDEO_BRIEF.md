# Intro video brief - conversational draft

Status: proposal, 2026-10-01. Nothing here is built. The video is optional
polish on top of the course requirements, so the game remains playable without it.
Fill in the "Your answer" lines in English or Chinese. "Use your default"
accepts the proposal written above that line.

## How it would be made

- [Remotion](https://www.remotion.dev/) describes each frame in React code and
  renders it to a video file. 3D scenes can use Three.js through
  `@remotion/three`. Remotion is free for individuals and students. Companies
  above a small size need a paid licence.
- The Remotion project lives in its own folder (`video/`) and has its own
  install. The game server, Docker image and CI never load it. Only the rendered
  file is shipped, e.g. `public/media/intro.webm` plus a poster image, kept to
  a few MB.
- Because the video is code, any change ("slower camera", "redder light") is an
  edit followed by a re-render. One codebase can also render both a 16:9 desktop
  cut and a 9:16 phone cut.
- What code does well: lighting, glow, cables, metal shapes, planets,
  atmospheres, particles, dust, camera moves, mechanical motion. What it does
  poorly: realistic human faces, cloth, fluid character acting. Your fully
  masked head and the robot both suit what code does well.

## Global decisions

1. **Visual style.**
   A: stylised 3D built in code: dark scenes, steel, red warning light, bloom.
   B: 2D illustrated/vector with parallax layers, closer to the in-game top-down art.
   C: 3D for scenes 1-2, 2D for the landing.
   Proposal: A. I can render one still frame in each style before you decide.
   Your answer: A, scientific 3D, I like metal textures with cold, reflective design.

2. **Length and playback.** Proposal: 20-30 s. It plays once after first login
   and can be skipped at any time. A "replay intro" button goes in the menu.
   Your answer: 20-30 s can perfectly do. Yes, the playback maybe in the settings menu.

3. **Words.** On-screen lore text, a voice-over, or no words? Which language?
   Proposal: 2-3 short lines of terminal-style text, English.
   Your answer: Some words, but not as subtitle, like show the name of the spaceship, and the name of the planet.

4. **Sound.** Kenney's Sci-Fi/Impact sound packs (CC0, already in assets/) can
   supply the effects. Music options: none, a simple synthesised drone, or a
   CC0 track you pick. Proposal: effects plus a low drone.
   Your answer: What is CC0 sound? I cannot find under Sci-Fi folder? Hmm, yes the sound, maybe the difficult part. Hmm, and I think maybe hard to guide you, I can only describe in roughly.

5. **Phone.** Proposal: one 16:9 cut, shown letterboxed on phones. A separate
   9:16 cut can follow later if you want one.
   Your answer: Hmm this part, actually I expect the user can play it with sideway, but I don't know if teaching team will check in sideway, I think they may test on devtool, but now sure. 

6. **Satire.** The robot gets a gentle name like "Hatchling". Should the video
   show that contrast, e.g. a cheerful corporate end card after the grim landing?
   Your answer: No haha, and I plan to let player to choose their own name, this name can be set as initial default name. 

## Design questions the video forces

The video will effectively define how the robot looks, and the game has no
settled robot design yet (the rover sprite is a placeholder).

7. **Robot.** Size relative to a human, two legs or another shape, one red
   optic or two, colour, and the flamethrower's shape (fuel tank on its back?).
   Your answer: Yes relative to human, two legs, two arms, dispersed computing units, and more like skeletons, not the strong type with solid muscle, there are many spaces with in the robots, I think if you can understand the meaning? Or I draw a reference picture? Inside the ./assets/robot concept/Robot.png. I designed spent times.

8. **The big pod.** In the game, the core is a 3x3 block that unfolds four
   panels into a cross. Should the big pod in the video unfold the same way, so
   the cutscene matches what the player then sees overhead? Proposal: yes.
   Your answer: Yes, in same way.

9. **The small pod.** Does the robot climb out of it, or does the pod itself
   open around the robot as it stands up?
   Your answer: I think we can change this scene, by activate the robot, the dark optics turns red, step one step forward and hold right arm(big gun).

## Robot reference: what I read from Robot.png

Source: `assets/robot concept/Robot.png` (local and git-ignored, see below).
Correct anything I misread.

- **Silhouette:** tall and skeletal, with an exposed spine column and piston
  rods running from the chest to the pelvis. You can see through gaps between
  parts. Armour plates are angular and sit separately on the chest, thighs,
  shins and forearms.
- **Head:** small and sunk between two large dome-shaped shoulder plates. It has
  a triangular housing with one red optic.
- **Right arm:** the whole forearm is a large weapon with two barrels. One has a
  perforated muzzle sleeve. The other has a red lens at the front. Red and
  black hoses run from the back or shoulder into the weapon.
- **Left arm:** thin. Its hand holds a grip on the weapon.
- **Legs:** long, with armoured thighs and shins. The feet are clawed, with two
  toes in front and one spur behind.
- **Material:** dark gunmetal with worn, lighter edges, slight rust, red accents. #if we can change the texture, into refective yellow paint? No rusty at all.

What the code version can match: proportions, silhouette, separate plates,
pistons, hoses, worn metal and the red optic. It will have less fine detail than
the drawing. Small bolts and greebles get simplified.

## Open questions from your answers

10. **Names.** What are the ship and the planet called? (Placeholder names are
    fine for now.) Where should the names appear: as a small system label in a
    corner, or as larger centred text?
    Your answer: The ship called Cuculidae, planet called Caidera, same as the game, the initial planet. Oh, I plan don't show the planet name, the ship name via the hull to represent. 

11. **Robot height.** About human height (~1.8 m), or taller (2.5-3 m)? This
    sets the pod sizes and how big the robot looks next to the core.
    Your answer: 2.5m, taller, the flamethrower and laswr emitter is 1.5m, quite long.

12. **The right-arm weapon.** Is it the flamethrower? If it is, should the red
    lens show a pilot flame when the robot raises it in 3b?
    Your answer: Yes the flamethrower, and the inner len, is the laser emitter, in game logic, one has short range but higher damage and laser beam has long range, and can ignite enemy.

## Shot list (revised 2026-10-02 from your answers)

Times are proposals. Edit any field. Items marked (assumed) are my guesses
where your answers left a gap.

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 1a | 0-3 s | Fixed, film directly to the head/helmet | From pure dark, the red light lit, the helmet is activated, there is no light on the helmet, we use buzz sound to express the activation. AI activates the agent. The area is not for human sustaination, then only pipes, cables, chips, radiators within, I may need to design an image as well. | Black + pulsing red | Low hum, alarm beep |
| 1b | 3-5 s | Close-up | Cables twitch or flicker with data light. A visor glint shows the pilot is "online" | Red + thin cyan data lines | Electrical crackle |
| 2a | 5-9 s | Pull back along the cables | The bridge is a machine with no seats or life support: steel, devices, racks, weapon mounts. **Ship name** appears | Cold, reflective steel, red accents | Machinery |
| 2b | 9-13 s | Tilt down through a floor port in the bridge's belly | The planet below, its rim glowing with sunlight. **Planet name** appears | Deep blue/black, bright rim | Drone swells |
| 3a | 13-16 s | Ground level, looking up | The small pod hits the ground. The big pod is still a streak high in the sky (assumed) | Planet daylight, dust | Whistle, impact |
| 3b | 16-20 s | Low angle facing the robot | The pod shell opens (assumed). The robot stands inside, dormant, optic dark. The optic turns red, the robot takes one step forward and raises its right-arm gun | Dust haze, red optic | Servo whirs, one heavy footstep |
| 3c | 20-24 s | Wider shot | ~0.5 s later the big pod lands nearby and unfolds like the in-game core: a 3x3 block opening four panels into a cross | Same | Heavy impact, hydraulics |
| end | 24-26 s | Fade | Cut to the game | - | - |

Your changes:

## References (optional)

A video is not required. Any of these help:

- A link with a timestamp ("Helldivers 2 hellpod drop, 0:42-0:50").
- Screenshots or stills from any game or film, with a note on what to take
  from each (camera angle, colour, robot shape, etc.).
- A phone photo of a paper sketch. Stick figures are fine.
- Words only: "like X, but darker / slower / more industrial".

Your references:

## Sound: describing it roughly is enough

You don't need to direct the sound precisely. Write a rough feel in the Sound
column ("heavy", "like a door slamming", "creepy hum"). For each cue I pick 2-3
candidates from Kenney's packs in `assets/Audio/` (CC0) and play them over that
shot in a preview. You pick by ear. The Kenney files are short game effects, so
the long atmospheric layers (the hum and drone) would be generated or layered in
code.

Kenney packs on disk that fit (`<pack>/Audio/*.ogg`):

- Sci-Fi Sounds: computerNoise, forceField, spaceEngine*, thrusterFire,
  impactMetal, explosionCrunch, lowFrequency_explosion, doorOpen/Close.
- Impact Sounds: impactMetal_heavy, impactPlate_heavy, footstep_concrete.

## Review loop

1. Style test: one still per candidate style. You pick one.
2. Key frames: one still per shot. You comment on composition and design.
3. Low-resolution animated preview of the whole video.
4. Feedback by timestamp, e.g. "0:07 camera too fast", "3b robot too small".
5. Final render to `public/media/`, wired into the post-login flow.
