# zstarview-vr Design

## 1. Overview

`zstarview-vr` is a Vite-based browser application built primarily with Three.js and `astronomy-engine`.

Its architecture is intentionally simple:

- one browser entry point
- one large orchestration module for runtime behavior
- a small set of extracted feature modules
- build-time scripts that convert raw astronomy and city data into runtime-friendly assets

The current design is optimized for a prototype that must run both on desktop and in WebXR VR, while keeping deployment simple enough for static hosting.

## 2. Technology Choices

- `Vite`
  - development server and production bundling
- `three`
  - scene graph, rendering, WebXR integration, textures, geometry, materials
- `astronomy-engine`
  - astronomical coordinate and solar-system calculations
- plain JavaScript ES modules
  - no framework layer, no state management library

This keeps the runtime dependency surface small and makes the app easy to host as static assets.

## 3. Top-Level Structure

### 3.1 Entry and UI Shell

- [index.html](/home/toshihiro/playground/zstarview-vr/index.html)
  - defines the canvas, HUD container, status region, and VR button
  - loads the application through `src/main.js`

### 3.2 Main Runtime Module

- [src/main.js](/home/toshihiro/playground/zstarview-vr/src/main.js)
  - owns scene creation, global state, asset loading, URL parameter parsing, astronomical updates, input handling, and the render loop

This file is the orchestration center of the application.

### 3.3 Extracted Feature Modules

- [src/menu/vr-menu.js](/home/toshihiro/playground/zstarview-vr/src/menu/vr-menu.js)
  - menu state, panel rendering, hover and selection logic, controller input integration
- [src/menu/star-preview.js](/home/toshihiro/playground/zstarview-vr/src/menu/star-preview.js)
  - guidance arc and target marker for the currently previewed or selected star
- [src/asterisms/catalog.js](/home/toshihiro/playground/zstarview-vr/src/asterisms/catalog.js)
  - static asterism definitions
- [src/asterisms/runtime.js](/home/toshihiro/playground/zstarview-vr/src/asterisms/runtime.js)
  - resolves source IDs into runtime star objects and produces runtime asterism objects
- [src/asterisms/render.js](/home/toshihiro/playground/zstarview-vr/src/asterisms/render.js)
  - ambient and highlighted line rendering plus label anchor updates

### 3.4 Generated and Static Data

- [src/generated/famous-stars-data.js](/home/toshihiro/playground/zstarview-vr/src/generated/famous-stars-data.js)
  - generated named-star and asterism-support data
- `public/data/*.bin`
  - star field binary assets
- `public/data/cities-index-v2.json`
  - city lookup index
- `public/data/cities-index-v2.json.gz`
  - gzip variant of the city index
- `public/data/dso.csv`
  - deep-sky object source catalog loaded directly at runtime

## 4. Build-Time Data Pipeline

The application relies on preprocessing scripts so runtime loading stays simple and cheap.

### 4.1 Star Data Generation

- [scripts/generate-stars-data.mjs](/home/toshihiro/playground/zstarview-vr/scripts/generate-stars-data.mjs)

Input:

- `data/stars.csv`

Outputs:

- `public/data/stars-data-base.bin`
- `public/data/stars-data-extra-7.bin`
- `public/data/stars-data-extra-8.bin`
- `public/data/stars-data-extra-9.bin`
- `public/data/stars-data-extra-10.bin`

Responsibilities:

- parse RA, declination, magnitude, and color data
- transform equatorial coordinates into Cartesian vectors
- derive sprite color and brightness from star properties
- partition stars into magnitude tiers and render layers
- pack layer metadata and float payloads into a compact binary format

### 4.2 City Index Generation

- [scripts/generate-cities-data.mjs](/home/toshihiro/playground/zstarview-vr/scripts/generate-cities-data.mjs)
- `scripts/generate-cities-gzip.mjs`

Input:

- `data/cities1000.txt`

Outputs:

- `public/data/cities-index-v2.json`
- `public/data/cities-index-v2.json.gz`

Responsibilities:

- filter usable place records
- retain capitals and sufficiently populated places
- normalize city lookup payload into a compact JSON structure
- provide a compressed delivery option for faster browser loading

### 4.3 Famous Star Data Generation

- [scripts/generate-famous-stars-data.mjs](/home/toshihiro/playground/zstarview-vr/scripts/generate-famous-stars-data.mjs)

Input:

- `data/stars.csv`

Output:

- [src/generated/famous-stars-data.js](/home/toshihiro/playground/zstarview-vr/src/generated/famous-stars-data.js)

Responsibilities:

- extract rows with non-empty star names
- preserve source IDs needed for runtime selection and highlighting
- collect required stars for asterism resolution

### 4.4 Build Hooks

`package.json` uses `predev` and `prebuild` hooks to regenerate derived assets before starting Vite or building production output.

This design ensures that a clean checkout can be built without a separate manual data-preparation step.

## 5. Runtime Architecture

### 5.1 Initialization Sequence

The runtime entry point is `bootstrap()` in `src/main.js`.

High-level flow:

1. load the base star binary
2. load the DSO catalog
3. resolve the observing location
4. initialize astronomical observer state
5. prepare VR capability and button behavior
6. enter the steady-state animation loop

This ordering makes startup deterministic and ensures the HUD can report a meaningful failure state when a mandatory asset cannot be loaded.

### 5.2 Scene Organization

The Three.js scene is composed from a few conceptual groups.

- sky sphere
  - background dome centered on the viewer
- star meshes
  - one mesh per generated star layer
- solar-system group
  - planets, Sun, Moon, labels, asterism lines, preview arc, target markers
- DSO group
  - deep-sky markers and labels
- horizon group
  - horizon ring, ticks, and related reference markers

In both desktop and XR rendering, the sky and celestial groups are repositioned around the current camera so the user remains visually centered inside the celestial sphere.

### 5.3 State Model

The application mostly uses module-level mutable state in `src/main.js`.

Examples:

- current observer and active location
- currently loaded star magnitude tier
- XR session and controller references
- selected star and hovered asterism star
- visibility flags for DSO and asterisms
- lazy-load promises for binary assets

This is simple and direct, but it also means state ownership is centralized rather than encapsulated in domain-specific controllers.

### 5.4 Data Loading Strategy

### Base and Extended Star Assets

- Base star data is required for startup.
- Extended tiers are loaded lazily only when requested by `maxMag`.
- Each tier is loaded once and tracked through dedicated promise variables and flags.

### City Index

- The application first attempts to fetch the gzip-compressed JSON asset.
- If gzip transport or decompression fails, it falls back to the plain JSON asset.
- Lookup occurs only when the URL requests a city-based location.

### DSO Catalog

- Loaded from CSV at runtime.
- Parsed into runtime objects used for markers, hover outlines, and labels.

### 5.5 Coordinate and Astronomy Pipeline

The runtime uses multiple coordinate transformations.

- `astronomy-engine` computes horizon coordinates and solar-system state from the current observer and time
- utility functions convert:
  - RA/Dec to altitude and azimuth
  - altitude and azimuth to Three.js world vectors
  - world vectors to screen-space positions for label layout

This separation is important because astronomical calculations operate in sky coordinate systems, while rendering and label placement operate in scene or screen space.

### 5.6 Input Model

### Desktop Input

- `M` toggles the VR-style menu
- arrow keys navigate menu items when the menu is open
- `Enter` activates the current menu item
- in fisheye desktop mode, arrow keys also adjust camera yaw and pitch when the menu is not consuming the interaction

### VR Input

- controller menu button toggles the menu
- trigger confirms the hovered or selected menu entry
- controller pointing is used for menu hover detection
- thumbstick vertical axis moves menu selection

The menu module owns most menu interaction logic, but `main.js` remains responsible for calling it at the correct time in the render loop.

### 5.7 Render Loop Responsibilities

The animation loop in `src/main.js` performs incremental updates.

Core responsibilities:

- refresh solar-system marker positions on a fixed interval
- keep celestial groups centered around the active viewer
- process VR menu button input and menu panel transform updates
- update pointer hover circles
- update hover labels for DSO, famous stars, and asterisms
- refresh label layout
- refresh the selected-star guidance arc when needed
- update or dismiss the VR splash
- render normally or through the fisheye path depending on mode

The loop uses `safeCall()` wrappers around many operations to isolate runtime errors and report them to the HUD instead of crashing the entire frame.

## 6. Feature Module Design

### 6.1 VR Menu

`createVrMenu()` in [src/menu/vr-menu.js](/home/toshihiro/playground/zstarview-vr/src/menu/vr-menu.js) builds a self-contained controller for menu UI behavior.

Notable design choices:

- menu UI is rendered into a canvas texture rather than HTML in XR
- the panel is a world-space plane in Three.js
- page content is declarative enough to rebuild on state changes
- controller-specific opening determines left or right side offset
- desktop mode reuses the same logical menu structure

The module exposes a narrow API back to `main.js`, including methods for toggling visibility, processing controller input, updating transform, updating hover state, and retrieving preview state.

### 6.2 Star Preview

`createStarPreviewRenderer()` in [src/menu/star-preview.js](/home/toshihiro/playground/zstarview-vr/src/menu/star-preview.js) isolates the selected-star guidance visuals.

Responsibilities:

- maintain the current target star
- draw a circular highlight around the target
- draw a great-circle-like arc from the current forward direction toward the target
- refresh only the arc when the viewer direction changes
- cleanly dispose geometry and materials when the preview changes

This extraction reduced rendering clutter in `main.js` without changing the core interaction model.

### 6.3 Asterism Runtime and Rendering

The asterism feature is split into definition, resolution, and rendering stages.

- catalog
  - static edge definitions using source IDs
- runtime resolution
  - converts source IDs into references to runtime star objects
- renderer
  - builds ambient and highlighted line groups on demand and controls highlight rotation

This design keeps authored asterism definitions independent from scene-object creation.

## 7. Error Handling and Fallbacks

The application uses pragmatic fallback behavior rather than strict failure.

- location lookup failure falls back to Tokyo
- gzip city index failure falls back to plain JSON
- unsupported WebXR disables the VR button and updates status text
- non-fatal frame update errors are surfaced through runtime warnings rather than terminating rendering

This is appropriate for a user-facing exploratory viewer where partial functionality is preferable to a hard stop.

## 8. Design Tradeoffs

### 8.1 Strengths

- low dependency count
- static-host friendly deployment model
- clear separation between generated assets and runtime logic
- extracted modules for the most interaction-heavy subsystems
- straightforward debugging because most state is visible in one place

### 8.2 Current Limitations

- `src/main.js` still carries many responsibilities and is the main complexity hotspot
- state is mostly global within the module rather than encapsulated
- there is no formal domain model for stars, DSO, labels, and interactions
- testing infrastructure is not currently part of the repository workflow
- some features still depend on timing-based coordination inside the render loop

## 9. Suggested Future Refactoring Directions

If the project continues to grow, the next reasonable decompositions would be:

- separate asset loading and caching into a loader module
- isolate label layout into its own subsystem
- isolate solar-system body updates into a dedicated controller
- separate desktop camera behavior from XR session behavior
- introduce a small application-state layer instead of further expanding module-global variables

These changes are not required for the current prototype, but they would reduce the maintenance pressure concentrated in `src/main.js`.

## 10. Center Label Ring Panel Design

The center label ring panel is now part of the VR label architecture.

### 10.1 Design Goal

The runtime still uses world-space `THREE.Sprite` labels for existing scene labels, but VR now adds a second label presentation path for center-adjacent objects.

The goal is to keep the immediate target area readable without forcing all labels to remain attached to the sky at all times.

### 10.2 Implemented Architecture

The runtime now uses a two-layer label model in VR:

- world label layer
  - existing scene-anchored labels
- center ring panel layer
  - a separate HUD-oriented ring panel for center-adjacent labels

This is implemented inside `src/main.js` rather than in a separate module, but the responsibilities are already split into candidate collection, center classification, and panel rendering helpers.

### 10.3 Scope Boundaries

Current VR ring-panel coverage:

- Sun
- Moon
- planets
- famous or named stars that already have runtime label sprites

Still excluded:

- asterism labels
- asterism highlight rendering
- DSO label routing
- selected-star guidance arc logic
- desktop mono and fisheye panel rendering

### 10.4 Candidate Data Model

`collectLabelLayoutCandidates()` now builds a shared candidate list before final placement.

The current candidate data includes fields such as:

- `kind`
- `sprite`
- `hudSprite`
- `baseVisible`
- `priority`
- `targetWorldPosition`
- `targetWorldDirection`
- `isSelected`
- `isHighlighted`
- runtime-computed center classification state

This candidate layer is what made it possible to add VR center-panel routing without rewriting each feature's astronomy or hover logic.

### 10.5 Center Classification

Center classification is based on angular distance from a reference direction.

Current behavior:

- ordinary VR viewing uses the headset forward direction
- while a controller trigger is held, the active controller ray direction becomes the reference direction
- hysteresis thresholds are applied for entering and leaving the center zone

This avoids the earlier flicker that would happen if panel eligibility were tied directly to momentary label visibility.

### 10.6 VR Panel Representation

The implemented panel is a lightweight Three.js HUD group:

- a transparent ring mesh
- lightweight inner and outer outlines
- dedicated HUD label sprites
- target rings rendered back on the sky for affected objects

The panel is positioned in front of the viewer at a configurable distance and scaled so that apparent size remains roughly stable when the distance is adjusted.

When a controller trigger is held, the panel position shifts from head-forward to controller-forward so the panel follows the pointer target area.

### 10.7 Label Placement Strategy

The current placement algorithm is intentionally simpler than the original draft.

Implemented behavior:

1. collect eligible candidates
2. classify center candidates from angular distance
3. route eligible VR candidates to the panel
4. if exactly one panel label is active, place it at the top of the ring
5. if multiple labels are active, compute a local centroid in panel space
6. place labels by angle relative to that centroid
7. enforce a minimum angular separation

This design reduces unnecessary label motion compared with direct view-angle tracking.

### 10.8 Solar-System Marker Changes

The solar-system presentation was also adjusted together with the ring panel:

- Sun and Moon now use crosshair-style gauge markers
- planets use their existing marker plus a crosshair-style gauge marker
- Sun, Moon, and planet labels are no longer treated as always-on world labels
- those labels are shown through the center ring panel when relevant

This matches the broader intent of making the central sky view cleaner while preserving a strong target marker.

### 10.9 Current Limitations

- The panel system still lives in `src/main.js` rather than an extracted label-layout module.
- There is no guide-line rendering from panel labels to sky targets.
- The panel currently uses simple sprite-based HUD labels rather than a more formal text layout system.
- No desktop implementation exists yet.
- Priority-based hiding is still minimal; the current approach mainly relies on scope restriction and angular separation.

### 10.10 Tradeoffs

- Mixing world-space labels with HUD-space labels increases state-management complexity.
- Pointer-driven center targeting improves intentional selection but adds another source of label-state transitions.
- Very transparent panel styling keeps the panel unobtrusive, but also means the panel shape is intentionally subtle.
- Keeping asterisms and DSO out of the panel reduced integration risk and kept the current implementation tractable.
