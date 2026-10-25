# Orbital cargo and local construction

The [22 October panel-footprint stage](ORBITAL_PANEL_FOOTPRINTS.md) supersedes
the compact cosmetic-wall geometry below for new orbital facility purchases.
It retains these delivery timers and the orbital/local construction distinction.

17 October 2026. The author clarified that orbital deliveries contain finished
equipment: the metal crate lands, its four walls unfold, then its contents deploy
in about a second. Construction drones belong to local assembly and repairs.

New compact cargo deliveries use 3.6 simulation seconds: impact at 1.35, panel
opening from 1.75 to 2.6, and deployment from 2.6 to 3.6. This applies to orbital
sentries, artillery, missile batteries, airbases, factories, launch stations,
support outposts, recyclers and bridge builders. Their readiness is still owned
by the server and saved with the accepted purchase. Visual interpolation cannot
unlock a unit early. No drone workers appear in the orbital presentation.

Native core, tank, dock and aircraft capsules retain their existing unfolding
geometry and short arrival timers; those animations already have no construction
drones. Shipyard production and repairs remain local work. Local construction
still costs GND and takes 60 seconds, with the drone bay and cosmetic workers.

New logistics cargo stores deliveryDuration beside remaining time. Previously
saved deliveries retain their countdown and legacy visual-duration fallback;
accepted orbital jobs retain their saved duration. No save reset, free supplies,
price change or currency conversion is introduced.

Validation: focused bridge/support checks cover the GND-only admission message,
panel-before-reveal sequence, saved delivery duration and completion after restart.
Five desktop/phone browser cases passed, including insufficient shared GND with
plenty of ORB, successful bridge construction, and orbital-versus-local worker
rendering. Screenshots were inspected. Updated modules are served locally on
port 8080; this stage has not been committed, pushed or deployed.
Typecheck and the full suite of 420 tests across 61 files passed; evidence and
whitespace checks also passed.
