# zstarview-vr

WebVR prototype of a sky viewer around Matsue, Japan.

Try it on GitHub Pages (for Quest 3 and other supported devices/browsers):

- https://tos-kamiya.github.io/zstarview-vr/

You can experience the app by opening the URL above.

## Requirements

- Node.js 18+ (recommended: 20+)
- npm

## Project Structure

- `src/`: app source code
- `data/stars.csv`: input star catalog
- `data/cities1000.txt`: input city catalog (GeoNames-derived)
- `scripts/generate-stars-data.mjs`: generator for `src/generated/stars-data.js`
- `scripts/generate-cities-data.mjs`: generator for `public/data/cities-index.json`
- `src/generated/`: generated files (can be deleted safely)
- `public/data/cities-index.json`: generated city index for lazy loading
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
- `public/data/cities-index.json`

from:

- `data/stars.csv`
- `data/cities1000.txt`

Then Vite builds the app into `dist/`.

## Local Development

```bash
npm run dev
```

`npm run dev` also regenerates `src/generated/stars-data.js` via `predev`.

## URL Parameters

You can control observer location from URL:

- `?lat=35.465&lon=133.051`
- `?city=Tokyo`

Priority:

1. `lat` + `lon` (if valid)
2. `city` (lazy-loaded city index lookup)
3. default (`Matsue`)

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
  regenerate and commit `src/generated/stars-data.js` in the same change.
- If you change `data/cities1000.txt` or `scripts/generate-cities-data.mjs`,
  regenerate and commit `public/data/cities-index.json` in the same change.
