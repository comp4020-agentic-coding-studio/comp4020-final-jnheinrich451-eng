# Keep the target outside the conversation

Generative agents turn a few words into detailed work. My position is that the
detail they add drifts towards what is usual, and that this helps a designer with
no target and harms one who has a target. Good practice therefore starts with
knowing which case you are in. If you have a target, keep it where the agent cannot
reword it: a sketch for form, a rule or test for behaviour, your own words for a sound.

## The drift enters early

Hintze et al. (2026) left image and caption models feeding each other for 700 runs
and found "just 12 dominant motifs with commercially safe aesthetics". Their loops
had no human, so they show a tendency, not what happens under direction. They
attribute it only "likely" to training data, and tested no other cause.

My first evidence is a game spacecraft, made with Codex and an image tool. I drew a
scythe-shaped bow. The prompt Codex wrote asked for a "subtle swept
upper bow ridge" and to "avoid an enormous blade fin", so my drawing was softened
before any image existed. The first render was a smooth teardrop. Reviewing outputs
is therefore not enough. A designer should also read what the agent told the tool.

![First sketch](docs/evidence/mycorrhizal-carrier/sketch-1-first.png)
![First render](docs/evidence/mycorrhizal-carrier/terraforming-carrier-concept-v1.png)

*First sketch and first render; see [all versions and prompts](docs/evidence/mycorrhizal-carrier/README.md).*

## Does the pull reach the person?

Wadinambiarachchi et al. (2024) suggest it does: sixty students sketched chatbot
avatars, and those using Midjourney copied more features from a supplied example
than those without, though originality barely changed. I first disagreed, since
that study tested inventing from nothing and I began with a drawing. But my feeling
is weak evidence. METR's developers believed AI had sped them up by 20% when they took 19%
longer (Becker et al., 2025). METR now calls that out of date, and its later data
suggests a speed-up, with "only very weak evidence for the size of this increase"
(Becker et al., 2026). The finding moved; the gap between belief and measurement is
why I rely on dated sketches and prompts, not memory.

## The case against me

The same record contradicts a simple version of my claim. For the final design
sheet, the prompt asked for "ONE broad fat cargo shuttle". Two berths appeared, and
Codex called them "erroneous" and asked for a fix. I saw two bays, left and right,
judged that better and adopted it. A generated image changed my design, by accident.

So a target is not a fixed answer. It is what lets a designer separate a useful
surprise from drift. Schön (1983, as quoted in Keer, 2018) describes materials
"continually talking back", and code does too: my anti-air tracers followed
ballistic physics until I saw the frame rate break the salvo up, and replaced them
with a lit firing line. Targets should change, but the designer should change them
on purpose.

## The same split in sound

Sound showed both halves without an image. Codex drafted short prompts for 52
weapon effects ([generation record](soundeffect/GENERATION.md)), and ElevenLabs
returned a burst where I wanted one machine-gun shot. I know what a tank sounds
like, so I rewrote the vehicle prompts, and the record keeps them: "zero revving,
zero acceleration", "zero doppler", "single isolated impact event with zero
bounces". Each negation names a default the generator kept reaching for. In the
carrier prompt the agent's negation softened my target; here mine defended it.
The colony's cues went differently. The generator understood Codex's "small
friendly robot pet" at once, and I kept its prompts almost as written. I have no
target for how a mechanical spider purrs, so its convention became the design.

## With no target, convention is a loan

The colony's economy went the same way. I know little about factory games: I named
its machines, and Codex joined them into a production chain trading food against
fuel. I could not have designed that, or judged it until it was built; playing it,
I found the power chain "a dead loop", because making fuel needed power.

Naur (1985) argued that a program's theory lives in its people, and that rebuilding
it from documents alone is "strictly impossible". Goedecke (2026) adds that agents
"can't retain theories of the codebase". If neither of us holds the theory, nobody
does. An agent's convention is a useful loan, but the designer must learn enough to
turn it into a target; I learned it only by playing what the loan built.

## Where targets live

Böckeler (2026) separates guides, which steer an agent "before it acts", from
sensors, which "observe after the agent acts". My sketches worked as guides and my
tests as sensors. Böckeler also warns: "Correctness is outside any sensor's remit
if the human didn't clearly specify what they wanted in the first place." That
answers the obvious objection that better models will remove the drift. They may
drift less, but no model can check work against a target nobody stated.

This is one designer's record of one project, and a skilled artist may need
sketches less. Still, the practice is cheap: decide whether you hold a target, then store it outside the chat.

## References

Becker, J., Rush, N., Barnes, B., & Rein, D. (2025, July 10). [*Measuring the impact of early-2025 AI on experienced open-source developer productivity*](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/). METR.

Becker, J., Rush, N., Cunningham, T., Rein, D., & Mahamud, K. (2026, February 24). [*We are changing our developer productivity experiment design*](https://metr.org/blog/2026-02-24-uplift-update/). METR.

Böckeler, B. (2026, April 2). [*Harness engineering for coding agent users*](https://martinfowler.com/articles/harness-engineering.html). martinfowler.com.

Goedecke, S. (2026, April 3). [*Programming (with AI agents) as theory building*](https://seangoedecke.com/programming-with-ai-agents-as-theory-building/).

Hintze, A., Proschinger Åström, F., & Schossau, J. (2026). Autonomous language-image generation loops converge to generic visual motifs. *Patterns, 7*(1), 101451. https://doi.org/10.1016/j.patter.2025.101451

Keer, L. (2018, September 3). [*Book review: The reflective practitioner*](https://drossbucket.com/2018/09/03/book-review-the-reflective-practitioner/). drossbucket.

Naur, P. (1985). Programming as theory building. *Microprocessing and Microprogramming, 15*, 253–261.

Schön, D. A. (1983). *The reflective practitioner: How professionals think in action*. Basic Books.

Wadinambiarachchi, S., Kelly, R. M., Pareek, S., Zhou, Q., & Velloso, E. (2024). The effects of generative AI on design fixation and divergent thinking. *CHI '24*. https://doi.org/10.1145/3613904.3642919
