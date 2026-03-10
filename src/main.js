import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { FAMOUS_STARS, ASTERISM_STARS } from './generated/famous-stars-data.js';
import { ASTERISM_DEFS } from './asterisms/catalog.js';
import { buildAsterismsFromStars } from './asterisms/runtime.js';
import { createAsterismRenderer } from './asterisms/render.js';
import { createVrMenu } from './menu/vr-menu.js';
import { createStarPreviewRenderer } from './menu/star-preview.js';
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
const FAMOUS_STAR_HIT_ANGLE_DEG = 1.6;
const FAMOUS_STAR_HIT_COS = Math.cos(THREE.MathUtils.degToRad(FAMOUS_STAR_HIT_ANGLE_DEG));
const BODY_POINTER_HIT_MIN_ANGLE_DEG = 0.8;
const PLANET_LABEL_COLOR = 'rgba(234,242,255,0.98)';
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
const BASE_BIN_URL = `${import.meta.env.BASE_URL}data/stars-data-base.bin`;
const EXTRA7_BIN_URL = `${import.meta.env.BASE_URL}data/stars-data-extra-7.bin`;
const EXTRA8_BIN_URL = `${import.meta.env.BASE_URL}data/stars-data-extra-8.bin`;
const EXTRA9_BIN_URL = `${import.meta.env.BASE_URL}data/stars-data-extra-9.bin`;
const EXTRA10_BIN_URL = `${import.meta.env.BASE_URL}data/stars-data-extra-10.bin`;
const DSO_CSV_URL = `${import.meta.env.BASE_URL}data/dso.csv`;
const DEFAULT_MAX_MAG = 6.0;
const EXTENDED_MAX_MAG_7 = 7.0;
const EXTENDED_MAX_MAG_8 = 8.0;
const EXTENDED_MAX_MAG_9 = 9.0;
const EXTENDED_MAX_MAG_10 = 10.0;
const APP_QUERY_PARAMS = new URLSearchParams(window.location.search);
const DSO_SHAPE_MIN_MAJOR_ARCMIN = 15.0;
const DSO_HOVER_SIZE_GAIN = 3.0;
const DSO_HIT_MIN_ANGLE_DEG = 0.9;
const DSO_CATALOG_LIKE_NAME_RE = /^(M\d+|NGC\d+|IC\d+|MEL\d+|MWSC\d+)$/i;
const ASTERISM_ROTATE_SLOT_MS = 3000;
const ASTERISM_AMBIENT_LINE_OPACITY = 0.08;
const ASTERISM_AMBIENT_LINE_COLOR = 0x78b6da;
const ASTERISM_AMBIENT_LINE_WIDTH_PX = 6.0;
const ASTERISM_HIGHLIGHT_LINE_WIDTH_PX = 3.0;
const ASTERISM_LINE_OPACITY = 0.6;
const ASTERISM_LINE_COLOR = 0x6bc6ff;
const ASTERISM_LABEL_COLOR = 'rgba(117, 204, 255, 0.98)';
const ASTERISM_LABEL_OUTLINE = 'rgba(5, 18, 35, 0.90)';
const LABEL_LAYOUT_INTERVAL_MS = 100;
const SOLAR_UPDATE_INTERVAL_MS = 500;
const LABEL_LAYOUT_MAX_RADIUS_PX = 240;
const LABEL_LAYOUT_RING_STEP_PX = 18;
const LABEL_CANVAS_BASE_ASPECT = 512 / 192;
const VR_CENTER_LABEL_ENTER_ANGLE_DEG = 2.2;
const VR_CENTER_LABEL_EXIT_ANGLE_DEG = 2.5;
const VR_CENTER_PANEL_DISTANCE_M = 50.0;
const VR_CENTER_PANEL_REFERENCE_DISTANCE_M = 5.0;
const VR_CENTER_PANEL_INNER_RADIUS_M = 0.4;
const VR_CENTER_PANEL_OUTER_RADIUS_M = 1.5;
const VR_CENTER_PANEL_SEGMENTS = 96;
const VR_CENTER_TARGET_RING_SCALE = 8.8;
const VR_CENTER_PANEL_LABEL_SCALE_X = 0.9;
const VR_CENTER_PANEL_LABEL_SCALE_Y = 0.325;
const VR_CENTER_PANEL_LABEL_MIN_SEPARATION_RAD = 0.34;
const SHOW_LABEL_BOUNDS_DEBUG = false;
const SHOW_LABEL_BOUNDS_DEBUG_3D = false;
const SHOW_LABEL_BOUNDS_DEBUG_2D = false;
const COLORIZE_LABEL_SPRITES_DEBUG = false;
// Debug switch: disable all label rendering/layout to isolate freeze root-cause.
const ENABLE_LABEL_RENDER = true;

let pointerHoverCircles = [];
let vrCenterTargetRings = [];
let vrCenterPanelLabelSprites = [];
let selectedStarObject = null;
let hoveredAsterismStar = null;
let asterismObjects = [];
let asterismKeysBySourceId = new Map();
let lastLabelLayoutMs = 0;
let lastRuntimeWarning = '';
let labelBoundsGroup = null;
const labelBoundsPool = [];
let labelBoundsCanvas = null;
let labelBoundsCtx = null;
const displayOptions = {
  asterisms: true,
  dso: true,
};

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
  if (parsed >= EXTENDED_MAX_MAG_10) return EXTENDED_MAX_MAG_10;
  if (parsed >= EXTENDED_MAX_MAG_9) return EXTENDED_MAX_MAG_9;
  if (parsed >= EXTENDED_MAX_MAG_8) return EXTENDED_MAX_MAG_8;
  if (parsed >= EXTENDED_MAX_MAG_7) return EXTENDED_MAX_MAG_7;
  return DEFAULT_MAX_MAG;
}

const desktopViewMode = parseViewModeFromUrl(APP_QUERY_PARAMS);
const requestedMaxMag = parseMaxMagFromUrl(APP_QUERY_PARAMS);
const shouldLoadExtraStars = requestedMaxMag > DEFAULT_MAX_MAG;
const fisheyeEnabled = desktopViewMode === VIEW_MODE_FISHEYE_180;
const STAR_SIZE_BASELINE = 1.42;
const STAR_SIZE_SCALE = 2.13;
const STAR_OPACITY_COMPENSATION = Math.min(1.0, STAR_SIZE_BASELINE / STAR_SIZE_SCALE);
const STAR_LAYER_OPACITY_MIN = 0.006;
const PLANET_MARKER_SCALE = 1.5;
let displayedStarCount = 0;
let loadedMaxMag = 0.0;
let baseStarsLoaded = false;
let extra7StarsLoaded = false;
let extra8StarsLoaded = false;
let extra9StarsLoaded = false;
let extra10StarsLoaded = false;
let baseBinaryLoadPromise = null;
let extra7BinaryLoadPromise = null;
let extra8BinaryLoadPromise = null;
let extra9BinaryLoadPromise = null;
let extra10BinaryLoadPromise = null;
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
const vrCenterLabelPanel = new THREE.Group();
vrCenterLabelPanel.visible = false;
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
scene.add(vrCenterLabelPanel);

const vrCenterLabelPanelRing = new THREE.Mesh(
  new THREE.RingGeometry(
    VR_CENTER_PANEL_INNER_RADIUS_M,
    VR_CENTER_PANEL_OUTER_RADIUS_M,
    VR_CENTER_PANEL_SEGMENTS,
  ),
  new THREE.MeshBasicMaterial({
    color: 0x7dc9ff,
    transparent: true,
    opacity: 0.012,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  })
);
vrCenterLabelPanelRing.renderOrder = 1000;
vrCenterLabelPanel.add(vrCenterLabelPanelRing);

const vrCenterLabelPanelInnerOutline = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: VR_CENTER_PANEL_SEGMENTS }, (_, i) => {
      const angle = (i / VR_CENTER_PANEL_SEGMENTS) * Math.PI * 2.0;
      return new THREE.Vector3(
        Math.cos(angle) * VR_CENTER_PANEL_INNER_RADIUS_M,
        Math.sin(angle) * VR_CENTER_PANEL_INNER_RADIUS_M,
        0,
      );
    }),
  ),
  new THREE.LineBasicMaterial({
    color: 0xa9dcff,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
    depthTest: false,
  })
);
vrCenterLabelPanelInnerOutline.renderOrder = 1001;
vrCenterLabelPanel.add(vrCenterLabelPanelInnerOutline);

const vrCenterLabelPanelOuterOutline = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: VR_CENTER_PANEL_SEGMENTS }, (_, i) => {
      const angle = (i / VR_CENTER_PANEL_SEGMENTS) * Math.PI * 2.0;
      return new THREE.Vector3(
        Math.cos(angle) * VR_CENTER_PANEL_OUTER_RADIUS_M,
        Math.sin(angle) * VR_CENTER_PANEL_OUTER_RADIUS_M,
        0,
      );
    }),
  ),
  new THREE.LineBasicMaterial({
    color: 0xc7ebff,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
    depthTest: false,
  })
);
vrCenterLabelPanelOuterOutline.renderOrder = 1001;
vrCenterLabelPanel.add(vrCenterLabelPanelOuterOutline);

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
  line.renderOrder = 50;
  line.visible = false;
  return line;
}

const vrControllers = [];
let leftController = null;
let rightController = null;

for (let i = 0; i < 2; i += 1) {
  const controller = renderer.xr.getController(i);
  const pointerLine = createControllerPointerLine();
  controller.add(pointerLine);
  controller.addEventListener('connected', (event) => {
    pointerLine.visible = event.data?.targetRayMode === 'tracked-pointer';
    if (event.data?.handedness === 'left') {
      leftController = controller;
    } else if (event.data?.handedness === 'right') {
      rightController = controller;
    }
  });
  controller.addEventListener('disconnected', (event) => {
    pointerLine.visible = false;
    controller.userData.isSelecting = false;
    if (leftController === controller) {
      leftController = null;
    }
    if (rightController === controller) {
      rightController = null;
    }
    vrMenu.handleControllerDisconnected(controller);
  });
  controller.addEventListener('selectstart', () => {
    controller.userData.isSelecting = true;
    vrMenu.handleControllerSelect(controller);
  });
  controller.addEventListener('selectend', () => {
    controller.userData.isSelecting = false;
  });
  vrControllers.push(controller);
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
    opacity: Math.max(STAR_LAYER_OPACITY_MIN, layer.opacity * STAR_OPACITY_COMPENSATION),
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createTextSprite(label, fillStyle = 'rgba(255,255,255,0.96)', strokeStyle = 'rgba(0,0,0,0.86)') {
  const fontSpec = 'bold 98px "Noto Sans", "Noto Sans JP", "Segoe UI", sans-serif';
  const lineWidth = 12;
  const paddingX = 24;
  const paddingY = 18;

  const probe = document.createElement('canvas');
  const probeCtx = probe.getContext('2d');
  probeCtx.font = fontSpec;
  const metrics = probeCtx.measureText(label);
  const measuredWidth = Math.max(1, metrics.width + lineWidth * 2 + 8);
  const measuredHeight = Math.max(
    1,
    ((metrics.actualBoundingBoxAscent || 70) + (metrics.actualBoundingBoxDescent || 28)) + lineWidth * 2 + 8,
  );

  const cnv = document.createElement('canvas');
  cnv.width = Math.max(256, Math.ceil(measuredWidth + paddingX * 2));
  cnv.height = Math.max(128, Math.ceil(measuredHeight + paddingY * 2));
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  if (COLORIZE_LABEL_SPRITES_DEBUG) {
    ctx.fillStyle = 'rgba(255, 64, 160, 0.22)';
    ctx.strokeStyle = 'rgba(255, 120, 200, 0.55)';
    ctx.lineWidth = 2;
    ctx.fillRect(4, 4, cnv.width - 8, cnv.height - 8);
    ctx.strokeRect(4, 4, cnv.width - 8, cnv.height - 8);
  }
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;
  ctx.strokeText(label, cnv.width / 2, cnv.height / 2 + 1);
  ctx.fillText(label, cnv.width / 2, cnv.height / 2 + 1);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.userData.labelCanvasWidth = cnv.width;
  sprite.userData.labelCanvasHeight = cnv.height;
  sprite.userData.labelMeasuredWidth = measuredWidth;
  sprite.userData.labelMeasuredHeight = measuredHeight;
  return sprite;
}

function setLabelSpriteScale(sprite, baseScaleX, baseScaleY) {
  const w = Math.max(1, Number(sprite?.userData?.labelCanvasWidth) || 512);
  const h = Math.max(1, Number(sprite?.userData?.labelCanvasHeight) || 192);
  const aspect = w / h;
  const correctedX = baseScaleX * (aspect / LABEL_CANVAS_BASE_ASPECT);
  sprite.scale.set(correctedX, baseScaleY, 1.0);
}

function setVrCenterPanelLabelScale(sprite) {
  setLabelSpriteScale(sprite, VR_CENTER_PANEL_LABEL_SCALE_X, VR_CENTER_PANEL_LABEL_SCALE_Y);
}

function ensureLabelBoundsLine(index) {
  if (labelBoundsPool[index]) return labelBoundsPool[index];
  const points = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(-0.5, -0.5, 0),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xff66cc,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 45;
  labelBoundsGroup.add(line);
  labelBoundsPool[index] = line;
  return line;
}

function hideUnusedLabelBounds(fromIndex = 0) {
  for (let i = fromIndex; i < labelBoundsPool.length; i += 1) {
    if (labelBoundsPool[i]) labelBoundsPool[i].visible = false;
  }
}

function ensureLabelBoundsCanvas() {
  if (labelBoundsCanvas && labelBoundsCtx) return;
  const cnv = document.createElement('canvas');
  cnv.style.position = 'fixed';
  cnv.style.left = '0';
  cnv.style.top = '0';
  cnv.style.width = '100vw';
  cnv.style.height = '100vh';
  cnv.style.pointerEvents = 'none';
  cnv.style.zIndex = '20';
  document.body.appendChild(cnv);
  labelBoundsCanvas = cnv;
  labelBoundsCtx = cnv.getContext('2d');
}

function resizeLabelBoundsCanvas() {
  if (!labelBoundsCanvas) return;
  const w = Math.max(1, renderer.domElement?.width || Math.floor(window.innerWidth * window.devicePixelRatio));
  const h = Math.max(1, renderer.domElement?.height || Math.floor(window.innerHeight * window.devicePixelRatio));
  labelBoundsCanvas.width = w;
  labelBoundsCanvas.height = h;
}

function drawLabelBoundsOverlay(rects) {
  if (!SHOW_LABEL_BOUNDS_DEBUG_2D) return;
  ensureLabelBoundsCanvas();
  resizeLabelBoundsCanvas();
  if (!labelBoundsCtx) return;
  const ctx = labelBoundsCtx;
  ctx.clearRect(0, 0, labelBoundsCanvas.width, labelBoundsCanvas.height);
  if (!SHOW_LABEL_BOUNDS_DEBUG || !Array.isArray(rects)) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 102, 204, 0.95)';
  ctx.lineWidth = 2;
  for (const r of rects) {
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    if (w <= 0 || h <= 0) continue;
    ctx.strokeRect(r.left, r.top, w, h);
  }
  ctx.restore();
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

function createDiskSprite(fillStyle = 'rgba(235, 240, 255, 0.98)') {
  const cnv = document.createElement('canvas');
  cnv.width = 128;
  cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);

  const cx = cnv.width / 2;
  const cy = cnv.height / 2;

  // 外側の光彩（ブルーム）用の色（透明度を0にしたものを作成）
  const transparentColor = fillStyle.replace(/[\d.]+\)$/g, '0)');

  // 放射状グラデーションを作成
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 60);
  gradient.addColorStop(0.0, fillStyle);
  gradient.addColorStop(0.4, fillStyle);
  gradient.addColorStop(1.0, transparentColor);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();

  // 中心コア部分
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(cx, cy, 25, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  // AdditiveBlendingで光っている感じを強調
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
}

function getPrimaryRenderCamera() {
  if (!renderer.xr.isPresenting) return camera;
  const xrCam = renderer.xr.getCamera();
  if (!xrCam) return camera;
  if (Array.isArray(xrCam.cameras) && xrCam.cameras.length > 0) {
    return xrCam.cameras[0];
  }
  return xrCam;
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function projectToScreen(pointWorld, cam, width, height) {
  const ndc = pointWorld.clone().project(cam);
  if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y) || !Number.isFinite(ndc.z)) return null;
  if (ndc.z < -1.0 || ndc.z > 1.0) return null;
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
    ndcZ: ndc.z,
  };
}

function worldUnitsPerPixelAt(pointWorld, cam, viewportHeightPx) {
  const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  const distance = Math.max(0.1, camPos.distanceTo(pointWorld));
  const fovDeg = Number.isFinite(cam.fov) ? cam.fov : 70;
  const visibleHeight = 2.0 * distance * Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
  return visibleHeight / Math.max(1, viewportHeightPx);
}

function getLabelAnchorWorld(sprite) {
  const anchorWorld = sprite?.userData?.anchorWorld;
  if (anchorWorld instanceof THREE.Vector3) return anchorWorld.clone();
  if (sprite?.position instanceof THREE.Vector3) return sprite.position.clone();
  return null;
}

function getLabelTargetDirection(sprite) {
  const anchorWorld = getLabelAnchorWorld(sprite);
  if (!(anchorWorld instanceof THREE.Vector3)) return null;
  if (anchorWorld.lengthSq() <= 0.0) return null;
  return anchorWorld.normalize();
}

function getCurrentForwardDirection() {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  if (!cam) return new THREE.Vector3(0, 0, -1);
  const worldQuat = new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();
}

function getControllerWorldRayDirection(controller) {
  if (!controller) return null;
  const worldQuat = new THREE.Quaternion().setFromRotationMatrix(controller.matrixWorld);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();
}

function getVrCenterReferenceDirection() {
  if (!renderer.xr.isPresenting) return getCurrentForwardDirection();
  for (const controller of vrControllers) {
    if (controller?.userData?.isSelecting) {
      const rayDir = getControllerWorldRayDirection(controller);
      if (rayDir instanceof THREE.Vector3) return rayDir;
    }
  }
  return getCurrentForwardDirection();
}

function classifyVrCenterLabelCandidate(candidate, forwardDirection) {
  if (!renderer.xr.isPresenting || !(forwardDirection instanceof THREE.Vector3)) {
    return { isCenterCandidate: false, angleDeg: null };
  }

  const targetDirection = candidate.targetWorldDirection;
  if (!(targetDirection instanceof THREE.Vector3)) {
    return { isCenterCandidate: false, angleDeg: null };
  }

  const dot = THREE.MathUtils.clamp(forwardDirection.dot(targetDirection), -1.0, 1.0);
  const angleDeg = THREE.MathUtils.radToDeg(Math.acos(dot));
  const wasCenterCandidate = candidate.sprite?.userData?.isVrCenterCandidate === true;
  const thresholdDeg = wasCenterCandidate ? VR_CENTER_LABEL_EXIT_ANGLE_DEG : VR_CENTER_LABEL_ENTER_ANGLE_DEG;
  return {
    isCenterCandidate: angleDeg <= thresholdDeg,
    angleDeg,
  };
}

function isVrCenterPanelEligibleCandidate(candidate) {
  if (!candidate?.isCenterCandidate) return false;
  switch (candidate.kind) {
    case 'sun':
    case 'moon':
    case 'planet':
    case 'named-star':
      return true;
    default:
      return false;
  }
}

function shouldUseVrCenterPanelLabel(candidate) {
  return renderer.xr.isPresenting && isVrCenterPanelEligibleCandidate(candidate);
}

function updateVrCenterLabelPanelState(candidates) {
  if (!renderer.xr.isPresenting || !Array.isArray(candidates)) {
    vrCenterLabelPanel.visible = false;
    updateVrCenterTargetRings(null);
    return;
  }
  vrCenterLabelPanel.visible = candidates.some((candidate) => isVrCenterPanelEligibleCandidate(candidate));
}

function updateVrCenterTargetRings(candidates) {
  for (const ring of vrCenterTargetRings) {
    ring.visible = false;
  }
  if (!renderer.xr.isPresenting || !Array.isArray(candidates)) return;

  const targets = candidates.filter((candidate) => (
    isVrCenterPanelEligibleCandidate(candidate)
    && candidate.targetWorldPosition instanceof THREE.Vector3
  ));

  for (let i = 0; i < Math.min(vrCenterTargetRings.length, targets.length); i += 1) {
    const ring = vrCenterTargetRings[i];
    const target = targets[i];
    ring.position.copy(target.targetWorldPosition);
    ring.visible = true;
  }
}

function updateVrCenterPanelLabels(candidates) {
  for (const sprite of vrCenterPanelLabelSprites) {
    sprite.visible = false;
  }
  if (!renderer.xr.isPresenting || !Array.isArray(candidates) || !vrCenterLabelPanel.visible) return;

  const xrCam = renderer.xr.getCamera();
  if (!xrCam) return;
  const headQuat = new THREE.Quaternion().setFromRotationMatrix(xrCam.matrixWorld);
  const invHeadQuat = headQuat.clone().invert();
  const ringRadius = (VR_CENTER_PANEL_INNER_RADIUS_M + VR_CENTER_PANEL_OUTER_RADIUS_M) * 0.5;
  const topAngle = Math.PI * 0.5;

  const panelCandidates = candidates
    .filter((candidate) => shouldUseVrCenterPanelLabel(candidate) && candidate.hudSprite)
    .map((candidate) => {
      const localDir = candidate.targetWorldDirection.clone().applyQuaternion(invHeadQuat).normalize();
      return { ...candidate, localDir, preferredAngle: topAngle, finalAngle: topAngle };
    });

  if (panelCandidates.length === 1) {
    panelCandidates[0].preferredAngle = topAngle;
    panelCandidates[0].finalAngle = topAngle;
  } else if (panelCandidates.length > 1) {
    let centroidX = 0.0;
    let centroidY = 0.0;
    for (const candidate of panelCandidates) {
      centroidX += candidate.localDir.x;
      centroidY += candidate.localDir.y;
    }
    centroidX /= panelCandidates.length;
    centroidY /= panelCandidates.length;

    for (let i = 0; i < panelCandidates.length; i += 1) {
      const candidate = panelCandidates[i];
      const relX = candidate.localDir.x - centroidX;
      const relY = candidate.localDir.y - centroidY;
      const relLenSq = relX * relX + relY * relY;
      const preferredAngle = relLenSq > 1.0e-8
        ? Math.atan2(relY, relX)
        : (topAngle + (i - ((panelCandidates.length - 1) * 0.5)) * VR_CENTER_PANEL_LABEL_MIN_SEPARATION_RAD);
      candidate.preferredAngle = preferredAngle;
      candidate.finalAngle = preferredAngle;
    }
    panelCandidates.sort((a, b) => a.preferredAngle - b.preferredAngle);
  }

  for (let i = 1; i < panelCandidates.length; i += 1) {
    const prev = panelCandidates[i - 1];
    const current = panelCandidates[i];
    if ((current.finalAngle - prev.finalAngle) < VR_CENTER_PANEL_LABEL_MIN_SEPARATION_RAD) {
      current.finalAngle = prev.finalAngle + VR_CENTER_PANEL_LABEL_MIN_SEPARATION_RAD;
    }
  }
  panelCandidates.sort((a, b) => a.priority - b.priority || a.order - b.order);

  for (let i = 0; i < Math.min(vrCenterPanelLabelSprites.length, panelCandidates.length); i += 1) {
    const candidate = panelCandidates[i];
    const sprite = candidate.hudSprite;
    if (!sprite) continue;
    sprite.position.set(
      Math.cos(candidate.finalAngle) * ringRadius,
      Math.sin(candidate.finalAngle) * ringRadius,
      0.002,
    );
    sprite.visible = true;
  }
}

function updateVrCenterLabelPanelTransform() {
  if (!renderer.xr.isPresenting || !vrCenterLabelPanel.visible) {
    vrCenterLabelPanel.visible = false;
    return;
  }

  const xrCam = renderer.xr.getCamera();
  if (!xrCam) {
    vrCenterLabelPanel.visible = false;
    return;
  }

  const headPos = new THREE.Vector3().setFromMatrixPosition(xrCam.matrixWorld);
  const headQuat = new THREE.Quaternion().setFromRotationMatrix(xrCam.matrixWorld);
  const referenceDir = getVrCenterReferenceDirection();
  vrCenterLabelPanel.position.copy(headPos).add(referenceDir.multiplyScalar(VR_CENTER_PANEL_DISTANCE_M));
  vrCenterLabelPanel.quaternion.copy(headQuat);
  const panelScale = VR_CENTER_PANEL_DISTANCE_M / VR_CENTER_PANEL_REFERENCE_DISTANCE_M;
  vrCenterLabelPanel.scale.setScalar(panelScale);
}

function setLabelAnchor(sprite, position) {
  if (!ENABLE_LABEL_RENDER) {
    sprite.visible = false;
    return;
  }
  sprite.userData.anchorWorld = position.clone();
  sprite.position.copy(position);
}

function createVrSplashSprite(text) {
  const isWarning = String(text || '').includes('Runtime warning');
  const cnv = document.createElement('canvas');
  cnv.width = isWarning ? 1700 : 1280;
  cnv.height = isWarning ? 860 : 320;
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

  let fontSize = isWarning ? 64 : 86;
  const maxWidth = cnv.width * 0.9;
  while (fontSize > (isWarning ? 34 : 44)) {
    ctx.font = `bold ${fontSize}px "Noto Sans", "Noto Sans JP", sans-serif`;
    const longestLine = String(text || '').split('\n').reduce((m, line) => Math.max(m, ctx.measureText(line).width), 0);
    if (longestLine <= maxWidth) break;
    fontSize -= 4;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = isWarning ? 'top' : 'middle';
  ctx.fillStyle = 'rgba(234, 242, 255, 0.98)';
  ctx.strokeStyle = 'rgba(2, 10, 22, 0.9)';
  ctx.lineWidth = 11;
  if (!isWarning) {
    ctx.strokeText(text, cnv.width / 2, cnv.height * 0.48);
    ctx.fillText(text, cnv.width / 2, cnv.height * 0.48);
  } else {
    const lines = String(text || '').split('\n');
    const lineHeight = Math.floor(fontSize * 1.22);
    let y = 90;
    for (const line of lines) {
      ctx.strokeText(line, cnv.width / 2, y);
      ctx.fillText(line, cnv.width / 2, y);
      y += lineHeight;
    }
  }

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
  sprite.scale.set(isWarning ? 2.7 : 2.15, isWarning ? 1.25 : 0.58, 1.0);
  return sprite;
}
function updatePreviewDisplay() {
  selectedStarObject = vrMenu.getPreviewStarObject();
  starPreviewRenderer.setTarget(selectedStarObject);
  starPreviewRenderer.refresh();
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

const dsoGroup = new THREE.Group();
dsoGroup.renderOrder = -10;
scene.add(dsoGroup);
const dsoObjects = [];
let dsoLoadPromise = null;

const starMeshes = [];

function addStarLayers(layers) {
  for (const layer of layers) {
    const radius = SKY_RADIUS - 4 - starMeshes.length;
    const mesh = createStarfieldFromLayer(layer, radius);
    scene.add(mesh);
    starMeshes.push(mesh);
  }
}

async function fetchArrayBufferWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const totalHeader = response.headers.get('content-length');
  const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : NaN;
  const total = Number.isFinite(totalBytes) ? totalBytes : null;

  if (!response.body) {
    const ab = await response.arrayBuffer();
    if (onProgress) onProgress(ab.byteLength, total ?? ab.byteLength);
    return ab;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.byteLength;
    if (onProgress) onProgress(loaded, total);
  }

  const merged = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  if (onProgress) onProgress(loaded, total ?? loaded);
  return merged.buffer;
}

function loadBinaryLayers(url, label) {
  return async (onProgress = null) => {
    const buffer = await fetchArrayBufferWithProgress(url, onProgress);
    const view = new DataView(buffer);
    let off = 0;

    const magic = view.getUint32(off, true);
    off += 4;
    if (magic !== 0x3156535a) {
      throw new Error(`Invalid ${label} binary magic`);
    }
    const layerCount = view.getUint32(off, true);
    off += 4;

    const headerBytes = 8 + layerCount * 12;
    if (buffer.byteLength < headerBytes) {
      throw new Error(`Truncated ${label} binary header`);
    }

    const layerMeta = [];
    let usedRows = 0;
    for (let i = 0; i < layerCount; i += 1) {
      const size = view.getFloat32(off, true);
      off += 4;
      const opacity = view.getFloat32(off, true);
      off += 4;
      const starCount = view.getUint32(off, true);
      off += 4;
      layerMeta.push({ size, opacity, starCount });
      usedRows += starCount;
    }

    let byteOff = headerBytes;
    const layers = [];
    for (let i = 0; i < layerCount; i += 1) {
      const m = layerMeta[i];
      const vecLen = m.starCount * 3;
      const posBytes = vecLen * 4;
      const colBytes = vecLen * 4;
      if (byteOff + posBytes + colBytes > buffer.byteLength) {
        throw new Error(`Truncated ${label} binary payload`);
      }
      const positions = new Float32Array(buffer, byteOff, vecLen);
      byteOff += posBytes;
      const colors = new Float32Array(buffer, byteOff, vecLen);
      byteOff += colBytes;
      layers.push({
        name: `l${String(i).padStart(2, '0')}`,
        size: m.size,
        opacity: m.opacity,
        positions,
        colors,
      });
    }

    return { layers, usedRows };
  };
}

async function loadBaseBinaryLayers(onProgress = null) {
  if (!baseBinaryLoadPromise) {
    baseBinaryLoadPromise = loadBinaryLayers(BASE_BIN_URL, 'base')(onProgress);
  }
  return baseBinaryLoadPromise;
}

async function loadExtra7BinaryLayers(onProgress = null) {
  if (!extra7BinaryLoadPromise) {
    extra7BinaryLoadPromise = loadBinaryLayers(EXTRA7_BIN_URL, 'extra-7')(onProgress);
  }
  return extra7BinaryLoadPromise;
}

async function loadExtra8BinaryLayers(onProgress = null) {
  if (!extra8BinaryLoadPromise) {
    extra8BinaryLoadPromise = loadBinaryLayers(EXTRA8_BIN_URL, 'extra-8')(onProgress);
  }
  return extra8BinaryLoadPromise;
}

async function loadExtra9BinaryLayers(onProgress = null) {
  if (!extra9BinaryLoadPromise) {
    extra9BinaryLoadPromise = loadBinaryLayers(EXTRA9_BIN_URL, 'extra-9')(onProgress);
  }
  return extra9BinaryLoadPromise;
}

async function ensureBaseStarsLoaded() {
  if (baseStarsLoaded) return true;
  const base = await loadBaseBinaryLayers();
  addStarLayers(base.layers);
  displayedStarCount += base.usedRows;
  loadedMaxMag = Math.max(loadedMaxMag, DEFAULT_MAX_MAG);
  baseStarsLoaded = true;
  return true;
}

async function loadExtra10BinaryLayers(onProgress = null) {
  if (!extra10BinaryLoadPromise) {
    extra10BinaryLoadPromise = loadBinaryLayers(EXTRA10_BIN_URL, 'extra-10')(onProgress);
  }
  return extra10BinaryLoadPromise;
}
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
labelBoundsGroup = new THREE.Group();
labelBoundsGroup.visible = SHOW_LABEL_BOUNDS_DEBUG && SHOW_LABEL_BOUNDS_DEBUG_3D;
solarSystemGroup.add(labelBoundsGroup);

const sunSprite = createCircleOutlineSprite('rgba(255, 214, 120, 0.98)');
const moonSprite = createCircleOutlineSprite('rgba(206, 220, 255, 0.98)');
const sunLabel = createTextSprite('Sun', 'rgba(255,228,166,0.98)');
setLabelSpriteScale(sunLabel, LABEL_SCALE_X, LABEL_SCALE_Y);
const moonLabel = createTextSprite('Moon', 'rgba(206,220,255,0.98)');
setLabelSpriteScale(moonLabel, LABEL_SCALE_X, LABEL_SCALE_Y);
const sunHudLabel = createTextSprite('Sun', 'rgba(255,228,166,0.98)');
setVrCenterPanelLabelScale(sunHudLabel);
sunHudLabel.visible = false;
const moonHudLabel = createTextSprite('Moon', 'rgba(206,220,255,0.98)');
setVrCenterPanelLabelScale(moonHudLabel);
moonHudLabel.visible = false;
solarSystemGroup.add(sunSprite);
solarSystemGroup.add(moonSprite);
solarSystemGroup.add(sunLabel);
solarSystemGroup.add(moonLabel);
vrCenterLabelPanel.add(sunHudLabel);
vrCenterLabelPanel.add(moonHudLabel);
vrCenterPanelLabelSprites.push(sunHudLabel, moonHudLabel);

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
  setLabelSpriteScale(label, LABEL_SCALE_X, LABEL_SCALE_Y);
  setLabelAnchor(label, altAzToVector(0.0, d.az, SYMBOL_RADIUS));
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
  const marker = createDiskSprite(def.color);
  marker.scale.set(1.0, 1.0, 1.0);
  const label = createTextSprite(def.label, PLANET_LABEL_COLOR);
  setLabelSpriteScale(label, LABEL_SCALE_X, LABEL_SCALE_Y);
  const hudLabel = createTextSprite(def.label, PLANET_LABEL_COLOR);
  setVrCenterPanelLabelScale(hudLabel);
  hudLabel.visible = false;
  solarSystemGroup.add(marker);
  solarSystemGroup.add(label);
  vrCenterLabelPanel.add(hudLabel);
  vrCenterPanelLabelSprites.push(hudLabel);
  return { ...def, marker, label, hudLabel };
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

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function isNamedDso(name, id) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (DSO_CATALOG_LIKE_NAME_RE.test(n)) return false;
  const i = String(id || '').trim();
  return n.toLowerCase() !== i.toLowerCase();
}

function dsoWorldDiameterFromArcmin(arcmin, gain = 1.0) {
  const deg = (arcmin / 60.0) * gain;
  const theta = THREE.MathUtils.degToRad(deg);
  return 2.0 * SYMBOL_RADIUS * Math.tan(theta * 0.5);
}

function createUnitEllipseMesh(fillColor, fillOpacity) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 1, 1, 0, Math.PI * 2, false, 0);
  const geometry = new THREE.ShapeGeometry(shape, 60);
  const material = new THREE.MeshBasicMaterial({
    color: fillColor,
    transparent: true,
    opacity: fillOpacity,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -6;
  return mesh;
}

function createUnitEllipseOutline(color, opacity, lineWidth = 2.6) {
  const points = [];
  const samples = 84;
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: lineWidth,
    depthWrite: false,
    depthTest: false,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = -5;
  line.visible = false;
  return line;
}

async function ensureDsoLoaded() {
  if (dsoLoadPromise) return dsoLoadPromise;
  dsoLoadPromise = (async () => {
    const res = await fetch(DSO_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load DSO catalog: HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return true;
    const header = parseCsvLine(lines[0]);
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));

    for (let i = 1; i < lines.length; i += 1) {
      const row = parseCsvLine(lines[i]);
      const id = row[idx.Id] || '';
      const name = row[idx.Name] || '';
      if (!isNamedDso(name, id)) continue;

      const majorArcmin = Number.parseFloat(row[idx.MajorArcmin] || 'NaN');
      const minorArcmin = Number.parseFloat(row[idx.MinorArcmin] || 'NaN');
      if (!Number.isFinite(majorArcmin) || !Number.isFinite(minorArcmin)) continue;
      if (majorArcmin < DSO_SHAPE_MIN_MAJOR_ARCMIN || minorArcmin <= 0) continue;

      const raHours = Number.parseFloat(row[idx.RAh] || 'NaN');
      const decDeg = Number.parseFloat(row[idx.Dec] || 'NaN');
      if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) continue;

      const paDeg = Number.parseFloat(row[idx.PAdeg] || '0');
      const eqCenter = raDecToUnitVector(raHours, decDeg).normalize();
      const decOffset = Math.max(-89.9, Math.min(89.9, decDeg + 0.08));
      const northProbeEq = raDecToUnitVector(raHours, decOffset).normalize();
      const cosDec = Math.max(0.15, Math.cos(THREE.MathUtils.degToRad(decDeg)));
      const eastProbeEq = raDecToUnitVector((raHours + (0.08 / 15.0) / cosDec + 24.0) % 24.0, decDeg).normalize();

      const majorDiameter = dsoWorldDiameterFromArcmin(majorArcmin, 1.0);
      const minorDiameter = dsoWorldDiameterFromArcmin(minorArcmin, 1.0);
      const fillOpacity = Math.min(0.24, Math.max(0.1, 0.22 - 0.04 * Math.sqrt(Math.max(0, majorArcmin / 60.0))));
      const fillMesh = createUnitEllipseMesh(0x6cb9ff, fillOpacity);
      fillMesh.scale.set(Math.max(0.45, majorDiameter * 0.5), Math.max(0.4, minorDiameter * 0.5), 1.0);

      const hoverOutline = createUnitEllipseOutline(0x72c6ff, 0.95, 2.8);
      hoverOutline.scale.set(
        Math.max(0.45, majorDiameter * 0.5 * DSO_HOVER_SIZE_GAIN),
        Math.max(0.4, minorDiameter * 0.5 * DSO_HOVER_SIZE_GAIN),
        1.0,
      );

      const label = createTextSprite(String(name), 'rgba(117, 204, 255, 0.98)', 'rgba(5, 18, 35, 0.90)');
      setLabelSpriteScale(label, FAMOUS_LABEL_SCALE_X, LABEL_SCALE_Y);
      label.visible = false;

      dsoGroup.add(fillMesh);
      dsoGroup.add(hoverOutline);
      solarSystemGroup.add(label);

      dsoObjects.push({
        id: String(id),
        name: String(name),
        paDeg: Number.isFinite(paDeg) ? paDeg : 0.0,
        majorArcmin,
        minorArcmin,
        majorDiameter,
        minorDiameter,
        eqCenter,
        northProbeEq,
        eastProbeEq,
        worldDirection: eqCenter.clone(),
        fillMesh,
        hoverOutline,
        label,
      });
    }
    return true;
  })().catch((e) => {
    console.warn('Failed to load DSO catalog:', e);
    return true;
  });

  return dsoLoadPromise;
}

const famousStarObjects = FAMOUS_STARS.map((def) => {
  const equatorialDirection = raDecToUnitVector(def.raHours, def.decDeg).normalize();
  const worldDirection = equatorialDirection.clone();
  const label = createTextSprite(def.name, 'rgba(234,242,255,0.98)');
  setLabelSpriteScale(label, FAMOUS_LABEL_SCALE_X, LABEL_SCALE_Y);
  setLabelAnchor(label, worldDirection.clone().multiplyScalar(SYMBOL_RADIUS));
  label.visible = false;
  const hudLabel = createTextSprite(def.name, 'rgba(234,242,255,0.98)');
  setVrCenterPanelLabelScale(hudLabel);
  hudLabel.visible = false;
  solarSystemGroup.add(label);
  vrCenterLabelPanel.add(hudLabel);
  vrCenterPanelLabelSprites.push(hudLabel);

  return { ...def, equatorialDirection, worldDirection, label, hudLabel, highlightUntilMs: 0 };
});
const famousSourceIds = new Set(
  famousStarObjects
    .map((s) => String(s.sourceId || '').trim().toUpperCase())
    .filter(Boolean),
);
const asterismOnlyStarObjects = ASTERISM_STARS
  .filter((def) => {
    const sid = String(def.sourceId || '').trim().toUpperCase();
    return sid && !famousSourceIds.has(sid);
  })
  .map((def) => {
    const equatorialDirection = raDecToUnitVector(def.raHours, def.decDeg).normalize();
    return { ...def, equatorialDirection, worldDirection: equatorialDirection.clone() };
  });
const asterismStarObjects = [...famousStarObjects, ...asterismOnlyStarObjects];
const hoverSelectableStarObjects = asterismStarObjects;
const starPreviewRenderer = createStarPreviewRenderer({
  solarSystemGroup,
  symbolRadius: SYMBOL_RADIUS,
  createCircleOutlineSprite,
  getCurrentForwardDirection,
  setStatus,
  arcConfig: {
    minSegments: 64,
    maxSegments: 96,
    widthDeg: 0.2,
    skipThresholdDeg: 1.0,
  },
});
const vrMenu = createVrMenu({
  scene,
  renderer,
  appVersion: APP_VERSION,
  famousStarObjects,
  getDisplayOptions: () => displayOptions,
  onToggleDisplayOption: (optionKey) => {
    if (!(optionKey in displayOptions)) return;
    displayOptions[optionKey] = !displayOptions[optionKey];
    applyDisplayOptions();
    setStatus(`${optionKey === 'dso' ? 'DSO' : 'Asterisms'} ${displayOptions[optionKey] ? 'shown' : 'hidden'}`);
  },
  setStatus,
  createCircleOutlineSprite,
  onStateChange: () => updatePreviewDisplay(),
});
({ asterismObjects, asterismKeysBySourceId } = buildAsterismsFromStars({
  definitions: ASTERISM_DEFS,
  stars: asterismStarObjects,
  createLabel: (def) => {
    const label = createTextSprite(def.name, ASTERISM_LABEL_COLOR, ASTERISM_LABEL_OUTLINE);
    setLabelSpriteScale(label, FAMOUS_LABEL_SCALE_X, LABEL_SCALE_Y);
    label.visible = false;
    solarSystemGroup.add(label);
    return label;
  },
}));
const asterismRenderer = createAsterismRenderer({
  solarSystemGroup,
  symbolRadius: SYMBOL_RADIUS,
  setLabelAnchor,
  config: {
    rotateSlotMs: ASTERISM_ROTATE_SLOT_MS,
    ambientLineOpacity: ASTERISM_AMBIENT_LINE_OPACITY,
    ambientLineColor: ASTERISM_AMBIENT_LINE_COLOR,
    ambientLineWidthPx: ASTERISM_AMBIENT_LINE_WIDTH_PX,
    highlightLineOpacity: ASTERISM_LINE_OPACITY,
    highlightLineColor: ASTERISM_LINE_COLOR,
    highlightLineWidthPx: ASTERISM_HIGHLIGHT_LINE_WIDTH_PX,
  },
});
asterismRenderer.attach({ objects: asterismObjects, keysBySourceId: asterismKeysBySourceId });

function applyDisplayOptions() {
  dsoGroup.visible = displayOptions.dso;
  if (!displayOptions.dso) {
    for (const dso of dsoObjects) {
      dso.hoverOutline.visible = false;
      dso.label.visible = false;
    }
  }
  asterismRenderer.setVisible(displayOptions.asterisms);
}

applyDisplayOptions();

const zenithMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
zenithMarker.scale.set(4.2, 4.2, 1.0);
zenithMarker.position.set(0, SYMBOL_RADIUS, 0);
solarSystemGroup.add(zenithMarker);

const nadirMarker = createCrossMarkerSprite('rgba(210, 244, 255, 0.96)');
nadirMarker.scale.set(4.2, 4.2, 1.0);
nadirMarker.position.set(0, -SYMBOL_RADIUS, 0);
solarSystemGroup.add(nadirMarker);

for (let i = 0; i < 2; i += 1) {
  const ring = createCircleOutlineSprite('rgba(255, 255, 255, 0.98)');
  ring.scale.set(8.4, 8.4, 1.0);
  ring.visible = false;
  ring.renderOrder = 36;
  solarSystemGroup.add(ring);
  pointerHoverCircles.push(ring);
}

for (let i = 0; i < 10; i += 1) {
  const ring = createCircleOutlineSprite('rgba(196, 232, 255, 0.96)');
  ring.scale.set(VR_CENTER_TARGET_RING_SCALE, VR_CENTER_TARGET_RING_SCALE, 1.0);
  ring.visible = false;
  ring.renderOrder = 37;
  solarSystemGroup.add(ring);
  vrCenterTargetRings.push(ring);
}

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
    setLabelAnchor(star.label, star.worldDirection.clone().multiplyScalar(SYMBOL_RADIUS));
  }
  for (const star of asterismOnlyStarObjects) {
    star.worldDirection.copy(star.equatorialDirection).applyQuaternion(equatorialRotation).normalize();
  }
  asterismRenderer.refreshAmbientOverlays();

  for (const dso of dsoObjects) {
    dso.worldDirection.copy(dso.eqCenter).applyQuaternion(equatorialRotation).normalize();

    const northProbe = dso.northProbeEq.clone().applyQuaternion(equatorialRotation).normalize();
    const eastProbe = dso.eastProbeEq.clone().applyQuaternion(equatorialRotation).normalize();

    const north = northProbe.clone().addScaledVector(dso.worldDirection, -northProbe.dot(dso.worldDirection));
    if (north.lengthSq() < 1e-7) {
      north.set(0, 1, 0).addScaledVector(dso.worldDirection, -dso.worldDirection.y);
    }
    north.normalize();

    const east = eastProbe.clone().addScaledVector(dso.worldDirection, -eastProbe.dot(dso.worldDirection));
    if (east.lengthSq() < 1e-7) {
      east.crossVectors(north, dso.worldDirection);
    }
    east.normalize();

    const paRad = THREE.MathUtils.degToRad(dso.paDeg);
    const majorAxis = north.clone().multiplyScalar(Math.cos(paRad)).add(east.clone().multiplyScalar(Math.sin(paRad))).normalize();
    const minorAxis = north.clone().multiplyScalar(-Math.sin(paRad)).add(east.clone().multiplyScalar(Math.cos(paRad))).normalize();

    const basis = new THREE.Matrix4().makeBasis(majorAxis, minorAxis, dso.worldDirection);
    const p = dso.worldDirection.clone().multiplyScalar(SYMBOL_RADIUS - 0.8);

    dso.fillMesh.position.copy(p);
    dso.fillMesh.setRotationFromMatrix(basis);

    dso.hoverOutline.position.copy(p);
    dso.hoverOutline.setRotationFromMatrix(basis);

    const labelPos = dso.worldDirection.clone().multiplyScalar(SYMBOL_RADIUS + 0.6);
    setLabelAnchor(dso.label, labelPos);
  }
}

function placeBodySprite({ body, sprite, minAlt = -0.8, alwaysVisible = false }) {
  const now = new Date();
  const equ = Astronomy.Equator(body, now, observer, true, true);
  const hor = Astronomy.Horizon(now, observer, equ.ra, equ.dec, 'normal');

  let mag = null;
  try {
    const ill = Astronomy.Illumination(body, now);
    mag = ill.mag;
  } catch (e) {
    // Some bodies might not have illumination/magnitude data
  }

  if (!alwaysVisible && hor.altitude <= minAlt) {
    sprite.visible = false;
    return;
  }
  sprite.visible = true;
  const pos = altAzToVector(hor.altitude, hor.azimuth, SYMBOL_RADIUS);
  sprite.position.copy(pos);
  return { dist: equ.dist, altitude: hor.altitude, azimuth: hor.azimuth, mag };
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
    setLabelAnchor(sunLabel, altAzToVector(sunPos.altitude + LABEL_ALT_OFFSET_DEG, sunPos.azimuth, SYMBOL_RADIUS));
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
    setLabelAnchor(moonLabel, altAzToVector(moonPos.altitude + LABEL_ALT_OFFSET_DEG, moonPos.azimuth, SYMBOL_RADIUS));
        zenithMarker.scale.set(scale, scale, 1.0);
    nadirMarker.scale.set(scale, scale, 1.0);
    updateHorizonTicksByAngularSize(deg * 2.0);
  } else {
    moonLabel.visible = false;
    const fallbackScale = spriteScaleFromAngularDiameter(0.52, SYMBOL_RADIUS);
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

        if (pos.mag != null) {
      // Planet scale based on magnitude.
      // Clip at -1.5 magnitude so bright planets (like Venus) don't get too large.
      // They will instead look brighter via bloom effect.
      const effectiveMag = Math.max(-1.5, pos.mag);
      const pScale = Math.max(0.6, 3.2 - 0.4 * effectiveMag) * (SYMBOL_RADIUS / 450) * PLANET_MARKER_SCALE;
      planet.marker.scale.set(pScale, pScale, 1.0);
    } else {
      planet.marker.scale.set(1.5 * PLANET_MARKER_SCALE, 1.5 * PLANET_MARKER_SCALE, 1.0);
    }

    planet.label.visible = true;
    const labelPos = altAzToVector(pos.altitude + LABEL_ALT_OFFSET_DEG, pos.azimuth, SYMBOL_RADIUS);
    setLabelAnchor(planet.label, labelPos);
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

function spriteHitCos(sprite, minHitAngleDeg = BODY_POINTER_HIT_MIN_ANGLE_DEG) {
  if (!sprite) return 1.0;
  const diameter = Math.max(0.2, Number(sprite.scale?.x) || 0.2);
  const angularDeg = THREE.MathUtils.radToDeg(2.0 * Math.atan((diameter * 0.5) / SYMBOL_RADIUS));
  const hitAngleDeg = Math.max(minHitAngleDeg, angularDeg * 1.2);
  return Math.cos(THREE.MathUtils.degToRad(hitAngleDeg));
}

function updatePointerHoverCircles(xrFrame) {
  for (const ring of pointerHoverCircles) {
    ring.visible = false;
  }

  if (!renderer.xr.isPresenting) return;
  const rayDirs = getControllerRayDirections(xrFrame);
  if (!rayDirs || rayDirs.length === 0) return;

  const candidates = [];
  for (const star of hoverSelectableStarObjects) {
    candidates.push({
      direction: star.worldDirection,
      hitCos: FAMOUS_STAR_HIT_COS,
      ringScale: 8.4,
    });
  }
  if (sunSprite.visible) {
    candidates.push({
      direction: sunSprite.position.clone().normalize(),
      hitCos: spriteHitCos(sunSprite, 1.0),
      ringScale: Math.max(8.4, Number(sunSprite.scale?.x) * 2.6),
    });
  }
  if (moonSprite.visible) {
    candidates.push({
      direction: moonSprite.position.clone().normalize(),
      hitCos: spriteHitCos(moonSprite, 1.0),
      ringScale: Math.max(8.4, Number(moonSprite.scale?.x) * 2.6),
    });
  }
  for (const planet of planetObjects) {
    if (!planet.marker.visible) continue;
    candidates.push({
      direction: planet.marker.position.clone().normalize(),
      hitCos: spriteHitCos(planet.marker, BODY_POINTER_HIT_MIN_ANGLE_DEG),
      ringScale: Math.max(8.0, Number(planet.marker.scale?.x) * 2.5),
    });
  }

  for (let rayIndex = 0; rayIndex < Math.min(pointerHoverCircles.length, rayDirs.length); rayIndex += 1) {
    const rayDir = rayDirs[rayIndex];
    let best = null;
    let bestDot = -1;
    for (const c of candidates) {
      const dot = rayDir.dot(c.direction);
      if (dot > c.hitCos && dot > bestDot) {
        bestDot = dot;
        best = c;
      }
    }
    if (!best) continue;
    const ring = pointerHoverCircles[rayIndex];
    if (!ring) continue;
    if (!Number.isFinite(best.ringScale) || best.ringScale <= 0) continue;
    ring.visible = true;
    ring.scale.set(best.ringScale, best.ringScale, 1.0);
    ring.position.copy(best.direction).multiplyScalar(SYMBOL_RADIUS - 0.18);
  }
}

function updateDsoHoverLabels(xrFrame) {
  for (const dso of dsoObjects) {
    dso.hoverOutline.visible = false;
    dso.label.visible = false;
  }
  if (!displayOptions.dso) return;
  if (!ENABLE_LABEL_RENDER) return;

  if (!renderer.xr.isPresenting) return;

  const rayDirs = getControllerRayDirections(xrFrame);
  if (!rayDirs || rayDirs.length === 0) return;

  let best = null;
  let bestDot = -1;

  for (const dso of dsoObjects) {
    const majorDeg = dso.majorArcmin / 60.0;
    const hitAngleDeg = Math.max(DSO_HIT_MIN_ANGLE_DEG, majorDeg * 0.6);
    const hitCos = Math.cos(THREE.MathUtils.degToRad(hitAngleDeg));
    for (const rayDir of rayDirs) {
      const dot = rayDir.dot(dso.worldDirection);
      if (dot > hitCos && dot > bestDot) {
        bestDot = dot;
        best = dso;
      }
    }
  }

  if (best) {
    best.hoverOutline.visible = true;
    best.label.visible = true;
  }
}

function updateFamousStarHoverLabels(xrFrame) {
  hoveredAsterismStar = null;
  if (!ENABLE_LABEL_RENDER) {
    for (const star of famousStarObjects) {
      star.label.visible = false;
    }
    return;
  }
  const nowMs = performance.now();
  const shouldKeepVisible = (star) => star.highlightUntilMs > nowMs || (vrMenu.isVisible() && star === selectedStarObject);
  if (!renderer.xr.isPresenting) {
    for (const star of famousStarObjects) {
      star.label.visible = shouldKeepVisible(star);
    }
    return;
  }

  for (const star of famousStarObjects) {
    star.label.visible = shouldKeepVisible(star);
  }

  const rayDirs = getControllerRayDirections(xrFrame);
  if (!rayDirs || rayDirs.length === 0) return;

  let bestStar = null;
  let bestDot = FAMOUS_STAR_HIT_COS;

  for (const star of hoverSelectableStarObjects) {
    for (const rayDir of rayDirs) {
      const dot = rayDir.dot(star.worldDirection);
      if (dot > bestDot) {
        bestDot = dot;
        bestStar = star;
      }
    }
  }

  if (bestStar) {
    hoveredAsterismStar = bestStar;
  }
}

function updateAsterismHoverOverlay() {
  asterismRenderer.updateHover(hoveredAsterismStar, ENABLE_LABEL_RENDER && displayOptions.asterisms);
}

function collectLabelLayoutCandidates() {
  const candidates = [];
  let displayOrder = 0;
  const nowMs = performance.now();
  const pushCandidate = (candidate) => {
    candidates.push({ ...candidate, order: displayOrder });
    displayOrder += 1;
  };

  if (sunSprite.visible) {
    pushCandidate({
      kind: 'sun',
      sprite: sunLabel,
      hudSprite: sunHudLabel,
      baseVisible: true,
      priority: 0,
      hideOnOverlap: false,
      targetWorldPosition: sunSprite.position.clone(),
      targetWorldDirection: getLabelTargetDirection(sunLabel),
    });
  }
  if (moonSprite.visible) {
    pushCandidate({
      kind: 'moon',
      sprite: moonLabel,
      hudSprite: moonHudLabel,
      baseVisible: true,
      priority: 0,
      hideOnOverlap: false,
      targetWorldPosition: moonSprite.position.clone(),
      targetWorldDirection: getLabelTargetDirection(moonLabel),
    });
  }
  for (let i = 0; i < planetObjects.length; i += 1) {
    const p = planetObjects[i];
    // Keep planet labels visible in close conjunctions by allowing fallback placement.
    if (p.marker.visible) {
      pushCandidate({
        kind: 'planet',
        sprite: p.label,
        hudSprite: p.hudLabel,
        baseVisible: true,
        priority: 1,
        hideOnOverlap: false,
        targetWorldPosition: p.marker.position.clone(),
        targetWorldDirection: getLabelTargetDirection(p.label),
      });
    }
  }
  const activeAsterismLabel = asterismRenderer.getActiveAsterism()?.label;
  if (activeAsterismLabel?.visible) {
    pushCandidate({
      kind: 'asterism',
      sprite: activeAsterismLabel,
      baseVisible: true,
      priority: 2,
      hideOnOverlap: false,
      targetWorldDirection: getLabelTargetDirection(activeAsterismLabel),
    });
  }
  for (const dso of dsoObjects) {
    if (dso.label.visible) {
      pushCandidate({
        kind: 'dso',
        sprite: dso.label,
        baseVisible: true,
        priority: 3,
        hideOnOverlap: false,
        targetWorldDirection: getLabelTargetDirection(dso.label),
      });
    }
  }
  for (const star of famousStarObjects) {
    const baseVisible = star.label.visible;
    if (baseVisible || renderer.xr.isPresenting) {
      pushCandidate({
        kind: 'named-star',
        sprite: star.label,
        hudSprite: star.hudLabel,
        baseVisible,
        priority: 4,
        hideOnOverlap: false,
        isSelected: star === selectedStarObject,
        isHighlighted: hoveredAsterismStar === star || star.highlightUntilMs > nowMs,
        targetWorldPosition: star.worldDirection.clone().multiplyScalar(SYMBOL_RADIUS),
        targetWorldDirection: getLabelTargetDirection(star.label),
      });
    }
  }

  candidates.sort((a, b) => {
    const pa = Number.isFinite(a.priority) ? a.priority : 999;
    const pb = Number.isFinite(b.priority) ? b.priority : 999;
    if (pa !== pb) return pa - pb;
    const oa = Number.isFinite(a.order) ? a.order : 0;
    const ob = Number.isFinite(b.order) ? b.order : 0;
    return oa - ob;
  });
  return candidates;
}

function applyLabelLayout() {
  if (!ENABLE_LABEL_RENDER) {
    hideUnusedLabelBounds(0);
    drawLabelBoundsOverlay([]);
    return;
  }
  const cam = getPrimaryRenderCamera();
  if (!cam) return;

  const viewportWidth = renderer.domElement?.width || window.innerWidth;
  const viewportHeight = renderer.domElement?.height || window.innerHeight;
  const candidates = collectLabelLayoutCandidates();
  const forwardDirection = renderer.xr.isPresenting ? getVrCenterReferenceDirection() : null;
  const debugRectIndex = 0;
  const debugRects2d = [];

  for (const cand of candidates) {
    const sprite = cand.sprite;
    const centerState = classifyVrCenterLabelCandidate(cand, forwardDirection);
    cand.isCenterCandidate = centerState.isCenterCandidate;
    cand.centerAngleDeg = centerState.angleDeg;
    sprite.userData.isVrCenterCandidate = centerState.isCenterCandidate;
    sprite.userData.vrCenterAngleDeg = centerState.angleDeg;

    const basePos = getLabelAnchorWorld(sprite);
    if (!(basePos instanceof THREE.Vector3)) {
      sprite.visible = false;
      sprite.userData.layoutOffsetPx = null;
      continue;
    }
    const baseProjection = projectToScreen(basePos, cam, viewportWidth, viewportHeight);
    if (!baseProjection) {
      sprite.visible = false;
      sprite.userData.layoutOffsetPx = null;
      continue;
    }
    sprite.position.copy(basePos);
    sprite.userData.layoutOffsetPx = [0, 0];
    sprite.visible = Boolean(cand.baseVisible) && !shouldUseVrCenterPanelLabel(cand);
  }

  updateVrCenterLabelPanelState(candidates);
  updateVrCenterTargetRings(candidates);
  updateVrCenterPanelLabels(candidates);

  hideUnusedLabelBounds(debugRectIndex);
  drawLabelBoundsOverlay(debugRects2d);
}

let lastSolarUpdateMs = 0;
let vrSplashSprite = null;
let vrSplashUntilMs = 0;
let vrSplashText = '';

let session = null;

function setStatus(text) {
  statusEl.textContent = `Status: v${APP_VERSION} | ${text}`;
}

function clearVrSplash() {
  if (!vrSplashSprite) return;
  scene.remove(vrSplashSprite);
  vrSplashSprite = null;
  vrSplashUntilMs = 0;
  vrSplashText = '';
}

function showVrSplash(text, durationMs) {
  clearVrSplash();
  vrSplashSprite = createVrSplashSprite(text);
  scene.add(vrSplashSprite);
  vrSplashUntilMs = Number.isFinite(durationMs) ? performance.now() + durationMs : Number.POSITIVE_INFINITY;
  vrSplashText = text;
}

function updateVrSplash(text) {
  if (!renderer.xr.isPresenting) return;
  if (vrSplashUntilMs !== Number.POSITIVE_INFINITY) return;
  if (!vrSplashSprite || vrSplashText !== text) {
    showVrSplash(text, Number.POSITIVE_INFINITY);
  }
}

function reportRuntimeWarning(context, error) {
  const detail = error instanceof Error ? (error.message || error.name) : String(error);
  const text = `${context}: ${detail}`.slice(0, 320);
  if (text === lastRuntimeWarning) return;
  lastRuntimeWarning = text;
  setStatus(`Runtime warning (${text})`);
  if (renderer.xr.isPresenting) {
    showVrSplash(`Runtime warning\n${text}\n(capture this screen)`, Number.POSITIVE_INFINITY);
  }
}

function safeCall(context, fn) {
  try {
    fn();
    return true;
  } catch (error) {
    reportRuntimeWarning(context, error);
    return false;
  }
}

function formatBytesMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function hasAllRequestedStarDataLoaded() {
  return !shouldLoadExtraStars || loadedMaxMag >= requestedMaxMag;
}

function buildEnterVrSplashText() {
  const base = locationSummaryText || activeLocation.name;
  if (hasAllRequestedStarDataLoaded()) {
    return `${base} / star data ready (maxMag ${loadedMaxMag.toFixed(1)})`;
  }
  return base;
}

async function ensureExtendedStarsLoaded() {
  if (!shouldLoadExtraStars || loadedMaxMag >= requestedMaxMag) return true;
  if (extendedStarsLoadPromise) return extendedStarsLoadPromise;

  extendedStarsLoading = true;
  extendedStarsLoadPromise = (async () => {
    const pendingLabels = [];
    if (requestedMaxMag >= EXTENDED_MAX_MAG_7 && !extra7StarsLoaded) pendingLabels.push('extra-7');
    if (requestedMaxMag >= EXTENDED_MAX_MAG_8 && !extra8StarsLoaded) pendingLabels.push('extra-8');
    if (requestedMaxMag >= EXTENDED_MAX_MAG_9 && !extra9StarsLoaded) pendingLabels.push('extra-9');
    if (requestedMaxMag >= EXTENDED_MAX_MAG_10 && !extra10StarsLoaded) pendingLabels.push('extra-10');
    const totalSteps = Math.max(1, pendingLabels.length);
    let stepIndex = 0;
    let lastProgressUpdateMs = 0;

    const makeProgressHandler = (label) => (loaded, total) => {
      const now = performance.now();
      const hasTotal = Number.isFinite(total) && total > 0;
      const pct = hasTotal ? Math.min(100, Math.round((loaded / total) * 100)) : null;
      if ((now - lastProgressUpdateMs) < 120 && pct !== 100) return;
      lastProgressUpdateMs = now;
      const prefix = `Loading star data (${stepIndex}/${totalSteps})`;
      const text = hasTotal
        ? `${prefix} ${label}: ${pct}%`
        : `${prefix} ${label}: ${formatBytesMiB(loaded)}`;
      updateVrSplash(text);
      setStatus(text);
    };

    if (requestedMaxMag >= EXTENDED_MAX_MAG_7 && !extra7StarsLoaded) {
      stepIndex += 1;
      const extra7 = await loadExtra7BinaryLayers(makeProgressHandler('extra-7'));
      addStarLayers(extra7.layers);
      displayedStarCount += extra7.usedRows;
      loadedMaxMag = Math.max(loadedMaxMag, EXTENDED_MAX_MAG_7);
      extra7StarsLoaded = true;
    }
    if (requestedMaxMag >= EXTENDED_MAX_MAG_8 && !extra8StarsLoaded) {
      stepIndex += 1;
      const extra8 = await loadExtra8BinaryLayers(makeProgressHandler('extra-8'));
      addStarLayers(extra8.layers);
      displayedStarCount += extra8.usedRows;
      loadedMaxMag = Math.max(loadedMaxMag, EXTENDED_MAX_MAG_8);
      extra8StarsLoaded = true;
    }
    if (requestedMaxMag >= EXTENDED_MAX_MAG_9 && !extra9StarsLoaded) {
      stepIndex += 1;
      const extra9 = await loadExtra9BinaryLayers(makeProgressHandler('extra-9'));
      addStarLayers(extra9.layers);
      displayedStarCount += extra9.usedRows;
      loadedMaxMag = Math.max(loadedMaxMag, EXTENDED_MAX_MAG_9);
      extra9StarsLoaded = true;
    }
    if (requestedMaxMag >= EXTENDED_MAX_MAG_10 && !extra10StarsLoaded) {
      stepIndex += 1;
      const extra10 = await loadExtra10BinaryLayers(makeProgressHandler('extra-10'));
      addStarLayers(extra10.layers);
      displayedStarCount += extra10.usedRows;
      loadedMaxMag = Math.max(loadedMaxMag, EXTENDED_MAX_MAG_10);
      extra10StarsLoaded = true;
    }
    return true;
  })()
    .catch((error) => {
      console.warn('Failed to load extended star catalog:', error);
      return true;
    })
    .finally(() => {
      extendedStarsLoading = false;
      extendedStarsLoadPromise = null;
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
      showVrSplash(buildEnterVrSplashText(), 3000);
      pendingExtendedStarsSplash = shouldLoadExtraStars && loadedMaxMag < requestedMaxMag;

      nextSession.addEventListener('end', () => {
        session = null;
        enterVrButton.textContent = 'Enter VR';
        setStatus(desktopModeLabel());
        pendingExtendedStarsSplash = false;
        clearVrSplash();
        vrMenu.setVisible(false);
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
  asterismRenderer.updateLineMaterialResolutions();
  resizeLabelBoundsCanvas();
}

window.addEventListener('resize', onResize);

window.addEventListener('keydown', (event) => {
  if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    vrMenu.toggle(camera);
  } else if (vrMenu.isVisible()) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      vrMenu.moveSelection(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      vrMenu.moveSelection(1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      vrMenu.activateCurrent();
    }
  }
});

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
  try {
    const nowMs = performance.now();
    let forceLabelRelayout = false;
    if (nowMs - lastSolarUpdateMs > SOLAR_UPDATE_INTERVAL_MS) {
      safeCall('updateSolarSystemMarkers', () => updateSolarSystemMarkers());
      lastSolarUpdateMs = nowMs;
      // Prevent one-frame snap to anchor when body anchors refresh.
      forceLabelRelayout = true;
    }

    if (vrMenu.isVisible() && selectedStarObject) {
      safeCall('refreshStarPreviewArc', () => starPreviewRenderer.refreshArc());
    }

    // Keep sky and stars centered around the observer.
    if (!renderer.xr.isPresenting) {
      sky.position.copy(camera.position);
      for (const mesh of starMeshes) {
        mesh.position.copy(camera.position);
      }
      dsoGroup.position.copy(camera.position);
      solarSystemGroup.position.copy(camera.position);
      horizonGroup.position.copy(camera.position);
      if (vrMenu.isVisible()) {
        safeCall('updateMenuPanelTransformDesktop', () => vrMenu.updateTransform(camera, leftController, rightController));
      }
    }

    if (renderer.xr.isPresenting) {
      const xrCam = renderer.xr.getCamera();
      sky.position.setFromMatrixPosition(xrCam.matrixWorld);
      for (const mesh of starMeshes) {
        mesh.position.copy(sky.position);
      }
      dsoGroup.position.copy(sky.position);
      solarSystemGroup.position.copy(sky.position);
      horizonGroup.position.copy(sky.position);

      safeCall('processMenuButtonInput', () => vrMenu.processGamepadInput({ session, leftController, rightController, xrCamera: xrCam }));
      if (vrMenu.isVisible() && xrCam) {
        safeCall('updateMenuPanelTransformXR', () => vrMenu.updateTransform(xrCam, leftController, rightController));
        safeCall('updateMenuPointerHover', () => vrMenu.updatePointerHover());
      }

      safeCall('updateVrCenterLabelPanelTransform', () => updateVrCenterLabelPanelTransform());

      if (vrSplashSprite) {
        if (nowMs > vrSplashUntilMs) {
          clearVrSplash();
          if (pendingExtendedStarsSplash && !extendedStarsLoading && loadedMaxMag < requestedMaxMag) {
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
    } else {
      vrCenterLabelPanel.visible = false;
      updateVrCenterTargetRings(null);
    }

    if (forceLabelRelayout || (nowMs - lastLabelLayoutMs) >= LABEL_LAYOUT_INTERVAL_MS) {
      safeCall('updateDsoHoverLabels', () => updateDsoHoverLabels(xrFrame));
      safeCall('updateFamousStarHoverLabels', () => updateFamousStarHoverLabels(xrFrame));
      safeCall('updateAsterismHoverOverlay', () => updateAsterismHoverOverlay());
      safeCall('applyLabelLayout', () => applyLabelLayout());
      lastLabelLayoutMs = nowMs;
    }
    safeCall('updatePointerHoverCircles', () => updatePointerHoverCircles(xrFrame));
  } catch (error) {
    reportRuntimeWarning('animationLoop', error);
  }

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
    `${desktopModeLabel()} (${activeLocation.name} ${activeLocation.lat.toFixed(3)}N, ${activeLocation.lon.toFixed(3)}E / ${sourceTag} / stars: ${displayedStarCount} / DSO: ${dsoObjects.length} / maxMag: ${loadedMaxMag.toFixed(1)})`,
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

  if (shouldLoadExtraStars && !renderer.xr.isPresenting) {
    void ensureExtendedStarsLoaded().then(() => {
      setStatus(
        `${desktopModeLabel()} (${activeLocation.name} ${activeLocation.lat.toFixed(3)}N, ${activeLocation.lon.toFixed(3)}E / ${sourceTag} / stars: ${displayedStarCount} / DSO: ${dsoObjects.length} / maxMag: ${loadedMaxMag.toFixed(1)})`,
      );
    });
  }
}

async function bootstrap() {
  setStatus('Loading base star data...');
  try {
    await ensureBaseStarsLoaded();
    await ensureDsoLoaded();
  } catch (error) {
    setStatus(`Failed to load base star data (${error.message})`);
    return;
  }
  await initializeLocation();
  await prepareVrButton();
}

void bootstrap();
