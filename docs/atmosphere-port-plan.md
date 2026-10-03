# VR Atmosphere Port Plan

Date: 2026-10-03
Status: Levels B and the display-mapping portion of C are implemented locally. Desktop-reference comparisons and Quest profiling remain pending.

## Goal

Replace the hand-authored sky-colour gradient in `src/main.js` with a sky layer
sampled from the desktop project's spherical-atmosphere model. The result should
give the VR viewer a recognizable daylight-to-twilight-to-night transition,
while head movement and controller input continue without waiting for the
atmosphere calculation.

There is no terrain model in this port. The atmosphere layer is therefore
clipped at the geometric horizon (`altitude < 0°`); the existing ground colour
and guide lines remain separate layers.

## Implementation levels

| Level | Includes | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| A. Hand-shaped gradient | Current style of procedural interpolation, with a few more Sun-altitude cases | Fast, but does not port the desktop model or provide a defensible match | Do not invest further here |
| B. Model-backed coarse sky | Port the desktop RGB scattering calculation; calculate a coarse all-sky grid in a Web Worker; bilinearly sample its texture; use fixed AOD550 = 0.15 | Real model behaviour with limited environmental variation; enough to establish visual identity and measure Quest cost | Start here |
| C. Desktop-aligned sky | Level B plus the desktop ambient and intensity mapping, reference comparisons, and texture refinement around the horizon and Sun; keep AOD fixed | Better visual fidelity without adding a regional or seasonal data asset | Adopt only if Level B shows a clear benefit and runs acceptably |
| D. Spectral / higher-order renderer | Wavelength-resolved scattering or a new multiple-scattering solver | Substantial new model work; the desktop runtime is itself an RGB approximation | Out of scope |

Level B should port the desktop runtime equations and coefficients, not merely
approximate their blue/orange appearance. Keep the model's numerical integration
counts at the desktop defaults initially (`view_steps=32`, `sun_steps=12`).
Reduce angular sample count first if computation takes too long; this preserves
the reference calculation at each retained direction.

## Proposed architecture

1. Extract a pure JavaScript function that accepts arrays of view altitude and
   azimuth, Sun altitude and azimuth, and atmospheric inputs, then returns RGB
   samples. Port the desktop terms in order: spherical Earth intersections,
   Rayleigh and aerosol density, Sun visibility/Earth shadow, ozone path,
   Rayleigh and Henyey–Greenstein phase functions, twilight approximation,
   exposure, and display mapping. Keep direct solar-disc transmission out of
   this sky-layer function.
2. Run the function in `src/sky/atmosphere-worker.js`. Generate a packed typed
   array in bounded chunks so large temporary arrays do not stall the page or
   exceed worker memory. Return a request ID with every completed texture.
3. Start with a 128 azimuth × 64 vertical sample texture as a measurement
   profile, not a promised production setting. Use azimuth wrapping and map the
   vertical texture coordinate through `sin(altitude)` so the spherical sampling
   has useful resolution near the horizon. Discard or set alpha to zero below
   the horizon. Benchmark higher resolution only after the first Quest profile.
4. Upload a completed `DataTexture` on the main thread and sample it in the sky
   shader. Reuse one texture for desktop, fisheye rendering, and both XR eyes;
   head rotation only changes texture lookup. Preserve the last completed
   texture while a new worker request runs.
5. Keep Gaia as an independent display layer. Fade it strongly through daylight
   and twilight so it does not compete with the atmospheric sky. Keep the
   below-horizon ground shading and `Sky Guides` separate from both textures.
6. Use a constant AOD550 for every location and season. Start with the desktop
   reference value 0.15; make any later adjustment a single documented global
   model parameter. Use observer height 0 m. Do not package or download an AOD
   climatology for this feature.

## Update and failure behaviour

- Use one timestamp for Sun, Moon, planets, and atmosphere inputs.
- Regenerate near twilight on a 15-second starting interval and outside
  twilight on a 60-second starting interval, matching the desktop refresh
  policy. Treat these as initial settings, then tune on-device.
- Include Sun altitude/azimuth, fixed AOD, quality, and request ID in the
  worker request. Ignore stale results when a newer request has superseded
  them.
- Do not run scattering integration in the render loop or once per eye.
- If the worker fails, retain the last texture; if none exists, keep the current
  procedural sky and report that the model layer could not be generated.
- Do not add public time controls in this phase. Frozen times may be supplied
  internally for reproducible comparisons.

## How to decide whether Level C is worthwhile

Compare the VR texture with the desktop `sky_color_samples()` output at matched
timestamp, Sun direction, fixed AOD, exposure, and ambient settings. Cover
Sun altitudes of approximately `+30°`, `+5°`, `0°`, `-6°`, `-12°`, and `-18°`,
including directions at the Sun, opposite the Sun, horizon, and zenith. Compare
both sample error and the final rendered appearance; matching a handful of RGB
values alone is not enough if interpolation creates visible bands or halos.

On Quest 3, record worker time, peak temporary memory, texture-upload time,
frame-time impact, and visible interpolation artefacts. Test a north/south
observer and equatorial locations to confirm that the coordinate transform
works; the atmospheric aerosol input remains identical at each location. If
Level B reads clearly as the desktop model's changing sky and maintains
comfortable interaction, keep its fixed AOD and resolution. Refine only the
global display mapping or angular sampling if a specific visual issue remains.

## Implementation status

- Level A remains the procedural fallback while the first model texture is generated and if the worker fails.
- Level B is implemented in `src/sky/atmosphere.js` and `src/sky/atmosphere-worker.js`, with main-thread texture sampling in `src/main.js`.
- The desktop sky-intensity adjustment and deep-night ambient contribution from `sky_disc.py` are included as the display-mapping portion of Level C.
- A presentation gain of 0.16 and Gaia overlay alpha of 0.12 keep the atmosphere visible under Gaia and leave more contrast for stars; tune these after visual review.
- Desktop sample comparisons, longitude-seam and horizon inspection, and Quest measurements have not been performed. The 128×64 resolution and 15/60-second update intervals are provisional.

## Out of scope

- Terrain or skyline masking; the horizon is geometric.
- Regional/seasonal aerosol datasets, live weather, cloud imagery, precipitation,
  or external runtime requests.
- New public date/time controls.
- Solar or lunar image textures, spectral wavelength integration, and a new
  high-order multiple-scattering model.
- A claim of desktop/VR pixel identity or a Quest performance budget before
  measurements exist.
