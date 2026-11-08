# Source assets used by Frontier

Audited 9 November 2026. This folder retains **28 original source files** as
evidence: 24 media files and four license notices, approximately 2.18 MB in total.
All other files in the local source library stay ignored and remain on disk.

Status labels describe the working tree inspected on this date, including
gameplay updates that are not part of this asset-only commit. They distinguish
what is drawn today from startup/preparation dependencies and earlier usage.

| Source pack or sheet | Retained files | Verified use |
| --- | ---: | --- |
| Topdown Tanks Remastered | 11 PNGs + License.txt | One drawn sentry barrel, nine startup image dependencies, one preparation dependency |
| Emote Pack / Pixel / Style 1 | 6 PNGs + License.txt | Emote wheel and emotes above the controlled unit |
| concept/cuculidae-sheet.png | 1 PNG | Source sheet of the extracted top-view entry ship |
| Desert Shooter Pack | 3 OGGs + License.txt | Earlier weapon sounds, retained as historical evidence |
| Sci-Fi Sounds | 3 OGGs + License.txt | Earlier weapon sounds, retained as historical evidence |

## Exact selection

From `2D assets/Topdown Tanks Remastered/PNG/Default size/`:

- `tankDark_barrel1.png` is drawn by the sentry renderer in `public/app.js`.
- `tileGrass1.png`, `tileGrass2.png`, `tileSand1.png`, `tileSand2.png`,
  `tankBody_sand.png`, `tankSand_barrel1.png`, `tankBody_dark.png`,
  `treeBrown_small.png` and `treeGreen_small.png` are still loaded during game
  startup. No current draw calls were found for these nine images.
- `sandbagBeige.png` is exported by `scripts/prepare-assets.mjs`, but is not
  currently loaded or drawn. It remains so the existing preparation command can
  reproduce its complete output from this checkout.

These are the eleven entries in `public/assets/kenney/manifest.json`. Terrain
and most current units use Canvas drawing code; these older sprites should not
be presented as the source of all current game artwork.

From `2D assets/Emote Pack/PNG/Pixel/Style 1/`: `emote_faceHappy.png`,
`emote_heart.png`, `emote_question.png`, `emote_alert.png`,
`emote_exclamation.png` and `emote_stars.png`. Their labels and loading paths are
in `public/emotes.js` and `public/communication-ui.js`.

`concept/cuculidae-sheet.png` is the source of
`public/assets/entry/cuculidae-top.png`, used by `public/entry-ship.js`. The
existing entry manifest records the original hash, crop and palette conversion.
This is the author's supplied concept sheet; the Kenney CC0 notices do not apply
to it. Its permission statement remains in that entry manifest.

Historical sound mapping:

| Source under this folder | Earlier runtime copy |
| --- | --- |
| 2D assets/Desert Shooter Pack/Sounds/shoot-g.ogg | public/audio/effects/gun.ogg |
| 2D assets/Desert Shooter Pack/Sounds/shoot-h.ogg | public/audio/effects/cannon.ogg |
| 2D assets/Desert Shooter Pack/Sounds/explosion-a.ogg | public/audio/effects/blast.ogg |
| Audio/Sci-Fi Sounds/Audio/laserLarge_000.ogg | public/audio/effects/rail.ogg |
| Audio/Sci-Fi Sounds/Audio/thrusterFire_000.ogg | public/audio/effects/missile.ogg |
| Audio/Sci-Fi Sounds/Audio/lowFrequency_explosion_000.ogg | public/audio/effects/rumble.ogg |

The current working-tree sound catalogue selects generated recordings instead.
`public/audio/effects/README.md` records the replacement. These six files are
evidence of the earlier implementation, not a claim that they are still heard.

## Verification and boundaries

[`used-assets.json`](used-assets.json) records every selected source path,
SHA-256, byte size, runtime destination, relationship and code/document evidence.
All 23 unchanged PNG/OGG copies match their runtime files byte-for-byte. The ship
sheet and its extracted runtime sprite match the existing derivative manifest.
The four original Kenney license notices are retained; runtime copies have the
same license text, with whitespace differences in three of them.

Run `node scripts/check-source-assets.mjs` from the repository root. It verifies
source and runtime hashes, license text, and that Git sees exactly the 28
selected source files plus this README and the manifest under `assets/`.

Audit validation also checked the staged Git blobs against all 28 original
hashes. An isolated temporary directory containing only the retained tank pack
sources and the existing preparation script reproduced all eleven runtime PNGs
and their manifest. The original source library and game saves were not changed.

The remaining asset packs, previews, alternate sizes, archives, catalog files
and unshipped concept studies stay ignored. `robot concept/Robot.png` was retired
in the intro design record; the four `video concept/` images are earlier studies.
Current music, generated sound effects, cinema, fonts, MYCORRHIZAL and the
opening loop have sources outside this root folder and are outside this audit.

Runtime copies remain under `public/`; Docker still excludes root `assets/`.
This commit records source evidence and changes no gameplay or media selection.
