# High, Normal and Low graphics

All presets use the same source-matched houses, props, illustrated actors,
world layout, gameplay, collision and save data. Normal remains the default;
existing explicit Low and Normal preferences remain valid. High is opt-in.

| Setting | High | Normal | Low |
| --- | --- | --- | --- |
| Maximum world pixel density | 2 | 1.5 | 1.1 |
| World pixel cap | 4 million | 2.4 million | 1.2 million |
| Longest world-buffer edge | 3072 | 2048 | 2048 |
| World-target AA | Up to 2x mobile / 4x desktop MSAA | Depth-gated edge filter | None |
| Ground / model anisotropy | Up to 8x / 4x | Up to 4x / 2x | Up to 2x / 1x |
| Curved model surfaces | 50% more sides, capped at 64; existing higher counts retained | Authored | Authored |
| Distant focus and highlight bloom | Higher resolution bounded buffers | Bounded buffers | Skipped |

Actual world resolution also respects the existing Phaser backing size and
hardware capabilities. These are upper bounds, not native-resolution promises.
Anisotropy is capped at the GPU's supported maximum. Sprite animation atlases
retain their existing filtering and no mipmaps, avoiding pose bleed.

The menu applies resolution, postprocessing and effect cadence immediately.
Reopen the game for all model tessellation and texture filtering changes.
Resident atlases are not mass-dirtied when selecting a preset. Geometry remains
cached and is never retessellated in a movement loop. The curve policy leaves
square timber and deliberately low-sided ornament designs alone.

High MSAA belongs to the actual world/depth render target, not merely the final
canvas. Three.js resolves both attachments at the end of the world render,
before night-light occlusion and the compositor sample depth. Target changes
release their old GPU resources; unchanged settings reuse the same allocations.
Normal uses depth discontinuities to restrict edge filtering, preserving painted
surface grain. High avoids adding that filter over the multisampled result.

Foreground depth blur is removed across presets. Outdoor focus starts farther
behind the player, distance haze begins farther back, and bloom affects brighter
highlights with less energy. Weather, sunlight, darkness and target protection
remain; this does not turn foggy weather into permanent clear skies.

The existing viewport streaming, texture residency limits, prefetch admission,
resource preparation budgets, arrival fences, model caches and manual camera
controls are unchanged. High costs more GPU time and target memory; it is not
an FPS improvement. Source art and terrain-bake resolution are unchanged, so
filtering cannot create detail absent from the original textures.

Validation: application/test-source TypeScript and Vite/Capacitor TypeScript
compiler checks. No game launch, browser/unit tests or real-device visual/FPS
verification were requested for this change.
