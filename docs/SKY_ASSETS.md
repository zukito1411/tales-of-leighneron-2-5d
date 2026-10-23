# Sky artwork v1

Runtime/source master: `public/assets/environment/sky-atlas-v1.png`.
Generated with the built-in imagegen tool, using the existing Sunset Valley
reference as style guidance. The master is 1254 by 1254 pixels with alpha;
corner alpha is zero. GPU registration uses normalized quadrant coordinates,
so it does not assume the requested 1024-pixel output size.

Top-left and top-right quadrants contain cloud variants; bottom-left contains
the sun; bottom-right contains the moon. GpuSky and GpuCloudShadows share one
texture. The master is retained in the repository without replacing original
art. Source inspection covered the complete sprites, gutters and alpha. GPU
appearance, filtering and horizon composition remain unverified in gameplay.

## Final generation prompt

Use case: stylized-concept. Asset type: one production 2D pixel RPG SKY SPRITE ATLAS, transparent background. Create a square 1024x1024 image organized into exactly four equal 512x512 quadrants with generous transparent gutters, no borders, no grid, no text. Each isolated object fully contained inside its own quadrant. TOP LEFT: one wide soft cumulus cloud cluster, ivory highlights, blue-gray underside, delicate hand-painted pixel texture. TOP RIGHT: a second distinct long broken cloud bank, neutral whites and gray-lavender underside, not dark black. BOTTOM LEFT: a small golden sun disc with detailed stippled yellow-white photosphere and subtle irregular painted halo, centered in cell, diameter about 150 pixels including halo, transparent outside. BOTTOM RIGHT: a detailed silvery full moon with blue-gray craters, subtle lunar glow, centered in cell, diameter about 160 pixels, transparent outside. Style: richly textured 1990s illustrated fantasy pixel RPG, restrained small-pixel brushwork and coherent traditional painted palette matching a medieval valley at sunset, high quality sprite art, NOT vectors, NOT flat icons, NOT 3D renders. Clouds about 400x240 pixels centered in their cells. All four sprites separated and complete, actual transparent alpha everywhere outside the objects; no background scenery, no stars, no horizon, no checkerboard painted in. Intended for GPU billboards in an existing game.
