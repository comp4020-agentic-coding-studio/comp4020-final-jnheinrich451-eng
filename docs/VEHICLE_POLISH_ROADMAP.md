# Vehicle polish and world variety

Agreed 23 October 2026. These are staged follow-ups after helicopter and
submarine Remote. Stages 1-2 are implemented locally; stages 3-6 remain future work.

1. **Tank appearance and movement effects - implemented locally.** A fictional
   heavy tank inspired by the Challenger 2 silhouette: broad tracks, angular
   turret cheeks, sloped hull armor, engine grille and a long recoiling cannon.
   Track links follow signed travel and hull turning, including reverse motion.
   Sand produces a stronger dust trail than grass; water and metal floors produce
   none. Dust uses at most ten analytic puffs per rendered tank, with no growing
   particle collection or server state. Reduced effects disables dust and track
   animation. Existing recoil drives the new hull and cannon. Gameplay footprint,
   acceleration, steering, health, weapons and guard behavior are unchanged.
   Validation: 20 tank/motion/guard tests, typecheck, desktop (1920 x 1080) and
   phone (390 x 844) driving/reload checks, inspected screenshots, and canvas
   checks for sand/grass versus floor/water/stopped/reduced dust suppression.
2. **Recycler and bridge-builder handling - implemented locally.** Both retain
   their appearances and 3.5 tiles/s forward limit. The recycler accelerates and
   steers more quickly; the builder feels heavier. Release WASD to brake, hold
   the opposite direction to brake then reverse, and slow for tighter turns.
   Remote recyclers brake and align at route corners and stop before collecting
   or unloading. Manual collection waits for a stationary half-second. Sand and
   grass produce bounded dust; flooring, water and reduced effects suppress it.
   Expired input, disconnect, boarding/exit and restart clear manual momentum;
   bridge construction holds the builder still. See [handling](VEHICLE_HANDLING.md).
3. **Friendly wrecks and recycling.** Reuse the facility-ruin visual language for
   destroyed vehicles. Allow recycling friendly destroyed facilities and vehicles
   on land. At sea, an armored transport carrying a recycler can stop over a wreck
   to recover it. User's salvage rule: half the resources spent when it was built.
   Use a saved purchase receipt and one finite salvage balance per wreck; never
   award resources twice after partial collection, reconnect or competing collectors.
   Before implementation, settle how the recorded GND/ORB price maps to raw
   salvage and the existing ground-processing/rocket-shipment branches, including
   free or old assets without receipts. Preserve destruction and conquest history.
4. **Deployment icons and facility art.** Give orbital-strike types, support
   outposts, bridge builders, empty airbases and tank pods clearer catalogue icons.
   Refine missile-launcher and rail-cannon appearances using the existing overhead
   canvas style. Keep placement previews consistent with actual footprints.
5. **Audio.** Add and balance movement, firing, impacts and UI sounds alongside
   the supplied background music; respect mute, volume and browser audio startup.
6. **Terrain and a second planet.** Add obstacle variety, then another planet with
   distinct terrain textures. Define collision/navigation and seeded generation
   before introducing new obstacles; keep existing saved worlds intact.

Complete and play-test each stage before the next. Bound dust/wake/audio work,
support reduced effects and mobile layouts, and measure rather than assume the
runtime cost. Commit, push and deployment are separate release steps.
