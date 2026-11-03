# Windows launcher and shared Android asset downloads

The previous Windows download was a portable self-extracting Electron app,
not an installer. It included all shipping game artwork/audio inside its
payload and could spend time unpacking before creating a window. That is a
plausible explanation for a short freeze/no visible window; the user's existing
EXE has not been run or diagnosed on their Windows installation.

Windows now produces two small-shell packages:

- `Tales-of-Leighneron-2.5D-Setup.exe`: per-user NSIS installer with shortcuts,
  an installation-directory choice, and no requested administrator elevation.
- `Tales-of-Leighneron-2.5D-Windows.exe`: optional portable launcher.

Electron itself is still included. Exact EXE size requires a Windows build;
a smaller launcher does not remove the disk space needed for game files.

## Same assets as Android, unchanged APK behavior

Android's existing build, pack generator, APK signing and downloader are
unchanged. Its job additionally uploads the existing `dist/native-assets.json`
as `Android-Pinned-Asset-Manifest`. The Windows job waits for Android, downloads
that exact manifest, checks the shipping inventory, removes the corresponding
Windows bundled asset files, and packages the small code/startup shell. It does
not create a second asset set, recompress art, or upload different packs.

Both applications pin identical paths, SHA-256 hashes, pack names and URLs under
the permanent `leighneron-assets-v1` release. The existing publish job still
uploads those Android-generated packs before publishing either application.
The asset-storage release remains excluded from release-retention deletion.

First launch asks to download missing game packs before importing the game or
initializing saves. Subsequent launches work offline after checking local
files. Updates request only packs containing files missing from the new pinned
manifest. A changed file can require its containing pack; this is not a binary
patch of individual files. Windows and Android download identical pack bytes
but store their own local copies on their respective devices.

Windows stores blobs at Electron's existing `userData/game-assets-v1` directory,
not a portable extraction/temp directory. The package name, product-name
configuration, application ID and `leighneron://game/` origin remain unchanged.
Save, settings and backup directories are never cleared by download retries.
NSIS does not delete app data on uninstall. The downloader owns only its asset
subdirectory; old asset blobs are retired only after the current set is complete.

## Download and runtime integration

- Transfers resume with HTTP Range and restart safely if a server ignores Range.
- Both compressed packs and individual extracted files are verified by SHA-256.
- The pinned manifest restricts downloads to the existing GitHub asset release.
  ZIP entries must be expected content hashes; paths and executable code are rejected.
- Incomplete data stays in temporary files. Verified files publish by rename.
  Receipt metadata avoids hashing the entire asset library on every startup;
  changed/missing metadata causes verification before reuse.
- Disk checks allow space for the compressed pack and its missing unpacked files.
  Errors leave completed files intact and expose a Resume button.
- Downloads, hashing, ZIP inflation and writes run in one owned Node worker.
  The worker is explicitly unpacked from ASAR with its pinned decoder and manifest,
  and stops when the game starts or the window closes.
- The renderer remains sandboxed with Node integration disabled. A preload bridge
  exposes fixed status/prepare/progress operations only to the main packaged page.
- The existing asset URLs resolve to local files through the stable protocol,
  including HEAD and byte ranges for audio. No game rendering/detail settings change.
- Only one desktop instance runs at a time. Window/startup failures show a native
  error dialog instead of only logging before exit.

`scripts/prepare-windows-downloads.mjs` stages a minimal package in
`desktop-package/`, avoiding redundant production node_modules because the web
bundle already includes the game libraries. The existing installed fflate
0.8.3 decoder and its MIT license are copied explicitly. There is no dependency
upgrade. Shell staging rejects payloads above 64 MiB before Electron, and the
workflow bounds/checks both EXEs and publishes their SHA-256 checksums.

## Verification limits

Only the required TypeScript compiler checks were authorized. Downloader test
cases were prepared in `tests/windowsAssetDownloads.test.ts` but not run.
No Windows installer/portable build, EXE launch, test/browser, real download,
CI run, commit, push or publication was performed for this change. TypeScript
checks cover the bridge and test declarations; they do not execute or fully
type-check the CommonJS Electron main/worker implementations. Installation,
ASAR worker loading, fresh/updated/offline startup, resumed downloads, save
continuity and actual size/performance still need Windows runtime verification.

References: [Electron preload isolation](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload),
[Electron protocol handling](https://www.electronjs.org/docs/latest/api/protocol),
[electron-builder NSIS](https://www.electron.build/v26/docs/nsis/),
[packaged file contents](https://www.electron.build/v26/docs/contents/).
