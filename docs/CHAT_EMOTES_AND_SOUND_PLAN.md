# Communication and sound plan

23 October 2026. Chat, pixel emotes and the first weapon sound effects are
implemented locally; see [weapon audio](SOUND_EFFECTS.md) for scope and checks.
Movement/ambient sounds remain planned; the current Apex-only BGM is unchanged. This stage has not been
committed, pushed or deployed.

## 1. Campaign chat

- Enter opens a compact composer at bottom left; Enter submits and closes even
  if empty (empty/whitespace-only text produces no blank message). Escape closes
  and retains the unsent draft. Drafts also survive refresh in this browser tab,
  scoped to the player and campaign; they are not sent until submitted.
  Keep recent messages above it, fading when idle with a small expandable history.
  Avoid the movement pad, combat bar and contextual vehicle controls on phones.
- Enter already confirms placement. Preserve that action while placing; provide
  an explicit chat button as an alternative. Do not steal Enter from other fields,
  dialogs or Chinese/other IME composition.
- Typing owns keyboard input: clear held movement/fire on entry, suppress weapon
  and deployment shortcuts, and require fresh input after closing. The multiplayer
  simulation continues. A moving vessel can still coast under its existing physics.
- Share plain-text messages only within the joined campaign. Server assigns sender,
  room, sequence and time; validate membership and limit length/rate. Render as text,
  never HTML. History is the latest 40 messages in this world runtime, with a
  280-character input limit and three messages per player per five seconds.
  It survives a client reconnect, not room runtime closure or server restart.
  A separate SSE communication event avoids resending history with every tick.
  The latest 256 request receipts suppress ordinary retries; no durable outbox or
  unlimited retry guarantee is implied. Failed sends keep a retryable draft.
- Test simultaneous send, room isolation, reconnect without duplicates, keyboard
  focus, phone layout and IME. Log delivery metadata without routine message bodies.

## 2. Emote wheel

- Hold Q, point at a sector, release Q to send. Keep B for Deploy. The on-screen
  Emote button opens a tap-to-select wheel; arrows/Enter also select and send.
- Six initial choices: hello, thanks, help, danger, follow me and celebration.
  Use six unchanged Kenney Emote Pack Pixel/Style 1 PNGs with labels. Their CC0
  notice and provenance are included in `public/emotes/`; no external fonts or
  image service are needed.
- Center dead zone and Escape cancel. Opening the wheel stops held fire and takes
  mouse aim/clicks; WASD can continue unless typing or another lifecycle gate applies.
- A short-lived bubble appears above the sender's controlled robot, vehicle,
  aircraft, ship or directly controlled remote cannon. Merely selecting an asset
  for autonomous Remote orders does not transfer control: anchor that emote to the
  player's body. Server validates the controlled entity; camera position is not identity.
- Lifetime: 3 seconds, replacing that player's previous bubble, with a one-second
  send cooldown. Replicate an allowed emote ID, sender, anchor and expiry;
  discard expired bubbles on reconnect. They do not affect combat or AI.
  An active deployed body is required for emotes. Chat works before deployment
  and while disabled; both require a connected, authorized, unpaused room.

## Communication validation

- Domain checks cover history/rate limits, blank and invalid text, request retry
  deduplication, expiring/replaced emotes and anchors for robot, tank, recycler,
  ship, aircraft and a live cannon control lease.
- Named-room HTTP/SSE test covers simultaneous send, peer delivery, room isolation,
  reconnect history, retry deduplication, revocation and runtime restart. Logs
  include delivery metadata but not message text. No chat is written to the save.
- Desktop 1920 x 1080 and phone 390 x 844 browser checks cover two players, empty
  Enter submission, Escape draft retention and refresh, IME Enter, typing without
  movement/deployment, held-key suppression, literal markup, failure/retry, Q and
  tap selection, occupied-recycler bubble, B deployment, reconnect and resizing.
  Screenshots were inspected. The composer accounts for visual viewport changes;
  actual mobile keyboards still need physical-device playtesting.
- 25 focused communication/cannon/invariant/narration/observability tests and one
  named-room communication test pass, plus typecheck and syntax checks.

### Large-world reconnect correction

The author reported music and zoom working while movement was blocked and the
connection read Reconnecting. The new chat-history write checked a fixed 64 KiB
outgoing-buffer limit immediately after the initial world snapshot. A snapshot
larger than that limit therefore closed a healthy stream before it could flush.
Small-fixture browser tests had not exposed this.

The shared stream check now allows one snapshot's byte size plus 64 KiB of small
events; repeated undrained snapshots still trigger disconnection. A regression
fixture with 1,600 salvage records reproduced a socket closure before the fix and
passes afterward. Desktop and phone browser checks cover actual offline/online
EventSource reconnection, movement, chat and emotes with that larger snapshot.
The author's saved world was not modified or reset.

## 3. Sound material found locally

This is a filename and bundled-licence inventory, not an audition or a claim that
the samples already sound suitable. These source packs are under ignored `assets/`.
Copy only selected runtime sounds and provenance into `public/audio/` when ready.

| Role | Existing source candidates | Remaining work |
| --- | --- | --- |
| Gunfire | `2D assets/Desert Shooter Pack/Sounds/shoot-a.ogg` through `shoot-h.ogg` | Audition; distinguish small arms, cannon and heavy salvo |
| Explosions | Desert Shooter `explosion-a/b/c.ogg`; `Audio/Sci-Fi Sounds/Audio/explosionCrunch_*.ogg`, `lowFrequency_explosion_*.ogg` | Layer impact and low rumble; limit overlapping blasts |
| Energy weapons | Sci-Fi Sounds `laserSmall_*.ogg`, `laserLarge_*.ogg` | Assign laser/rail signatures after listening |
| Engines and thrust | Sci-Fi Sounds `engineCircular_*.ogg`, `spaceEngineLow_*.ogg`, `spaceEngineLarge_*.ogg`, `spaceEngineSmall_*.ogg`, `thrusterFire_*.ogg` | Check whether clips loop; build distinct speed/load responses |
| Mechanical impacts | Sci-Fi Sounds `impactMetal_*.ogg`; `Audio/Impact Sounds/Audio/impactMetal_*`, `impactPlate_*` | Track/rail rhythm, heavy pod panels, machinery layers |
| Alien texture | Sci-Fi Sounds `slime_000.ogg`, `slime_001.ogg` | Possible wet layer; no dedicated monster roar or hive-whine file identified |
| UI | `Audio/UI Audio`, `Audio/Interface Sounds` | Audition a small consistent selection; inspect their own licences before shipping |

The inspected `License.txt` files in Sci-Fi Sounds, Impact Sounds and Desert
Shooter identify Kenney and CC0. Keep those notices with selected runtime copies.
No clearly named dedicated tank-track, rail-running, real jet or marine diesel
recordings were found. Generic engines are candidates, not confirmed substitutes.
Monster calls and the hive's unsettling whine may need original sound design or
additional sourced material. Do not substitute human combat voiceovers automatically.

## 4. Implementation order and mix

1. Chat, then emotes, as separately playable multiplayer steps.
2. Weapons and impacts: begin with tank cannon, machine gun, rail cannon, missile
   launch and explosion. Play accepted shot/impact events once; snapshots and
   reconnects must not replay old volleys. Rejected input makes no firing sound.
3. Vehicle movement: tank tracks, utility engines, rail clatter, jet thrust,
   helicopter rotors and ship engines. Local looping voices follow actual speed
   and engine state, with smooth pitch/volume changes and no restart every frame.
4. Monsters and hives: nearby attack/death calls and restrained living-hive ambience.
   Destroyed/conquered hives stay silent. Avoid constant full-volume whining.

Use a browser sound mixer with separate music and effects levels, gesture startup,
hidden-tab pause, distance attenuation and stereo position around the viewed scene.
Prioritize the player's controlled asset and nearby threats. Bound simultaneous
voices and ambient loops; aggregate rapid-fire bursts instead of starting an audio
node per bullet. Remote overview must not make every enemy on the planet audible.
Preserve visual warnings for muted play. Test busy battles and mobile playback
before claiming a performance budget; no server-side audio synthesis is needed.

Travel/combat BGM crossfading remains separately planned in
[BACKGROUND_MUSIC.md](BACKGROUND_MUSIC.md). New terrain and planets remain in
[VEHICLE_POLISH_ROADMAP.md](VEHICLE_POLISH_ROADMAP.md).
