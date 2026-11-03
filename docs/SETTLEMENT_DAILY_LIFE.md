# Settlement daily life and integration

Routine plans cover existing residents in every settlement. Houses, inns,
workshops, guilds, archives, stables and stores are selected from actual
enterable buildings in that resident's town. Homes owned or offered to the
player are excluded. Nearby alternatives provide household variety without
sending residents arbitrarily across a city. Plans cap households at four,
inns at eight, workrooms at four and relief barracks at five routine visitors;
room placement can admit fewer when furniture or story residents need space.

Civilian work starts around 08:00, supper around 18:00, and home time between
22:00 and 23:30. Morning departures start around 06:00. Stable per-person offsets
spread departures. Only a relief fraction of mobile guards receives barracks
breaks. Gate sentries, marching formations, quest contacts, cinematic subjects,
escorts and permanent indoor story residents retain their established roles.
Outdoor workers retain authored activity courts rather than gathering at one
new shared point. Inns have more patrons after work; overnight service contacts
remain available. Guilds and other workplaces have smaller overnight casts.

Nearby residents with approved walking animations use the existing street
route queue and collision checks to reach a certified doorway forecourt. A
resident at the door waits while the player stands beside them. Residents
without matching walking art change residency offscreen; no sliding idle
sprites or substitute regional artwork are introduced. Unloaded residents are
projected by the current game clock. No unseen crowd is physically simulated.
Only the content manager owns outdoor actors and saved coordinates. Indoors,
the existing room owns visitor actors; claiming a visitor disposes any hidden
outdoor counterpart. Original IDs, trust and quest state remain unchanged.

Planning resumes at most four steps per town within a shared 0.25 ms allowance.
Live actors check routines at staggered 300–499 ms intervals. Clock projections
run incrementally, and room population changes advance one step per 500 ms.
Indoor arrivals/departures reuse the entrance flood's checked parent graph;
short pedestrian detours reuse NPC avoidance. Story contacts get placement
priority. Optional visitors skip unsafe slots and defer obstructed arrivals.
Room generators, actor references and contact shadows are released on teardown.

Guild clerks use the existing town contract board. Room-local supply sellers
and armorers use the existing merchant and forge UI with eligibility enforced
by the same store actions. Their temporary dialogue definitions are not saved
or added to the global NPC catalog. No new seated/drinking animation is claimed.

Other changes: manual locks release beyond view distance or after 300 ms
outside render submission; route work runs ahead of actor placement with a
reserved share; redundant transition save captures were removed. Optional
shader output variants are budgeted separately and instance buffers are not
copied. Adaptive resolution defaults off for fresh preferences; existing saved
preferences remain respected. No artwork, model detail or effect is removed.

Keyboard bindings and touch size live in device preferences, with duplicate and
reserved-key checks. HUD/skill/interaction hints follow custom bindings. Menu
shortcuts remain fixed. Standard potion IDs and effects are unchanged. New
purchasable concentrated supplies restore a fraction of maximum vitals with a
minimum amount; missing counts in older saves remain valid and mean zero.
Shortcuts consume standard bottles first, then concentrated supplies; individual
bottles can be selected in inventory.

Verification is compiler/source review only unless explicitly authorized.
Focused regression cases are in `tests/settlementLife.test.ts`; they have not
been executed for this change. Visual transitions, frame-time percentiles,
Android behavior and real gameplay/save restoration still require runtime
verification. Compiler success is not evidence of smooth frame pacing.
