# Establishment fittings

Interiors reuse the exterior trade-sign identity and existing regional furniture
materials. Stable facade models take precedence over generic neighborhood labels
when choosing an interior; Highmere's barn lots are labeled as working stables.
Building IDs, resident assignments, services, home ownership and save fields remain unchanged. Decorations do not create new shop inventories.

| Establishment | Interior treatment |
| --- | --- |
| Inn / tavern | Ale casks with taps, labeled wine bottles on shelves, serving counter, shared food and cups, separate kitchen and guest rooms |
| Clothing business | Dress forms, folded fabric shelves, sample counter, cutting and treadle-sewing benches, separate workroom |
| Bakery | Framed clear-glazing pastry case with loaves and cake, bread shelves, paired-chair tea tables, oven and preparation room |
| Restaurant / dining room | Inward-facing table settings, food plates and cups, kitchen preparation surfaces |
| Barracks / armory | Mounted spears, sword, shields and repair tools; existing beds and equipment storage |
| Stable | Painted dirt floor, timber walls, six open-front straw-bedded stall bays, tied hay bales, troughs, water tubs, feed sacks, saddles, lead ropes and grooming tools |
| Market hall | Produce trays at the counter and stocked wooden shelf bins |
| Herbalist | Labeled jars, bottle counter and preparation bench |
| Bookseller / guild / archive | Book shelves, reading or contract tables, ledgers and work surfaces; clothing guilds have sewing equipment in their workroom |

Retail layouts separate a service bay and display/dining bay with a 240-unit
main aisle and a 120-unit cross aisle. Furniture must fit within its room and
avoid reserved lanes and other solid objects. Complete table/chair groups are
admitted together. Existing entrance flood routing and full-body placement checks
place quest residents first and admit optional staff/customers only in reachable,
clear spaces. Optional retail occupancy is capped at nine total residents and
uses the existing day/night arrival system.

Small stock items are parts of cached 3D furniture geometry, not independent
scene objects. They share existing materials and batches and add no texture
downloads, per-object animation loops, physics bodies or transparency passes.
Glazing is represented by its frame and sparse pane reflections, keeping the
displayed food visible in the existing opaque renderer. Room furnishing
submission yields after every four objects during the existing loading overlay.

Compiler checks cover integration only. The game, browser, automated gameplay
tests and performance profiling were not run for this change. Camera-dependent
appearance and real-device frame times still require a rendered review.

Stable interior doors use the same shared timber-leaf model as exterior doors,
with the clear width and height supplied by that actual building. The interior
leaves fold back along their jambs. The vestibule and cart aisle reserve the
entire frame width; narrow rail collision uses the rendered rail depth. Straw
bedding remains walkable and does not reserve a false tall NPC occlusion area.
The dirt floor reuses the already loaded painted terrain artwork; its one
256-square texture is released with the room. Stable stock uses the existing
shared furniture batches and adds no per-frame decoration work.

Indoor idle facing is resolved from each resident's actual safe position. Patrons
with a table assignment retain a local table point after relocation, rather than
reusing their old spawn vector. Other residents prefer a clear authored heading,
a nearby table, or the center of their current room. Short floor/wall probes
reject idle directions into a nearby wall. Arrivals and servers reset their
facing after walking. A staggered check updates at most one resident every
180 ms; turning toward the player requires a clear interaction path. Cinematics,
story combat and active walking retain control of their actors. Existing complete
directional poses and regional artwork are preserved.
