# Regional trees and touch layout editing

Six new painted pixel-RPG trees share one streamed billboard atlas:

- Coconut palms and banyans in Portquill, including suitable coastal sand.
- Palms on suitable Rindass coasts.
- Tall silvercrown trees and pale-barked cedars in Narenthil (roughly 570–650
  world units before the existing size variation).
- Dark ancient oaks and firs in Druganwoods forests.

Existing snow trees, volcanic scenery and the unique Elarion life-tree artwork
remain in their existing roles. Tree counts retain the existing deterministic
chunk grid and terrain/road/quest/content reservations. The new trees have
surveyed trunk-only collision profiles and use the existing billboard/fading
path. Their whole painted crowns are static, rather than using extra split
canopy textures; existing tree sway is unchanged.

The PNG is registered as a streamed sheet. Boot neither downloads nor prepares
it unless an applicable chunk needs it later. One decoded source is packed one
complete tree per yielded chunk-preparation step. Only one completed 1536 × 1536
atlas is retained. It passes the existing GPU upload fence before its trees and
colliders are revealed together. No per-frame pixel scans or full-world tree
searches were added. Timeouts, dimension failures and disposal are bounded;
failed optional art uses the established tree artwork fitted within the reserved
envelope so a broken download cannot strand streaming. Existing synchronous
fixture paths likewise do not wait for asynchronous image decoding.

Artwork, measured source registration and exact built-in imagegen prompts:
`art-source/trees/regional-trees-prompts-v1.md` and `src/data/regionalTrees.ts`.
The accepted runtime PNG and recoverable initial master are versioned.

The pause menu's **Keyboard & touch controls** settings now includes
**Customize touch button positions, sizes & opacity**. It opens a paused preview
using the actual MobileControls component. Players can drag any control or use
the horizontal/vertical sliders, resize buttons and the joystick, and adjust
each control's opacity. Missing skill slots and the contextual interaction
button are shown in the editor so their future positions remain configurable.

Portrait and landscape layouts are separate. Controls use normalized safe-area
centers and clamped usable sizes; opacity cannot make a button completely
invisible. Existing layouts remain unchanged until a custom layout is saved.
The existing global size preference still applies. Editing intercepts pointer,
click and keyboard actions; it never forwards preview gestures to gameplay.
Pointer cancellation, rotation, focus loss, unmounting and control-setting
changes release input. The editor cleans up its resize listener/observer and
restores focus. Cancel does not write preferences; Save publishes the complete
validated layout once. Automatic arrangement and restoration of the original
layouts are available. Overlapping controls produce an advisory in the editor.

Layouts extend the existing device-control preference record, preserving key
bindings and the old size preference. Invalid saved layouts fall back to the
original usable controls. Progress saves, quests and character state are
unaffected. Storage failures are reported as session-only application rather
than successful persistence. Layout editing measures the DOM only while the
editor is open; gameplay does not add resize observers or position polling.

Validation: source/asset inspection and both required TypeScript compiler
checks. No game, browser, Playwright, APK build or real-device performance test
was run. GPU sprite cropping, FPP/TPP forest appearance, Android touch gestures,
rotation/notch handling and frame-time effects remain unverified in gameplay.
