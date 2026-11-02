# First-person right gauntlet and casting hand

Status: archived source artwork. Hands and forearms were removed from the first-person screen at the user's request. The runtime no longer loads, decodes, or renders this sheet.

`first-person-gauntlets-v3.png` is the versioned transparent source master, generated with the built-in imagegen tool. Two equal cells contain complete, continuous right hand/forearm poses: gripping and casting. No existing character painting was replaced. The glove uses the hero's leather, navy, green and brass palette; it is a shared first-person glove, not a separate glove for every awakened costume.

References inspected: `assets/characters/leigneron/idle.png`, `idle_sides.png`, `walk_up.png`, and the user's first-person longsword reference. The first draft was rejected for its frontal fist; the corrected grip was extended in the final edit below.

Final edit prompt:

> Production edit of this two-cell first-person RPG hand sheet. Preserve the corrected right-hand gripping anatomy, leather/brass/navy/green identity and crisp pixel-painted style, and preserve the spell-casting pose in second cell. Recompose BOTH complete hand-and-forearm poses with much LONGER CONTINUOUS FOREARMS, needed so the arm exits the bottom of a first-person screen during a sword swing. Two equal square cells side by side on 1536x768 genuinely TRANSPARENT background. In EACH 768x768 cell the HAND is SMALL near upper-left at center(210,210), gripping right fist ~150 pixels wide with forefinger knuckles to left, thumb over index on upper right exactly as existing corrected art, hand points upward along vertical invisible sword handle. In second cell same small open hand cast, center palm(210,210). Entire finished uninterrupted forearm extends diagonally from wrist at(250,290) toward(650,740), at least FOUR hand-widths of forearm length, physically natural long sleeve, proportionate wrist, gold bracer, navy cloth then green sleeve, NO giant flared bell cuff or shoulder. Keep all subject inside each cell with 20px transparent padding. NO painted weapon, no shadows, no backgrounds, no text. Do NOT draw frontal punching fists. This is owner's-eye right-arm viewpoint. Make both complete poses continuous, no stitches or assembled pieces.

The former hand renderer used normalized cell bounds and inspected grip registration instead of the requested generation dimensions. Both complete poses are retained here as source artwork.

The sword remains active: its original equipment/awakening painting is mapped onto an alpha-derived mesh with a blade ridge, beveled edges, and a rounded grip. It uses real surface lighting. `FirstPersonPose.ts` samples the actual skill clock; it does not own damage, hit timing, cooldowns, or persistence.
