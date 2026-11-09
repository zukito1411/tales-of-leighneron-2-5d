# Android APK release pipeline

The release workflow remains in `.github/workflows/release-both.yml` for
historical compatibility, but it now builds **Android only**. There is no
Windows/Electron packaging job or dependency in the release process.

Each qualifying push to `main` builds and verifies a non-debuggable APK,
preserves the existing certificate fingerprint for update compatibility,
uploads the immutable downloadable game asset packs, and publishes the signed
APK plus SHA-256 checksum to GitHub Releases.

## Resilience and safety

The Android job uses pinned Gradle 8.11.1, a cached binary distribution,
bounded download retries, and a longer network timeout to mitigate
temporary upstream 504 failures. An actual build, signing, or verification
failure still blocks release publication.

The special `leighneron-assets-v1` storage release is kept intact for
existing installs and downloadable game content. The existing policy
retains the four latest normal releases.

Only workflow configuration was changed to remove Windows packaging.
The game's runtime code, rendering quality, and saved-game behavior are not
altered by this pipeline change.

The workflow ignores changes confined to `.github/workflows/**` on push;
this documentation change also triggers the new APK-only workflow on
`main`. Check Actions and the Releases page for the resulting signed APK.
