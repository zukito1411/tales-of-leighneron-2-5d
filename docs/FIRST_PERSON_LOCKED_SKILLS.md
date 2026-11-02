# First-person locked skill commands

An explicit enemy lock takes priority over free camera/crosshair aim when a
targeted combat art is requested in first person. The locked enemy must remain
active, visible, alive, vulnerable, within that art's targeting range and
reachable through the existing cover checks. A held lock is already known and
does not repeat the automatic illumination/perception check that otherwise
requires approaching an unlit enemy.

The cast records whether it began as a first-person locked command. Azure
Cleave uses that same eligibility at release, then flies in a fixed direction
with normal collision checks. Barrage puts the explicit locked target first
in its bounded six-enemy snapshot; nearby additional foes retain the normal
perception rules. An unreachable explicit FPP lock rejects the command before
spending stamina or cooldown instead of substituting an unrelated Barrage foe.

Third-person targeting, unlocked first-person assistance, basic attacks,
ability ranges, movement/landing safety, invulnerability, costs and cooldowns
keep their existing rules. Self-centered and healing arts remain self-centered.

Compiler checks do not establish phone behavior; gameplay verification is
separate from source inspection and release packaging.
