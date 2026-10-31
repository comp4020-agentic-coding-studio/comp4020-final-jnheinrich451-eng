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
    Your answer: The ship called Cuculidae, planet called Caldera, same as the game, the initial planet. Oh, I plan don't show the planet name, the ship name via the hull to represent. 

11. **Robot height.** About human height (~1.8 m), or taller (2.5-3 m)? This
    sets the pod sizes and how big the robot looks next to the core.
    Your answer: 2.5m, taller, the flamethrower and laswr emitter is 1.5m, quite long.

12. **The right-arm weapon.** Is it the flamethrower? If it is, should the red
    lens show a pilot flame when the robot raises it in 3b?
    Your answer: Yes the flamethrower, and the inner len, is the laser emitter, in game logic, one has short range but higher damage and laser beam has long range, and can ignite enemy.

## Ship design: the Cuculidae (proposal, 2026-10-23)

One rule decides most of the design: **nothing aboard is built for a human
body, except the capsule that holds the commander's head.**

### Design rules

- **No human spaces.** No corridors, doors, stairs, seats, handrails or windows.
  Gaps between machines are only as wide as the maintenance arms and drones that
  move through them.
- **Dark by default.** Machines don't need light. The only lights are status
  LEDs and the red warning light, which comes on because a human mind has just
  been connected. This gives the dark opening shots a reason in the story,
  rather than being only a style choice.
- **Packed tight.** Nothing aboard needs air, so there are no empty rooms.
- **Heat is the main problem.** In space, heat can only leave by radiating
  away, so the ship carries large radiator panels. The interior sounds like its
  cooling system: coolant pumps humming, liquid moving through pipes, metal
  ticking as it heats and cools.
- **Built along a spine.** One long keel with modules hung off it. No
  streamlining, because the ship never enters an atmosphere. The belly always
  faces the planet, so the launch doors, guns and sensors are on the belly.

### Inside: each part has a game job

| Part | Game link | Look |
| --- | --- | --- |
| Commander capsule | The player | The deepest, most armoured point. Only the head is shown, hung in a cradle of cables like any other component. The only soft thing aboard. |
| Compute and cables | The brain link | Racks of processors, cable bundles thicker than an arm, thin cyan data lights. |
| Fabricators | Replicator, orbital delivery of cores, tanks, ships and airbases | Assembly lines that print whatever is ordered. Spare robots hang in rows on rails, their optics dark. |
| Pod bay | Drop pods | Pods racked in a honeycomb above launch doors in the belly. |
| Orbital gun | Orbital strikes (HE, incendiary, gas) | A long gun along the spine, fed from shell magazines. |
| Survey sensors | Orbital survey at game entry | Dishes and lens arrays on the belly. |
| Reactor | Power | At the far end from the capsule, behind a heavy shield. |

### Outside

- Long, dark hull in cold, reflective metal. The radiator wings are held
  edge-on to the sun. The launch doors have scorch marks around them.
- CUCULIDAE is stencilled large on the hull with a registry code. The ship
  itself has no use for a name. It is there for whoever reads the records.
- Scale: about a kilometre or more long, big enough to launch cores, tanks and
  boats (proposal).

### The name

Cuculidae is the scientific name of the cuckoo family. Some cuckoos lay their
eggs in other birds' nests, and the hatched chick pushes the host's eggs out.
That matches this ship: it lays pods on someone else's planet, and a
"Hatchling" clears out the natives. If you want the video to hint at this, the
pod bay alone is enough: pods racked like eggs in a carton. The pod shapes stay
the same as in the game.

### Proposed shot-list changes

- **2a:** pull back from the capsule along the cables, through racks and pipes
  and past rows of dormant robots. The camera never passes through a corridor.
- **2b:** the camera reaches the pod bay. The belly doors open and the planet's
  glowing rim appears through the opening. With no windows aboard, the open
  launch door is the only view out. A pod is released.
- **2c (new, about 3 s):** outside, below the ship. CUCULIDAE on the hull, pods
  falling toward Caldera. The hull replaces the on-screen name text.
- The total grows by about 3 s, to roughly 29 s.

13. Do these rules and parts match what you imagined? Add or remove anything.
    Your answer:

14. Should the revised 2a and 2b and the new 2c go into the shot list?
    Your answer: (Superseded by your 2026-10-24 flow below, which replaces
    these shots with the factory sequence.)

15. Was the cuckoo meaning intentional, and should the video hint at it?
    Your answer:

## Your flow (2026-10-24, in your words)

> From the dark, with electronic beeps, and the different reminder lights
> blinks, the red lights with the light path cascading globally, the container
> with the head, we use a closed dark helmet to represent, the lights on the
> helmet lit, and radiators vibrates. The head is activated. And the camera
> faces the helmet from the front, and dragged back slowly, no human voice, for
> there is no human as target to listen, only data flowing. And we can listen
> the machine activates sounds, the engine bursting, piston pushing, belt
> running. The weapon factory begin runs at full speed. The sound is an
> implication. And the camera moves through the wall, see the steel plates,
> chips, cables, tubes within, and enter a new scene, the two sides are lines of
> pipelines, totally in 6, and the war machines, tanks, jets, ships, they are
> outputs by the factory at far side, we can use a furnace, very big one to
> represent factory now, and they are ported, and warped into drop pods in
> different size, and the mechanical arms rearrange them into the right place,
> the launcher crates. and loaded, and they are sent into the planet below. And
> the camera move forward, through the furnace, enter the factory's shells
> manufactor, and the camera tracks the maybe 500mm shell, with the pipeline,
> the arms, and send into the orbital cannon on the ship, and fire into the
> atmosphere, the shell breaks the air, and with flames. And then the scene
> changes to the big one, the big spaceship hovers on the orbit, below is the
> big planet, and numbers of the droppods send into the planet with flame
> tails. The background has a bright very far solar, a dot, but emit white
> bright light. The style is scientific, pure scientific, we can see the
> atmophere reflect white scattered lights. And then camera change to the
> ground, we shot from ground to above, and we see droppod just impact heavily
> just behind the camera, with dust, and expand, one support core is expanded
> and self built, rises, the robot in stand form in the drop pod already, and it
> is activated, and step one step heavily right on the camera, the scene turns
> dark.

Style note: "pure scientific" is read as realistic, hard sci-fi. One hard
sunlight, true black space, black shadows, a thin bright atmosphere edge and
believable scale. Clean rendered look, not photoreal.

## Shot list v3 (2026-10-24, from your flow)

This replaces the earlier shot list. The old table is in git history (commit
423058c). Times are proposals. Items marked (assumed) are my guesses where the
flow leaves a gap.

### Act 1: wake-up (0-10 s)

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 1a | 0-3 s | Fixed, facing the front of the closed dark helmet | Black. Small indicator lights blink on, one by one | Black, scattered small lights | Electronic beeps |
| 1b | 3-6 s | Same | A red light path cascades outward from the capsule through the whole ship. The helmet's own lights come on and the radiators vibrate: the head is online | Red wave, helmet lights | Data chatter, radiator hum. No voice |
| 1c | 6-10 s | Slow pull back | The ship wakes up in the dark around the capsule | Red, more lights joining | Engines bursting into life, pistons, belts: the factory is heard before it is seen |

### Act 2: factory (10-34 s)

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 2a | 10-12 s | Passes through the wall | Cutaway through the wall: steel plates, chips, cables, tubes | Cold metal, cyan data lights | Muffled machinery |
| 2b | 12-17 s | Wide, slow push down the hall | Six production lines, three on each side. A huge furnace glows at the far end. Tanks, jets and ships come out of it along the lines | Orange furnace glow against cold steel | Furnace roar, conveyor rumble |
| 2c | 17-22 s | Tracking beside the lines | Each finished vehicle is sealed into a drop pod sized to fit. Mechanical arms sort the pods into launcher crates | Same | Servos, metal clanks |
| 2d | 22-25 s | Looking down | Crates load, and pods fire down through the belly toward the planet | Planet light from below | Launch thumps |
| 2e | 25-27 s | Flies forward into the furnace | White-hot flash, coming out in the shell factory | White-orange flash | Roar swells, then cuts |
| 2f | 27-31 s | Tracking one ~500 mm shell | Along the line, passed from arm to arm, loaded into the orbital cannon's breech | Cold steel, red warning lights | Clanks, breech slam |
| 2g | 31-34 s | Following the shell out | The cannon fires. The shell dives into the atmosphere, its nose wrapped in re-entry flame | Muzzle flash, then flame glow | Gun blast, then see question 18 |

### Act 3: orbit (34-41 s)

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 3a | 34-41 s | Very wide, slow drift | The ship holds orbit, CUCULIDAE on its hull. The planet fills the bottom of the frame, with a thin bright atmosphere edge scattering white light. The sun is a tiny, intensely bright white dot far away. Dozens of pods fall toward the planet with flame tails | One hard white light, black shadows | See question 18 |

### Act 4: ground (41-52 s)

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 4a | 41-44 s | Ground level, looking up at the sky | A pod streaks down and slams in just behind the camera. The camera shakes and dust rolls over the lens | Daylight, dust | Rising whistle, huge impact |
| 4b | 44-48 s | The camera turns as the dust clears (assumed) | The support core unfolds and builds itself up, the same way as in the game | Dust haze | Hydraulics, metal locking into place |
| 4c | 48-52 s | Low, facing the robot | The robot already stands in its pod. Its optic lights red, and it takes one heavy step right onto the camera. Black | Red optic, then black | Servo whine, one heavy footstep, silence |

Total: about 52 s.

16. **Length.** This flow runs about 52 s, against the earlier 20-30 s. Keep
    the full length, or trim it? If trimming, which part goes first?
    Your answer:

17. **Ground order.** Which pod lands just behind the camera: the core's or the
    robot's? If it is the core's, the camera has to turn around to see it
    unfold (assumed in 4b).
    Your answer:

18. **Sound in space.** Real space is silent. For the cannon shot and the orbit
    shot, cut to silence or just a very low drone, then let the ground impact
    hit loud? Proposal: yes. It fits "pure scientific" and makes the landing
    hit harder.
    Your answer:

19. **The six lines.** What does each line make? Proposal: two for tanks, two
    for aircraft, two for ships.
    Your answer:

20. **The shell's job.** Does the shell clear the landing site, like an orbital
    strike in the game, so the ground scene shows a smoking crater nearby?
    Which shell type: HE, incendiary or gas?
    Your answer:

Your changes:

## Models: what to give me for each one

You don't need to supply 3D model files. Each model is built in code from
simple shapes: boxes, cylinders, tubes and bevelled plates. What I need is to
know what it should look like.

### What makes a reference image useful

- **More than one angle.** A front view and a side view are ideal. A top view
  helps for vehicles and the ship. A single angle hides depth. Robot.png is a
  three-quarter front view, so a side view would show how deep the chest is and
  how the legs bend.
- **Scale.** Write the size (2.5 m, 1 km) or draw a human next to it.
- **Labels.** Arrows and short notes: "laser emitter", "glows red", "this hose
  goes into the back".
- **What moves, and how.** Hinges (a door), slides (a piston), rotation (a
  turret), unfolding (the core panels).
- Sketches, paintings, generated concept images and phone photos of paper all
  work. Screenshots from games or films work too, with a note on what to take
  from each.

### Where to put images

- Save them in `assets/video concept/` (git-ignored, local only) and tell me
  the file names. You can also paste an image into the chat for a quick look,
  but files are better because they can be reopened later.
- Your own designs can later be copied into a tracked folder such as
  `docs/previews/video/` as design-process evidence. Keep screenshots of other
  people's games and films in the ignored folder, because the repo becomes
  public.

### Checklist

Hero models are seen up close or for a long time, so they deserve a reference
image. Minor models are seen briefly or far away, so a line of words is enough.

| Model | Shots | Weight | Reference so far | Your notes |
| --- | --- | --- | --- | --- |
| Robot | 4c | Hero | Robot.png and act4-landing.png (they differ, see question 21) | |
| Helmet and capsule room | 1a-1c | Hero | act1-helmet-wall.png | |
| Ship exterior | 3a | Hero | act3-orbit-drop.png (replaces the ship design proposal) | |
| Factory hall and furnace | 2b-2e | Hero | act2-factory-hall.png | |
| Support core | 4b | Hero | act4-landing.png plus the in-game core | |
| Orbital cannon | 2f-2g | Medium | None | |
| Shell (~500 mm) | 2f-2g | Medium | Shell rows in act2-factory-hall.png | |
| Planet Caldera | 2d, 3a | Medium | act3-orbit-drop.png | |
| Drop pods and launcher crates | 2c-2d, 3a, 4a-4c | Medium | act2 and act3: dark armoured crates with thrusters | |
| Mechanical arms | 2c, 2f | Minor | act2-factory-hall.png | |
| Tank, jet, ship | 2b-2c | Minor | act2-factory-hall.png | |
| Wall cutaway | 2a | Minor | The panel style in act1-helmet-wall.png | |

## Concept images (2026-10-30)

Four images, saved locally in `assets/video concept/` (git-ignored). Each is
1672 x 941 pixels.

### act1-helmet-wall.png: Act 1

- A closed, dark helmet set into a wall of electronics, seen straight on and
  symmetrical. It has red light strips along its seams, and cables plug into
  six connectors around it.
- The wall around it holds circuit boards, RAM-like banks, cooling grilles and
  scattered status LEDs in red, amber and green.
- The image shows the "fully on" moment. The video starts from black and
  reaches this state by the end of 1b.
- The cables run outward from the helmet in a cross pattern, so the red light
  cascade in 1b can travel along those cable runs.
- The helmet sits inside a wall, so pulling back reveals more wall, and the
  "camera passes through the wall" transition in 2a follows on naturally.

### act2-factory-hall.png: Act 2

- A long hall with **four** furnace mouths glowing at the far end. Your flow
  says one big furnace (question 24).
- Production lines carry jets (left), a spacecraft-like craft (centre) and tanks
  (right). Gantries and robotic arms run alongside.
- In the foreground, crate walls fold up around each vehicle to seal it. That is
  the game's orbital crate unfolding in reverse, which is good continuity.
- A gantry lowers a sealed crate into a floor shaft, and crates drop out
  through the floor on thrusters.
- Rows of tall shells already stand on the right side of the same hall
  (question 25).
- Look: cold grey steel with orange furnace light and amber safety lights.

### act3-orbit-drop.png: Act 3

- The Cuculidae is a long, wedge-shaped hull with a large triangular fin hanging
  below it. CUCULIDAE is lettered in gold on the side.
- Crates drop from the belly with flame trails.
- The planet below is blue and white: clouds, mountain ranges, lakes and coast.
  The atmosphere edge glows blue.
- The sun is in the upper right with strong light rays, and a moon or planet
  sits in the upper left (question 26).
- This replaces my earlier spine-and-radiator ship proposal. The design rules
  for the inside still apply.

### act4-landing.png: Act 4

- A low camera in the grass, looking up at the robot standing inside the
  unfolded core. The core's walls lie open around it, and a tall tower with a
  crane arm rises behind it.
- The robot has yellow armour, a visor head with a red strip, a right-arm gun
  with two muzzles and a hose, and a left hand. That matches the game's yellow
  robot, but not Robot.png (question 21).
- The robot stands in the core, not in a separate pod. That also matches the
  game, where the robot exits the core (question 22).
- Blue grass and giant blue mushroom-shaped alien trees. The game's ground
  tiles are green grass (question 23).

### How the images can be used

These images have far more detail than shapes built in code will. There are
two ways to use them:

- **2.5D:** animate the image itself with slow zooms, parallax layers, lights
  switching on, flames, dust and particles. The video keeps the image's look.
  The camera cannot really move through space, though, and nothing in the
  picture can move like a 3D object (the robot cannot take a step).
- **3D in code:** the camera can fly anywhere and parts really move, but the
  look is simpler than the images.

Proposal: mix them. Use 2.5D for 1a-1c (straight-on helmet, fixed camera, a
perfect fit) and 3a (the ship drifts while crates fall with animated trails).
Use 3D where things move: the 2a wall pass, the factory tracking in 2c-2g, and
the robot in Act 4.

What 2.5D needs from you:

- **Bigger images, only for the 2.5D shots:** act1 (helmet) and act3 (orbit).
  Ideally 3840 x 2160, at least 2560 x 1440, and kept at 16:9. act2 and act4
  are only references for 3D building, so their current size is fine.
  - act1: the shot starts zoomed in on the helmet. At the current size, the
    helmet is enlarged about 1.5x and looks soft. At 3840 x 2160 it stays sharp.
  - act3: the image is narrower than the 1920-pixel-wide video, so it is
    enlarged even with no zoom.
- **act3 layers (optional):** the ship alone on a transparent background, and
  the planet and space without the ship. The ship can then drift against the
  planet. Without layers, the whole picture zooms slowly.
- **act1 lights-off copy (optional):** the same picture with *every* light off:
  helmet strips, cable glows and all the small background LEDs. The room should
  be dim, with the metal shapes faintly visible, not pure black. The video
  switches each light on by revealing the lit image in that spot, so the two
  versions must line up exactly. Check by flipping between them: only the
  lights should change. If they are upscaled, upscale both with the same tool.
  If your tool cannot keep the alignment, skip this copy. Starting from pure
  black, I can extract the lights from the lit image in code. The difference is
  that the room cannot be faintly visible before the lights come on.

21. **Robot design.** Robot.png is gunmetal, with dome shoulders and a single
    triangular optic. act4 is yellow, with a visor head. The game's robot is
    yellow with a red optic. Proposal: Robot.png's skeletal body and head with
    the game's yellow armour plates. Or use act4 as it is.
    Your answer:

22. **One pod instead of two.** In act4 the robot stands inside the opened core,
    like in the game. Proposal: only the core pod lands. It streaks down over
    the camera and hits in front of it, and dust covers the lens. As the dust
    clears, the core is unfolding and its tower rises. The robot inside lights
    its optic and steps onto the camera. This also settles question 17.
    Your answer:

23. **Ground colour.** Blue grass and trees (act4), or the game's green grass,
    so the cut from the video into the game matches?
    Your answer:

24. **Factory.** One big furnace (your flow) or four (act2)? The centre craft
    looks like a spacecraft, but the game has no spacecraft unit. Should it be a
    game unit instead (bomber, helicopter, AC-130-style gunship)? Should naval
    ships appear? A battleship would dwarf the crates.
    Your answer:

25. **Shell line.** act2 already shows shells in the same hall. Keep the flight
    through the furnace into a separate shell factory, or pan across to the
    shell line in this hall? Panning means one fewer environment to build.
    Your answer:

26. **The body in the upper left of act3.** The game's entry scene has Caldera,
    Vesper and one decorative moon. Is this Vesper, or the moon?
    Your answer:

27. **Image source.** Which tool or process made these images? The portfolio
    should record where each image came from.
    Your answer:

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

For each sound, answer whichever of these three you can:

1. **When:** the visual moment it belongs to ("as the red light comes on",
   "the frame the pod hits").
2. **Like what:** a comparison or a made-up word ("like a fluorescent tube
   starting", "a deep *thoom*", "a car door slam, but much bigger").
3. **Feel:** pick a side from any of these pairs: low / high, heavy / light,
   sharp / soft, close / far, short / long, loud / quiet, clean / gritty.

Also say which kind of sound it is:

- **Background:** runs through a whole shot (hum, wind, engine).
- **Event:** one hit tied to an action (beep, impact, footstep).
- **Music:** a drone or tune under everything, or none.

Silence also counts as a choice. A moment of near-silence just before the pod
hits makes the impact feel bigger.

Example, shot 1a: "Background: almost silent, a faint low hum. Event: when the
red light comes on, a short electric buzz, like a fluorescent tube starting.
Low, gritty, close."

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
