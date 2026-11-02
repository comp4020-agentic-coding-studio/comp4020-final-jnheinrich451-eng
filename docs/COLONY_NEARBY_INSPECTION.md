# Colony walk-up bed inspection

2 November 2026. The author asks for the bottom plant panel to appear by
walking onto or near growing beds, fitting the colony's relaxed pace.

## Implemented behavior

- Use only the local worker's rendered ground position, including in co-op.
  A planted bed shows crop/water/growth and tending actions; an empty one shows
  seed choices. This also works on saved arrival and newly built nearby beds.
- Approach within one tile of the bed's 3-by-3 footprint to inspect. Keep the
  current bed until 1.5 tiles away, or another bed is at least 0.35 tiles closer.
  This prevents selection flicker between neighboring beds.
- The automatic panel never pans the camera, takes keyboard focus or sends a
  farming command. Watering, planting, gathering and clearing remain explicit.
- Walk away to close an automatic panel. Esc, X or a clear-ground click dismisses
  nearby beds until leaving their neighborhood and returning.
- Manual bed/Garden inspection is retained while stationary. Intentional walking
  of at least half a tile resumes nearby inspection; interpolation settling after
  releasing movement does not cancel a deliberate manual selection.
- Camp, shipping, placement, Crew, help and text entry take priority. Automatic
  selection checks ten times per second and changes the panel only when needed.
- Phone direction controls sit immediately above an automatic panel, allowing
  walking away without closing it. Panel height is observed on resize, never
  measured as part of the animation loop.

Implementation is local UI state in `public/colony-nearby.js` and
`public/colony-app.js`; it does not change saved crops or server authority.

## Validation

Nine focused unit/projection/invariant tests and TypeScript passed. Four new
browser tests cover empty/saved arrivals, real walking, no automatic mutations
or camera jump, watering, dismissal/re-entry, neighbors, manual/tool priority,
phone movement and each co-op player's own selection. Seven existing movement,
projection and Camp/cinema browser checks also passed. A cinema polling assertion
was corrected to wait through a temporary missing decoded frame during seeking.

Desktop and phone screenshots were inspected:
[desktop](testing/evidence/2026-11-02/colony-nearby-bed-desktop.png),
[phone](testing/evidence/2026-11-02/colony-nearby-bed-phone.png).
Checks used disposable saves and local Chrome/phone-sized emulation. No real
save was edited or reset, and this stage has not been deployed.
