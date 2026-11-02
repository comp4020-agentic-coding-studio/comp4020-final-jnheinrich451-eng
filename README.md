# Frontier: a foothold worth returning to

Frontier is a cooperative overhead 2D war game for one to four friends. You land
a robot on an alien planet, build a base, then take the planet with tanks, ships,
aircraft, rail guns and orbital strikes. You can also play it alone.

## Start playing

Open [the game](https://comp4020-final-jnheinrich451-eng.fly.dev/), choose **Demo
account**, then **Create account** with any `@frontier.test` address. Verify it in
your private Demo inbox; no real email is sent. Choose **New Game**, pick a planet,
name the campaign and enter. Place your support core and your robot lands. **WASD**
moves, the mouse aims, **B** opens Deploy and **F1** lists the controls.

To add a second player, open **Room** and **Create invitation code**. They choose
**Play as guest** in another browser and paste the code. To return later, use
**Save and leave room**, then **Continue**.

## What good means here

Good means **a defeat always leaves a way back, and the way back costs something**.
Your robot can die, but you can still find a way to fight back. Your ruins, your
spending and the sites you conquered all stay.

With permanent death, one bad fight ends a long campaign. With free respawns,
nothing you lose matters. Juul (2009) found that players who failed some and then
finished a game rated it highest, and that players prefer to feel responsible for
failing. The first result only neared significance (p=0.06), so I take it as a
reason, not proof. It fits Frontier's warned attacks: a loss should feel like your
own mistake.

Frontier is also small on purpose. Sloan (2020) writes that software freed from
being "professional and scalable" becomes "a different activity altogether". A room
holds four people, a campaign belongs to its host, and a friend needs no account to
join. Helldivers 2 gave me the cooperative war, but I left out friendly fire.

## What is enforced

These claims are rules in [CLAUDE.md](CLAUDE.md), and each has a check:

| Claim | Check |
| --- | --- |
| No defeat ends a campaign: with no cores and no money, you still get a core, an HE tank and your robot | [Recovery](spec/logistics.test.ts#L141) |
| Losses stay: ruins remain and conquest is permanent | [Ruins](spec/infrastructure-repair-ui.test.ts#L27), [conquest](spec/conquest.test.ts#L57) |
| Bulwarks take only explosives and charged magnetic shots, and warn before striking | [Bulwarks](spec/bulwark.test.ts#L29) |
| Friendly weapons never hurt your side | [Friendly damage](spec/vehicle-survival.test.ts#L10) |
| Two people share one world, and it survives a restart | [Restart](spec/wreck-recovery-http.test.ts#L17) |

## What is judged

I judged these by playing each stage and correcting it:

- Death feels like part of the loop, not a punishment.
- The HUD reads in one second, and you learn by playing. Dead Space led me to put
  information on the unit, not in corner panels.
- The three planets and their transitions make arriving feel like an event.

This is only my own judgement. I have no recorded test with outside players, and
sustained four-player combat on Fly is unmeasured. In a local
[latency test](tests/browser/multiplayer-latency.spec.js#L125), changes reached other
players in under 0.2 s (median) and 0.55 s at worst, inside its one-second limit.

## What I chose not to build

- Friendly fire, and any loss that ends a campaign.
- Large public servers.
- Per-shot costs and offline income.
- Farms in the war. **Colonization** is a separate peaceful mode for people who
  prefer not to fight. It shares accounts and multiplayer, but it is unfinished.
- Isometric or 3D art: [Kenney's tank pack](https://kenney.nl/assets/top-down-tanks-remastered)
  showed that overhead silhouettes stay readable.

## Sources

- Juul, J. (2009). [Fear of failing? The many meanings of difficulty in video games](https://www.jesperjuul.net/text/fearoffailing/). In *The Video Game Theory Reader 2*. Routledge.
- Sloan, R. (2020). [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/).
- Games: [Helldivers 2](https://www.playstation.com/en-us/games/helldivers-2/) and Dead Space (2008).
