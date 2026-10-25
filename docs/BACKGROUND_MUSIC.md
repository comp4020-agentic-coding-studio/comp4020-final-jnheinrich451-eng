# Background music

Implemented locally, 23 October 2026. This stage uses only the author's supplied
`audio/Apex_Of_Conquest.mp3`; the source file is unchanged. A byte-identical runtime
copy lives in `public/audio/`, which the existing Docker build includes.
See its README for source provenance.

The track loops during travel, construction and combat. Playback starts after a
click, tap or key press, respecting browser autoplay restrictions. Help (?) has
music on/off and volume controls near the top. The default is enabled at 25%.
Preferences persist in this browser, separately from campaign saves. Hidden tabs
pause playback; returning resumes when browser policy permits. Playback failures
show a retry instruction without blocking gameplay. There is one HTML audio
element per page, no server music simulation and no added sound effects.

Chrome decoded 177.058 seconds of stereo audio. A decoded 48 kHz measurement found
approximately 1.20 seconds below amplitude 0.001 at the end of the first channel.
This is a quiet tail, not a claim of a seamless musical loop. Native looping keeps
the supplied composition intact; the listener may hear its ending before restart.

Future, not implemented: ordinary and combat tracks can crossfade over roughly
2-4 seconds. Use combat activity near the player, keep combat music active briefly
after the last threat, and apply a minimum dwell time to avoid rapid switching.
Crossfading smooths volume changes but does not automatically align tempo, key or
phrases. Matching edits or stems would provide tighter musical transitions.
`Steel_Wrought_Ascent.mp3` is not assigned or shipped in this stage.

Validation: desktop 1920 x 1080 and phone 390 x 844 Chrome playback, actual loop
wrap at end-of-track, off/volume persistence across reload, simulated visibility
pause/resume, Help/Escape and screenshot inspection. Browser checks assert correct
MP3 content type and byte count. Source and runtime SHA-256 hashes match.
Typecheck, JavaScript syntax and whitespace checks pass. These are local checks,
not deployed playback or tests on physical iOS/Android devices.
