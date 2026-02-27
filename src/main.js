import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { STAR_LAYERS, STAR_META } from './generated/stars-data.js';

const DEFAULT_LOCATION = {
  name: 'Tokyo',
  lat: 35.681236,
  lon: 139.767125,
};

const EYE_HEIGHT_M = 1.7;
const SKY_RADIUS = 450;
const SYMBOL_RADIUS = SKY_RADIUS - 8;
const AU_KM = 149597870.7;
const EARTH_OBLIQUITY_DEG = 23.439291;
const CITY_INDEX_URL = `${import.meta.env.BASE_URL}data/cities-index.json`;

const canvas = document.getElementById('scene');
const statusEl = document.getElementById('status');
const enterVrButton = document.getElementById('enter-vr');
let locationSummaryText = '';

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030711);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, EYE_HEIGHT_M, 0);

const hemiLight = new THREE.HemisphereLight(0x6f8ec9, 0x172133, 0.4);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xd8e6ff, 0.26);
dirLight.position.set(-2, 5, 2);
scene.add(dirLight);

function createStarfieldFromLayer(layer, radius) {
  const srcPos = layer.positions;
  const srcCol = layer.colors;
  const positions = new Float32Array(srcPos.length);
  const colors = new Float32Array(srcCol.length);

  for (let i = 0; i < srcPos.length; i += 3) {
    positions[i] = srcPos[i] * radius;
    positions[i + 1] = srcPos[i + 1] * radius;
    positions[i + 2] = srcPos[i + 2] * radius;
  }
  for (let i = 0; i < srcCol.length; i += 1) {
    colors[i] = srcCol[i];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: layer.size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: layer.opacity,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createTextSprite(label, fillStyle = 'rgba(255,255,255,0.96)', strokeStyle = 'rgba(0,0,0,0.86)') {
  const cnv = document.createElement('canvas');
  cnv.width = 512;
  cnv.height = 192;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.font = 'bold 98px "Noto Sans", "Noto Sans JP", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;
  ctx.strokeText(label, cnv.width / 2, cnv.height / 2 + 1);
  ctx.fillText(label, cnv.width / 2, cnv.height / 2 + 1);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
}

function createCrossMarkerSprite(strokeStyle = 'rgba(235, 240, 255, 0.98)') {
  const cnv = document.createElement('canvas');
  cnv.width = 192;
  cnv.height = 192;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(48, 48);
  ctx.lineTo(144, 144);
  ctx.moveTo(144, 48);
  ctx.lineTo(48, 144);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

function createCircleOutlineSprite(strokeStyle) {
  const cnv = document.createElement('canvas');
  cnv.width = 256;
  cnv.height = 256;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.beginPath();
  ctx.arc(cnv.width / 2, cnv.height / 2, 90, 0, Math.PI * 2);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 10;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

function createVrSplashSprite(text) {
  const cnv = document.createElement('canvas');
  cnv.width = 1024;
  cnv.height = 256;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);

  ctx.fillStyle = 'rgba(8, 15, 30, 0.88)';
  ctx.strokeStyle = 'rgba(150, 189, 240, 0.55)';
  ctx.lineWidth = 3;
  const r = 26;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(cnv.width - r, 0);
  ctx.quadraticCurveTo(cnv.width, 0, cnv.width, r);
  ctx.lineTo(cnv.width, cnv.height - r);
  ctx.quadraticCurveTo(cnv.width, cnv.height, cnv.width - r, cnv.height);
  ctx.lineTo(r, cnv.height);
  ctx.quadraticCurveTo(0, cnv.height, 0, cnv.height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 72px "Noto Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(234, 242, 255, 0.98)';
  ctx.strokeStyle = 'rgba(2, 10, 22, 0.9)';
  ctx.lineWidth = 10;
  ctx.strokeText(text, cnv.width / 2, cnv.height / 2);
  ctx.fillText(text, cnv.width / 2, cnv.height / 2);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.6, 0.4, 1.0);
  return sprite;
}

function altAzToVector(altDeg, azDeg, radius) {
  const alt = THREE.MathUtils.degToRad(altDeg);
  const az = THREE.MathUtils.degToRad(azDeg);
  const cosAlt = Math.cos(alt);
  return new THREE.Vector3(
    radius * cosAlt * Math.sin(az),
    radius * Math.sin(alt),
    -radius * cosAlt * Math.cos(az)
  );
}

function angularDiameterDeg(diameterKm, distAu) {
  const distKm = distAu * AU_KM;
  const rad = 2.0 * Math.atan((diameterKm * 0.5) / Math.max(1e-9, distKm));
  return THREE.MathUtils.radToDeg(rad);
}

function spriteScaleFromAngularDiameter(angularDeg, radius) {
  const theta = THREE.MathUtils.degToRad(angularDeg);
  const diameter = 2.0 * radius * Math.tan(theta * 0.5);
  return Math.max(2.4, diameter * 1.8);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function skyDiscColorFromSunAltitude(sunAltDeg) {
  // Very light tint only: dark blue at night -> soft sky blue at daytime.
  const t = THREE.MathUtils.clamp((sunAltDeg + 8.0) / 40.0, 0.0, 1.0);
  return new THREE.Color(
    lerp(0.03, 0.36, t),
    lerp(0.06, 0.62, t),
    lerp(0.16, 0.97, t)
  );
}

let cityIndexPromise = null;

function normalizeCityName(value) {
  return (value || '').trim().toLowerCase();
}

function parseLatLonFromUrl(searchParams) {
  const latText = searchParams.get('lat');
  const lonText = searchParams.get('lon');
  if (latText == null || lonText == null) return null;
  const lat = Number.parseFloat(latText);
  const lon = Number.parseFloat(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { name: `${lat.toFixed(4)},${lon.toFixed(4)}`, lat, lon };
}

async function loadCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch(CITY_INDEX_URL, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load city index: HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => (Array.isArray(json.entries) ? json.entries : []));
  }
  return cityIndexPromise;
}

function pickCity(cities, cityName) {
  const q = normalizeCityName(cityName);
  if (!q) return null;

  let best = null;
  let bestScore = -1;

  for (const row of cities) {
    const [name, ascii, lat, lon, country, admin1, pop] = row;
    const n = normalizeCityName(name);
    const a = normalizeCityName(ascii);
    let score = -1;
    if (n === q || a === q) score = 100;
    else if (n.startsWith(q) || a.startsWith(q)) score = 70;
    else if (n.includes(q) || a.includes(q)) score = 40;
    if (score < 0) continue;
    score += Math.min(30, Math.log10(Math.max(1, Number(pop) || 1)) * 4);
    if (score > bestScore) {
      bestScore = score;
      best = { name: String(name), lat: Number(lat), lon: Number(lon), country: String(country), admin1: String(admin1) };
    }
  }
  return best;
}

async function resolveLocationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromLatLon = parseLatLonFromUrl(params);
  if (fromLatLon) return { ...fromLatLon, source: 'latlon' };

  const city = params.get('city');
  if (city && city.trim()) {
    try {
      const cities = await loadCityIndex();
      const found = pickCity(cities, city);
      if (found) return { ...found, source: 'city' };
      return { ...DEFAULT_LOCATION, source: 'fallback_city_not_found', requestedCity: city };
    } catch (_e) {
      return { ...DEFAULT_LOCATION, source: 'fallback_city_index_error', requestedCity: city };
    }
  }

  return { ...DEFAULT_LOCATION, source: 'default' };
}

function raDecToAltAz(raHours, decDeg, when, observerRef) {
  const hor = Astronomy.Horizon(when, observerRef, raHours, decDeg, 'normal');
  return { alt: hor.altitude, az: hor.azimuth };
}

function eclipticLonToRaDec(lonDeg) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const eps = THREE.MathUtils.degToRad(EARTH_OBLIQUITY_DEG);
  const x = Math.cos(lon);
  const y = Math.sin(lon) * Math.cos(eps);
  const z = Math.sin(lon) * Math.sin(eps);
  const raRad = Math.atan2(y, x);
  const raHours = (((THREE.MathUtils.radToDeg(raRad) / 15.0) % 24) + 24) % 24;
  const decDeg = THREE.MathUtils.radToDeg(Math.asin(z));
  return { raHours, decDeg };
}

function buildLineOnSky(pointCount, pointBuilder, radius, material, closeLoop = true) {
  const points = [];
  for (let i = 0; i < pointCount; i += 1) {
    const t = i / pointCount;
    const { alt, az } = pointBuilder(t);
    points.push(altAzToVector(alt, az, radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = closeLoop
    ? new THREE.LineLoop(geometry, material)
    : new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(SKY_RADIUS, 96, 64),
  new THREE.MeshBasicMaterial({ color: 0x060b16, side: THREE.BackSide, depthWrite: false })
);
sky.position.set(0, EYE_HEIGHT_M, 0);
scene.add(sky);

const starMeshes = STAR_LAYERS.map((layer, index) => {
  const radius = SKY_RADIUS - 4 - index;
  const mesh = createStarfieldFromLayer(layer, radius);
  scene.add(mesh);
  return mesh;
});

const horizonRadius = 90;
const horizonPoints = [];
for (let i = 0; i < 256; i += 1) {
  const a = (i / 256) * Math.PI * 2;
  horizonPoints.push(
    new THREE.Vector3(
      Math.cos(a) * horizonRadius,
      0,
      Math.sin(a) * horizonRadius
    )
  );
}
const horizonGeometry = new THREE.BufferGeometry().setFromPoints(horizonPoints);
const horizonRing = new THREE.LineLoop(
  horizonGeometry,
  new THREE.LineBasicMaterial({
    color: 0x257435,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
  })
);
scene.add(horizonRing);

const horizonTickGeometry = new THREE.BufferGeometry();
const horizonTicks = new THREE.LineSegments(
  horizonTickGeometry,
  new THREE.LineBasicMaterial({
    color: 0x40a25a,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
  })
);
scene.add(horizonTicks);

function updateHorizonTicksByAngularSize(targetAngularDeg) {
  // Keep marker length so the apparent size from eye height is targetAngularDeg.
  const eyeToTickDist = Math.sqrt(horizonRadius * horizonRadius + EYE_HEIGHT_M * EYE_HEIGHT_M);
  const theta = THREE.MathUtils.degToRad(Math.max(0.05, targetAngularDeg));
  const tickLen = 2.0 * eyeToTickDist * Math.tan(theta * 0.5);
  const half = tickLen * 0.5;

  const points = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    points.push(
      new THREE.Vector3(c * horizonRadius, -half, s * horizonRadius),
      new THREE.Vector3(c * horizonRadius, +half, s * horizonRadius)
    );
  }
  horizonTickGeometry.setFromPoints(points);
}

const groundDisc = new THREE.Mesh(
  new THREE.CircleGeometry(70, 96),
  new THREE.MeshBasicMaterial({
    color: 0x22354a,
    transparent: true,
    opacity: 0.33,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
groundDisc.rotation.x = -Math.PI / 2;
scene.add(groundDisc);

let activeLocation = { ...DEFAULT_LOCATION, source: 'default' };
let observer = new Astronomy.Observer(activeLocation.lat, activeLocation.lon, 0);
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

const sunSprite = createCircleOutlineSprite('rgba(255, 214, 120, 0.98)');
const moonSprite = createCircleOutlineSprite('rgba(206, 220, 255, 0.98)');
solarSystemGroup.add(sunSprite);
solarSystemGroup.add(moonSprite);

const cardinalDefs = [
  { label: 'N', az: 0.0 },
  { label: 'NE', az: 45.0 },
  { label: 'E', az: 90.0 },
  { label: 'SE', az: 135.0 },
  { label: 'S', az: 180.0 },
  { label: 'SW', az: 225.0 },
  { label: 'W', az: 270.0 },
  { label: 'NW', az: 315.0 },
];
for (const d of cardinalDefs) {
  const label = createTextSprite(d.label, 'rgba(156, 230, 182, 0.98)');
  label.scale.set(36.0, 13.5, 1.0);
  label.position.copy(altAzToVector(0.0, d.az, SYMBOL_RADIUS));
  solarSystemGroup.add(label);
}

const planetDefs = [
  { body: 'Mercury', label: 'Mercury', color: 'rgba(232,232,232,0.98)' },
  { body: 'Venus', label: 'Venus', color: 'rgba(255,228,166,0.98)' },
  { body: 'Mars', label: 'Mars', color: 'rgba(255,159,131,0.98)' },
  { body: 'Jupiter', label: 'Jupiter', color: 'rgba(255,233,189,0.98)' },
  { body: 'Saturn', label: 'Saturn', color: 'rgba(255,233,161,0.98)' },
];
const planetObjects = planetDefs.map((def) => {
  const marker = createCrossMarkerSprite(def.color);
  marker.scale.set(3.0, 3.0, 1.0);
  const label = createTextSprite(def.label, def.color);
  // User requested 5x larger celestial labels.
  label.scale.set(36.0, 13.5, 1.0);
  solarSystemGroup.add(marker);
  solarSystemGroup.add(label);
  return { ...def, marker, label };
});

const zenithMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
zenithMarker.scale.set(4.2, 4.2, 1.0);
zenithMarker.position.set(0, SYMBOL_RADIUS, 0);
solarSystemGroup.add(zenithMarker);

const nadirMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
nadirMarker.scale.set(4.2, 4.2, 1.0);
nadirMarker.position.set(0, -SYMBOL_RADIUS, 0);
solarSystemGroup.add(nadirMarker);

const skyColorDisc = new THREE.Mesh(
  new THREE.CircleGeometry(260, 96),
  new THREE.MeshBasicMaterial({
    color: 0x7fb8ff,
    transparent: true,
    opacity: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
skyColorDisc.rotation.x = -Math.PI / 2;
skyColorDisc.position.set(0, SYMBOL_RADIUS - 1.5, 0);
solarSystemGroup.add(skyColorDisc);

const eclipticLine = buildLineOnSky(
  360,
  (t) => {
    const lon = t * 360.0;
    const { raHours, decDeg } = eclipticLonToRaDec(lon);
    return raDecToAltAz(raHours, decDeg, new Date(), observer);
  },
  SYMBOL_RADIUS - 1,
  new THREE.LineDashedMaterial({
    color: 0x806925,
    dashSize: 3.8,
    gapSize: 2.6,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  })
);
solarSystemGroup.add(eclipticLine);

const celestialEquatorLine = buildLineOnSky(
  240,
  (t) => {
    const ra = t * 24.0;
    return raDecToAltAz(ra, 0.0, new Date(), observer);
  },
  SYMBOL_RADIUS - 1,
  new THREE.LineDashedMaterial({
    color: 0x4b5056,
    dashSize: 6.6,
    gapSize: 6.8,
    transparent: true,
    opacity: 0.78,
    depthTest: false,
  })
);
solarSystemGroup.add(celestialEquatorLine);

function rebuildReferenceLines() {
  const now = new Date();
  const eclPts = [];
  for (let i = 0; i < 360; i += 1) {
    const lon = (i / 360) * 360.0;
    const { raHours, decDeg } = eclipticLonToRaDec(lon);
    const { alt, az } = raDecToAltAz(raHours, decDeg, now, observer);
    eclPts.push(altAzToVector(alt, az, SYMBOL_RADIUS - 1));
  }
  eclipticLine.geometry.setFromPoints(eclPts);
  eclipticLine.computeLineDistances();

  const eqPts = [];
  for (let i = 0; i < 240; i += 1) {
    const ra = (i / 240) * 24.0;
    const { alt, az } = raDecToAltAz(ra, 0.0, now, observer);
    eqPts.push(altAzToVector(alt, az, SYMBOL_RADIUS - 1));
  }
  celestialEquatorLine.geometry.setFromPoints(eqPts);
  celestialEquatorLine.computeLineDistances();
}

function placeBodySprite({ body, sprite, minAlt = -0.8, alwaysVisible = false }) {
  const now = new Date();
  const equ = Astronomy.Equator(body, now, observer, true, true);
  const hor = Astronomy.Horizon(now, observer, equ.ra, equ.dec, 'normal');
  if (!alwaysVisible && hor.altitude <= minAlt) {
    sprite.visible = false;
    return;
  }
  sprite.visible = true;
  const pos = altAzToVector(hor.altitude, hor.azimuth, SYMBOL_RADIUS);
  sprite.position.copy(pos);
  return { dist: equ.dist, altitude: hor.altitude, azimuth: hor.azimuth };
}

function updateSolarSystemMarkers() {
  const sunPos = placeBodySprite({ body: 'Sun', sprite: sunSprite, alwaysVisible: true });
  const moonPos = placeBodySprite({ body: 'Moon', sprite: moonSprite, alwaysVisible: true });

  if (sunSprite.visible && sunPos && Number.isFinite(sunPos.dist)) {
    const deg = angularDiameterDeg(1392700.0, sunPos.dist);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    sunSprite.scale.set(scale, scale, 1.0);

    const skyColor = skyDiscColorFromSunAltitude(sunPos.altitude);
    const skyAlpha = lerp(0.012, 0.06, THREE.MathUtils.clamp((sunPos.altitude + 8.0) / 40.0, 0.0, 1.0));
    skyColorDisc.material.color.copy(skyColor);
    skyColorDisc.material.opacity = skyAlpha;
  }

  if (moonSprite.visible && moonPos && Number.isFinite(moonPos.dist)) {
    const deg = angularDiameterDeg(3474.8, moonPos.dist);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    moonSprite.scale.set(scale, scale, 1.0);
    for (const planet of planetObjects) {
      planet.marker.scale.set(scale, scale, 1.0);
    }
    zenithMarker.scale.set(scale, scale, 1.0);
    nadirMarker.scale.set(scale, scale, 1.0);
    updateHorizonTicksByAngularSize(deg * 2.0);
  } else {
    // Fallback: average apparent moon diameter (about 0.52 deg), doubled.
    const fallbackScale = spriteScaleFromAngularDiameter(0.52, SYMBOL_RADIUS);
    for (const planet of planetObjects) {
      planet.marker.scale.set(fallbackScale, fallbackScale, 1.0);
    }
    zenithMarker.scale.set(fallbackScale, fallbackScale, 1.0);
    nadirMarker.scale.set(fallbackScale, fallbackScale, 1.0);
    updateHorizonTicksByAngularSize(1.04);
  }

  for (const planet of planetObjects) {
    const pos = placeBodySprite({ body: planet.body, sprite: planet.marker, alwaysVisible: true });
    if (!planet.marker.visible || !pos) {
      planet.label.visible = false;
      continue;
    }
    planet.label.visible = true;
    const labelPos = altAzToVector(pos.altitude + 1.2, pos.azimuth, SYMBOL_RADIUS);
    planet.label.position.copy(labelPos);
  }

  rebuildReferenceLines();
}

let lastSolarUpdateMs = 0;
let vrSplashSprite = null;
let vrSplashUntilMs = 0;

let session = null;

function setStatus(text) {
  statusEl.textContent = `Status: ${text}`;
}

async function prepareVrButton() {
  if (!navigator.xr) {
    enterVrButton.disabled = true;
    setStatus('WebXR unavailable in this browser');
    return;
  }

  const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
  if (!isSupported) {
    enterVrButton.disabled = true;
    setStatus('Immersive VR unsupported on this device');
    return;
  }

  enterVrButton.addEventListener('click', async () => {
    if (session) {
      await session.end();
      return;
    }
    try {
      const nextSession = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor'],
      });
      renderer.xr.setFramebufferScaleFactor(1.25);
      renderer.xr.setSession(nextSession);
      session = nextSession;
      enterVrButton.textContent = 'Exit VR';
      setStatus('Immersive VR session started');
      if (vrSplashSprite) {
        scene.remove(vrSplashSprite);
        vrSplashSprite = null;
      }
      vrSplashSprite = createVrSplashSprite(locationSummaryText || activeLocation.name);
      scene.add(vrSplashSprite);
      vrSplashUntilMs = performance.now() + 3000;

      nextSession.addEventListener('end', () => {
        session = null;
        enterVrButton.textContent = 'Enter VR';
        setStatus('Desktop preview');
        if (vrSplashSprite) {
          scene.remove(vrSplashSprite);
          vrSplashSprite = null;
        }
      });
    } catch (error) {
      setStatus(`Failed to start VR (${error.message})`);
    }
  });

  setStatus('Desktop preview (VR ready)');
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);

// Fixed viewpoint: ground level at Matsue, facing north.
camera.lookAt(0, EYE_HEIGHT_M, -10);

renderer.setAnimationLoop(() => {
  const nowMs = performance.now();
  if (nowMs - lastSolarUpdateMs > 10000) {
    updateSolarSystemMarkers();
    lastSolarUpdateMs = nowMs;
  }

  // Keep sky and stars centered around the observer.
  if (!renderer.xr.isPresenting) {
    sky.position.copy(camera.position);
    for (const mesh of starMeshes) {
      mesh.position.copy(camera.position);
    }
    solarSystemGroup.position.copy(camera.position);
    groundDisc.position.copy(camera.position);
    groundDisc.position.y -= EYE_HEIGHT_M;
  }

  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    sky.position.setFromMatrixPosition(xrCam.matrixWorld);
    for (const mesh of starMeshes) {
      mesh.position.copy(sky.position);
    }
    solarSystemGroup.position.copy(sky.position);
    groundDisc.position.copy(sky.position);
    groundDisc.position.y -= EYE_HEIGHT_M;

    if (vrSplashSprite) {
      if (nowMs > vrSplashUntilMs) {
        scene.remove(vrSplashSprite);
        vrSplashSprite = null;
      } else {
        const headPos = new THREE.Vector3().setFromMatrixPosition(xrCam.matrixWorld);
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(xrCam.matrixWorld);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat).normalize();
        vrSplashSprite.position.copy(headPos).add(forward.multiplyScalar(1.8));
        vrSplashSprite.quaternion.copy(headQuat);
      }
    }
  }

  renderer.render(scene, camera);
});

async function initializeLocation() {
  activeLocation = await resolveLocationFromUrl();
  observer = new Astronomy.Observer(activeLocation.lat, activeLocation.lon, 0);
  const sourceTag = (() => {
    if (activeLocation.source === 'city') return `city:${activeLocation.name}`;
    if (activeLocation.source === 'latlon') return 'lat/lon';
    if (activeLocation.source === 'fallback_city_not_found') {
      return `city not found ('${activeLocation.requestedCity}') -> default`;
    }
    if (activeLocation.source === 'fallback_city_index_error') {
      return `city lookup error ('${activeLocation.requestedCity}') -> default`;
    }
    return 'default';
  })();
  setStatus(
    `Desktop preview (${activeLocation.name} ${activeLocation.lat.toFixed(3)}N, ${activeLocation.lon.toFixed(3)}E / ${sourceTag} / stars: ${STAR_META.usedRows})`,
  );
  if (activeLocation.source === 'fallback_city_not_found') {
    locationSummaryText = `City '${activeLocation.requestedCity}' not found. Using default: ${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  } else if (activeLocation.source === 'fallback_city_index_error') {
    locationSummaryText = `City lookup error for '${activeLocation.requestedCity}'. Using default: ${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  } else {
    locationSummaryText = `${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  }

  updateSolarSystemMarkers();
}

initializeLocation();
prepareVrButton();
