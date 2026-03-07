# Developer Notes

## Requirements

- Node.js 18+ (recommended: 20+)
- npm

## Project Structure

- `src/`: app source code
- `src/main.js`: app bootstrap and top-level render/update orchestration
- `src/menu/vr-menu.js`: VR menu state, panel drawing, and pointer/trigger interaction
- `src/menu/star-preview.js`: `Jump to Star` preview arc and target marker rendering
- `src/asterisms/catalog.js`: imported asterism definitions
- `src/asterisms/runtime.js`: source-id to runtime-star resolution for asterisms
- `src/asterisms/render.js`: ambient/highlight asterism line rendering
- `data/stars.csv`: input star catalog
- `data/cities1000.txt`: input city catalog (GeoNames-derived)
- `public/data/dso.csv`: input deep-sky-object catalog (OpenNGC-derived)
- `scripts/generate-stars-data.mjs`: generator for star binary chunks
- `scripts/generate-cities-data.mjs`: generator for `public/data/cities-index-v2.json`
- `scripts/generate-cities-gzip.mjs`: generator for `public/data/cities-index-v2.json.gz`
- `scripts/generate-famous-stars-data.mjs`: generator for `src/generated/famous-stars-data.js`
- `src/generated/`: generated files (can be deleted safely)
- `src/generated/famous-stars-data.js`: generated famous-star / asterism source-id dataset
- `public/data/cities-index-v2.json`: generated city index for lazy loading
- `public/data/cities-index-v2.json.gz`: gzip version loaded by browser and decompressed in JS
- `dist/`: build output

## Build (when `src/generated/` does NOT exist)

You can build from a clean state without `src/generated/`.

1. Install dependencies:

```bash
npm install
```

2. Build:

```bash
npm run build
```

`npm run build` automatically runs `prebuild`, which regenerates:

- `public/data/stars-data-base.bin`
- `public/data/stars-data-extra-7.bin`
- `public/data/stars-data-extra-8.bin`
- `public/data/stars-data-extra-9.bin`
- `public/data/stars-data-extra-10.bin`
- `public/data/cities-index-v2.json`
- `public/data/cities-index-v2.json.gz`

from:

- `data/stars.csv`
- `data/cities1000.txt`
- `public/data/dso.csv` (loaded directly at runtime)

Then Vite builds the app into `dist/`.

## Local Development

```bash
npm run dev
```

`npm run dev` also regenerates star/city generated data files via `predev`.

## URL Parameters

You can control observer location from URL:

- `?lat=35.465&lon=133.051`
- `?city=Tokyo`
- `?city=Matsue&country=JP`

Notes:

- `country` is used only with `city` lookup.
- `country` must be a 2-letter country code (case-insensitive), e.g. `jp`, `JP`.

## Compression (Client-side `.gz`)

The app first requests `public/data/cities-index-v2.json.gz` and decompresses it in JavaScript using `DecompressionStream('gzip')`.
If that fails (unsupported browser or missing `.gz`), it falls back to `cities-index-v2.json`.

This means server-side gzip settings are optional for city index loading.

Quick check after deploy:

```bash
curl -I https://YOUR_HOST/zstarview-vr/data/cities-index-v2.json.gz
```

Expected: HTTP 200 and a non-zero `Content-Length`.

## Notes

- Do not run `vite build` directly if `src/generated/` is missing.
- Always use `npm run build` (or run the generator manually first).

## Generated File Policy

Rule:

- If you change `data/stars.csv` or `scripts/generate-stars-data.mjs`,
  regenerate and commit `public/data/stars-data-base.bin` and
  `public/data/stars-data-extra-7.bin` and
  `public/data/stars-data-extra-8.bin` and
  `public/data/stars-data-extra-9.bin` and
  `public/data/stars-data-extra-10.bin` in the same change.
- If you change `data/cities1000.txt` or `scripts/generate-cities-data.mjs`,
  regenerate and commit `public/data/cities-index-v2.json` in the same change.
- If you change city generator scripts, also regenerate and commit `public/data/cities-index-v2.json.gz`.

## Recent Updates

### v0.8.0 (2026-03-06)

- **Asterism Overlay Import (zstarview-aligned)**:
  - Switched asterism definitions to HIP/source-id based paths to align with zstarview data.
  - Added/updated seasonal asterism set including Big Dipper and Little Dipper.
  - Hovering a famous star now resolves matching asterisms by source-id, with 3-second rotation when multiple matches exist.

- **Label Layout Stabilization (temporary baseline mode)**:
  - Disabled label-avoidance offset motion and easing logic for isolation/debugging baseline.
  - Labels are currently placed at their anchor positions without collision-driven movement.
  - Disabled pink label tint debug mode used during overlap diagnostics.

- **Documentation Updates**:
  - Updated both `README.md` and `README-ja_JP.md` with imported asterism behavior and lists.
  - Japanese README now includes Japanese names for imported asterisms.

### v0.5.0 (2026-03-01)

- **Planet Rendering Upgrade**:
  - Replaced planet cross markers with dynamic disk sprites.
  - Added bloom-like effects using radial gradients and `AdditiveBlending`.
  - Implemented magnitude-based scaling (dimmer planets appear smaller).
  - Added scaling clip at -1.5 magnitude to prevent oversized disks for bright planets like Venus.
- **Astronomy Engine Integration**:
  - Now dynamically calculates planet visual magnitude using `Astronomy.Illumination`.

- **Jump to Named Star (VR)**:
  - Added a VR menu panel accessible via the controller Menu button (or 'M' key on desktop).
  - Evolved the panel into a two-level VR menu with `Jump to Star` and `About`.
  - In VR, menu items are hovered by pointer and activated by trigger; the Menu button is reserved for showing/hiding the panel.
  - `Jump to Star` now distinguishes hovered preview from trigger-confirmed selection. Hover drives the preview only before the first star is confirmed; confirmed selection persists until the menu closes.
  - The target star is marked with a glowing circle, and a dynamic great-circle arc is rendered from the center of the user's field of view.
  - The menu panel appears offset to the left or right of the user's forward view depending on which controller opened it, and shows a visible pointer/menu intersection marker.

### v0.8.3 (2026-03-08)

- **Rendering Refactor**:
  - Split `Jump to Star` preview rendering out of `main.js` into `src/menu/star-preview.js`.
  - Split asterism ambient/highlight rendering out of `main.js` into `src/asterisms/render.js`.
  - Kept `src/main.js` focused on scene setup and cross-module orchestration.

- **Code Cleanup**:
  - Removed dead preview and label-layout constants left behind by earlier interaction changes.
  - Removed unused label collision/layout scaffolding that was no longer referenced by the simplified layout path.
