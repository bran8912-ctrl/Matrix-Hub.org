# Factory simulator build slot

This directory is deployed as static content at `/simulations/factory/`. The
current `index.html` is a placeholder until a Cocos Creator simulator build is
available.

## Export and install

1. Open the simulator project in Cocos Creator and select the Web Desktop or
   Web Mobile build target.
2. Set the build's base URL / server root to `/simulations/factory/` and keep
   emitted asset and script URLs relative to that directory. Do not use
   root-relative `/assets/...` URLs.
3. Export the production build, then copy its entry HTML, `assets/`, scripts,
   and other generated build files into this directory. Preserve the host
   integration contract in `docs/simulator-spec.md`.
4. Ensure the build's entry file is named `index.html`, and test both direct
   loading at `/simulations/factory/` and embedding on `/industrial-simulation`.

Keep the build self-contained and static: no database, remote AI, paid runtime
service, or third-party runtime dependency is required. Do not vendor the
separate `bran8912-ctrl/cocos2d-x` repository; it is engine context only.
