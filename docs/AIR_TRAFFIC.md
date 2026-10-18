# Shared airfields and cruise (16 October)

Player story: launch an empty aircraft into a holding patrol, keep fighting on
the ground, assign bomber strikes, and recall to a different free friendly
runway. E still boards a parked aircraft. This is the airport foundation for
the later carrier; it does not implement the carrier itself.

Each operational airbase contributes one fleet slot and one parking slot.
Aircraft in flight and orbital delivery count against fleet capacity. Cruise
does not permit extra production. A landing reservation prevents two aircraft
claiming one runway. Empty airbases can be deployed, including by the same owner.
All friendly runways accept visitors. Aircraft ownership remains unchanged.

Cruise is an explicit saved mission, not an abandoned pilot seat. Bomber strikes
ordered from cruise return to cruise, including with empty bays. Recall selects
a free runway, lands and rearms. Manual flight may land at any free runway on a
slow approach. A destroyed destination can divert to another free runway; if
none exists, existing bounded emergency recovery applies. Surviving aircraft
are retained when base loss reduces fleet capacity; production stays locked.

The server owns orders, capacity, reservations, supplies and persisted movement.
Existing per-airbase aircraft records remain storage identities for compatible
saves; aircraft.baseId identifies the physical destination, not ownership or
the manufacturing record. No extra aircraft simulation is added. Construction,
repair and ammunition retain their existing costs and timers.

Check cruise/strike/recall transitions, cross-base boarding and disembarking,
simultaneous landing claims, capacity during flight, restart and base loss.
Review desktop/mobile controls and ask whether holding aircraft and choosing
a destination feel clear. Four-player production performance remains unmeasured.

Local validation: typecheck and all 382 tests in 58 files passed. The new
server case verifies visiting-aircraft boarding races, cruise and landing tags
across restart, and production rejection at full fleet capacity. Domain cases
cover cruise strikes with empty-bay holding, cross-base landing and exclusive
reservations. After excluding vacant aircraft placeholders from enemy spawn
clearance, the 14 relevant conquest/settlement/air-traffic checks passed again.
Desktop and phone browser cruise/recall cases passed; the final desktop rerun
and existing heavy-HE automatic mission also passed. Screenshots were reviewed.
Windows browser runners lingered after completed cases and were stopped.
Process-evidence and whitespace checks passed. Not committed or deployed yet.
