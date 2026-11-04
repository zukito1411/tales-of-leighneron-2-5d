# Village livestock artwork

Generated with the built-in imagegen tool on 4 November 2026. No existing animal artwork was replaced. Versioned source masters:

- `chicken/poses-v1.png`
- `goat/poses-v1.png`
- `cow/poses-v1.png`

Each source is 1254 × 1254 RGBA with genuine transparent pixels. Twelve complete poses: four columns (standing, left step, right step, grazing), three rows (side, front, rear). West mirrors the side row. Source dimensions, alpha occupancy and crop rectangles were inspected; all three sheets were viewed. Generated dimensions differ from the chicken prompt's requested size; runtime registration uses the actual source.

`src/game/systems/LivestockArt.ts` owns explicit source rectangles, a single uniform fit per animal, and grounded references per direction. It produces one 512 × 384 atlas per species. Poses are never independently fitted or stretched.

Loading is optional, serial, near eligible farm/highland sites, and cancelled on game disposal. Three bounded atlases serve a six-animal pool. Source PNGs are retained in the repository; the existing public asset inventory includes them for web, Android and Windows releases.

Visual acceptance in both camera modes, GPU crop registration, animation cadence and device performance remain unverified: no game or browser was launched.

Exact built-in generation prompts follow.

## chicken

> Use case: stylized-concept. Asset type: finished transparent fantasy RPG livestock sprite atlas. Create exactly 12 COMPLETE full-body poses of ONE russet brown hen with warm cream neck feathers, red comb and wattle, yellow legs, natural chicken anatomy, detailed hand-painted pixel-RPG shading and warm dark outlines, matching a richly painted woodland fantasy game. Strict 4 columns by 3 rows, square 1024x1024 canvas, every cell 256 wide and one third canvas high. Row 1 RIGHT facing three-quarter overhead: standing, walk step left leg, walk step right leg, pecking. Row 2 facing DOWN toward camera: standing, walk left step, walk right step, pecking. Row 3 facing UP away: standing, walk left step, walk right step, pecking. Same exact chicken BODY SIZE in every frame, consistent feet baseline 86% cell height, center every body horizontally in cell. Generous empty margin minimum 30 pixels per cell. Entire beak, tail, comb, toes contained, no clipping or crossing cells. Transparent alpha background ONLY, no ground, NO cast shadows, no labels, grid lines or text. Finished crisp game artwork, not a mascot, not photo, not 3D render.

## goat

> Use case: stylized-concept. Asset type: finished TRANSPARENT fantasy RPG livestock sprite atlas. Exactly 12 COMPLETE full-body poses of ONE small sturdy cream-and-brown village goat, curved dark horns, short beard, cloven hooves, natural goat anatomy. Detailed hand-painted pixel-RPG shading, warm dark outline, richly textured cream coat with brown saddle markings, same painted woodland fantasy aesthetic as a brown rabbit game sprite. Strict FOUR columns by THREE rows on a square canvas. Row 1 RIGHT facing three-quarter overhead: standing, walking left-leg step, walking right-leg step, head down grazing. Row 2 DOWN facing toward camera: standing, walk left step, walk right step, grazing. Row 3 UP facing away: standing, walk left step, walk right step, grazing. Same goat body SIZE and proportions in every pose and direction, body horizontal center each cell, hooves baseline 86% cell height. All horns, ears, beard, tail, hooves safely inside own cell with at least 30 pixels empty padding. Actual transparent alpha everywhere between goats. NO ground, cast shadows, backdrop, grid, text or labels. Not mascot, not photorealistic, not 3D render. Finished isolated game artwork.

## cow

> Use case: stylized-concept. Asset type: finished transparent fantasy RPG livestock sprite atlas. Exactly 12 COMPLETE full-body poses of ONE sturdy reddish brown-and-cream dairy cow, ivory horns, soft pink muzzle, calm eyes, natural cow anatomy including udder and cloven hooves. Rich hand-painted pixel-RPG shading, crisp warm dark outlines, textured coat, same detailed painted woodland fantasy aesthetic as a brown rabbit game sprite. Strict FOUR columns by THREE rows, square canvas. Row 1 RIGHT facing three-quarter overhead: standing, walking left-leg step, walking right-leg step, head down grazing. Row 2 DOWN toward camera: standing, walk left step, walk right step, grazing. Row 3 UP away: standing, walk left step, walk right step, grazing. Same cow BODY SIZE and proportions in every pose/direction, horizontal body center every cell, feet baseline at 86 percent cell height. Generous empty padding 30 pixels minimum inside every cell, all horns/ears/tail/hooves completely contained, no touching neighboring cells. Actual transparent alpha between all cows. NO backdrop, ground, cast shadows, grid lines, text, labels or props. Not mascot, not photo, not 3D render. Finished isolated game artwork.

