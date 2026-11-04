# Source-painted shrine and deliberate town gardens

## Sprite paint

The previous model used hard-coded cool limestone colors. It did not match
its original `native_story_bare` frame 11, the warm painted moon-stone sprite.
The model now tiles measured opaque source patches for stone, light surfaces,
shaded carving and amber ornament across all sculpted elevations. Its carved
crescent is reused as a pedestal inset. No new raster asset or material atlas
is required. Harp, circlet and pedestal trim use the sprite's amber ornament;
the existing attunement halo is warm. The source PNG is unchanged.

Registration uses the original 260 x 278 source crop and the loader's actual
retained/trimmed crop. It never reads adjoining atlas cells. `shrinePaint` is
included in the existing model-state invalidation keys. No runtime pixel scan,
image recoloring, new light or extra draw pass was introduced.

The source swatches and the actual mesh were inspected in a temporary offline
material study from front/oblique/rear angles. An initial bright cracked swatch
produced repeated white bands; it was replaced with quieter source stone grain.
That study uses approximate lighting, not the running game's post-processing.
It does not establish final appearance in Android day/night lighting.

## Empty plots

Both supplied screenshots were opened. Oakmere shows bare wall-side land;
Highmere shows isolated furniture on a broad open merchant lawn. Increasing
search limits in the preceding update did not establish that those areas were
filled. Reading the actual generated content revealed zero Highmere windmills
and an exhausted 54-prop Oakmere allowance.

- Windmill admission now distinguishes the tower's physical ground from its
  elevated sail span. Ground/road/person checks use the tower; tall structures
  and tree crowns still veto the complete sail envelope. Existing streaming
  retains the full modeled envelope. Tower height puts the lowest static sail
  above a standing character. Body collision and door routes are unchanged.
- Pasture admission reserves the actual royal precinct, preventing livestock
  enclosures in the castle forecourt. Existing rural candidates remain first.
- Tree crown reservations are radial around their feet. A billboard's upright
  painted height no longer consumes a long strip of flat land behind it.
- Seven Oakmere and fourteen Highmere planted seating layouts now have explicit
  settlement-local plots, covering wall-side bands, merchant/central greens,
  upper terraces and southern approaches. The larger courts include paired
  trees, flower beds, seats and a well; narrow bands use compact planted seats.
  Each composition is admitted entirely or omitted against the current final
  buildings, streets, defenses, NPC schedules, crop beds and interaction paths.
- These fixed plots replace thousands of speculative garden proposals. Small
  seating pockets elsewhere retain the preceding behavior. All details use the
  existing streamed content and batches, with the 24-new-props-per-chunk cap.
  Oakmere/Highmere town allowances permit the deliberate compositions; none of
  this planning runs per frame. Existing buildings and quest contacts stay put.

## Inspection and checks

Reading the generated content with its real versioned animation manifests gave:

| Settlement | Mills | Pastures | Complete planted seating layouts |
| --- | ---: | ---: | ---: |
| Oakmere | 2 | 2 | 7 |
| Highmere | 3 | 3 | 14 |

These are admitted source definitions, not counts observed in gameplay. The
Highmere merchant mill occupies approximately local (-502, 1453); the north-wall
Oakmere seating groups include y=-1160. Runtime streaming, camera framing and
visual density in the exact reported views still need device confirmation.

Both required TypeScript checks and scoped whitespace checks passed. No unit,
integration or browser tests, game launch, gameplay simulation or FPS benchmark
ran. Only static content reading and offline asset/mesh inspection supplemented
compilation. The existing automatic signed Android/Windows release pipeline
and asset downloader remain unchanged.
