# Android game-file downloads

Android releases now keep game code and the startup logo in the APK. The exact
existing shipping artwork/audio files are ZIP-compressed into immutable data
packs, without resizing, conversion or editing source assets. The ordinary Vite
browser build remains self-contained. The Windows launcher now reuses the exact
manifest and packs from this Android job; Android installation and download
behavior are unchanged. See `WINDOWS_ASSET_DOWNLOADS.md`.

`prepare-android-downloads.mjs` runs after the web build and before Capacitor
sync. It uses the existing public shipping inventory, deduplicates identical
bytes, groups files by hash prefix, and writes a trusted manifest into the APK.
Generated JavaScript is not part of these downloadable packs. Each APK pins
its own manifest; code changes still need an APK update.

On Android startup, the native GameAssets plugin checks private app files.
Missing packs require the player's download-button action before importing the
game. Pack transfers resume using HTTP Range where supported, are verified by
SHA-256, and stream through native ZIP extraction. Every extracted file is
checked for its expected size and SHA-256 before atomic publication. Entry
names must belong to the APK manifest; arbitrary paths are rejected. Completed
files survive interrupted downloads. Retry never deletes saves or settings.

The game continues to request its existing local asset URLs. A Capacitor
WebView client serves those requests from private, content-addressed files,
including byte-range responses for audio. No remote game-page navigation,
service worker database, SQL database, account, or runtime asset decoding was
added. When files are complete, startup works offline without checking a host.
Storage is persistent app no-backup files (not the OS-evictable cache directory), so downloaded artwork does not consume the cloud backup quota intended for saves.
Uninstalling/clearing app data removes downloaded files; normal updates retain
them. Obsolete downloader files are retired only after the new set completes.

The release pipeline publishes packs to the permanent `leighneron-assets-v1`
GitHub Release BEFORE publishing the small APK. The asset release is excluded
from both four-game-release retention jobs: old APKs may still require its
immutable packs. Do not delete that release or its existing assets. No secret
or database is required; downloads are public. New releases reuse identical
packs and upload only new content hashes. A changed file can require downloading
its containing pack, not the complete game. The initial total download is still
the full required content; the smaller APK does not remove that requirement.

Required TypeScript checks passed. Native Java compilation and packaging are
verified by the release workflow. Fresh-install, interrupted transfer, update,
range playback and real-device behavior need device verification; source and
compiler review do not establish these. No gameplay/browser tests were run.
