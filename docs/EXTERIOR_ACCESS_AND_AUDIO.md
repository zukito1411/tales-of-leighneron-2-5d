# Exterior access, admission budgets and camera-relative audio

Exterior NPCs and movable quest objects now wait for a validated standing
position with local walking access. Quest loot containers and harvestables use
the same admission checks as quest interactables. Structural entrances, docks
and shrines retain their existing placement systems.

Gate standing exclusions cover the arch footprint; movement and access checks
retain the genuine opening between its supports. A player-sized swept path
must connect a placement to an authored street/road or reach surrounding
countryside outside the town. Terrain is sampled every eight world units and
height changes are checked in both directions. A bounded neighborhood search
can find turns around obstacles; it is not a whole-world navigation proof.

Placement searches yield between probes, rotate fairly, retain at most 128
jobs/results and run inside the shared frame-work allowance, with a 0.55 ms
slice checked between probes. They wait until the initial presentation is
ready. Failed searches have a one-second cooldown; no unchecked original
position is substituted. Home and schedule requests retry, and the escort and
quest guide share one validated arrival position for the scene. IDs, trust,
quest progress and collected/opened state retain their existing meaning.

Content admission counts unsuccessful attempts against its time allowance.
A resumable iterator prevents early rejected records from starving later
actors, and temporary rejections receive a short cooldown. Teleports reset the
iterator for the new physics neighborhood. Encounter groups remain atomic.
Searches, iterators and retry data are released on shutdown.

Enemy audio projects source/listener offsets through the existing presentation
camera transform. Playing channels refresh position, pan and distance gain
every 80 ms, without additional timers or audio nodes. Camera zoom does not
alter hearing range. Pauses, mute, actor retirement and completed death sounds
retain their cleanup behavior; simultaneous channels remain capped at 14.

Validation for this change is limited to source/integration review and the
required local TypeScript compiler checks. No game, browser, Playwright,
development server or build was launched. Rendered placement, audio listening
and device frame-time verification remain pending.
