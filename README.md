# zstarview-vr

Experimental WebXR port of the AI-assisted Python sky viewer “zstarview”.

Try `zstarview-vr` on GitHub Pages (for Quest 3 and other supported devices/browsers):

https://tos-kamiya.github.io/zstarview-vr/

This repository represents a milestone snapshot of an ongoing migration
from a desktop Python/Qt application to a browser-based immersive prototype.

Original desktop application:  
https://github.com/tos-kamiya/zstarview (Python/Qt version)

## Quick Links

- Default:
  - [Open default URL](https://tos-kamiya.github.io/zstarview-vr/)
- Extended stars (`maxMag=7`):
  - [Open with `maxMag=7`](https://tos-kamiya.github.io/zstarview-vr/?maxMag=7)
- Extended stars (`maxMag=8`):
  - [Open with `maxMag=8`](https://tos-kamiya.github.io/zstarview-vr/?maxMag=8)
- Extended stars (`maxMag=9`):
  - [Open with `maxMag=9`](https://tos-kamiya.github.io/zstarview-vr/?maxMag=9)
- Extended stars (`maxMag=10`):
  - [Open with `maxMag=10`](https://tos-kamiya.github.io/zstarview-vr/?maxMag=10)
  - Note: due to extremely large data size, this mode is provided mainly for benchmarking rather than practical use.

Major cities (about 20):

- [Tokyo, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Tokyo&country=JP)
- [Osaka, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Osaka&country=JP)
- [Matsue, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Matsue&country=JP)
- [Seoul, KR](https://tos-kamiya.github.io/zstarview-vr/?city=Seoul&country=KR)
- [Beijing, CN](https://tos-kamiya.github.io/zstarview-vr/?city=Beijing&country=CN)
- [Shanghai, CN](https://tos-kamiya.github.io/zstarview-vr/?city=Shanghai&country=CN)
- [Taipei, TW](https://tos-kamiya.github.io/zstarview-vr/?city=Taipei&country=TW)
- [Singapore, SG](https://tos-kamiya.github.io/zstarview-vr/?city=Singapore&country=SG)
- [Bangkok, TH](https://tos-kamiya.github.io/zstarview-vr/?city=Bangkok&country=TH)
- [Delhi, IN](https://tos-kamiya.github.io/zstarview-vr/?city=Delhi&country=IN)
- [Dubai, AE](https://tos-kamiya.github.io/zstarview-vr/?city=Dubai&country=AE)
- [Cairo, EG](https://tos-kamiya.github.io/zstarview-vr/?city=Cairo&country=EG)
- [London, GB](https://tos-kamiya.github.io/zstarview-vr/?city=London&country=GB)
- [Paris, FR](https://tos-kamiya.github.io/zstarview-vr/?city=Paris&country=FR)
- [Berlin, DE](https://tos-kamiya.github.io/zstarview-vr/?city=Berlin&country=DE)
- [Istanbul, TR](https://tos-kamiya.github.io/zstarview-vr/?city=Istanbul&country=TR)
- [New York, US](https://tos-kamiya.github.io/zstarview-vr/?city=New%20York&country=US)
- [Los Angeles, US](https://tos-kamiya.github.io/zstarview-vr/?city=Los%20Angeles&country=US)
- [Mexico City, MX](https://tos-kamiya.github.io/zstarview-vr/?city=Mexico%20City&country=MX)
- [Sao Paulo, BR](https://tos-kamiya.github.io/zstarview-vr/?city=Sao%20Paulo&country=BR)

## Usage (VR Mode)

1. Open:
   - https://tos-kamiya.github.io/zstarview-vr/
2. Optionally specify location in URL:
   - `?lat=35.465&lon=133.051`
   - `?city=Tokyo`
   - `?city=Matsue&country=JP`
   - `?timeOffsetMinutes=120` to view the sky two hours ahead (`-90` shifts it back 90 minutes).
3. Start VR:
   - Press `Enter VR`.
   - A location splash appears in front of the user for about 3 seconds.
4. While immersed:
Location resolution priority:

1. `lat` + `lon` (if valid)
2. `city` (lazy-loaded city index lookup)
3. default (`Tokyo`)

If `city` is not found (or city index loading fails), the app falls back to default (`Tokyo`) and explicitly shows the fallback reason in status/splash text.
If `country` is also specified, city lookup is filtered by that country code (ISO 3166-1 alpha-2, e.g. `JP`, `US`).

## Feature: VR Center Label Ring Panel

In VR, `zstarview-vr` now includes a center label ring panel that reduces label clutter near the current target area.

- When the Sun, Moon, planets, or named stars enter the center target zone, their labels move from the sky into a transparent donut-shaped HUD panel.
- If only one object is active, its ring label stays at the top of the panel to reduce motion.
- If multiple objects are active, labels are placed around the ring from their relative directions within the current group.
- While a controller trigger is held, the center target zone and the ring panel follow the controller pointing direction.
- The sky target itself is reinforced with target rings, while the panel remains intentionally very faint.

Related marker behavior:

- The Sun uses a crosshair-style gauge marker; the Moon uses its phase disc.
- Planets use their existing marker plus a crosshair-style gauge marker.
- Solar-system labels are no longer shown as always-on world labels; they are shown through the center panel when relevant.

The Gaia texture is an equirectangular Galactic-coordinate map and is bundled locally. It fades in daylight and is rendered behind stars and celestial objects. If the image cannot load, the star scene remains available and the status reports the missing layer.

The sky colour uses the desktop project's RGB spherical-atmosphere model. It is recomputed in a Web Worker from the Sun's altitude and azimuth, with a fixed AOD550 of 0.15, and shared by desktop, fisheye, and both XR eyes. The display is dimmed to preserve star visibility, and the optional Gaia background is blended softly over it. The initial 128×64 texture is a profiling setting; Quest performance and desktop colour matching still need device validation. If generation fails, the procedural sky remains available.

`Sky Guides` also includes north and south celestial-pole markers. The never-rises boundary follows the observer's hemisphere and latitude; at the equator it collapses to a pole and is omitted.
Named-star search and persistent selected-target guidance have been removed; named-star labels and asterism pointing highlights remain.

## Feature: Asterism Overlay (Imported from zstarview)

- Asterisms are always shown as dim ambient lines, and pointing at a famous star brightens the matching pattern.
- If multiple asterisms share the same star, the overlay rotates every 3 seconds.
- Asterism definitions are imported in HIP/source-id form to match zstarview data.

Imported asterisms:

- Winter: `Winter Triangle`, `Orion's Belt`, `Winter Hexagon`, `Southern Cross`, `Southern Pointers`, `Diamond Cross`, `False Cross`
- Spring: `Big Dipper`, `Little Dipper`, `Spring Triangle`, `Arc to Arcturus`, `Leo Sickle`, `Southern Triangle`
- Summer: `Summer Triangle`, `Northern Cross`, `Teapot`, `Keystone`
- Autumn: `Great Square of Pegasus`, `Circlet of Pisces`, `Water Jar of Aquarius`, `Cassiopeia W`, `House of Cepheus`, `Job's Coffin`

## Usage (Desktop Mode)

1. Open with `?view=fisheye180`:
   - https://tos-kamiya.github.io/zstarview-vr/?maxMag=10&view=fisheye180
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
- Star catalog (source for generated star data): Hipparcos and Tycho Catalogues (ESA 1997), plus Tycho-2 Catalogue (Hog et al. 2000), via CDS Strasbourg  
  Source (Hipparcos/Tycho): https://cdsarc.cds.unistra.fr/ftp/I/239/  
  Source (Tycho-2): https://cdsarc.cds.unistra.fr/ftp/I/259/  
  License note in zstarview: ODbL or CC BY-NC 3.0 IGO (non-commercial)
- Deep-sky objects (`public/data/dso.csv`): OpenNGC via PyOngc  
  Source: https://github.com/mattiaverga/OpenNGC  
  License: CC BY-SA 4.0

## Developer Notes

For build/development/setup details, see:

- [DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)

## Acknowledgements

This project was developed with assistance from Google Gemini 3 and OpenAI GPT-5 (Codex).
