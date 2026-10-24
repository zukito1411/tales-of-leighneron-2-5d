# Travel horse source and derived mesh

Base anatomical mesh/rig: **Horse**, by Quaternius, from Ultimate Animated Animals.
License: CC0 1.0 Universal.

- Author: https://quaternius.com/packs/ultimateanimatedanimals.html
- Source: https://poly.pizza/m/qvTrSG9pZF
- Original GLB: https://static.poly.pizza/d37dbc87-ca61-4b2c-a2da-d2f0c4240bef.glb
- License: https://creativecommons.org/publicdomain/zero/1.0/

`horse-model-source.glb` retains the complete source rig and animations.
`scripts/author-travel-horse.mjs` bakes four complete Walk poses to
`src/game/presentation25d/travelHorseModel.json` using installed Three.js.
The game uses the resulting opaque mesh, with actual modeled legs, neck, ears,
head, muzzle, mane and tail. No billboard, two-sided silhouette shell, runtime
skinning or per-frame geometry authoring is used.

Approved project horse paintings supply the projected coat, harness and blaze,
with their own opaque material patches for hair, muzzle and hooves. Paint
coordinates are bound once at authoring, independently of animated positions.
Source alpha describes paint coverage; it cannot cut holes in the solid mesh.
The source model's flat brown materials are not used for the final coat.
