# Interior furniture volumes

Ordinary rooms and player-owned homes now submit fixed furniture geometry to
the existing shared instanced renderer. Each model is built once per active
style/batch using the existing artwork atlas. No replacement artwork, new
runtime image or additional post-processing pass is introduced.

## Shapes and artwork

- Beds have legs, a frame, mattress, horizontal bedding, headboard and footboard.
- Tables, benches and workstations have horizontal painted surfaces, supports
  and open leg space. Chairs and royal seats have seats, backs and legs.
- Wardrobes, bookcases, pantries and screens have solid side/back volumes with
  their original hinges, shelves, books and carving retained on the front.
- Counters have a top and front fascia; hearths have jambs, a recess, mantel
  and chimney. Decorative steps use separate treads and risers.
- Barrels, planter pots, fountain bowls and brazier bases have circular sections.
  Foliage and flames retain fixed intersecting artwork cutouts.
- Arches have thickness around an open passage. Lanterns have a framed body.
  Weapon racks retain their open frame and mounted weapons face with the rack.
- Regional centerpieces retain their separate throne, couch, shrine, fountain
  or brazier treatment. All nine original regional collections are supported.
- Cave/tower chests change geometry when opened, and tower doors retain their
  closed/open states. Rugs remain floor decals.

The checked-in material rectangles in `furnitureMaterials.json` were selected
from the existing packed furniture atlases. Their sampled minimum alpha is
234/255, avoiding transparent edge patches on the added sides and backs.
They are normalized to each visible subject, so the same rectangles work with
both the 192px housing frames and 256px ordinary-room frames. Runtime geometry
uses these small material regions without scanning or repainting pixels.

## Placement and lifecycle

Furniture uses the existing front-foot anchor and saved floor heading. Rotation
does not tilt its vertical axis or make it follow the camera. Editable homes
derive model depth from the saved collision footprint. Ordinary furnishings
retain their existing contact depths. The floor planner, IDs, collision rules,
sleep/reward interactions, ownership, gold and save payload are unchanged.

The renderer checks the full model's extent, including foliage overhang, during
view culling. Furniture shares the architecture shading and character cutaway.
Soft contact shadows reuse the existing shared artwork and add no per-prop
update listener. Destroying a furnishing also destroys its contact shadow;
home edits, room exit and scene shutdown retain their existing cleanup paths.

The furniture editor remains the existing overhead layout planner; the placed
furniture is presented in 3D during gameplay.

## Verification

Both mandatory TypeScript compiler checks pass. Source artwork and integration
were inspected. The game was not launched, and visual appearance, touch
interaction and real-device frame pacing remain unverified. The release
workflow checks the APK's package, stable signing certificate and non-debuggable
manifest before publication.
