# Starting core recovery

The first super core in each campaign is the crew's permanent recovery anchor.
It is immune to facility damage and excluded from enemy target selection. This
does not protect nearby players, vehicles or buildings. Later cores and support
outposts remain destructible. Robot recovery stays free and still needs a clear
landing point near a completed recovery core.

The server stores `logistics.startingCoreId` in the campaign save, atomically with
the first accepted core deployment. All teammates can recover there. The map and
recovery selector label it as protected.

For older campaigns without that identifier, the server backs up the database to
`backups/before-starting-core-<id>.sqlite`, then protects the earliest surviving
core in insertion order and clears its old damage. It does not reconstruct deleted
cores or change other buildings. This migration runs once per campaign.

If no recovery cores remain, use **All cores lost / Emergency orbital core** in
the robot recovery window, then choose a clear landing site. The next core is free
under the existing emergency rule and becomes the protected starting core if none
has been designated. Conquest, resources and other equipment remain saved.

Tests cover targeting and direct damage immunity, vulnerability of later recovery
bases, backed-up legacy migration, restart persistence and exhausted-economy
emergency recovery. Browser checks cover the empty recovery window and shared
protected-core recovery. Fly verification follows a later deployment.
