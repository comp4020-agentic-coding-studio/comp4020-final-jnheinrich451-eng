# Ship visual scale plan

The author asked to review ship size relative to aircraft, while retaining the
current runway footprint. First complete bridge underpasses, then review scale
in playable stages.

1. **Bridge passage:** allow all vessel types beneath completed water spans;
   retain ground traffic above, existing artwork and saved bridge geometry.
2. **Carrier artwork:** compare the current carrier with a modest 10–20% visual
   enlargement and its parked aircraft. Inspect at a dock, a bridge and a narrow
   inlet before choosing the final scale. This is a proposal, not a balance change.
3. **Other vessels:** review gunship and transport proportions alongside the
   carrier; keep each silhouette distinct. Review the submarine only if needed.
4. **Playtest:** check boarding, shore ramps, vehicle loading, deck aircraft,
   weapon mounts and desktop/phone views. Enlarged art must not misleadingly
   suggest it collides with a bank or another hull when navigation says it clears.

Initial scope is artwork. Changing physical hull dimensions would need a separate
dock/berth, bridge-channel and transport-access review, including old saves. Do not
silently enlarge collision footprints or shrink runways as part of the art pass.

## Battleship presentation, 22 October

The author chose to remodel the existing gunship first, with the actual nine-shell
salvo as a later gameplay step. The supplied triple-barrel turret sketch is the
reference; this is an Iowa-inspired overhead interpretation, not a scale replica.

Initial visual pass (the main battery is now functional; see the follow-up below):

- Three visible triple-barrel turrets: two forward and one aft. The added forward
  mount follows the existing forward bearing; it has no separate weapon/reload yet.
  Existing live muzzle positions and recoil attribution are retained. The original
  four-shell salvo and two independent reloads remain unchanged.
- Six visible twin secondary mounts, three per side. They follow the existing
  side bearings. Only the original two side firing groups are active; the additional
  mounts and barrels are presentation for the later battery stage.
- Angular armored turret roofs, circular barbettes, deck planking, bridge fittings,
  two funnels and restrained exhaust while the engine is working.
- Speed-driven bow waves and stern propeller foam on surface vessels. Reversing
  shifts the pressure wave and shortens the propeller wash; stopped hulls produce
  no moving wake. Submerged submarines produce no surface wake or exhaust.
- Carrier arresting wires, deck-edge fittings and funnel exhaust; transport keeps
  its open cargo deck and single main turret. No extra carrier main guns.
- Reduced effects disables exhaust and animated foam, retaining a few static water
  marks while moving. All marks are bounded canvas drawing, not network particles,
  saved simulation objects or physical waves.

Hull dimensions, collision, docks, aircraft scale, names, costs and controls are
unchanged. The visual enlargement proposal remains a later comparison: detail gives
the carrier scale in this pass without making its deck overhang existing berths.

### Main-battery follow-up, 22 October

Now implemented locally in [Ship armament](SHIP_ARMAMENT.md): the raised turret
and all nine barrels fire, traverse and reload through shared server/canvas
geometry. Artillery/naval admission permits 12 incoming shells; Fire/Gas allow
nine of one type while keeping total and area limits. The original proposed
requirements below are retained as historical context.

### Secondary-battery follow-up, 23 October

All six twin secondary mounts now aim and fire independently through the shared
geometry. Each broadside cycles one pair every 180ms, with five damage per barrel
to preserve the former maximum damage rate. The target has a dispersion circle;
each barrel has its own muzzle flash and recoil. Carrier/transport side weapons,
hull dimensions and docking are unchanged. See [Ship armament](SHIP_ARMAMENT.md)
for arcs, persistence, limits and local validation. The brief below records the
original proposal; both battery stages are now implemented locally.

### Original armament-stage brief

Use three independent turret reloads with three rounds each. Single click selects
one ready turret; double click fires all ready turrets. Update saved legacy reloads,
HUD readiness and all nine predicted impacts together. Today's eight-heavy-shell
limit cannot admit nine rounds, so capacity must be explicitly revised and checked;
Fire/Gas field reservations also need a decision before permitting a full salvo.
Keep failed volleys atomic and preserve accepted shells across loss/restart.

Recommended secondary battery: six twin mounts, three per side, firing in a staggered
sequence into a visible dispersion circle. Only mounts with an outward firing arc
and valid range may fire. Agree total damage rate first; adding six firing mounts
must not silently multiply current damage by six. Keep existing friendly immunity
and bounded projectile capacity. This is a proposal, not current firing behavior.

Local validation: TypeScript and diff checks pass. Desktop and phone browser
checks pass existing volley/salvo, side fire, release/blur, keyboard controls,
resize and replacement-dock boarding (four final cases). Bridge-underpass checks
also passed at both sizes. Inspected the four-vessel art study and live gunship
screenshots at 1920x1080 and 390x844. This establishes local presentation and
interaction checks, not a Fly performance measurement. Not committed or deployed.
