# zstarview-vr

WebVR prototype of a sky viewer (default location: Tokyo, Japan).

Try it on GitHub Pages (for Quest 3 and other supported devices/browsers):

- https://tos-kamiya.github.io/zstarview-vr/

You can experience the app by opening the URL above.

## Screenshot

Desktop mode (`?view=fisheye180`):

![Desktop fisheye 180 screenshot](./imgs/browser-fisheye180.png)

## Usage (VR Mode)

1. Open:
   - https://tos-kamiya.github.io/zstarview-vr/
2. Optionally specify location in URL:
   - `?lat=35.465&lon=133.051`
   - `?city=Tokyo`
   - `?city=Matsue&country=JP`
3. Start VR:
   - Press `Enter VR`.
   - A location splash appears in front of the user for about 3 seconds.

Location resolution priority:

1. `lat` + `lon` (if valid)
2. `city` (lazy-loaded city index lookup)
3. default (`Tokyo`)

If `city` is not found (or city index loading fails), the app falls back to default (`Tokyo`) and explicitly shows the fallback reason in status/splash text.
If `country` is also specified, city lookup is filtered by that country code (ISO 3166-1 alpha-2, e.g. `JP`, `US`).

## Usage (Desktop Mode)

1. Open with `?view=fisheye180`:
   - `https://tos-kamiya.github.io/zstarview-vr/?view=fisheye180`
2. Use arrow keys:
   - `←/→` for azimuth
   - `↑/↓` for altitude

## License

This project is licensed under the MIT License.

- [LICENSE](./LICENSE)

Data source licenses (inherited from zstarview dataset sources):

- City names (`data/cities1000.txt`): GeoNames dump  
  Source: https://download.geonames.org/export/dump/  
  License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Star catalog (source for generated star data): Hipparcos and Tycho Catalogues (ESA 1997) via CDS Strasbourg  
  Source: https://cdsarc.cds.unistra.fr/ftp/I/239/  
  License note in zstarview: ODbL or CC BY-NC 3.0 IGO (non-commercial)

## Developer Notes

For build/development/setup details, see:

- [DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)

## Acknowledgements

This project was developed with assistance from OpenAI GPT-5 (Codex).
