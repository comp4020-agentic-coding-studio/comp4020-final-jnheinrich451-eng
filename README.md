# Frontier: a foothold worth returning to

Frontier is a cooperative 2D war game for one to four friends: land a robot,
build a base and conquer an alien planet with vehicles and orbital support.
**Colonization** offers a separate peaceful garden world, with no enemies or ending.

## Start playing

Open [the game](https://comp4020-final-jnheinrich451-eng.fly.dev/) and create an
**Email account** or **Demo account**. Email accounts verify through your inbox;
Demo accepts any `@frontier.test` address and uses a private simulated inbox.
Choose **New Game**, select a planet and place your support core. **WASD** moves,
the mouse aims, **B** opens Deploy and **F1** lists controls. Choose
**Colonization** for peaceful play.

To invite a friend, open **Room** and **Create invitation code**. They choose
**Play as guest** and enter the code. **Unregistered guests do not keep personal
progress for a later visit.** Their contributions remain in the host's world.
Guests can register and verify before leaving to keep their pilot. Account holders
use **Save and leave room**, then **Continue**; returning teammates need the host online.

## What good means here

In War Zone, good means **defeat leaves a way back without undoing its
consequences**. Robot recovery is free, but destroyed equipment, spent resources and
conquered sites stay changed. Colonization offers peaceful lasting progress:
neglect never removes what you built.

Permanent defeat would end a campaign; restoring everything would erase its
consequences. Juul (2009) found that players who failed before finishing rated a
game highest, although that result only neared significance (p=0.06). His finding
that players prefer feeling responsible for failure also informs Frontier's
warned attacks. These findings guide my design; they do not prove it enjoyable.

Frontier is also small on purpose. Sloan (2020) writes that software freed from
being "professional and scalable" becomes "a different activity altogether". A room
holds four, a campaign belongs to its host, and a friend needs no account to join.
Helldivers 2 gave me the cooperative war, but I left out friendly fire.

## What is enforced

These [CLAUDE.md](CLAUDE.md) rules have checks:

| Claim | Check |
| --- | --- |
| Emergency recovery supplies a core, HE tank and robot even with no money | [Recovery](spec/logistics.test.ts#L141) |
| Ruins remain and conquest is permanent | [Ruins](spec/infrastructure-repair-ui.test.ts#L27), [conquest](spec/conquest.test.ts#L57) |
| Bulwarks take explosive, magnetic and gas damage; fire only slows them | [Bulwarks](spec/bulwark.test.ts) |
| Friendly weapons never hurt your side | [Friendly damage](spec/vehicle-survival.test.ts#L10) |
| Both players see construction, which survives restart | [Shared saves](spec/campaigns.test.ts#L266) |
| Neglect never removes colony construction | [Neglect](spec/colony-ground.test.ts#L235) |
| Each account can own three saves per mode | [Saves](spec/campaign-mode.test.ts#L113) |

## What is judged

Through playing and correction, I judged whether:

- Recovery makes another attempt inviting.
- The HUD reads quickly; Dead Space inspired information on the unit.
- Planet transitions make arriving feel like an event.
- Generated effects fit each weapon, and music suits each planet.

These are my judgements, with no recorded independent playtest. Sustained
four-player combat on Fly is unmeasured. Local [latency measurements](docs/HUD_AND_POLISH_STAGE.md#full-browser-suite)
had medians below 0.2 s and a maximum of 0.554 s; they do not establish deployed latency.

## What I chose not to build

- Friendly fire, permanent defeat, per-shot costs or offline income.
- Large public servers: within Fly's one shared CPU and 256 MB, rooms hold four
  players and worlds cap active enemies plus reserved arrivals at 24.
- Farms in combat; growing belongs to Colonization.
- An angled combat view: [Kenney's tank pack](https://kenney.nl/assets/top-down-tanks-remastered)
  informed its overhead silhouettes. Colonization uses an angled view for machinery.

## Sources

- Juul, J. (2009). [Fear of failing? The many meanings of difficulty in video games](https://www.jesperjuul.net/text/fearoffailing/). In *The Video Game Theory Reader 2*. Routledge.
- Sloan, R. (2020). [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/).
- Games: [Helldivers 2](https://www.playstation.com/en-us/games/helldivers-2/) and Dead Space (2008).
