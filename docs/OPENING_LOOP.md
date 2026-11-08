# Opening loop

Status: built locally on 8 November 2026 at the author's request; awaiting the
author's playtest. Nothing here is deployed yet.

## What the author asked for

After approving the idle loop of scene 04 (the yellow robot standing in its
opened drop pod on blue grass), the author asked for it to be placed "at the
entry of the game", with a shining line such as "SKIP WITH ANY KEY". A key
blacks the screen out and the player enters the login page.

## Behaviour

- The opening is a title screen in front of the entry pages. It plays on `/`,
  `/campaigns/` and `/login/`, once per browser tab session (`sessionStorage`
  `frontier-opening-seen`). Reloading, returning from a room, logging in and the
  other account pages never replay it. A new tab or window starts a new session,
  so it plays again.
- The loop repeats until the player acts. Any key, click or tap skips it. Lone
  modifier keys and Ctrl/Alt/Meta shortcuts stay with the browser and do not
  skip. The key that skips is swallowed, so it never reaches the page beneath
  (no Enter on a lobby button, no Escape back).
- Skipping fades the screen to black over 0.7 s.
  - A signed-out player on `/` is sent to `/login/` by the lobby. The lobby
    waits for the black and keeps it, and the login page fades in from black
    (`frontier-opening-handoff`, honoured for 5 s).
  - A signed-in player on `/login/` is sent to `/campaigns/` the same way.
  - Otherwise the black lifts over the page underneath (the lobby, or the login
    form).
- The line reads "Press any key to skip" on keyboard devices and "Tap to skip"
  on touch screens (`hover: none` and `pointer: coarse`). It uses the entry
  gold, has a halo that breathes, and a white shine sweeps across it every 3.3 s.
- Reduced motion shows the first frame as a still picture (no video download)
  and a steady line, and keeps the gate.
- A hidden tab pauses the video. A page restored from the back/forward cache
  never comes back black.
- Automated browsers (`navigator.webdriver`) skip the opening, so test runs and
  preview screenshots start on the page itself. `tests/browser/entry-opening.spec.js`
  reports a person's browser to exercise it.
- The opening is presentation only. It stores two `sessionStorage` flags, never
  changes what the server admits, and does not touch the entry scene's saved
  sky phase or camera.

The arrival fade from `frontier-opening-handoff` is also used by the war zone's
Account settings link (9 November 2026): the battlefield fades to black, sets the
flag and opens the account page, which fades in. The account page's Return to
battlefield sets `html[data-opening="leave"]`, a 0.5 s fade to black, before the
game page, which starts black and lifts its own cover.

## Files

- `public/entry-opening.js`: a classic script in `<head>` of `campaigns.html`
  and `account.html`. It decides before first paint (`html[data-opening]`),
  builds the overlay and exposes `window.frontierOpening` (`active`, `done`,
  `navigating`). `campaigns.js` and `account.js` await `done` before their
  redirects and set `navigating`.
- `public/entry-opening.css`: the overlay, the line and the black hand-off.
- `public/assets/entry/opening-loop.mp4` (3.6 MB) and `opening-poster.jpg`
  (frame 0), with provenance in `opening-manifest.json`.
- `server.js` serves `.jpg` as `image/jpeg`. The existing byte-range MP4 route
  serves the loop.

## The video

- 10 s at 30 fps, 1672 x 940, H.264 with one keyframe, no audio.
- It is rendered from `output/video-frames/scene-04-robot-deployment-v1.png` as
  a layered 2D animation, not a generative video.
- Every motion repeats a whole number of times in 10 s, so the last frame leads
  into the first. Measured on the uncompressed frames, the wrap differs from
  frame 0 by the same amount as any neighbouring pair.
- After compression, the wrap differs by about 2 grey levels of fine edge
  noise, which could not be seen at 2x zoom.
- Robot motion is micro: about 1.5 px at the head, 2.5 px at the weapon muzzle
  and 4.6 px at the free hand, with planted feet.
- On phones the portrait crop centres the robot; the sun and trees fall
  outside it.

## Checks (local only)

- `tests/browser/entry-opening.spec.js` covers five cases. Each ran green on
  8 November 2026 under a config without the shared `webServer` (the specs start
  their own servers):
  - A guest at 1920 x 1080: the key blacks out into `/login/`, then reload and
    revisit do not replay it.
  - A signed-in player: a click reveals the lobby, and a new tab at `/login/`
    hands over to `/campaigns/`.
  - A phone at 390 x 844: Tap to skip.
  - Reduced motion.
  - Automated browsers.
- Existing specs ran green beside them: `entry`, `entry-alignment`,
  `orbital-entry`, `campaigns`, `accounts` and `colonization-lobby`.
- Screenshots were inspected at desktop and phone sizes.
- None of this says anything about Fly. The extra 3.6 MB per first visit has not
  been measured on a deployed machine.

## Open for the author

- Wording: the brief said "SKIP WITH ANY KEY or something like this". This
  build uses "Press any key to skip".
- Whether music should start with the opening. It is silent now; browsers block
  sound before the first key anyway.
- Whether once per tab session is the right frequency, rather than once per
  browser or every visit to `/`.
