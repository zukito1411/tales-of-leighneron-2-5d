# First-person combat awareness and interactions

The first-person HUD owns the center reticle, an aimed interaction prompt,
three directional warning slots and a short indicator for actual health loss.
Enemy names and health remain on the existing overhead indicators; the center
has no duplicate enemy health, lock labels or reach text. Third-person HUD
and interaction selection keep their existing behavior.

- Perception samples run at most ten times per second. Enemy candidates come
  from the existing live combat list. Warning candidates come from active
  AttackTelegraph instances; spear/stone prediction uses the existing eight-shot
  pool. No scene-child/world scans, image decoding or GPU readbacks are added.
- The reticle projects authored target volumes through the current camera.
  Its color feedback requires visibility and clear cover checks. Reach uses the
  equipped weapon, current combo step, normal boss padding and facing cone;
  a lock never grants extra reach or authorizes a hit.
- Screen warnings reuse the actual circle, ring, cone and line hit areas.
  NPC-directed attacks are excluded. Damage bearings are emitted only after
  Player.takeDamage reduces health; zero-distance environmental hits have no
  invented horizontal direction.
- WorldScene resolves the current aimed interaction again when Interact is
  pressed. Outdoors, interiors, beds, story work and dungeon objects retain
  their existing reach, path, ownership, combat and payment checks. Placement
  recovery remains accessible when a story encounter cannot place attackers.
- Hiding/switching cameras, pausing, graphics recovery and scene shutdown clear
  transient feedback. Event listeners and overlay elements are released on
  scene change or renderer disposal.

Compiler/build checks do not verify layout, targeting feel or phone performance.
Gameplay and real-device verification require a separate authorized run.
