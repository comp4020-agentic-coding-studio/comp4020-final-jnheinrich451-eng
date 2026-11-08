# Frontier entry: planets, identity and saved campaigns

30 October 2026. Author-directed design record, based on the supplied login,
menu, planet selection, save-list, Join and striped-wordmark sketches. This
records the presentation stage. Its first local implementation is described
below; a third playable planet and emailed campaign invitations remain future
work. Review this stage before changing enemy AI.

## Local implementation: 30 October

The author approved beginning the opening-page implementation after confirming
the recipient-bound email-invitation design. The presentation stage uses the
existing identity and campaign services. No new invitation emails are sent and
no recipient restrictions are claimed for the existing shareable codes.

- The opening login is centered over a rotating Caldera, with the original
  striped Frontier wordmark, matte lighting, a distant sun and independently
  moving stars. A small projected canvas uses baked cosmetic samples of the
  existing templates; it does not load a live world or another player's save.
- Signed-in accounts see New Game, Continue and Join. New Game offers Caldera
  and Vesper with arrows and fictional survey data. Selecting a planet reveals
  the name form; submitting saves once, then enters that campaign. If admission
  fails after saving, Continue offers the saved campaign for retry.
- Continue filters existing memberships by their saved template and displays
  open/closed status and the shared three-owned-save limit. Joining remains an
  explicit code submission. Guest entry goes directly to Join. Merely changing
  menu views never leaves an active room; Return and Save and leave remain
  separate actions.
- Account registration, verification, recovery, private Demo inbox, takeover
  and logout retain their existing service operations. Fresh visitors to `/`
  see login; `/campaigns/` also supports direct guest access to Join.
- Decorative rendering can fail without blocking the HTML forms. Pause
  animation, reduced motion and hidden tabs suspend scene motion; the short
  post-login glitch is also disabled by the motion preferences. Browser Back,
  on-screen Back and Escape navigate the campaign views.

Local validation and reviewed screenshot details are recorded at the end of
this document. These changes are not a claim of a deployment or real inbox
delivery. Recipient-bound invitation implementation is the next account-flow
stage after visual review.

## Experience and screen sequence

### Author visual refinement: 30 October

After reviewing the first local version, the author requested the following
corrections. These supersede the first pass's dim stationary sun, fixed light
direction, menu rows and translucent information panels:

- Black space with slow, independent star and blue nebula motion. A brilliant
  blue-white sun has a clear luminous core, soft dust-light shafts and a faint
  slow pulse. The supplied Galaxy on Fire 2 screenshot is a lighting reference;
  the scene remains original procedural art, with no copied game assets.
- One moving three-dimensional sun direction lights all three visible bodies.
  Behind the planets it gives dark faces and bright rims; toward the camera it
  reveals their surfaces. This is a cosmetic lighting model, not gameplay time
  or a new orbital simulation.
- Email/Demo selection updates only the account controls in place. Per-tab
  cosmetic state preserves animation time, camera composition and pointer
  offset across reload and entry-page navigation. Storage contains no account,
  invitation, form or campaign data; blocked storage remains nonfatal. Reduced
  motion, Pause and hidden-tab suspension remain available.
- Center the main heading and white menu actions; use a small glow and scale
  change for hover. Remove the translucent menu, save and Hostile panels and
  the rectangular arrow hover backgrounds. Retain accessible keyboard focus,
  readable errors and actual input-field boundaries.
- Keep Continue's right arrow at the far right, narrow its save list, and place
  Select below the globe. Planet geometry supplies the layout coordinates so
  the button follows the actual composition at desktop and phone sizes.

The entry scene is an open view of space, with controls floating over the image.
Remove the large enclosing cards and planet bounding boxes. Individual input
fields, buttons, focus outlines and concise error messages still need visible
edges and adequate contrast. Use a subtle darkening behind text when necessary,
without turning it into another framed panel. The interface remains HTML;
decorative planets never own keyboard focus or form input.

| Screen | Composition | Action and outcome |
| --- | --- | --- |
| Login | Large Caldera centered behind the form; its top may extend outside the viewport. The form may be wider than the globe. No planet-name heading here. Frontier wordmark upper left; a small sun and distant bodies remain in the background. | Email / Demo modes, email and password, Sign in, Register, Forgot password and Play as guest. An existing authenticated session goes directly to the menu. |
| Main menu | Keep the large centered planet. Brief signal/glitch transition replaces the login content with three clear options. | New Game, Continue, Join. No browser-closing Quit button. Account settings / Sign out remain available as secondary actions. |
| New Game | Smoothly pull the view back a little. Center the selected globe, name above, large previous/next arrows at its sides, scientific-style planet details to the right. | Select Caldera or Vesper, then name and create the campaign. Clearly separate choosing a template from the one action that writes the save. Continue into that saved campaign without requiring a confusing manual refresh. |
| Continue | Pull back farther and move the selected planet left. Its name stays above; the right side lists named saves with an Enter button on each row. | Planet arrows filter saves by their saved template. Show owned saves and joined campaigns with owner/member and open/closed status. Enter uses the existing server membership checks. Include a clear empty state and a link to New Game. |
| Join | Pull back to a composition of three celestial bodies, leaving the middle clear for an invitation-code field and Enter button. | Redeem the host's existing code. It identifies the campaign and its planet; joining does not create a world or require planet selection. One of the three bodies is decorative/unavailable until a real third template exists. |

Guest access goes directly to Join, with a small explanation that Email or Demo
accounts can host and keep campaign membership. Do not present an apparently
working New Game control that will inevitably fail for a guest. Keep an active
visit's Return to battlefield action available. Navigating menu views is not the
same as leaving or closing a campaign; keep Save and leave as the explicit room
action. Browser Back and an on-screen Back control return through these views;
Escape backs out of a view without submitting forms or silently signing out.

Selecting an existing save always uses that save's planet, identity and progress.
Do not reinterpret a Caldera save as Vesper because the last viewed globe changed.
The account limit is three owned saves per mode (war zone and colonization,
since 8 November 2026), not three slots per planet;
the save presentation must explain the existing limit without deleting anything.
Room-full, owner-offline, unavailable save and expired-session states stay on the
appropriate view with a useful recovery action.

## Space and lighting direction

The author's "dry" direction is interpreted as **matte, rocky, restrained and
cinematic**: visible surface texture, strong directional lighting, a readable
day/night boundary and a thin atmospheric rim. The sun is the source of the
highlight; do not add unrelated glowing edges to every object. Black space and
faint colored stars provide depth without washing out the controls.

The Assignment 1 reference was inspected read-only at
`../comp4020-ass1-jnheinrich451-eng`:

- `hero.ts` implements the first page's Three.js globe, 2,600-star 3D point field,
  depth-dependent star size, slow individual twinkle, independent sky rotation,
  directional light and limb highlight. Its fallback globe uses a rough material.
- `hotspot.ts` and the hero stack in `styles.css` add a concentrated solar flare,
  vignette and faint scanlines while keeping controls above the scene.
- `starfield.ts` is a separate seeded static SVG star generator for the stripe
  fan's exposed regions. It is not the first page's live 3D sky renderer.
- `glitch.ts` is a reference for the signal aesthetic, but its NASA archive data
  and observatory-specific text do not belong in Frontier.

Borrow that light/depth language and the calm star motion. Do not copy the Mars
model as Caldera, the observatory layout, the NASA dataset, or a dependency tree
without checking asset provenance and the implementation cost. Leave the sibling
project unchanged. Frontier can use a lightweight canvas sphere/projection or a
small isolated WebGL scene; the renderer must not become a requirement for login.
Reuse the existing Caldera/Vesper template silhouettes for visual identity, then
add cosmetic surface detail. The preview never loads another player's campaign.

Keep one foreground globe rotating about its own axis and the distant sky moving
more slowly on a different axis. Additional planets drift subtly with depth;
they must not all rotate like one flat poster. Camera position and scale change
between views while light direction stays coherent. Pointer parallax is small
and optional; touch needs no imitation hover or motion sensor. Bound particles
and pixel ratio, cache textures, and stop animation when hidden or in battle.

Provisional motion targets are a 400–650 ms camera ease and a single 180–250 ms
low-contrast glitch on successful login. Glitch affects decorative fragments or
the outgoing layer, never form values or readable error text. No continuous
flicker, white-screen flash, animation wait before a button works, or repeated
login requests. Reduced motion and Pause animation produce a stable scene and
an immediate/faded view change; a failed renderer leaves fully usable HTML forms.

## Planet information: fictional setting data

The author permits invented radius, mass, coordinates and atmosphere details.
These are **game lore**, not measurements, physics parameters or promises about
map size. Keep them with presentation metadata, separate from world generation
and movement/combat rules. The following values are initial art-direction copy:

| Field | Caldera | Vesper |
| --- | --- | --- |
| Designation | CDR / 01 | VSP / 02 |
| Radius | 6,180 km | 7,020 km |
| Mass | 5.14 × 10²⁴ kg | 6.72 × 10²⁴ kg |
| Sector position | +04.8 / −12.1 / +00.6 ly | +05.2 / −11.7 / +00.8 ly |
| Atmosphere | N₂ 78% · O₂ 18% · Ar 3% · traces 1% | N₂ 72% · O₂ 20% · CO₂ 6% · Ar 2% |
| Terrain | Island footholds, open ocean, continental fronts | Slate ridges, river crossings, lakes, green lowlands |
| Initial threat | HOSTILE | HOSTILE |

Present HOSTILE in red with text, not color alone. This is the initial template
description on New Game. Continue must not falsely overwrite a saved campaign's
conquest status with that label; use only progress actually supplied by the server
or omit a live threat claim. Avoid adding an unavailable planet to selection just
to fill the Join composition. Only `caldera-v1` and `vesper-v1` are currently
accepted playable templates in `public/planets.js` and `campaigns/service.js`.

## Frontier wordmark

An original vector study is saved as
[the SVG concept](previews/frontier-wordmark-concept.svg), with
[a dark/light and compact-size preview](previews/frontier-wordmark-concept.html).
The reviewed concept is now installed as `public/frontier-wordmark.svg` for the
local opening-page implementation.

Create an original SVG wordmark from the author's sketch: a strong initial F,
angular open letterforms, a small four-point star inside O, and a long horizontal
stripe that accelerates into a tapered tip. Add parallel red, yellow and blue
flight trails with staggered lengths and clear spacing. Use pale lettering on
space and a dark single-color fallback; do not reproduce a third-party logo.

Keep the mark legible at the top-left navigation size and on a phone. Provide an
accessible Frontier text label and a compact F/star variant for very narrow
layouts. Trails may have a restrained entry reveal, but never a looping animation
that competes with the form. Prefer code-native SVG paths so the logo remains
sharp, lightweight and editable; no raster generator is necessary for this mark.

## Accounts and invitations: current behavior to preserve

The campaign invitation is currently a **code, not an email invitation link**.
Email links belong to account verification and password recovery; those are
separate from permission to enter a particular campaign.

1. The signed-in Email or Demo host opens a campaign and chooses **Room → Create
   invitation code** in battle. The connected owner alone may issue it.
2. The server generates 24 random hexadecimal characters, displayed in four
   six-character groups. The host copies it and shares it with one person using
   their chosen communication channel. Frontier does not send it by email.
3. The recipient signs in or chooses Play as guest, opens Join, and pastes the
   code. The existing API ignores case and hyphens; it checks expiry, one-time use,
   host presence and four-player capacity, then admits that person's identity.
4. A code expires after 30 minutes, when the room closes, when unused codes are
   revoked, or on server restart. It grants access to whoever redeems it first;
   it is not addressed to a specific email. Capacity failure must not consume it.
5. An invited account keeps membership and can later use Continue while the owner
   has opened the room. A guest's personal visit is temporary; deliberate leave,
   room closure/restart or expiry of the disconnect grace ends it, while their
   construction remains in the host's world. The host can issue another code.

The new central Join field can therefore reuse the current API without a new mail
workflow. A future Copy invitation link could prefill the same code using a URL
fragment, strip the fragment from history and require the user's explicit Join
action after identity selection. That convenience is a proposal, not current
behavior or automatic email sending. Do not shorten the code or alter its
security/lifetime as a side effect of visual polish. Never log or expose codes in
public game snapshots, analytics, error dumps or unrelated URL requests.

### Recipient-bound email links: clarification before implementation

30 October clarification: the author wants an invitation sent to a real email
address to be redeemable only by the verified Email account for that address.
Guest, Demo, unverified Email and another email account must not redeem that
invitation. This is new authorization behaviour, not simply an emailed copy of
the existing bearer code. No invitation mail or runtime change is made by this
design update.

Keep two clearly labelled host actions: **Create invitation code** retains the
existing shareable access for accounts/guests; **Invite by email** creates a
recipient-bound invitation. A targeted invitation must retain its recipient
restriction even if somebody copies its token into a manual Join field or calls
the endpoint directly. Wrong-account attempts must not invalidate or consume it.

The author subsequently approved this flow, including the final Join button:

1. Opening an email link loads Frontier's entry scene and remembers the pending
   invitation. A signed-out visitor sees the normal login form with a short
   invitation notice; registration and password recovery keep that destination.
2. If an account is needed, register with the invited address, verify ownership
   through the ordinary verification flow, then sign in. An invitation link alone
   neither verifies the account nor signs the visitor in.
3. The server checks the authenticated private account: Email mode, verified
   address, and recipient match. Reuse account email normalization (trim and
   lowercase); do not invent Gmail dot/plus alias equivalence. Checking a typed
   address or trusting browser state is insufficient. A wrong identity sees
   **Sign in with the invited email**, with a deliberate switch-account action.
4. After a match, show the Join composition with the invitation already loaded,
   the campaign/planet and current account identified, and one **Join room**
   button. No retyping or displaying a long raw token is necessary. A visitor
   already signed into the correct account goes directly to this review step.
5. Only that final POST revalidates session, recipient, host availability,
   capacity and expiry, then atomically grants membership and consumes the
   invitation. Opening, previewing or logging in never consumes it. This also
   keeps mail-link previews/scanners from joining a room.

Use the tab in which the browser opens the email link. Do not promise that an
external email client can find or navigate a particular existing Frontier tab.
The flow works in a new tab, the same tab, another browser or another device;
another browser/device may require sign-in again. Account-state notifications
between same-origin tabs can improve the experience, but are not authorization.
When the original invitation tab regains focus, recheck the server session so
verification/sign-in completed in another tab is recognized. Keep a safe local
return destination across account pages; never follow arbitrary redirect URLs.
Different pending invitations must not silently replace each other's target.

The browser reference is [MDN window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open);
optional same-origin account-state notification is described by the
[Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).
Do not broadcast raw invitation tokens, private recipient addresses or credentials.

If the person is already playing elsewhere, retain that session until they
explicitly leave/switch. Explain when leaving an owned room closes it for their
teammates. An existing member can enter/return using their existing membership;
do not manufacture a duplicate membership or spend another invitation.

For the first implementation, the proposed default is to retain the current
30-minute validity and room-close/restart invalidation. The email and landing
screen must explain that the host's room needs to stay open. This timing is not
a new user-confirmed duration; changing it requires a deliberate lifecycle
decision. Full rooms and temporary host disconnection do not consume a still-valid
invitation; expired, revoked or invalidated links offer a request-new-link path.

Acceptance adds recipient-match tests (including forwarded links and attempts
through the code endpoint), verified versus unverified identity, wrong-account
retry without consumption, registration/verification in another tab, two open
invitations, simultaneous Join attempts, session switch before submission, and
explicit handling of an existing room. Do not expose the full recipient address
to an unauthorized visitor or reveal account existence when the host sends mail.
Bound invitation sending and report delivery failures; SMTP configuration alone
does not establish delivery. Real outgoing email remains a separately verified
implementation task.

| Identity mode | Existing behavior the new screens must retain |
| --- | --- |
| Email | Ordinary real address and password; registration requires an emailed, single-use verification link. Forgot password sends a separate reset link. Preserve resend, expiry, explicit confirmation, takeover and guest-to-account identity attachment. |
| Demo | Chosen `name@frontier.test` address and password; verification/recovery use an authorized private simulated inbox. Keep visible Demo labeling. It proves no real email ownership. |
| Guest | Browser-bound identity, join by host invitation, no hosting. Explain temporary visits; registration can preserve the guest's identity and contributions under the existing attachment rules. |

Real email needs a working configured provider and an actual delivered message.
The source's `smtpAvailable` status reports configuration, not inbox delivery.
The older account record includes a user-reported delivery and provider suspension;
provider recovery has not been established by this design inspection. Verify the
live registration/reset flow before calling that path ready, and keep truthful
delivery failures and Demo/guest alternatives. Do not turn a failed Email request
into a Demo account or bypass verification. No secrets or outgoing emails were
accessed for this design record.

Source anchors: `public/account.js` / `accounts/service.js` for identity and
verification; `public/app.js` room-invite handlers and `public/index.html` room
dialog for code creation; `campaigns/service.js` list/create/join/enter/invite
branches for admission and save limits; `public/campaigns.js` for current routing.

## Implementation sequence and acceptance

1. Record the exact tested/deployed build and close the current multiplayer
   release check. Two real people on Fly remains distinct from automated local
   browser evidence; do not label it complete on the strength of screenshots.
2. Build the visual scene, original wordmark and screen layouts using the current
   identity/campaign services. Review desktop and phone screenshots before tuning
   camera motion, lighting and glitch intensity.
3. Connect the existing operations, then cover the complete entry/return flow.
   Fix genuine missing API data deliberately rather than inventing save details.
4. Have an unfamiliar player enter and join without coaching; record confusion,
   corrections and the build reviewed. Only then continue to the enemy-AI stage.

Required checks for this presentation stage:

- At 1920 × 1080 and 390 × 844, all identity options and primary actions fit and
  remain reachable with the mobile keyboard open. No horizontal overflow. Long
  save names wrap or truncate accessibly; saved-list scrolling does not hide Back.
- Keyboard-only navigation, visible focus, Enter submission, labelled arrow
  buttons, Back/Escape and screen-reader status updates. Scene changes move focus
  to a meaningful heading; hidden forms are not focusable. Decorative layers
  never intercept input. Error text remains visible over every planet phase.
- Reduced motion, explicit Pause animation, hidden-tab behavior and a failed or
  disabled renderer. No glitch flash or background repaint blocks authentication.
- Email/Demo selection, existing login, registration/verification, resend, reset,
  private inbox isolation, expired link, takeover and logout; preserve ownership
  and saved pilot/vehicle state. Use test mail capture for automation and separately
  report an authorized live inbox test; do not claim one proves the other.
- Create each available planet, name the save, avoid duplicate creation on rapid
  clicks, show the three-save limit, and return to the same save after reload.
  Continue filters by saved template and explains unavailable/closed member rooms.
- Host issues a code; a second isolated browser joins with an account and with a
  guest. Test invalid, expired, used, revoked, full-room and owner-offline cases;
  a failed join preserves input and offers retry. Keep campaign isolation intact.
- Active-room return and explicit leave; session expiry during a transition,
  network failure, reconnect and server restart. Menu animation cannot manufacture
  success, replay accepted actions or resume held battlefield fire.

Visual acceptance means the authored composition, readable forms and restrained
depth survive both viewports. Functional acceptance means a new player can log
in or choose guest, create/resume/join the correct world, and understand failures.
No new enemy rules, save migration, third world, paid renderer or mail invitation
service is included in this presentation brief.

### Local check results: opening-page implementation

- Nine distinct browser checks passed across targeted runs: two existing account
  workflows, two updated campaign create/invite/return workflows, four entry
  checks, and one two-/four-participant propagation rehearsal. All used fresh
  temporary registries and browser identities, with no live inbox or user saves.
- Entry checks cover 1920 × 1080 and 390 × 844, keyboard navigation, browser Back,
  Escape, planet-filtered saves, failed Join preserving its input, a 390 × 500
  viewport, reduced motion, and a null canvas context leaving forms functional.
  The partial-create check records one Vesper save despite a rapid double-click,
  handles a forced admission failure, then enters that same save from Continue.
- Review found and corrected stale disabled controls on page-cache restoration
  and duplicate guest Join history entries on Escape; both regressions passed.
  The propagation fixture also now chooses a clear full sentry-pod footprint for
  each sample, respecting still-unfolding deliveries after a foundation is removed.
- Account checks cover Demo registration, private inbox isolation, verification,
  login, profile, logout and guest entry. These are not real email-delivery tests.
- Local propagation p95 was 467 ms with two players and 472 ms with four in this
  small fixture. These numbers do not establish live Fly or sustained-combat
  capacity. The entry/campaign checks also passed independently of that metric.
- Syntax, TypeScript and evidence checks passed. The targeted browser fixtures
  were run with an isolated local config after the redundant global test server
  stalled during teardown; final targeted runs exited normally. No full-suite
  or CI result is claimed for this working tree.
- Settled login/menu/New Game/Continue/Join screenshots were reviewed under
  `.local/entry-ui-final-2026-10-30/`, with separate desktop and phone folders.
  The layouts have no horizontal overflow. Phone creation uses normal vertical
  scrolling after planet selection. This remains distinct from author approval
  or an uncoached human entry/join rehearsal.

No commit, push or deployment was performed for this opening-page stage.

### Refinement checks: continuous sky and unboxed controls

The author's follow-up is implemented locally. The sun completes its cosmetic
orbit in four active minutes; its direction is shared by surface shading,
atmospheric rims and the visible flare. The sky uses cached procedural blue
clouds on black, with soft cached light shafts. There is no added renderer
dependency or external art asset.

Eleven targeted browser checks passed: the existing two account and two campaign
flows plus seven entry cases, now including 1280 × 900 alongside desktop and
phone. The new continuity check compares the actual paused canvas byte-for-byte
through Email/Demo changes, reload, and a saved Vesper Continue camera; it also
verifies that switching mode changes the submitted authentication kind.
Denied browser storage and a failed canvas both leave the forms usable.

Reviewed screenshots caught a Return-to-battle banner crossing the planet
heading. The heading now follows the status/banner flow, while arrows remain
aligned to the globe. After that correction and softer light shafts, the two
affected continuity/admission-return regressions passed again with normal exit.
Syntax, TypeScript, evidence and whitespace checks passed. Screenshots include
`.local/cosmic-login-desktop.png` and `.local/cosmic-login-frontlit.png`, plus
the desktop/laptop/phone entry captures under
`.local/entry-refinement-browser-2026-10-30/`.

The full-face image uses a selected cosmetic timeline position to inspect the
lighting model; it is not a measured orbit or gameplay test. These are local
checks and visual inspection, not a deployment, full-suite or human acceptance
claim. No account, campaign or battlefield save semantics changed in this pass.

### Directional planet exchange: 30 October 2026

*Replaced by the warp jump in the 31 October record at the end of this document.*

New Game and Continue arrows now exchange the foreground planet with the other
playable planet in the background over one active second. The outgoing world
shrinks toward the pressed arrow (right to right, left to left) and remains
visible there. The selected world approaches from its current background
position and grows into the foreground. Repeated presses in the same direction
can therefore approach from that side; reversing the arrow mirrors the exchange.
There is one Caldera, one Vesper and one decorative moon in the scene.

The receding world shrinks earlier than the incoming world grows. Opposing arcs
keep repeated same-direction exchanges from crossing at one center, and smaller
bodies draw behind larger ones. Each planet keeps its own spin phase. Stars,
nebula and sunlight continue on their existing timeline; the animation does not
reset them or change which campaign is selected. Rapid arrow presses start from
the currently drawn positions, with only three bodies in flight. Hidden tabs
freeze the active scene clock. Pause and reduced motion settle on the selection
immediately. The background side joins the existing per-tab cosmetic snapshot,
so reload can resume from the saved poses without changing account or save data.

Eight entry browser checks passed, including a new check of the canvas's actual
drawn positions, sizes and source buffers for both directions, repeated arrows,
rapid reversal and the final selected world. Review then caught coincident
centers during repeated right presses; after adding the curved paths, the
animation and paused-refresh continuity checks passed again (two focused cases).
The animation check also verifies separated silhouettes at similar depths and
immediate stable rendering under reduced motion. Reviewed captures are under
`.local/planet-arrow-arc-regression/`. JavaScript syntax, TypeScript, evidence
and scoped whitespace checks passed. This remains a local presentation change;
no commit, push or deployment was performed.

### Visible sky rotation and smooth camera movement: 30 October 2026

The author found star rotation hard to see and planet exchanges/zooming visibly
choppy. The previous renderer gated drawing at 50 ms (nominally 20 FPS), while
the sunlight cache expired after roughly 23 ms, causing every drawn frame to
re-shade the planet textures. These were browser rendering costs.

Stars now rotate about one degree per active second around the viewing axis,
relative to the fixed controls and planet positions. The nebula turns slightly
more slowly to retain depth. The existing scene clock keeps this motion
continuous between pages; hidden tabs, Pause and reduced motion still stop it.

Scene movement and compositing now follow `requestAnimationFrame` directly.
Slow surface spin/lighting are sampled every 100 ms and the resulting globe
images reused between samples. Pausing renders the exact saved phase so reload
continuity is preserved. Projection geometry is shared by globe resolution,
pixel alpha is initialized once, and a cached atmospheric rim replaces repeated
shadow-blurred strokes. Canvas resolution remains bounded; this does not raise
the texture size or add a renderer dependency.

Before/after profiling used the same isolated headless Chrome fixtures at
1280 × 900 and 390 × 844, with frozen copies of the previous renderer. On the
local browser's approximately 144 Hz animation clock, desktop median scene-draw
intervals fell from 55.5 ms to 6.9 ms. Arrow p95 intervals fell from 56.5 ms to
10.7 ms; the first arrow's synchronous draw fell from 18.9 ms to 6.7 ms.
Main-thread work across the approximately 5.2-second arrow scenario decreased
from 1,040.5 ms to 751.5 ms. Both viewports improved from about 19 to about 144
submitted scene frames per second. This measures local canvas submission and
CPU work, not physical display presentation, low-end-device performance or Fly
capacity. Periodic surface shading remains the more expensive part of a frame.
Snapshots, JSON results and repeatable profiling scripts are in
`.local/entry-fps-profile/`.

All eight entry browser checks passed after the optimization, covering desktop,
laptop and phone layouts, rapid/repeated arrow use, reduced motion, exact paused
reload, storage/canvas fallback and campaign admission recovery. Syntax,
TypeScript, evidence and scoped whitespace checks passed. The captured desktop
scene was visually reviewed. These changes are local and have not been deployed.

### Room-notice alignment correction: 30 October 2026

The author reported the New Game planet title and Select button moving out of
place when reminded to save and leave an active room. The controls followed
document flow, but their spacing assumed a fixed header without room/status
notices. The canvas globe stayed at its original viewport position. Scrolling
also moved the controls independently of the foreground planet.

The destination now measures its document origin below the header and notices.
The foreground globe, arrows, title and Select spacing use that shared geometry.
Resizing the notices updates the origin without resizing or observing the
destination itself. The foreground globe follows page scrolling, including when
animation is paused; distant bodies and the sky retain their own positions.
Planet exchanges interpolate the foreground scroll contribution, and explicit
menu navigation returns to the top. Account and room admission rules are unchanged.

The author then asked to remove the redundant current-room notice because
Continue already provides that flow. Signed-in players now see Return / Save and
leave only on Continue, not on the main menu or planet selection. Selecting a
planet still opens the creation form while a room is active; that form provides
an Open Continue action and keeps Create disabled until the current room is left.
This never silently closes a shared room. Guest visitors retain their room
controls on Join because they cannot access Continue.

Typechecking, JavaScript syntax and scoped whitespace checks passed. All eight
existing entry browser cases passed, plus three new isolated real-room checks
at 1280 x 900, 1280 x 720 and 390 x 844. The new checks compare the actual painted
globe with the DOM controls, bound the Select gap, check title/notice separation,
and cover room entry/leave, paused scrolling, reload, planet changes and resizing.
After the author's simplification, all eleven cases passed again, including
Continue-only room controls and the creation form's explicit Continue action.
Phone captures were reviewed under `.local/entry-continue-full/`; the full run
is recorded in `.local/entry-continue-full.log`.
This correction is local and has not been deployed.

### Floating lobby feedback and save management: 30 October 2026

The author requested that Room list updated and similar notices take no layout
space and have no bounding box. Lobby status feedback now floats near the bottom
of the viewport with transparent background, no border and readable text shadow.
It does not intercept battlefield-style scene or form clicks; the Sign in again
link remains interactive when needed. Success messages expire after five seconds;
errors stay until the next action so they can be read. Neither kind moves the
planet, title, save list or forms.

Continue also has unboxed Delete actions beside owned saves, followed by a named
inline confirmation with Cancel and Delete save. Escape cancels before leaving
the page. Open/reconnecting/saving worlds cannot be deleted; joined worlds never
show the owner action. Successful deletion refreshes the list and slot count;
failed requests preserve the save. Persistence and archive semantics are recorded
in [CAMPAIGN_STAGE.md](CAMPAIGN_STAGE.md#30-october-2026-owner-save-deletion).

The two new save-management browser cases and eleven existing entry/alignment
cases passed. They verify transparent, borderless feedback without geometry
changes, success expiry, persistent errors, owner-only actions, cancel/Escape
without a request, failed-deletion retention, real deletion and reload, and slot
reuse. Phone confirmation captures were reviewed under
`.local/save-management-verified/`. Typechecking and all 932 tests also passed.
Checks use isolated accounts and worlds; this remains a local change.

### Campaign naming form: 30 October 2026

The campaign-name field is centered beneath its heading, capped at 440 px and
responsive to the available width. Create and enter sits underneath the field
at every viewport size. Focusing the field changes its existing border to a
subtle light color instead of drawing the outer blue outline. Other controls
retain their keyboard focus indicators.

Desktop (1920 x 1080) and phone (390 x 844) browser probes verified centered
controls, a 12 px field-to-button gap, retained typing and keyboard navigation,
and no visible outer input outline or horizontal overflow. Screenshots were
reviewed under `.local/create-form-style/`. The existing Vesper creation and
admission-retry browser case also passed. No save or account logic changed.

### Ship, warp jump and drop-pod dive: 31 October 2026

The author supplied concept art for the Cuculidae and asked for it to hover over
the destination, jump between planets and send a drop pod into the planet as the
new loading sequence. Login, the main menu and Join are unchanged. The author
chose the warp streak, one shared dive for New Game and Continue, and using the
concept image directly. Timings and art are provisional until the author's
playtest.

**Hover.** New Game and Continue show the ship over the globe, nose up and slightly
right, 0.8 of the globe's radius long (0.64 on phones), with a minor sway and three
red tails. It is positioned from the globe, so it scrolls and resizes with the
destination.

**Jump (1.6 s).** Charge 0.5 s: the ship turns toward the pressed arrow and the stars
lean. Streak 0.25 s: it stretches into a line and leaves. Arrival 0.85 s: it collapses
back in from the opposite side. The globes hold still, then swap in a single frame
at the flash's peak, which is never pure white. The world just left stays behind the
ship in the sky, replacing the old rule that it recedes toward the arrow. The new
title fades in on arrival. Presses before the swap only change this jump's
destination. A press after it waits for the arrival, so the ship never teleports.

**Dive (7 s, then 1 s to black, then 1.2 s fade into the game).**

| Step | Time | What happens |
|---|---|---|
| Zoom | 1.5 s | Lobby fades, camera pushes in until the ship fills the frame |
| Release | 1.5 s | Pod leaves the port side from under the hull; ship runs ahead and out of frame; daylit ground rises beneath them |
| Dive | 4 s | Camera follows the pod over a real coastline as flames, sparks and clouds build |
| Dark | 1 s | Page fades to black, then the game opens |

The pod follows the ochre canisters under the concept's hull. Ground uses the
selected planet's own preview map, blurred once to soften its stepped coast, lit
evenly so the dive shows land even when the ship is over the night side. The target
is the nearest coast to the pod, so land and sea are both in view. Clouds pass the
edges of the frame and leave the centre clear.

**Rules.**

- New Game's dive starts at Create and enter, Continue's at Enter. The server has to
  create the save first, so choosing a planet does not start it.
- The pod holds at the end of the zoom until the server admits the player. A refusal
  reverses the camera and shows the error. Failed creation-then-entry still keeps the
  save and offers Continue, as before.
- Any click, tap or key skips to a faster fade. Return, refresh, direct links and Join
  use only the black fade-in.
- Reduced motion and Pause animation play no dive. A hidden tab freezes the scene
  clock, so a wall-clock limit still completes entry.
- All of this is browser-only and stores nothing. It reads the same baked preview
  maps as the globe, never a save.

**Game page.** `#loading` is now a black cover with no text. "Establishing uplink"
appears only after 3 seconds, and failures stay readable at once. Once the first
battlefield frame paints, a black layer fades for 1.2 seconds without capturing
input, then removes itself.

**Correction to the brief.** The brief said game files would download during the
dive. They cannot: static JS is served `no-cache` with no validators, so a browser
must fetch it again on navigation. The 161 game files load after the screen is
black. See the checks below for what was measured.

**Asset.** `public/assets/entry/cuculidae-top.png` is the top view alone, cut from the
author's concept sheet as the largest connected opaque shape, then reduced to 255
colours (75 KB). `public/assets/entry/manifest.json` records its source and hashes.
The sheet stays in the ignored local `assets/concept/`.

**Checks.** All local, on isolated saves; no author playtest, Fly run or slower-device
measurement yet.

- `pnpm exec vitest run`: 137 files, 1090 tests passed. `pnpm typecheck` passed.
- `entry.spec` 12 of 12, including new cases at 1920x1080 and 390x844: the pod holds
  past the zoom until the server answers, the sequence reaches the game, and the cover's
  opacity is sampled per frame through a real gradual fade. Others cover refusal, skip,
  Return with no dive, reduced motion with no dive, and a failed load staying readable.
- Reviewed captures at both sizes, day side and night side, on Caldera and Vesper.
  Reviewing them found problems the tests could not: an empty dive over the night side,
  flat full-frame cloud, tiled ground texture, and the ship crossing the phone title.
- Keyboard entry, and a resize from 1920x1080 to 1280x800 mid-dive, navigated at 8.03 s
  with no page errors.
- The game was ready about 430 to 480 ms after navigation on localhost. Over the
  network this gap is unmeasured; the words on the cover appear after 3 seconds.

### Join arrival and top-down pod: 2 November 2026

[Join arrival and runways](JOIN_ARRIVAL_AND_RUNWAYS.md) adds a warp to Join and
replaces the side-on canister and comet tail below with a top-down pod and heat ring.

### Ship size and dive frame pacing: 31 October 2026

After playing it, the author asked for the ship at 80% of its size and reported a low
frame rate during the drop, asking whether that was a resource compromise.

**Size.** The hover ship is 80% of its first length at every screen size. The camera
still fills the frame with the hull, so the close-up is unchanged and the zoom travels
25% further. The globe and the ground under the dive are magnified 25% more with it.

**Cause.** It was a resource compromise, and it broke this document's rule. Globe
surfaces are reshaded only ten times a second, which cannot be seen at hover size. The
dive kept doing that behind a zoom that enlarges the planet about six times, and through
the dive itself, when the ground hides the globe completely. Measured on the author's
machine, before the fix:

- The frame rate itself was not limited: 90 to 100 fps through the flight on the RTX
  5070 Ti at 2560x1440, 81 to 85 on the Intel UHD 770, and 94 on a blank page in the same
  automated window. Switching off the ground, grain, cloud, flame or edge layers one at a
  time made no measurable difference.
- With the camera still in the admission hold, in daylight, the planet changed on only
  15 of 144 frames, about 100 ms apart. The magnified planet was moving at 10 fps.
- Each reshade blocked the page for about 11 ms, against 0.4 ms for an ordinary frame.
  With Chrome's CPU throttled four times, the average stayed at 58 fps but the slowest
  5% of frames took 47 ms, ten stutters a second.

**Fix.** A flight keeps its first surface sample, so no globe is reshaded until it ends.
A refusal after a long hold lets the surface catch up with one small step. Hiding the
sky and globes during the dive saved too little to measure, so they are still drawn.

| Dive phase | Before | After |
| --- | --- | --- |
| Script time, slowest 5% of frames | 10.6 ms | 0.8 ms |
| Same, CPU throttled 4x | 44.6 ms | 4.0 ms |
| Frame interval, slowest 5%, throttled 4x | 47 ms | 13 ms |
| Average fps, throttled 4x | 58 | 98 |
| Globe reshades in a flight | 210 | 0 |

The last row comes from a headless run at 1920x1080 with the fix switched off in memory.
The other rows are from a real browser window at 2560x1440. `entry.spec` now fails if a
flight reshades more than the first sample of each globe. The author's own run was not
reproduced as a low average frame rate, so whether this fully answers it is for the
author's next playtest. The warp jump still reshades at ten samples a second; its
globes hold still and are not magnified.
