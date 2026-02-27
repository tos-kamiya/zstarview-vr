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
- `scripts/generate-stars-data.mjs`: generator for `src/generated/stars-data.js`
- `src/generated/`: generated files (can be deleted safely)
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

from:

- `data/stars.csv`

Then Vite builds the app into `dist/`.

## Local Development

```bash
npm run dev
```

`npm run dev` also regenerates `src/generated/stars-data.js` via `predev`.

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
