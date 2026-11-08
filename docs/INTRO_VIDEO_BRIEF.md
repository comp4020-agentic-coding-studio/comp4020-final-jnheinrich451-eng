# Intro video brief - conversational draft

Status, 2026-11-01: two silent preview clips exist locally. They are not wired
into the game, and Acts 2 and 4 are not built. The video is optional polish on
top of the course requirements, so the game remains playable without it.
Fill in the "Your answer" lines in English or Chinese. "Use your default"
accepts the proposal written above that line.

## Current state

| Clip | Shots | Method | Preview | Review |
| --- | --- | --- | --- | --- |
| Act 1, wake-up | 1a-1c, 10 s | 2.5D shader over the helmet image pairs | `output/video-tests/act1-wake-preview-v1.mp4` | Author: good |
| Orbit | 3a, 10 s | 2.5D layers, pods and shells drawn in code | `output/video-tests/act3-orbit-preview-v2.mp4` | Waiting for author |

Both are 1920 x 1080 at 30 fps, with no sound yet.

**Plan change proposed (2026-11-02).** The author asked about prompts, key frames
and generated video. The proposal is a mix: Acts 2 and 4 become clips from a video
generator, each guided by key frames, and Remotion assembles the film. Act 1 and
the orbit shot stay in code. If the two tests in `docs/INTRO_VIDEO_PROMPTS.md`
pass, this replaces question 28 and shot list v4, and the cutouts requested for 2.5D
are no longer needed. Until then, v4 stays the current plan.

**Playback decision (author, 2026-11-01).** The video plays when the user enters
the game. Pressing any key shows a skip prompt, and pressing again within 3
seconds confirms the skip. It is not built yet. Two points are open:

- Browsers block sound on autoplay until the user has clicked or pressed
  something on the page, so the first visit needs a "press to start" step, or
  the video starts muted.
- Should it play on every visit, or only the first visit from a browser?

**Conflict decision (author, 2026-11-01).** Where earlier answers and the newest
images disagree, the images win.

**Rebuilding.** In `video/`: `pnpm install`, then `pnpm layers` (needs Python
with opencv-python and numpy, and the images in `output/video-frames/`), then
`pnpm exec remotion render Act1Wake out/act1.mp4`. `pnpm studio` opens a live
preview. The folder has its own install, so the game's install, CI and Docker
image never load Remotion.

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

## Shot list v4 (2026-11-01, from the images)

The concept images are now the plan (author, 2026-11-01). Where your earlier flow
and an image differ, this list follows the image. Shot list v3 is in git history.
Times are proposals, and items marked (assumed) are my guesses.

**Method.** 2.5D worked well and keeps the images' look, so Acts 2 and 4 are
proposed as 2.5D too (question 28). The Method column assumes that.

### Act 1: wake-up (0-10 s), built, author approved

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 1a | 0-3 s | Fixed, facing the helmet | Black. Small indicator lights blink on, one by one | Black, scattered small lights | Electronic beeps |
| 1b | 3-6 s | Same | The helmet strips light up. A red wave spreads outward across the wall and the radiators tremble: the head is online | Red wave, helmet lights | Data chatter, radiator hum. No voice |
| 1c | 6-10 s | Slow pull back to the wide wall | The rest of the wall wakes up, with engine thumps shaking the frame | Red and amber LEDs on dark steel | Engines, pistons, belts: the factory is heard before it is seen |

### Act 2: factory (10-29 s), from scene-02-foundry-v1.png

| # | Time | Camera | What happens | Light / colour | Method |
| --- | --- | --- | --- | --- | --- |
| 2a | 10-12 s | Pushes into the wall | Rushes into a dark gap in the wall, then opens into the hall | Dark, then furnace light | Zoom and dark transition |
| 2b | 12-18 s | High and wide, slow push down the hall | Furnace mouths glow at the far end. Lanes carry jets, the armed craft and tanks toward the camera | Orange furnace glow, cold grey steel, amber safety lights | Vehicle cutouts move along their lanes over an empty hall |
| 2c | 18-22 s | Same push | Sealed crates move along the lanes. A gantry carries one over the floor shaft | Same | Crate and gantry cutouts |
| 2d | 22-25 s | Same push | The crate drops into the shaft, and crates fall away through the floor on thrusters | Thruster flame from below | Flame drawn in code |
| 2e | 25-29 s | Pans right to the shell rows | Tall shells stand in rows beside the lanes, and one is carried out toward the guns (assumed) | Cold steel, red warning lights | Pan across the same image, then cut to the orbit shot |

The separate shell factory, the flight through the furnace and the six-line
layout are dropped: scene 02 shows the shells in the same hall.

### Act 3: orbit (29-39 s), built

| # | Time | Camera | What happens | Light / colour | Sound |
| --- | --- | --- | --- | --- | --- |
| 3a | 29-39 s | Fixed, no zoom | The Cuculidae coasts slowly right at one constant speed, engines dark. Three pods eject under the hull and fall under gravity, keeping the ship's drift. Their flames grow with the fall. The under-hull cannons fire alternating twin salvos, and the shells streak away and burn up at the top of the atmosphere. The last frame matches scene 03 | Hard sunlight from the upper right, blue atmosphere edge | See question 18 |

This shot now carries the cannon fire, so the old shot 2g is merged into it. The
sun stays large and bright as in scene 03, not the tiny dot from the earlier flow.

### Act 4: ground (39-50 s), from scene-04-robot-deployment-v1.png

| # | Time | Camera | What happens | Light / colour | Method |
| --- | --- | --- | --- | --- | --- |
| 4a | 39-42 s | In the blue grass, looking up | A pod streaks down and hits in front of the camera. The frame shakes and dust covers the lens | Daylight, blue trees, dust | Pod and dust drawn in code over the empty landscape |
| 4b | 42-46 s | Same | The dust clears on the opened pod. Its tower rises behind the robot (assumed) | Dust haze clearing | Tower cutout slides up. The walls are already open when the dust clears |
| 4c | 46-50 s | Same | The robot stands in the centre cell, dark. Its red slit lights, and it takes one heavy step right onto the camera. Black | Red slit, then black | Lit and unlit pair, then the robot cutout looms toward the camera |

Total: about 50 s.

16. **Length.** This list runs about 50 s. Keep it, or trim it?
    Your answer:

17. Closed by question 22: one pod, landing in front of the camera.

18. **Sound in space.** Real space is silent. For the orbit shot, use silence or
    just a very low drone, including for the cannons, then let the ground impact
    hit loud? Proposal: yes. It fits "pure scientific" and makes the landing hit
    harder.
    Your answer:

19. Closed by scene 02: the lanes carry jets, the armed craft and tanks.

20. Closed by scene 04: the landing view shows no crater, so the shells fall
    somewhere else on the planet.

28. **Acts 2 and 4 in 2.5D.** Proposal: yes, instead of building 3D models. It
    matches your images far better and is much quicker to build. The limits are
    that the camera moves less, and the crate walls and pod walls cannot visibly
    fold, so those moves are hidden by a cut or by dust.
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
| Robot | 4c | Hero | scene-04-robot-deployment-v1.png | |
| Helmet and capsule room | 1a-1c | Hero | scene-01 v2 and the expanded pair, each with a lights-off copy | |
| Ship exterior | 3a | Hero | cuculidae-design-sheet-v1.png and scene-03-cuculidae-descent-v1.png | |
| Factory hall and furnace | 2b-2e | Hero | scene-02-foundry-v1.png | |
| Support core | 4b | Hero | scene-04-robot-deployment-v1.png plus the in-game core | |
| Orbital cannon | 2f-2g | Medium | Under-hull cannons in the design sheet | |
| Shell (~500 mm) | 2f-2g | Medium | Shell rows in act2-factory-hall.png | |
| Planet Caldera | 2d, 3a | Medium | scene-03-cuculidae-descent-v1.png | |
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

### Material check (2026-11-01)

Files are in `output/video-frames/`. This corrects the earlier request for
3840 x 2160 images: enlarging a file adds pixels but no detail, so what counts
is how much real detail an image holds.

**Helmet pair** (`scene-01-head-container-expanded-3840x2160-v1.png` and its
lights-off copy):

- Alignment: at most 0.4 pixels of drift across the 4K frame.
- Lights: every LED and strip is off. The red lines down the centre stay red but
  no longer glow, so they read as painted cables. The red wash on the top of the
  helmet stays, as your prompt asked.
- Exposure: the off image is brighter than the lit one (about 10-25% in the
  areas measured). A tone match in code removes most of that.
- The outer 1-pixel border is partly transparent. It gets trimmed.
- The off image keeps normal exposure instead of the dim room requested earlier.
  This works better, because code can darken it to any level.
- A still test of the light wave works: `output/video-tests/act1-wave-test.png`.
  Motion is not tested yet.

**Detail limit.** Both 3840 x 2160 files are bicubic enlargements of 1672 x 941
images, as their prompt files say. The helmet holds about 220 x 320 pixels of
real detail. In `scene-01-head-container-v2.png` the same helmet holds 339 x 498.
With the helmet at 85% of frame height, v2 is clearly crisper (compare
`act1-closeup-v2.png` and `act1-closeup-expanded.png` in `output/video-tests/`).

**Act 1 method.** It starts close on v2, using
`scene-01-head-container-close-lights-off-v1.png` as its lights-off pair, then
blends into the expanded pair during the pull back. Both pairs are split into a
wall layer and a layer per light, so each light switches on separately.
The wide image is about 29% brighter over the same wall, so it is tone-matched
to the close image.

### Orbit shot: how the layers are used

- `scene-03-background-plate-v1.png` is the background. It lines up with the
  scene to within about half a pixel.
- `cuculidae-sunlit-cutout-v1.png` is the ship. The generator enlarged it, so it
  is scaled to 72% and placed by matching it against
  `scene-03-cuculidae-armed-v1.png`. It keeps the scene's sunlight and sits
  cleanly on the plate.
- One pod is cut from scene 03. Pods, flames and sparks are drawn in code because
  they have to move.
- The camera and planet stay still. The ship's speed is constant, because its
  engines are dark.
- Each pod's release time is worked back from its position in scene 03, so the
  last frame lands on that composition.
- Pods fall behind the ship layer, so they slide out from under the hull.
- `cuculidae-design-sheet-v1.png` is not a layer, because its views are flat and
  evenly lit. It remains the reference for the ship's design and for any 3D
  close-up of the cannons.

21. **Robot design.** Robot.png is gunmetal, with dome shoulders and a single
    triangular optic. act4 is yellow, with a visor head. The game's robot is
    yellow with a red optic. Proposal: Robot.png's skeletal body and head with
    the game's yellow armour plates. Or use act4 as it is.
    Your answer: Settled by scene 04 (2026-11-01): the slim yellow robot over a dark
    skeleton, with one narrow red slit, matching the game. Robot.png is retired.

22. **One pod instead of two.** In act4 the robot stands inside the opened core,
    like in the game. Proposal: only the core pod lands. It streaks down over
    the camera and hits in front of it, and dust covers the lens. As the dust
    clears, the core is unfolding and its tower rises. The robot inside lights
    its optic and steps onto the camera. This also settles question 17.
    Your answer: Settled by scene 04: one pod, and the robot stands in its central
    cell. Question 17 is closed.

23. **Ground colour.** Blue grass and trees (act4), or the game's green grass,
    so the cut from the video into the game matches?
    Your answer: Following scene 04: blue. The game's Caldera is now painted blue
    too (`public/caldera-art.js`), so this is no longer a conflict.

24. **Factory.** One big furnace (your flow) or four (act2)? The centre craft
    looks like a spacecraft, but the game has no spacecraft unit. Should it be a
    game unit instead (bomber, helicopter, AC-130-style gunship)? Should naval
    ships appear? A battleship would dwarf the crates.
    Your answer: Following scene 02: a furnace wall with several mouths, and the
    centre craft stands for the ship lane.

25. **Shell line.** act2 already shows shells in the same hall. Keep the flight
    through the furnace into a separate shell factory, or pan across to the
    shell line in this hall? Panning means one fewer environment to build.
    Your answer: Following scene 02: pan to the shell line in the same hall.

26. **The body in the upper left of act3.** The game's entry scene has Caldera,
    Vesper and one decorative moon. Is this Vesper, or the moon?
    Your answer: The scene 03 prompt calls it a smaller distant planet.

27. **Image source.** Which tool or process made these images? The portfolio
    should record where each image came from.
    Your answer: Recorded in the `*-prompt.txt` file beside each image.

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
