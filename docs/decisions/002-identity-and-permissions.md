# ADR-002: accounts own campaigns; admitted teammates share operation

10 October 2026. Accepted rules, implemented and checked locally. This records
the existing design for Crit 10; it does not claim deployed verification.

## Reason and alternatives

README values solo progress, useful cooperation and saved work worth returning to.
We use Email/Demo accounts for lasting campaign ownership and allow unregistered
guests to join by invitation. Requiring every teammate to register would slow
entry. Allowing anonymous hosting would make ownership depend on a disposable
browser cookie. A Demo account offers a visible, self-contained trial route;
its activation is explicitly simulated and does not establish email ownership.

Construction ownership protects another player's work. Equipment operation is
shared so friends can cooperate without the owner having to rebuild every vehicle.
Exclusive seats and control leases prevent two users steering one machine.
The cost is that a teammate can move shared equipment; ownership is not a promise
that it will remain where its builder left it. The campaign owner cannot silently
take over an occupied seat or dismantle a registered teammate's buildings.

## Server permission matrix

| Operation | Authority checked on the server | Evidence |
| --- | --- | --- |
| Create/host a save | Activated Email/Demo account; limits on saved/active campaigns | campaigns/service.js; spec/campaigns.test.ts |
| Open a closed room | Campaign owner; a member waits for the owner | campaigns/service.js; spec/campaigns.test.ts |
| Join/read/stream/act | Redeemed invitation or remembered account membership, active visit and matching credential/runtime; four distinct participants maximum | campaigns/service.js; isolation, capacity and delayed-body tests in spec/campaigns.test.ts |
| Issue/revoke invitations | Connected owner; single-use, expiring codes | campaigns/service.js; invite race and non-owner denial checks |
| Pause | Solo owner only; admitting another participant resumes play | campaigns/service.js; pause/reconnect tests |
| Leave | Anyone ends their own visit; owner departure closes the room | ADR-001; spec/campaigns.test.ts |
| Deploy | Initial core from orbit; other construction requires an active ground robot. Valid terrain/footprint, per-type limits and no occupied machinery overlap | server.js; core/tank/rail/naval/aircraft domain and HTTP tests |
| Dismantle sentry, change sentry mode, remove rail, install legacy switch | Builder, or host managing an abandoned guest's construction | server.js canManage; guest-retention test |
| Add exits to an existing compact rail | Original rail owner; this helper currently has no host-abandonment exception | public/rail.js railError; compact rail tests |
| Set an installed legacy switch | Connected active participant; route support and carriage reservation checks | server.js; switch tests |
| Operate artillery/missiles | Connected active participant, exclusive operator lease; firing/ammo/movement require that operator | server.js; artillery/missile HTTP tests |
| Board tank, ship or aircraft | Active robot at the eligible boarding location, operational vehicle, vacant seat | server.js; tank/ship/aircraft tests and named-room boarding race |
| Drive/fire/change vehicle loadout | The currently seated player; requests cannot substitute someone else's identity | server.js derives vehicle from player identity; ground/naval/aircraft tests |
| Replace destroyed tank/ship | Original vehicle owner, eligible destroyed state and replacement location | server.js; vehicle loss tests; no host-abandonment exception here |
| Recover robot | Disabled player selects a completed friendly core with clear arrival space | server.js; survival tests |
| Account/logout/takeover/reset | Account credentials or single-use action token, with live control revoked and delayed requests rechecked | accounts/service.js; spec/accounts.test.ts |

The table deliberately distinguishes ownership exceptions. It does not promise
that the host can modify every abandoned vehicle or every kind of rail operation.
An ordinary guest's membership ends after leave or a 30-second disconnected visit;
their constructions stay and the host gains the stated management rights.
Registered membership survives room closure. See [campaign stage](../CAMPAIGN_STAGE.md).

All authorization is server-side. Hiding a button is only guidance. Named-room
requests are checked again after reading their body, including the exact runtime
and visit, to reject commands held over a close/reopen or account takeover.
The legacy field remains a separate, explicitly labelled browser-identity test
world; it is not a way to bypass named-campaign admission.

## Operational evidence

[Structured logs](../OBSERVABILITY.md) distinguish global actor ID from campaign
pilot ID, which can differ for guests. Names alone are not identity. Logs record
accepted and denied requests plus room and combat outcomes. They never contain
invitation codes, email fields, authentication cookies or action-token bodies.

Local automated checks support these rules. The two-classmate, URL-only Fly
rehearsal and the author's account of narrating actual activity remain required
human evidence; neither this ADR nor a green test can stand in for them.
