# CI release download recovery

The combined release workflow is `.github/workflows/release-both.yml`.
It only publishes the Android APK and Windows installer/portable EXE together after
both jobs have produced verified release artifacts.

## External HTTP 504 failures

A `504 Gateway Time-out` from a tool archive download is not evidence of a game
code or graphics failure. The Android job downloads the pinned Gradle 8.11.1
binary distribution; the Windows job uses pinned Electron 45.0.0 and
electron-builder 26.18.0, which can download further packaging helpers.

- Android prepares Gradle with bounded retries and caches the wrapper
  distribution before running `assembleRelease`. APK signing keys and
  fingerprint verification remain unchanged.
- Windows caches Electron and electron-builder archives and retries the
  same `electron-builder --win nsis portable --x64 --publish never` command.
  The two Windows targets and artifact filenames are unchanged.
- Downloads or packaging that still fail after the bounded attempts cause CI
  to fail. A failed Windows job must not publish an APK-only release.

A workflow-only commit does not automatically start this release pipeline;
the workflow's `push.paths-ignore` intentionally excludes `.github/workflows/**`.
Use `workflow_dispatch` or a normal non-workflow commit when the
workflow needs to run on a new revision. Check the corresponding Actions run
for final APK + EXE publication, rather than assuming that successful
Gradle setup means a release was published.
