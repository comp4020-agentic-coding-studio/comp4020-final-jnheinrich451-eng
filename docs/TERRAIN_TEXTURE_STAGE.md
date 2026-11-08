# War-zone terrain texture stage

8 November 2026. The author asked whether the war-zone maps could have better
texture, and said the facilities and robots are already well designed; enemies
and terrain are the parts to change. Claude reviewed the three planets and
proposed this stage: terrain first, enemies designed later. The author approved
the terrain fix ("Yes please the Terrain fix, the enemies, we can design later").
Textures are drawn in code; the author did not choose painted texture images,
which remain possible later.

## Problems found

From the 2 November battlefield screenshots and the drawing code:

- Coasts, shallows and shores were filled one whole tile at a time, so every
  lake and island edge was a 48-pixel staircase.
- Vesper's moss patches were flat squares four tiles wide, so its ground read as
  a checkerboard. Caldera already used smooth noise; Vesper and Sirocco did not.
- Terrain chunks were drawn at fractional pixel positions when zoomed, leaving
  faint seams every 16 tiles.
- Vesper ridges and Sirocco mesas repeated one drawing every four or five tiles,
  cut off square at the ridge edge.
- Grass, sand and rock met at hard tile edges, with no wet sand, foam or depth.

## Implemented behaviour

Presentation only. The saved terrain, mountain and water masks are read and never
changed; movement, cover, placement and collision still come from the tiles.

- `public/ground-art.js` paints every planet's ground, water and ridges. Coasts
  and ridge outlines follow a blurred signed distance to the saved edge, held
  within `EDGE` (0.35 tiles) of the exact distance. A straight edge stays exactly
  on the tile boundary, a drawn edge never strays more than 0.35 tiles from the
  saved one, and every tile centre shows its own saved surface, so a one-tile
  island or a narrow river never disappears.
- Water gets depth shading over four tiles, a shallow band and a thin foam line;
  land beside water gets a wet band. Sirocco's sand sea keeps its dunes, now with
  wandering crests, and a darker firm edge instead of foam; its oases foam.
- Sand meets ground along a gently wandering line instead of a tile edge.
- Ground colour drifts on a quarter-tile lattice: Caldera keeps its meadow
  drift; Vesper's square patches become continuous moss; Sirocco is mottled lightly.
- Vesper ridges are rough rock lit from the shared upper-right sun, with patchy
  snow on the highest levels. Sirocco mesas are flat sun-baked tops inside a dark,
  layered cliff collar whose sun-facing faces glow. Both cast a soft shadow down
  and to the left. Saved ridge levels are averaged, because they change in
  four-tile blocks and are decoration only (any ridge tile blocks aircraft).
- Single rocks are faceted boulders with a contact shadow, shaped per tile.
- The hand-drawn details stay: Caldera's tufts and blue trees, Vesper's reeds,
  logs and moss clumps, Sirocco's cracks and pebbles, Sirocco's palms. Water
  ripples are sparse and offset instead of one per tile.
- Chunks are built from a half-resolution surface plus full-resolution details.
  `drawTerrain` snaps chunk corners to whole device pixels, which removes the
  seams, and builds new chunks within a 12 ms frame budget; a chunk still
  waiting shows the overview image for its patch.
- The far-zoom overview and minimap use the same painter at four pixels a tile.
  Flooring that comes or goes repaints only its cells, as before.
- The Blight Root's converted ground now follows the painted coast and ridge
  edges instead of tile squares, and leaves a round clearing at each rock, so the
  obstacle stays visible inside the coating. The mask is computed at eight pixels
  a tile and smoothed up.

## Cost

Measured on the author's i9-14900K in Chrome, at the default 0.75 zoom:

- A detailed chunk took 1 to 4 ms before and takes about 7 to 9 ms now. The frame
  budget spreads a fresh desktop view (about 15 chunks) over roughly eight frames.
- The full overview takes about 140 ms (Caldera) to 300 ms (Sirocco) once, at load.

Phone cost was not measured on a phone. Chunks are cached as before (32 kept), so
the cost is paid once per area visited.

There is no per-pixel speck in the ground. A first version had one, and
`sirocco-naval.spec.js` (desktop) failed: its submarine stopped after burrowing.
The same spec passed with the previous painter in a copy of the tree. A
reproduction on the E-cores found no long frames or tasks; instead the test's
full-screen PNG screenshot took about 550 to 640 ms with the speck against 110 ms
before, because per-pixel grain barely compresses. That paused the page past the
pilot's 700 ms input lease, and the server's `stopShip` then cleared the throttle.
Swapping parts in the copy showed the cause: a flat chunk surface, a JPEG
screenshot or a tiny clip were all fast, while 'high' upscale quality, device-pixel
snapping and frozen `ImageBitmap` chunks made no difference. Without the speck the
screenshot takes about 126 ms, the PNG is 376 KB instead of 1.1 MB, and the
submarine keeps its throttle. Players never take these screenshots, but other
tests do, mid-drive.

## Validation

Local checks only; nothing here is deployed or playtested by the author yet.

- `spec/terrain-art.test.ts` (11 tests) checks, on the busiest edge regions of all
  three planets, that every drawn coast and ridge stays within 0.35 tiles of the
  saved edge (worst measured: 0.31 tiles on Caldera and Vesper, 0.19 on
  Sirocco), that every tile centre shows its saved surface, that a straight coast
  stays exactly on the tile boundary and a one-tile island stays visible, that a
  single repainted overview cell matches the whole-map paint, and that painting
  never changes the saved world. The existing terrain-repaint, Sirocco
  presentation, unit HUD and map-horizon specs still pass, and `tsc --noEmit`
  is clean.
- Browser specs on the E-cores: gpu-reset, hud, vesper, sirocco, sirocco-naval,
  planet, survey-zoom, landing-zones, contaminator, construction-presentation,
  hazard-visibility, bridge-building and modifier: 33 of 33 passed on the final
  code with retries off. The full unit suite (1,333 tests) passed before the
  speck was removed; the terrain unit specs passed again after.
- A scripted session on an isolated server created a campaign on each planet at
  1920 x 1080 and 390 x 844, landed, walked with the keyboard, visited lake,
  coast, ridge and mesa regions, zoomed to survey, opened the M overview and
  resized the desktop window. No page errors and no page scroll; screenshots
  were inspected.
- Before/after renders of the same places with the previous painter (taken from
  the last commit) are in `docs/testing/evidence/2026-11-08/terrain-*.png`.

## Open for the author's playtest

- Whether the look suits each planet, especially Vesper's rock and snow and
  Sirocco's mesa tops, and whether rocks read clearly enough as obstacles.
- Survey zoom (below 0.5) still shows the four-pixel overview, which is softer
  than close views; a sharper survey image would cost more memory and load time.
- Whether to keep textures in code or supply painted texture images.

## Not in this stage

Enemy art and behaviour (the author will design these later), alien converted
ground and compound floors, conquered-site scars, and painted texture images.
