# zstarview-vr Specification

## 1. Purpose

`zstarview-vr` is a browser-based sky viewer that renders stars and related celestial overlays for both:

- immersive WebXR VR sessions
- desktop browser sessions

The application is intended to let a user inspect the night sky from a specified observing location, preview notable stars, and view supporting overlays such as asterisms and deep-sky objects.

## 2. Supported Modes

The application provides two presentation modes.

### 2.1 VR Mode

- Entered through the `Enter VR` button when the browser and device support `immersive-vr`.
- Intended for headsets such as Meta Quest class devices.
- The user looks around naturally by moving their head.
- A world-anchored menu can be opened from a controller menu button.

### 2.2 Desktop Mode

- Available in any supported desktop browser even without WebXR support.
- Default view mode is a normal monoscopic view.
- An optional fisheye 180-degree mode is available with a URL parameter.
- The VR menu can be previewed on desktop for development and functional parity testing.

## 3. User Goals

The application supports the following primary user tasks.

- Observe the sky from a specified location.
- Inspect stars, the Sun, the Moon, and major planets.
- View deep-sky object markers and labels.
- View named asterism overlays.
- Select a named star from a menu and receive directional guidance toward it.

## 4. Startup Behavior

On startup, the application:

1. loads the base star dataset
2. loads the deep-sky object catalog
3. resolves the observing location from URL parameters or defaults
4. initializes the display and status text
5. enables VR entry if the environment supports WebXR immersive VR

If any mandatory base asset fails to load, the application reports the failure in the status area and does not complete initialization normally.

## 5. Observing Location

The observing location is determined in the following priority order.

1. `lat` and `lon`
2. `city` with optional `country`
3. default location (`Tokyo`)

### 5.1 URL Parameters for Location

- `lat`
  - Latitude in decimal degrees.
- `lon`
  - Longitude in decimal degrees.
- `city`
  - City name used for lookup in the generated city index.
- `country`
  - Optional ISO 3166-1 alpha-2 country code used to narrow city lookup.

### 5.2 Fallback Rules

- If `lat` and `lon` are valid, they take precedence over all other location parameters.
- If `city` is provided and lookup succeeds, the matched city is used.
- If `city` lookup fails or the city index cannot be loaded, the application falls back to the default location and reports the fallback reason in status text and splash text.

## 6. View and Data Parameters

### 6.1 URL Parameters

- `view`
  - `mono` or omitted: normal desktop view
  - `fisheye180`: circular fisheye desktop view
- `maxMag`
  - Controls how faint the loaded stars may be
  - supported effective values are clamped to the available dataset tiers up to `10`

### 6.2 Magnitude Tiers

The base application loads stars up to visual magnitude 6.0.

Additional tiers may be loaded up to:

- 7.0
- 8.0
- 9.0
- 10.0

Desktop mode may load extended tiers after startup when requested.

In VR mode, if an extended tier is requested and not yet loaded, the application shows a temporary splash and defers loading until after VR entry.

## 7. Rendered Content

The application renders the following content categories.

### 7.1 Stars

- Base and extended star datasets rendered as layered point clouds.
- Brighter and fainter stars differ in sprite scale and opacity.
- Famous named stars are available for menu-based selection and hover interactions.

### 7.2 Solar System Bodies

- Sun
- Moon
- Mercury
- Venus
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune

These bodies are rendered with dynamic positions derived from astronomical calculations.

### 7.3 Deep-Sky Objects

- Loaded from a CSV catalog at runtime.
- Displayed as markers and labels when the DSO display option is enabled.

### 7.4 Asterisms

- Always available as an ambient line overlay when enabled.
- When the user points at a relevant famous star, the matching asterism is highlighted.
- If multiple asterisms share the same star, the highlighted overlay rotates among them over time.

### 7.5 Reference Markers and Lines

- horizon ring and tick marks
- cardinal directions
- zenith and nadir markers
- ecliptic line
- celestial equator line

## 8. VR Interaction

### 8.1 Entering and Exiting VR

- The `Enter VR` button starts an `immersive-vr` session when supported.
- While VR is active, the button changes to `Exit VR`.
- Exiting VR restores desktop mode state and closes the VR menu.

### 8.2 VR Splash

When entering VR, the application shows a short splash in front of the user that includes location information.

If extended star data still needs to be loaded for the requested `maxMag`, a loading splash may remain visible until loading completes.

### 8.3 VR Menu

The VR menu is opened and closed with the controller menu button.

Menu characteristics:

- world-anchored panel
- positioned in front of the user
- offset slightly left or right depending on which controller opened it
- pointer-based hover
- trigger-based activation

Current menu pages:

- `Jump to Star`
- `Display Options`
- `About`

### 8.4 Jump to Star

The `Jump to Star` page lets the user select from a list of named stars.

Behavior:

- Before confirmation, the preview follows the currently hovered star.
- After confirmation, the selected star remains active until the menu closes.
- The application draws a target marker around the target star.
- The application draws a great-circle arc from the current forward direction toward the target when the angular separation is large enough.
- The application does not rotate the sky automatically; guidance is purely visual.

### 8.5 Display Options

The `Display Options` page currently supports:

- `Asterisms`
- `DSO`

When a layer is disabled, its related hover labels and highlight overlays are also suppressed.

## 9. Desktop Interaction

### 9.1 Menu Access

- Press `M` to open or close the menu.
- While the menu is open:
  - `ArrowUp` moves selection upward
  - `ArrowDown` moves selection downward
  - `Enter` activates the selected item

### 9.2 Desktop Fisheye Controls

When `view=fisheye180` is active and VR is not active:

- `ArrowLeft` rotates yaw left
- `ArrowRight` rotates yaw right
- `ArrowUp` pitches upward
- `ArrowDown` pitches downward

Pitch is limited to prevent flipping.

## 10. Status and Feedback

The application provides a HUD with:

- application title
- brief mode and usage hints
- an `Enter VR` / `Exit VR` action button
- status text

Status text is used for:

- current mode
- active location
- fallback reasons
- star and DSO counts
- current loaded magnitude tier
- runtime errors such as unsupported VR or failed asset loading

## 11. Asset and Browser Requirements

### 11.1 Runtime Requirements

- a modern browser with ES module support
- WebGL support
- WebXR support for immersive VR use

### 11.2 Optional Browser Features

The city index is requested first as a gzip-compressed JSON asset and decompressed in the browser via `DecompressionStream('gzip')`.

If that feature is unavailable or the gzip asset cannot be used, the application falls back to the uncompressed JSON asset.

## 12. Non-Goals and Current Constraints

- The application is not a full planetarium with arbitrary time controls.
- The application currently has a fixed "current time" style rendering model rather than an exposed user time-setting workflow.
- The menu star list is intentionally limited to a subset of visible named stars prepared by the generated data.
- The application currently favors immediate interactive rendering over extensive user customization.

## 13. Center Label Ring Panel

The VR runtime includes a center label ring panel for reducing label clutter near the current target area.

### 13.1 Purpose

When important labeled objects gather near the center of the current VR view, in-scene labels can overlap and become difficult to read.

The center label ring panel preserves the exact center region by moving selected labels onto a transparent donut-shaped HUD panel.

### 13.2 User-Facing Behavior

- When eligible celestial objects enter the center target zone, the application shows a transparent donut-shaped panel in front of the user.
- The central hole remains clear so that the user can inspect the target area itself.
- Eligible objects inside the center target zone use ring-panel labels instead of ordinary in-scene labels.
- If no eligible object is inside the center target zone, the panel is hidden.
- While the user is holding a VR trigger, the center target zone and the panel position follow the controller pointing direction instead of the head-forward direction.

### 13.3 Current Scope

The current implementation covers:

- Sun
- Moon
- planets
- named stars that already have runtime labels

The current implementation does not change:

- asterism labels or asterism highlight behavior
- deep-sky object label behavior
- selected-star guidance arc behavior
- desktop mono label behavior
- desktop fisheye label behavior

### 13.4 Placement Rules

- Eligibility is determined by angular distance from the active center reference direction.
- In ordinary VR viewing, the center reference direction is the user's forward view direction.
- While a controller trigger is held, the center reference direction becomes that controller's pointing direction.
- If exactly one label is placed on the panel, it is shown at the top of the ring to avoid unnecessary motion.
- If multiple labels are placed on the panel, their placement is based on their directions relative to the local centroid of the candidate group.
- A minimum angular separation is enforced so labels do not collapse into each other on the ring.

### 13.5 Solar-System Marker Behavior

- Sun and Moon are marked with crosshair-style gauge markers.
- Planets are drawn with their existing marker plus an additional crosshair-style gauge marker.
- Sun, Moon, and planet labels are no longer shown as always-on in-scene labels.
- Those labels appear on the center ring panel when the corresponding object enters the center target zone.

### 13.6 Named Star Behavior

- Named stars can appear on the center ring panel when they enter the center target zone in VR.
- Pointing at a named star no longer forces its normal label to appear by itself.
- Existing selection and highlight behavior used by other VR features remains available.

### 13.7 Visual Behavior

- The panel is intentionally very transparent and visually lightweight.
- The panel itself is head-facing, but its position can move from head-forward to controller-forward while a trigger is held.
- The panel is scaled to preserve a roughly stable apparent size even when its distance from the viewer is adjusted.
- The target zone is visually supported by additional rings around the corresponding target objects in the sky.

### 13.8 Non-Goals and Current Constraints

- No redesign of the asterism system
- No DSO migration into the center ring panel
- No desktop implementation of the ring panel at this time
- No guide-line rendering from ring labels back to the sky objects at this time
- No user-exposed configuration UI for the ring geometry or thresholds at this time
