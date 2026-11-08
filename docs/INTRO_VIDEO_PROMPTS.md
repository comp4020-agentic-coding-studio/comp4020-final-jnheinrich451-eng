# Intro video prompts

Status, 2026-11-02: proposal. Nothing here has been generated yet, and the plan
stands only if the two tests below pass. `docs/INTRO_VIDEO_BRIEF.md` holds the
design decisions. This file holds what you paste into the tools.

## How the work divides

| Who | Does what |
| --- | --- |
| You | Say what you want in rough words. Make key frames with your image tool, generate clips in the video tool, and judge the motion by eye |
| Claude | Write the prompts here. Check frames from every take for melting metal, extra limbs and flicker. Then assemble the film in Remotion: cuts, timing, one shared colour, grain, shake on impacts, sound, and the skip screen |
| Code keeps | Act 1 (approved) and the orbit shot, because the hull lettering must stay readable and the pods must follow your slow-gravity rule |

Key frames are what keep the film consistent: every clip is told exactly where
it starts and ends, using your images.

## Start with two tests

These use images you already have, so no key frames are needed yet. Make the
other key frames only after these pass.

Tool: Kling, image to video, 1080p, 5 seconds, native audio off, no end frame.

**Test 1, robot step.** First frame: `scene-04-robot-deployment-v1.png`.
Paste shot 4c's prompt with the style line and avoid line.

**Test 2, factory hall.** First frame: `scene-02-foundry-v1.png`.

```text
Camera glides slowly forward down the hall, high above the production lanes, in
one smooth continuous move. Tanks, jets and sealed crates roll slowly along their
lanes. Crane arms and presses work in a steady mechanical rhythm. Furnace glow
shimmers through the heat haze.
```

Generate each test up to three times, then put the takes in
`output/video-clips/` as `test1-take1.mp4`, `test2-take1.mp4` and so on.

**A test passes if:**

- Metal stays rigid and keeps its shape.
- The robot keeps two arms and two legs, with the gun on the same side.
- Movement feels heavy and huge, not floaty or toy-sized.

If both pass, generate the rest. If only one passes, generated clips are used
only for that kind of shot, and code covers the others.

## Shot list v5 (proposal)

Real motion brings back shots that the images alone could not do, including your
trip through the wall, tracking a shell to the gun, and the robot's step.

| Shot | Length | First frame | Last frame | What happens |
| --- | --- | --- | --- | --- |
| Act 1 | 10 s | Built | Built | Wake-up, already approved |
| 2a | 2.5 s | K01 | K02 | Through the wall |
| 2b | 2.5 s | K02 | K03 | Bursts out at the furnace |
| 2c | 6 s | K03 | scene 02 | Flies backward down the line, and the hall is revealed |
| 2d | 4 s | K04 | K05 | Armour panels close around a jet |
| 2e | 4 s | K06 | K07 | Crane drops a pod down the shaft, and the planet appears below |
| 2f | 3 s | K08 | K09 (optional) | Follows a shell to the gun |
| 2g | 2 s | K10 | none | The gun fires in vacuum |
| Act 3 | 8-10 s | Built | Built | Orbit shot in code |
| 4a | 2 s | K11 | K12 | Pod hits the meadow |
| 4b | 4 s | K12 | K13 | Dust clears, the cube opens, the tower rises |
| 4c | 4 s | K13 | K14 (optional) | Red slit lights, one step onto the camera, black |

Total: about 52 s. Generate 5 seconds for every shot, even the short ones. The
extra length lets me keep the best part and adjust its speed.

Shots 2a to 2c use K02 and K03 twice, so the clips join without a visible cut.
The same goes for K12 and K13 in Act 4.

## Text used in every prompt

Add the style line after each prompt. Put the avoid line in the negative prompt
box. If there is no such box, add it at the end of the prompt.

**Style line:**

```text
Photoreal hard science-fiction film. Dark charcoal frosted matte steel, cold
restrained light, believable kilometre-scale weight. Slow, heavy, precise machine
motion.
```

**Avoid line:**

```text
morphing, melting or bending metal, objects changing shape, extra limbs, flicker,
text, letters, logos, watermark, humans, handheld shake, sudden cuts
```

**For 2g, also avoid:**

```text
smoke, billowing exhaust, lingering fire, shock rings, sparks floating
```

## Video prompts

Use Start & End Frames mode whenever the table gives a last frame.

**2a. Through the wall.**

```text
Camera pushes straight forward, speeding up, into the dark gap beside the helmet
and enters the wall. Layers of steel plates, circuit boards, cable bundles and
coolant tubes slide past the lens on all sides with strong depth. All machinery
stays still. Only the camera moves.
```

**2b. Into the hall.**

```text
Camera keeps flying forward through the last layers of machinery. The orange gap
ahead widens, and the camera bursts out into an enormous hall, facing a furnace
mouth. Heat haze shimmers, and a red-hot forged hull slides out along its rail.
```

**2c. The reveal.**

```text
Camera moves slowly backward and rises in one smooth continuous move, away from
the furnace wall and up above the production lanes. Red-hot hulls travel along
their lanes toward the camera and cool to dark metal as they pass under the
presses. Crane arms and presses work in a steady mechanical rhythm.
```

**2d. Sealing the pod.**

```text
Fixed camera. Thick hinged armour panels swing closed one after another around
the jet, slowly and heavily, then lock. Amber warning lights blink. The jet does
not move. The panels stay rigid and keep their shape.
```

**2e. The drop.**

```text
The huge crane arm lowers the sealed pod into the square floor socket and lets
go. Camera tilts down and follows it over the rim, until it looks straight down
the shaft. The pod falls away, its thrusters igniting, and shrinks toward the open
hatch and the blue planet far below.
```

**2f. The shell.**

```text
Camera tracks sideways beside one huge shell as a mechanical arm carries it along
its rail at a steady speed, past the upright rows of shells, toward the open
breech of the gun. Red warning lights turn. The shell stays rigid and upright.
```

**2g. Fire.**

```text
Fixed camera under the hull. The twin barrels recoil one after the other, each
with a hard white muzzle flash that vanishes at once. One glowing shell leaves
each barrel and shrinks straight toward the planet. This is vacuum and the fire
does not linger. The ship and planet stay still.
```

**4a. Impact.**

```text
Fixed camera, low in the blue grass. High in the sky a burning cube streaks down
very fast, trailing a thin line of flame, and slams into the meadow in front of
the camera. The ground jumps, and a ring of pale dust and torn grass rolls toward
the lens. The trees stay still.
```

**4b. The core opens.**

```text
Fixed camera, low in the grass. The dust thins and drifts away. The four thick
side walls of the cube swing outward and down to the ground, slow and heavy, on
their hinges. Behind the motionless dark robot, a tall tower rises in telescoping
stages. Everything is rigid and mechanical. Nothing melts or grows.
```

**4c. Wake and step.**

```text
Fixed camera, low in the grass. The robot stands still. Its narrow red slit
flickers on and steadies into a strong glow. Then it takes one single heavy step
straight toward the camera, and its foot comes down onto the lens. The grass
shakes. Its large gun arm stays on the left of the frame. Exactly two arms and two
legs, with slim skeletal proportions.
```

## Key frame prompts

K01 is done: `key-01-act1-end-v1.png`, the exact last frame of Act 1. Save the
others in `output/video-frames/` as `key-02-inside-wall-v1.png` and so on, with
your usual `-prompt.txt` beside each one.

Every prompt starts with this line:

```text
Single widescreen 16:9 cinematic film still, same world, materials and lighting
as the attached images. No humans, text, logos or watermark.
```

**K02, inside the wall.** Attach K01.

```text
The camera is now INSIDE the wall, deep in the machinery. A tight gap runs between
dense layers of stacked steel plates, circuit boards with tiny red and amber
lights, thick black cable bundles and coolant tubes, all close to the lens around
the edges of the frame with strong depth. Straight ahead in the centre, a narrow
vertical gap shows hot orange light from a huge space beyond. This gap is not
built for people: no corridor, door or handrail.
```

**K03, at the furnace.** Attach `scene-02-foundry-v1.png`.

```text
The same foundry from a much lower, closer camera, above the centre lane and
looking straight at one furnace mouth, which fills the upper frame. A red-hot
forged hull rides out on a heavy conveyor rail toward the camera. Restrained heat
haze.
```

**K04, open pod.** Attach `scene-02-foundry-v1.png`.

```text
A closer view of the left packaging station in the attached image, from a slightly
raised side camera. One finished grey fighter jet rests inside an open box-shaped
pod frame. Thick hinged armour panels stand fully open on both sides.
```

**K05, sealed pod.** Attach K04.

```text
Exactly the same image and camera. Only one change: the hinged panels are now
fully closed, so the jet is hidden inside a sealed cubic armoured drop pod.
Everything else stays identical.
```

**K06, crane.** Attach `scene-02-foundry-v1.png`.

```text
A closer view of the right side of the attached image. The huge ceiling crane arm
grips a sealed cubic pod just above a square launch socket in the floor. Orange
light rises from the shaft below. High three-quarter camera looking down.
```

**K07, down the shaft.** Attach K06 and `scene-03-background-plate-v1.png`.

```text
Camera looks straight down a deep square launch shaft from just above its rim.
Walls with amber light strips run down to a vanishing point. Far below, the bottom
hatch is open onto space, and the blue-white planet and its glowing blue atmosphere
fill the opening. A sealed cubic pod, seen from above, falls small in the middle of
the shaft with bright thruster glow around its edges.
```

**K08, shell.** Attach `scene-02-foundry-v1.png`.

```text
A close view at the shell rows on the right side of the attached image. One huge
dark steel artillery shell, far taller than a tank, is held upright by a mechanical
arm on a rail, with the rows receding behind it. Cold steel, red warning lights.
```

**K09, breech (optional).** Attach K08.

```text
The same shell has reached the open breech of an enormous gun. The shell is lined
up with the breech and half inside it. Heavy machined steel and red warning light.
```

**K10, the gun.** Attach `scene-03-cuculidae-armed-v1.png` and
`cuculidae-design-sheet-v1.png`.

```text
Close exterior view under the hull. One twin-barrel under-hull cannon mount fills
the frame, its barrels angled toward the planet. Hard sunlight from the upper
right, black space and the blue curve of the planet behind it. Not firing. No
lettering visible on the hull.
```

**K11, empty meadow.** Attach `scene-04-robot-deployment-v1.png`.

```text
Exactly the same low camera, trees, sky, sun and blue grass. Remove the robot, the
pod and the tower completely, leaving an empty blue meadow.
```

**K12, cube landed.** Attach K11 and `scene-02-foundry-v1.png`.

```text
Exactly the same camera as the first image. A huge sealed cubic drop pod, like the
sealed pods in the second image, has just landed in the middle of the meadow. Its
hot edges still glow. A thick ring of pale dust rolls outward and half hides it.
```

**K13, robot dark.** Attach `scene-04-robot-deployment-v1.png`.

```text
Exactly the same image. Only one change: the red optical slit is switched off, so
it is dark glass with no red glow on the head. Everything else stays identical.
```

**K14, foot on the lens (optional).** Attach `scene-04-robot-deployment-v1.png`.

```text
The same low camera. The robot has stepped forward. Its yellow mechanical foot
fills most of the frame, coming down toward the lens and blocking the sky, with the
grass in deep shadow beneath it.
```

## When a take fails

- Change one thing at a time, then generate again.
- If the camera does something odd, shorten the camera sentence.
- If metal melts, ask for less action in that clip, or split the clip in two.
- After three failed takes, tell me what went wrong. A shot this hard may need a
  simpler action or a cut hidden by dust.

## Tool notes (checked 2026-11-02)

- **Kling** is the first choice. Its [guide](https://kling.ai/quickstart/klingai-video-3-model-user-guide)
  lists Start & End Frames for Kling 3.0, with clips of 3-15 seconds at 720p or
  1080p. The guide does not spell out the rules for clips using both frames, so
  the tests confirm that in practice.
- **Kling 4.0** also has
  [start and end frames](https://kling.ai/explore/kling_ai_pricing), but I found
  no price or guide for it. Use it if the app offers it at a similar cost.
- **Cost.** Kling 3.0 at 1080p with no native audio is 8 credits a second. The
  [Standard plan](https://kling.ai/blog/kling-video-3-0-credit-cost-guide) is
  listed at $6.99 for a first month with 660 credits, then $8.80. That covers the
  tests. Three takes of all ten shots come to about 1,200 credits, so the whole
  film may need Pro (3,000 credits, $25.99 for a first month). These figures come
  from a July article and can change, so check the app before paying.
- **Free plan.** It lists no monthly credits, excludes commercial use, and removing
  the watermark needs a paid plan. A public game should use clips from a paid plan.
- **Veo 3.1** is not an option through the normal Gemini API.
  [Google shut down its preview on 22 October 2026](https://ai.google.dev/gemini-api/docs/video),
  so older comparison articles are out of date.
- **Seedance** may be a good backup, but I could not confirm start and end frames
  on an official page.

## Take log

Fill this in as evidence, because the portfolio should show where each clip came
from. Clips stay in `output/video-clips/`, which git ignores.

| Shot | Tool and model | Date | Take used | Notes |
| --- | --- | --- | --- | --- |

## Final file

A polished film of about 50 s will probably be tens of MB, not the few MB the
brief first assumed: the Act 1 preview alone is 9.9 MB for 10 s. The size and how
it is served from the small Fly machine must be checked before it is wired into
the game.
