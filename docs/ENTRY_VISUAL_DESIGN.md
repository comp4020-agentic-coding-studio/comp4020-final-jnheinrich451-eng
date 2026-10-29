# Frontier entry: planets, identity and saved campaigns

30 October 2026. Author-directed design record, based on the supplied login,
menu, planet selection, save-list, Join and striped-wordmark sketches. This
records the next presentation stage; it does not claim that these screens or a
third playable planet have been implemented. Complete the current multiplayer
release checks first, then build and review this stage before changing enemy AI.

## Experience and screen sequence

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
The current account limit is three owned campaigns, not three slots per planet;
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
It is a review artifact and is not installed in the runtime interface.

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
