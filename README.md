# Tales of Leighneron — 2.5D edition

Experimental Three.js presentation of the complete Tales of Leighneron game.
Imported from `zukito1411/mernondna-rpg-base`, commit
`245c8e1c32b2795ea3183d5e66c821bce588a763`.

The original source and artwork are included. Combat, enemy AI, quests, regional
content, companions, equipment, housing, dungeons, Tower, progression and save
validation continue running in the existing simulation. This repository does
not apply the speculative campaign rewrite discussed separately.

## Rendering

- A perspective Three.js camera orbits through 360 degrees, with adjustable
  pitch, smooth follow, mouse look and zoom.
- Animated sprites and vegetation use camera-facing planes. Houses use fixed
  textured wall/roof volumes with their original facades; field crops stand upright.
- Look upward to see illustrated clouds, sun and moon. Sky colors and shadows
  follow the existing day/night clock; terrain residency stays bounded.
- Terrain uses a bounded height field; decals and sprite feet share its heights.
- Atlas frames are instanced; changing animation frames changes UVs rather than
  uploading a new image per pose.
- Phaser 3.90 remains the sole gameplay/physics/streaming owner and the asset and
  vector preparation backend. Its world drawing call is replaced, so the world
  is not rendered twice or copied from a screenshot onto a tilted rectangle.
- React retains the original menus, dialogue, HUD and mobile controls.
- Shadows, cloud drift, precipitation, night-light masks and foam animation run
  on the GPU, sharing existing source art and gameplay state.
- Three.js requires WebGL 2. Characters and non-house scenery retain cylindrical
  billboards; directional actors select their existing poses relative to yaw.
- WASD moves relative to the camera; left click attacks, right click dashes,
  Space jumps, Shift sprints and the wheel zooms. The pause menu has camera
  sensitivity and graphics settings. Touch supports drag orbit and pinch zoom.

See [the migration notes](docs/PRESENTATION_25D.md) for integration details and
remaining verification work. This edition is experimental. Compilation alone
is not evidence of visual parity, correct targeting, Android compatibility or
higher frame rates.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

## Compile / build

```sh
npm run test:types
npm exec --no -- tsc -p tsconfig.node.json --noEmit
npm run build
```

The first two commands are compiler checks, not gameplay tests. Unit and browser
tests remain available but should only be run when explicitly requested.

The **Build 2.5D browser game** Actions workflow compiles and builds on pushes to
`main`. Its `Tales-of-Leighneron-2.5D-Web` artifact contains `dist/` and can be
served by a static web server. This workflow does not publish to the original
itch.io page or assume that GitHub Pages has been enabled.

## Android

`capacitor.config.ts`, Gradle, Java packages and Android resources use a separate
application ID: **`com.mernondna.rpg25d`**. It can coexist with the original app.

The **Build and release 2.5D Android APK** workflow runs on pushes to `main`
and manual dispatch. It publishes an experimental, non-debuggable release APK.
Configure all four `ANDROID_25D_*` signing secrets for persistent in-place
updates. Without them, each run generates an ephemeral signing key; those APKs
cannot update installations signed by another key. Export save backups before
replacing an installation. CI compilation and packaging do not verify gameplay
or real-device rendering.

## Saves and offline storage

The browser edition uses `mernondna-25d-save-v1`, and the service worker has a
separate cache prefix. The original browser save and cache are not reused.
The version-7 save payload is preserved: use Export/Import Save Backup to move
progress between the two editions. The new Android app has its own local data.
Do not uninstall the original game to try this edition.

## Credits

Created by Zuki. Original project:
https://github.com/zukito1411/mernondna-rpg-base

Existing artwork and audio credits are retained in the imported files, including
`public/assets/audio/README.txt`. This renderer does not grant new redistribution
rights to third-party assets.
