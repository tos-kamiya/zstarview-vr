# Developer Notes

## Requirements

- Node.js 18+ (recommended: 20+)
- npm

## Project Structure

- `src/`: app source code
- `data/stars.csv`: input star catalog
- `data/cities1000.txt`: input city catalog (GeoNames-derived)
- `scripts/generate-stars-data.mjs`: generator for `src/generated/stars-data.js`
- `scripts/generate-cities-data.mjs`: generator for `public/data/cities-index-v2.json`
- `scripts/generate-cities-gzip.mjs`: generator for `public/data/cities-index-v2.json.gz`
- `src/generated/`: generated files (can be deleted safely)
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

- `src/generated/stars-data.js`
- `public/data/stars-data-extra-10.bin`
- `public/data/cities-index-v2.json`
- `public/data/cities-index-v2.json.gz`

from:

- `data/stars.csv`
- `data/cities1000.txt`

Then Vite builds the app into `dist/`.

## Local Development

```bash
npm run dev
```

`npm run dev` also regenerates `src/generated/stars-data.js` via `predev`.
`predev` regenerates both star and city generated data files.

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

This repository intentionally keeps `src/generated/stars-data.js` under version control.

Why:

- Easier debugging when generated output differs between environments
- Clear git diffs for generator/script changes
- Faster first-time inspection after clone

Rule:

- If you change `data/stars.csv` or `scripts/generate-stars-data.mjs`,
  regenerate and commit `src/generated/stars-data.js` and
  `public/data/stars-data-extra-10.bin` in the same change.
- If you change `data/cities1000.txt` or `scripts/generate-cities-data.mjs`,
  regenerate and commit `public/data/cities-index-v2.json` in the same change.
- If you change city generator scripts, also regenerate and commit `public/data/cities-index-v2.json.gz`.

## Recent Updates

### v0.5.0 (2026-03-01)

- **Planet Rendering Upgrade**:
  - Replaced planet cross markers with dynamic disk sprites.
  - Added bloom-like effects using radial gradients and `AdditiveBlending`.
  - Implemented magnitude-based scaling (dimmer planets appear smaller).
  - Added scaling clip at -1.5 magnitude to prevent oversized disks for bright planets like Venus.
- **Astronomy Engine Integration**:
  - Now dynamically calculates planet visual magnitude using `Astronomy.Illumination`.
