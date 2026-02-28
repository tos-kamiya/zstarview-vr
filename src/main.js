import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { STAR_LAYERS, STAR_META } from './generated/stars-data.js';
import { FAMOUS_STARS } from './generated/famous-stars-data.js';
import packageJson from '../package.json';

const DEFAULT_LOCATION = {
  name: 'Tokyo',
  lat: 35.681236,
  lon: 139.767125,
};

const EYE_HEIGHT_M = 1.7;
const SKY_RADIUS = 450;
const SYMBOL_RADIUS = SKY_RADIUS - 8;
const LABEL_SCALE_X = 72.0;
const LABEL_SCALE_Y = 27.0;
const FAMOUS_LABEL_SCALE_X = LABEL_SCALE_X * 1.2;
const LABEL_ALT_OFFSET_DEG = 1.2;
const APP_VERSION = packageJson.version;
const FAMOUS_STAR_HIT_ANGLE_DEG = 1.2;
const FAMOUS_STAR_HIT_COS = Math.cos(THREE.MathUtils.degToRad(FAMOUS_STAR_HIT_ANGLE_DEG));
const VIEW_MODE_MONO = 'mono';
const VIEW_MODE_FISHEYE_180 = 'fisheye180';
const FISHEYE_CUBE_SIZE = 1024;
const DESKTOP_YAW_STEP_RAD = THREE.MathUtils.degToRad(3.0);
const DESKTOP_PITCH_STEP_RAD = THREE.MathUtils.degToRad(2.0);
const DESKTOP_PITCH_LIMIT_RAD = THREE.MathUtils.degToRad(85.0);
const AU_KM = 149597870.7;
const EARTH_OBLIQUITY_DEG = 23.439291;
const CITY_INDEX_URL = `${import.meta.env.BASE_URL}data/cities-index-v2.json`;
const CITY_INDEX_GZ_URL = `${CITY_INDEX_URL}.gz`;
const DEFAULT_MAX_MAG = 6.0;
const EXTENDED_MAX_MAG = 7.0;
const APP_QUERY_PARAMS = new URLSearchParams(window.location.search);

const canvas = document.getElementById('scene');
const hudEl = document.getElementById('hud');
const statusEl = document.getElementById('status');
const enterVrButton = document.getElementById('enter-vr');
let locationSummaryText = '';

function parseViewModeFromUrl(searchParams) {
  const value = (searchParams.get('view') || '').trim().toLowerCase();
  if (value === VIEW_MODE_FISHEYE_180) return VIEW_MODE_FISHEYE_180;
  return VIEW_MODE_MONO;
}

function parseMaxMagFromUrl(searchParams) {
  const value = searchParams.get('maxMag');
  if (value == null || value.trim() === '') return DEFAULT_MAX_MAG;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_MAG;
  if (parsed >= EXTENDED_MAX_MAG) return EXTENDED_MAX_MAG;
  return DEFAULT_MAX_MAG;
}

const desktopViewMode = parseViewModeFromUrl(APP_QUERY_PARAMS);
const requestedMaxMag = parseMaxMagFromUrl(APP_QUERY_PARAMS);
const shouldLoadExtraStars = requestedMaxMag >= EXTENDED_MAX_MAG;
const fisheyeEnabled = desktopViewMode === VIEW_MODE_FISHEYE_180;
const STAR_SIZE_SCALE = fisheyeEnabled ? 8.0 : 1.0;
let displayedStarCount = STAR_META.usedRows;
let loadedMaxMag = STAR_META.maxVmag;
let extendedStarsLoaded = false;
let extendedStarsLoading = false;
let extendedStarsLoadPromise = null;
let pendingExtendedStarsSplash = false;

if (fisheyeEnabled && hudEl) {
  hudEl.style.display = 'none';
}

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
const fisheyeViewRotation = new THREE.Matrix3();
const fisheyeViewRotationMatrix4 = new THREE.Matrix4();

const fisheyeCubeTarget = new THREE.WebGLCubeRenderTarget(FISHEYE_CUBE_SIZE, {
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
const fisheyeCubeCamera = new THREE.CubeCamera(0.1, 1200, fisheyeCubeTarget);

const fisheyePostScene = new THREE.Scene();
const fisheyePostCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fisheyePostMaterial = new THREE.ShaderMaterial({
  depthWrite: false,
  depthTest: false,
  uniforms: {
    uCubeTex: { value: fisheyeCubeTarget.texture },
    uViewRot: { value: fisheyeViewRotation },
    uBackground: { value: new THREE.Color(0x000000) },
    uAspect: { value: window.innerWidth / Math.max(1, window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform samplerCube uCubeTex;
    uniform mat3 uViewRot;
    uniform vec3 uBackground;
    uniform float uAspect;

    void main() {
      vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y * 2.0 - 1.0);
      vec2 q = p;
      if (uAspect >= 1.0) {
        q.x *= uAspect;
      } else {
        q.y /= max(uAspect, 1e-6);
      }
      float r = length(q);
      if (r > 1.0) {
        gl_FragColor = vec4(uBackground, 1.0);
        return;
      }

      float theta = r * (0.5 * 3.141592653589793);
      float phi = atan(q.y, q.x);
      float sinTheta = sin(theta);

      vec3 dirLocal = vec3(
        sinTheta * cos(phi),
        sinTheta * sin(phi),
        -cos(theta)
      );
      vec3 dirWorld = normalize(uViewRot * dirLocal);
      vec4 color = textureCube(uCubeTex, dirWorld);
      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
});
const fisheyePostQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fisheyePostMaterial);
fisheyePostScene.add(fisheyePostQuad);

const hemiLight = new THREE.HemisphereLight(0x6f8ec9, 0x172133, 0.4);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xd8e6ff, 0.26);
dirLight.position.set(-2, 5, 2);
scene.add(dirLight);

function createControllerPointerLine() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0x9ad8ff,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const line = new THREE.Line(geometry, material);
  line.scale.z = 120;
  line.visible = false;
  return line;
}

for (let i = 0; i < 2; i += 1) {
  const controller = renderer.xr.getController(i);
  const pointerLine = createControllerPointerLine();
  controller.add(pointerLine);
  controller.addEventListener('connected', (event) => {
    pointerLine.visible = event.data?.targetRayMode === 'tracked-pointer';
  });
  controller.addEventListener('disconnected', () => {
    pointerLine.visible = false;
  });
  scene.add(controller);
}

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
    size: layer.size * STAR_SIZE_SCALE,
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
  cnv.width = 1280;
  cnv.height = 320;
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

  let fontSize = 86;
  const maxWidth = cnv.width * 0.9;
  while (fontSize > 44) {
    ctx.font = `bold ${fontSize}px "Noto Sans", "Noto Sans JP", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 4;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(234, 242, 255, 0.98)';
  ctx.strokeStyle = 'rgba(2, 10, 22, 0.9)';
  ctx.lineWidth = 11;
  ctx.strokeText(text, cnv.width / 2, cnv.height * 0.48);
  ctx.fillText(text, cnv.width / 2, cnv.height * 0.48);

  const versionText = `v${APP_VERSION}`;
  ctx.font = 'bold 34px "Noto Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(197, 219, 255, 0.9)';
  ctx.strokeStyle = 'rgba(2, 10, 22, 0.82)';
  ctx.lineWidth = 6;
  ctx.strokeText(versionText, cnv.width - 28, cnv.height - 26);
  ctx.fillText(versionText, cnv.width - 28, cnv.height - 26);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(2.15, 0.58, 1.0);
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

function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunAltDeg: { value: -90.0 },
      uTurbidity: { value: 4.0 },
      uWorldToEquatorial: { value: new THREE.Matrix3() },
      uNeverRisesThresholdDeg: { value: -54.0 },
      uNeverRisesMode: { value: 1.0 },
      uGroundMaskStrength: { value: 0.30 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform float uSunAltDeg;
      uniform float uTurbidity;
      uniform mat3 uWorldToEquatorial;
      uniform float uNeverRisesThresholdDeg;
      uniform float uNeverRisesMode;
      uniform float uGroundMaskStrength;

      float luma(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
      }

      vec3 softClipLuma(vec3 color, float maxLuma) {
        float y = luma(color);
        if (y <= 1e-6 || y <= maxLuma) return color;
        return color * (maxLuma / y);
      }

      void main() {
        vec3 dir = normalize(vDir);
        vec3 sunDir = normalize(uSunDir);

        float tau = clamp((uTurbidity - 2.0) / 8.0, 0.0, 1.0);
        float viewAltDeg = degrees(asin(clamp(dir.y, -1.0, 1.0)));
        float tAlt = clamp(viewAltDeg / 90.0, 0.0, 1.0);
        float sunUp = smoothstep(-8.0, 6.0, uSunAltDeg);
        float twilight = smoothstep(-10.0, 0.0, uSunAltDeg);

        vec3 horizonDay = vec3(0.98, 0.70, 0.45);
        vec3 zenithDay = vec3(0.18, 0.42, 0.93);
        vec3 base = mix(horizonDay, zenithDay, tAlt);

        float haze = (0.22 + 0.48 * (1.0 - tAlt)) * (0.65 + 0.55 * tau);
        base = mix(base, vec3(1.0), haze);

        float sunFacing = max(0.0, dot(dir, sunDir));
        float glow = pow(sunFacing, 1.9 - 0.55 * tau);
        vec3 sunTint = mix(vec3(1.0, 0.82, 0.58), vec3(1.0, 0.92, 0.78), tau);
        vec3 color = base + sunTint * (0.52 * glow * sunUp);

        float anti = max(0.0, dot(dir, -sunDir));
        float antiBoost = pow(anti, 2.2);
        color += vec3(0.06, 0.10, 0.20) * (0.24 * antiBoost * sunUp);

        vec3 night = vec3(0.01, 0.02, 0.05);
        color = mix(night, color, twilight);
        color = mix(vec3(0.0), color, 0.1);

        float maxLuma = 0.28 + 0.20 * sunUp;
        color = softClipLuma(color, maxLuma);
        color = clamp(color, 0.0, 1.0);

        vec3 eqDir = normalize(uWorldToEquatorial * dir);
        float decDeg = degrees(asin(clamp(eqDir.y, -1.0, 1.0)));
        float neverRisesMask = 0.0;
        if (uNeverRisesMode > 0.0) {
          // Northern hemisphere: never rises when dec <= (lat - 90).
          neverRisesMask = step(decDeg, uNeverRisesThresholdDeg);
        } else {
          // Southern hemisphere: never rises when dec >= (lat + 90).
          neverRisesMask = step(uNeverRisesThresholdDeg, decDeg);
        }
        vec3 neverRisesTint = vec3(0.42, 0.07, 0.07);
        color = mix(color, color + neverRisesTint, 0.08 * neverRisesMask);
        color = clamp(color, 0.0, 1.0);

        // Darken the lower hemisphere (alt < 0) without a physical ground disc.
        float groundMask = step(dir.y, 0.0);
        vec3 groundColor = vec3(0.12, 0.19, 0.27);
        color = mix(color, groundColor, uGroundMaskStrength * groundMask);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

let cityIndexPromise = null;

function normalizeCityName(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeCountryCode(value) {
  return (value || '').trim().toUpperCase();
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

async function parseGzipJsonFromResponse(response) {
  const compressed = await response.arrayBuffer();
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream unavailable');
  }
  const ds = new DecompressionStream('gzip');
  const decompressedStream = new Response(compressed).body.pipeThrough(ds);
  return new Response(decompressedStream).json();
}

async function loadCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch(CITY_INDEX_GZ_URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load gzip city index: HTTP ${res.status}`);
        return parseGzipJsonFromResponse(res);
      })
      .catch(async () => {
        // Fallback path for environments without DecompressionStream or missing .gz file.
        const res = await fetch(CITY_INDEX_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load city index: HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => (Array.isArray(json.entries) ? json.entries : []));
  }
  return cityIndexPromise;
}

function pickCity(cities, cityName, countryCode = null) {
  const q = normalizeCityName(cityName);
  const c = normalizeCountryCode(countryCode);
  if (!q) return null;

  let best = null;
  let bestScore = -1;

  for (const row of cities) {
    const [name, ascii, lat, lon, country, admin1, pop] = row;
    if (c && normalizeCountryCode(country) !== c) continue;
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
  const fromLatLon = parseLatLonFromUrl(APP_QUERY_PARAMS);
  if (fromLatLon) return { ...fromLatLon, source: 'latlon' };

  const city = APP_QUERY_PARAMS.get('city');
  const country = APP_QUERY_PARAMS.get('country');
  if (city && city.trim()) {
    try {
      const cities = await loadCityIndex();
      const found = pickCity(cities, city, country);
      if (found) return { ...found, source: 'city' };
      return {
        ...DEFAULT_LOCATION,
        source: 'fallback_city_not_found',
        requestedCity: city,
        requestedCountry: normalizeCountryCode(country),
      };
    } catch (_e) {
      return {
        ...DEFAULT_LOCATION,
        source: 'fallback_city_index_error',
        requestedCity: city,
        requestedCountry: normalizeCountryCode(country),
      };
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

const skyMaterial = createSkyMaterial();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(SKY_RADIUS, 96, 64),
  skyMaterial
);
sky.position.set(0, EYE_HEIGHT_M, 0);
scene.add(sky);

const starMeshes = [];

function addStarLayers(layers) {
  for (const layer of layers) {
    const radius = SKY_RADIUS - 4 - starMeshes.length;
    const mesh = createStarfieldFromLayer(layer, radius);
    scene.add(mesh);
    starMeshes.push(mesh);
  }
}

addStarLayers(STAR_LAYERS);
const equatorialRotation = new THREE.Quaternion();
const equatorialBasisMatrix = new THREE.Matrix4();
const worldToEquatorialMatrix3 = new THREE.Matrix3();
const horizonGroup = new THREE.Group();
scene.add(horizonGroup);

const horizonRadius = SYMBOL_RADIUS - 2;
const horizonPoints = [];
for (let i = 0; i < 256; i += 1) {
  const az = (i / 256) * 360.0;
  horizonPoints.push(altAzToVector(0.0, az, horizonRadius));
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
horizonGroup.add(horizonRing);

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
horizonGroup.add(horizonTicks);

function updateHorizonTicksByAngularSize(targetAngularDeg) {
  const halfAltDeg = Math.max(0.025, targetAngularDeg * 0.5);
  const points = [];
  for (let i = 0; i < 8; i += 1) {
    const az = (i / 8) * 360.0;
    points.push(
      altAzToVector(-halfAltDeg, az, horizonRadius),
      altAzToVector(+halfAltDeg, az, horizonRadius)
    );
  }
  horizonTickGeometry.setFromPoints(points);
}

let activeLocation = { ...DEFAULT_LOCATION, source: 'default' };
let observer = new Astronomy.Observer(activeLocation.lat, activeLocation.lon, 0);
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

const sunSprite = createCircleOutlineSprite('rgba(255, 214, 120, 0.98)');
const moonSprite = createCircleOutlineSprite('rgba(206, 220, 255, 0.98)');
const sunLabel = createTextSprite('Sun', 'rgba(255,228,166,0.98)');
sunLabel.scale.set(LABEL_SCALE_X, LABEL_SCALE_Y, 1.0);
const moonLabel = createTextSprite('Moon', 'rgba(206,220,255,0.98)');
moonLabel.scale.set(LABEL_SCALE_X, LABEL_SCALE_Y, 1.0);
solarSystemGroup.add(sunSprite);
solarSystemGroup.add(moonSprite);
solarSystemGroup.add(sunLabel);
solarSystemGroup.add(moonLabel);

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
  label.scale.set(LABEL_SCALE_X, LABEL_SCALE_Y, 1.0);
  label.position.copy(altAzToVector(0.0, d.az, SYMBOL_RADIUS));
  solarSystemGroup.add(label);
}

const planetDefs = [
  { body: 'Mercury', label: 'Mercury', color: 'rgba(232,232,232,0.98)' },
  { body: 'Venus', label: 'Venus', color: 'rgba(255,228,166,0.98)' },
  { body: 'Mars', label: 'Mars', color: 'rgba(255,159,131,0.98)' },
  { body: 'Jupiter', label: 'Jupiter', color: 'rgba(255,233,189,0.98)' },
  { body: 'Saturn', label: 'Saturn', color: 'rgba(255,233,161,0.98)' },
  { body: 'Uranus', label: 'Uranus', color: 'rgba(179, 236, 255, 0.98)' },
  { body: 'Neptune', label: 'Neptune', color: 'rgba(145, 176, 255, 0.98)' },
  { body: 'Pluto', label: 'Pluto', color: 'rgba(214, 203, 186, 0.98)' },
];
const planetObjects = planetDefs.map((def) => {
  const marker = createCrossMarkerSprite(def.color);
  marker.scale.set(3.0, 3.0, 1.0);
  const label = createTextSprite(def.label, def.color);
  label.scale.set(LABEL_SCALE_X, LABEL_SCALE_Y, 1.0);
  solarSystemGroup.add(marker);
  solarSystemGroup.add(label);
  return { ...def, marker, label };
});

function raDecToUnitVector(raHours, decDeg) {
  const ra = (raHours * Math.PI) / 12.0;
  const dec = THREE.MathUtils.degToRad(decDeg);
  const c = Math.cos(dec);
  return new THREE.Vector3(
    c * Math.cos(ra),
    Math.sin(dec),
    -c * Math.sin(ra),
  );
}

const famousStarObjects = FAMOUS_STARS.map((def) => {
  const equatorialDirection = raDecToUnitVector(def.raHours, def.decDeg).normalize();
  const worldDirection = equatorialDirection.clone();
  const label = createTextSprite(def.name, 'rgba(234,242,255,0.98)');
  label.scale.set(FAMOUS_LABEL_SCALE_X, LABEL_SCALE_Y, 1.0);
  label.position.copy(worldDirection).multiplyScalar(SYMBOL_RADIUS);
  label.visible = false;
  solarSystemGroup.add(label);
  return { ...def, equatorialDirection, worldDirection, label };
});

const zenithMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
zenithMarker.scale.set(4.2, 4.2, 1.0);
zenithMarker.position.set(0, SYMBOL_RADIUS, 0);
solarSystemGroup.add(zenithMarker);

const nadirMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
nadirMarker.scale.set(4.2, 4.2, 1.0);
nadirMarker.position.set(0, -SYMBOL_RADIUS, 0);
solarSystemGroup.add(nadirMarker);

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

function computeEquatorialRotation(when) {
  const basisXAltAz = raDecToAltAz(0.0, 0.0, when, observer);
  const basisYAltAz = raDecToAltAz(0.0, 90.0, when, observer);
  const basisZAltAz = raDecToAltAz(6.0, 0.0, when, observer);

  const basisX = altAzToVector(basisXAltAz.alt, basisXAltAz.az, 1.0).normalize();
  const basisY = altAzToVector(basisYAltAz.alt, basisYAltAz.az, 1.0).normalize();
  const basisZ = altAzToVector(basisZAltAz.alt, basisZAltAz.az, 1.0).normalize();

  // Re-orthonormalize to keep rotation stable.
  basisY.addScaledVector(basisX, -basisX.dot(basisY)).normalize();
  basisZ.copy(new THREE.Vector3().crossVectors(basisX, basisY)).normalize();

  equatorialBasisMatrix.makeBasis(basisX, basisY, basisZ);
  equatorialRotation.setFromRotationMatrix(equatorialBasisMatrix);
}

function updateStarfieldOrientation(when) {
  computeEquatorialRotation(when);

  for (const mesh of starMeshes) {
    mesh.quaternion.copy(equatorialRotation);
  }

  worldToEquatorialMatrix3.setFromMatrix4(equatorialBasisMatrix).invert();
  skyMaterial.uniforms.uWorldToEquatorial.value.copy(worldToEquatorialMatrix3);

  const lat = activeLocation.lat;
  if (lat >= 0.0) {
    skyMaterial.uniforms.uNeverRisesMode.value = 1.0;
    skyMaterial.uniforms.uNeverRisesThresholdDeg.value = lat - 90.0;
  } else {
    skyMaterial.uniforms.uNeverRisesMode.value = -1.0;
    skyMaterial.uniforms.uNeverRisesThresholdDeg.value = lat + 90.0;
  }

  for (const star of famousStarObjects) {
    star.worldDirection.copy(star.equatorialDirection).applyQuaternion(equatorialRotation).normalize();
    star.label.position.copy(star.worldDirection).multiplyScalar(SYMBOL_RADIUS);
  }
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
  const now = new Date();
  updateStarfieldOrientation(now);

  const sunPos = placeBodySprite({ body: 'Sun', sprite: sunSprite, alwaysVisible: true });
  const moonPos = placeBodySprite({ body: 'Moon', sprite: moonSprite, alwaysVisible: true });

  if (sunSprite.visible && sunPos && Number.isFinite(sunPos.dist)) {
    const deg = angularDiameterDeg(1392700.0, sunPos.dist);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    sunSprite.scale.set(scale, scale, 1.0);
    sunLabel.visible = true;
    sunLabel.position.copy(altAzToVector(sunPos.altitude + LABEL_ALT_OFFSET_DEG, sunPos.azimuth, SYMBOL_RADIUS));
    const sunDir = altAzToVector(sunPos.altitude, sunPos.azimuth, 1.0).normalize();
    skyMaterial.uniforms.uSunDir.value.copy(sunDir);
    skyMaterial.uniforms.uSunAltDeg.value = sunPos.altitude;
  } else {
    sunLabel.visible = false;
    skyMaterial.uniforms.uSunAltDeg.value = -90.0;
  }

  if (moonSprite.visible && moonPos && Number.isFinite(moonPos.dist)) {
    const deg = angularDiameterDeg(3474.8, moonPos.dist);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    moonSprite.scale.set(scale, scale, 1.0);
    moonLabel.visible = true;
    moonLabel.position.copy(altAzToVector(moonPos.altitude + LABEL_ALT_OFFSET_DEG, moonPos.azimuth, SYMBOL_RADIUS));
    for (const planet of planetObjects) {
      planet.marker.scale.set(scale, scale, 1.0);
    }
    zenithMarker.scale.set(scale, scale, 1.0);
    nadirMarker.scale.set(scale, scale, 1.0);
    updateHorizonTicksByAngularSize(deg * 2.0);
  } else {
    moonLabel.visible = false;
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
    const labelPos = altAzToVector(pos.altitude + LABEL_ALT_OFFSET_DEG, pos.azimuth, SYMBOL_RADIUS);
    planet.label.position.copy(labelPos);
  }

  rebuildReferenceLines();
}

function getControllerRayDirections(xrFrame) {
  if (!xrFrame || !renderer.xr.isPresenting) return null;
  const session = renderer.xr.getSession();
  const refSpace = renderer.xr.getReferenceSpace();
  if (!session || !refSpace) return null;

  const rays = [];
  for (const src of session.inputSources) {
    if (src.targetRayMode !== 'tracked-pointer') continue;
    const pose = xrFrame.getPose(src.targetRaySpace, refSpace);
    if (!pose) continue;
    const o = pose.transform.orientation;
    const q = new THREE.Quaternion(o.x, o.y, o.z, o.w);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize();
    rays.push(dir);
  }
  return rays;
}

function updateFamousStarHoverLabels(xrFrame) {
  if (!renderer.xr.isPresenting) {
    for (const star of famousStarObjects) {
      star.label.visible = false;
    }
    return;
  }

  const rayDirs = getControllerRayDirections(xrFrame);
  if (!rayDirs || rayDirs.length === 0) {
    for (const star of famousStarObjects) {
      star.label.visible = false;
    }
    return;
  }

  let bestStar = null;
  let bestDot = FAMOUS_STAR_HIT_COS;

  for (const star of famousStarObjects) {
    star.label.visible = false;
    for (const rayDir of rayDirs) {
      const dot = rayDir.dot(star.worldDirection);
      if (dot > bestDot) {
        bestDot = dot;
        bestStar = star;
      }
    }
  }

  if (bestStar) {
    bestStar.label.visible = true;
  }
}

let lastSolarUpdateMs = 0;
let vrSplashSprite = null;
let vrSplashUntilMs = 0;

let session = null;

function setStatus(text) {
  statusEl.textContent = `Status: v${APP_VERSION} | ${text}`;
}

function clearVrSplash() {
  if (!vrSplashSprite) return;
  scene.remove(vrSplashSprite);
  vrSplashSprite = null;
  vrSplashUntilMs = 0;
}

function showVrSplash(text, durationMs) {
  clearVrSplash();
  vrSplashSprite = createVrSplashSprite(text);
  scene.add(vrSplashSprite);
  vrSplashUntilMs = Number.isFinite(durationMs) ? performance.now() + durationMs : Number.POSITIVE_INFINITY;
}

async function ensureExtendedStarsLoaded() {
  if (!shouldLoadExtraStars || extendedStarsLoaded) return true;
  if (extendedStarsLoadPromise) return extendedStarsLoadPromise;

  extendedStarsLoading = true;
  extendedStarsLoadPromise = import('./generated/stars-data-extra-7.js')
    .then((extra) => {
      addStarLayers(extra.STAR_EXTRA_7_LAYERS);
      displayedStarCount += extra.STAR_EXTRA_7_META.usedRows;
      loadedMaxMag = Math.max(loadedMaxMag, extra.STAR_EXTRA_7_META.maxVmag);
      extendedStarsLoaded = true;
      return true;
    })
    .catch((error) => {
      console.warn('Failed to load extended star catalog:', error);
      return false;
    })
    .finally(() => {
      extendedStarsLoading = false;
    });

  return extendedStarsLoadPromise;
}

function desktopModeLabel() {
  if (desktopViewMode === VIEW_MODE_FISHEYE_180) {
    return 'Desktop mode (fisheye180)';
  }
  return 'Desktop mode';
}

function renderDesktopFrame() {
  if (desktopViewMode !== VIEW_MODE_FISHEYE_180) {
    renderer.render(scene, camera);
    return;
  }

  fisheyeCubeCamera.position.copy(camera.position);
  fisheyeCubeCamera.update(renderer, scene);

  fisheyeViewRotationMatrix4.makeRotationFromQuaternion(camera.quaternion);
  fisheyeViewRotation.setFromMatrix4(fisheyeViewRotationMatrix4);
  fisheyePostMaterial.uniforms.uViewRot.value.copy(fisheyeViewRotation);

  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(fisheyePostScene, fisheyePostCamera);
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
      renderer.xr.setFoveation(0);
      renderer.xr.setSession(nextSession);
      session = nextSession;
      enterVrButton.textContent = 'Exit VR';
      setStatus('Immersive VR session started');
      showVrSplash(locationSummaryText || activeLocation.name, 3000);
      pendingExtendedStarsSplash = shouldLoadExtraStars && !extendedStarsLoaded;

      nextSession.addEventListener('end', () => {
        session = null;
        enterVrButton.textContent = 'Enter VR';
        setStatus(desktopModeLabel());
        pendingExtendedStarsSplash = false;
        clearVrSplash();
      });
    } catch (error) {
      setStatus(`Failed to start VR (${error.message})`);
    }
  });

  setStatus(`${desktopModeLabel()} (VR ready)`);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fisheyePostMaterial.uniforms.uAspect.value = window.innerWidth / Math.max(1, window.innerHeight);
}

window.addEventListener('resize', onResize);

// Fixed initial heading: facing north.
camera.lookAt(0, EYE_HEIGHT_M, -10);

if (fisheyeEnabled) {
  const desktopLook = {
    yaw: 0.0,
    pitch: 0.0,
  };

  function applyDesktopLook() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = desktopLook.yaw;
    camera.rotation.x = desktopLook.pitch;
    camera.rotation.z = 0.0;
  }

  window.addEventListener('keydown', (event) => {
    if (renderer.xr.isPresenting) return;

    let handled = true;
    switch (event.key) {
      case 'ArrowLeft':
        desktopLook.yaw += DESKTOP_YAW_STEP_RAD;
        break;
      case 'ArrowRight':
        desktopLook.yaw -= DESKTOP_YAW_STEP_RAD;
        break;
      case 'ArrowUp':
        desktopLook.pitch = Math.min(DESKTOP_PITCH_LIMIT_RAD, desktopLook.pitch + DESKTOP_PITCH_STEP_RAD);
        break;
      case 'ArrowDown':
        desktopLook.pitch = Math.max(-DESKTOP_PITCH_LIMIT_RAD, desktopLook.pitch - DESKTOP_PITCH_STEP_RAD);
        break;
      default:
        handled = false;
        break;
    }

    if (!handled) return;
    event.preventDefault();
    applyDesktopLook();
  });
}

renderer.setAnimationLoop((_time, xrFrame) => {
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
    horizonGroup.position.copy(camera.position);
  }

  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    sky.position.setFromMatrixPosition(xrCam.matrixWorld);
    for (const mesh of starMeshes) {
      mesh.position.copy(sky.position);
    }
    solarSystemGroup.position.copy(sky.position);
    horizonGroup.position.copy(sky.position);

    if (vrSplashSprite) {
      if (nowMs > vrSplashUntilMs) {
        clearVrSplash();
        if (pendingExtendedStarsSplash && !extendedStarsLoading && !extendedStarsLoaded) {
          pendingExtendedStarsSplash = false;
          showVrSplash('Loading star data...', Number.POSITIVE_INFINITY);
          ensureExtendedStarsLoaded().finally(() => {
            if (renderer.xr.isPresenting && vrSplashSprite && vrSplashUntilMs === Number.POSITIVE_INFINITY) {
              clearVrSplash();
            }
          });
        }
      } else {
        const headPos = new THREE.Vector3().setFromMatrixPosition(xrCam.matrixWorld);
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(xrCam.matrixWorld);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat).normalize();
        vrSplashSprite.position.copy(headPos).add(forward.multiplyScalar(1.8));
        vrSplashSprite.quaternion.copy(headQuat);
      }
    }
  }

  updateFamousStarHoverLabels(xrFrame);

  if (renderer.xr.isPresenting) {
    renderer.render(scene, camera);
  } else {
    renderDesktopFrame();
  }
});

async function initializeLocation() {
  activeLocation = await resolveLocationFromUrl();
  observer = new Astronomy.Observer(activeLocation.lat, activeLocation.lon, 0);
  const sourceTag = (() => {
    if (activeLocation.source === 'city') {
      return activeLocation.country ? `city:${activeLocation.name},${activeLocation.country}` : `city:${activeLocation.name}`;
    }
    if (activeLocation.source === 'latlon') return 'lat/lon';
    if (activeLocation.source === 'fallback_city_not_found') {
      const cc = activeLocation.requestedCountry ? `, country '${activeLocation.requestedCountry}'` : '';
      return `city not found ('${activeLocation.requestedCity}'${cc}) -> default`;
    }
    if (activeLocation.source === 'fallback_city_index_error') {
      const cc = activeLocation.requestedCountry ? `, country '${activeLocation.requestedCountry}'` : '';
      return `city lookup error ('${activeLocation.requestedCity}'${cc}) -> default`;
    }
    return 'default';
  })();
  setStatus(
    `${desktopModeLabel()} (${activeLocation.name} ${activeLocation.lat.toFixed(3)}N, ${activeLocation.lon.toFixed(3)}E / ${sourceTag} / stars: ${displayedStarCount} / maxMag: ${loadedMaxMag.toFixed(1)})`,
  );
  if (activeLocation.source === 'fallback_city_not_found') {
    const cc = activeLocation.requestedCountry ? ` in country '${activeLocation.requestedCountry}'` : '';
    locationSummaryText = `City '${activeLocation.requestedCity}'${cc} not found. Using default: ${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  } else if (activeLocation.source === 'fallback_city_index_error') {
    const cc = activeLocation.requestedCountry ? ` in country '${activeLocation.requestedCountry}'` : '';
    locationSummaryText = `City lookup error for '${activeLocation.requestedCity}'${cc}. Using default: ${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  } else {
    locationSummaryText = `${activeLocation.name} (${activeLocation.lat.toFixed(3)}, ${activeLocation.lon.toFixed(3)})`;
  }

  updateSolarSystemMarkers();
}

initializeLocation();
prepareVrButton();
