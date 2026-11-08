# Planet music

## Assignment, 9 November 2026

War Zone previously used Apex of Conquest on every planet. The author requested
Crimson Vanguard on Sirocco and Steel Wrought Ascent on Vesper, retaining Apex on
Caldera. They also supplied three colonization tracks and requested one for each
peaceful planet, leaving the pairings to Codex. The chosen assignments follow the
planet descriptions: Morrow's freshwater ponds, Nacre's tidal wetlands and
Aurelia's golden uplands.

| Mode | Planet | Track |
| --- | --- | --- |
| War Zone | Caldera | Apex of Conquest |
| War Zone | Sirocco | Crimson Vanguard |
| War Zone | Vesper | Steel Wrought Ascent |
| Colonization | Morrow | Twilight Over the Still Lake |
| Colonization | Nacre | Harvest at Low Tide |
| Colonization | Aurelia | Sun Drenched Sanctuary |

One browser-owned player selects its track from the authoritative world's
`template`. Music starts after a player gesture, loops, pauses while the tab is
hidden and does not restart on repeated snapshots for the same planet. The music
toggle and volume share the existing browser preference across both modes and
remain independent of effects. War Zone keeps its field-guide controls;
Colonization exposes the same controls in Crew. Earlier peaceful saves use the
existing civilian planet grouping without changing their terrain or save data.
This stage does not add music to the campaign menus.

The six runtime MP3s are unchanged copies of the author's supplied files in
`audio/`. [Runtime provenance and exact filenames](../public/audio/README.md)
record what is known, including the author's Gemini attribution and the missing
generation metadata. No external audio service is called during play.
Generated weapon effects have their own
[integration record](WAR_ZONE_GENERATED_AUDIO.md).

## Playback validation

The music player also corrects an existing loading race: hiding and reopening
the tab, or toggling music off and on, while `play()` is pending could leave it
paused after an abort. It now remembers the resume request and retries once
when that attempt settles. A blocked autoplay or failed asset does not trigger
automatic retry loops, and a changed track ignores stale playback results.
Seven focused cases in `spec/music.test.ts` cover these states, an early player
gesture and repeated snapshots retaining playback position.

Local verification on 9 November 2026 passed those seven cases, the two supplied
invariants, TypeScript and the process evidence check. Four native Chrome browser
checks passed at 1920 x 1080 and 390 x 844: all six real campaign pages select the
assigned file and label, play advancing audio with nonzero captured samples,
retain mute/volume between maps and load each track only once through snapshots.
The existing loop/visibility checks pass, and colony controls work by keyboard
and after resizing to 1024 x 768 or 844 x 390. Desktop, phone and resized Crew
screenshots were inspected. The tests use temporary campaigns and do not access
the author's saves. These checks verify browser playback, not a listening review
of musical balance on the author's device.

## Historical planning sources

The original planning note reviewed these sources on 20 October 2026. That review
is historical, not a fresh verification of current terms or track-specific
licensing. Exact prompts, model versions, generation dates and applicable terms
for the five newly assigned tracks have not been supplied.

- [Gemini music help](https://support.google.com/gemini/answer/16901237?hl=en)
- [Google terms](https://policies.google.com/terms?hl=en)
- [Lyria original-expression and similarity-filter guidance](https://blog.google/innovation-and-ai/products/gemini-app/lyria-3/)
