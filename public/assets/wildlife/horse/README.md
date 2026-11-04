# Stable horse — recovered source artwork

The three source PNGs are byte-for-byte recoveries from the parent of commit
`4a629e3` (`Remove traveling horse caravans and fix TypeScript compilation blocker (#8)`).
No new artwork, recoloring, image editing, 3D horse mesh, cart, road-caravan
simulation or wheel rig was introduced.

| Current source | Historical source |
| --- | --- |
| `east-v1.png` | `public/assets/vehicles/horse-east-walk.png` |
| `south-v1.png` | `public/assets/vehicles/horse-south-walk.png` |
| `north-v1.png` | `public/assets/vehicles/horse-north-walk.png` |

Each PNG is 1254 × 1254 RGBA, with four complete hoof poses in a 2 × 2 layout.
All three sheets were viewed; dimensions, alpha occupancy and complete-pose
source bounds were inspected. West mirrors the east-facing source.

`LivestockArt.ts` prepares the existing 512 × 384, twelve-frame livestock atlas.
Explicit roots align the historical sheets' uneven padding; a single uniform
fit covers all directions and poses. The grounded third source pose is the
rest reference. The horse uses all four existing walking poses and its resting
pose for quiet feeding/rest intervals; it has no invented grazing animation.
Reference side height is 88 world units, with a separate horse-sized clearance.

Only one direction source is decoded at a time. Its four poses are prepared
under the existing frame-work allowance before the decoded image is released
and the next source is loaded. The complete atlas waits for the shared GPU
upload fence before any animal appears. Cancellation removes partial atlases.

The horse occupies an authored stable bay. Four indoor livestock slots share
the same bounded six-sprite pool used outdoors. Roads, quest state, saves and
the retired traveling-caravan behavior are retained as they were.

Compiler checks cover integration only. Rendered FPP/TPP inspection, animation
cadence, crop registration on the GPU and device frame-time measurements remain
pending; no game or browser was launched for this change.
