import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { STAR_LAYERS, STAR_META } from './generated/stars-data.js';

const MATSUE = {
  lat: 35.465,
  lon: 133.051,
};

const EYE_HEIGHT_M = 1.7;
const SKY_RADIUS = 450;
const CARDINAL_RADIUS = 22;
const SYMBOL_RADIUS = SKY_RADIUS - 8;
const AU_KM = 149597870.7;

const canvas = document.getElementById('scene');
const statusEl = document.getElementById('status');
const enterVrButton = document.getElementById('enter-vr');

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

function createCardinalSprite(label) {
  const cnv = document.createElement('canvas');
  cnv.width = 256;
  cnv.height = 128;
  const ctx = cnv.getContext('2d');

  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(2, 18, 28, 0.95)';
  ctx.fillStyle = 'rgba(156, 230, 182, 0.98)';
  ctx.strokeText(label, cnv.width / 2, cnv.height / 2);
  ctx.fillText(label, cnv.width / 2, cnv.height / 2);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 1.3, 1.0);
  return sprite;
}

function createSymbolSprite(label, fillStyle = 'rgba(255,255,255,0.96)', strokeStyle = 'rgba(0,0,0,0.86)') {
  const cnv = document.createElement('canvas');
  cnv.width = 192;
  cnv.height = 192;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.font = 'bold 132px "Noto Sans Symbols", "Segoe UI Symbol", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;
  ctx.strokeText(label, cnv.width / 2, cnv.height / 2 + 3);
  ctx.fillText(label, cnv.width / 2, cnv.height / 2 + 3);

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
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
      EYE_HEIGHT_M,
      Math.sin(a) * horizonRadius
    )
  );
}
const horizonGeometry = new THREE.BufferGeometry().setFromPoints(horizonPoints);
const horizonRing = new THREE.LineLoop(
  horizonGeometry,
  new THREE.LineBasicMaterial({
    color: 0x49e96b,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
  })
);
scene.add(horizonRing);

const d = CARDINAL_RADIUS / Math.sqrt(2);
const cardinalAnchors = [
  { label: 'N', x: 0, z: -CARDINAL_RADIUS },
  { label: 'NE', x: d, z: -d },
  { label: 'E', x: CARDINAL_RADIUS, z: 0 },
  { label: 'SE', x: d, z: d },
  { label: 'S', x: 0, z: CARDINAL_RADIUS },
  { label: 'SW', x: -d, z: d },
  { label: 'W', x: -CARDINAL_RADIUS, z: 0 },
  { label: 'NW', x: -d, z: -d },
];

for (const anchor of cardinalAnchors) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x4c7f66, roughness: 0.9, metalness: 0.0 })
  );
  pole.position.set(anchor.x, 0.5, anchor.z);
  scene.add(pole);

  const sprite = createCardinalSprite(anchor.label);
  sprite.position.set(anchor.x, 1.65, anchor.z);
  scene.add(sprite);
}

const observer = new Astronomy.Observer(MATSUE.lat, MATSUE.lon, 0);
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

const sunSprite = createCircleOutlineSprite('rgba(255, 214, 120, 0.98)');
const moonSprite = createCircleOutlineSprite('rgba(206, 220, 255, 0.98)');
solarSystemGroup.add(sunSprite);
solarSystemGroup.add(moonSprite);

const planetDefs = [
  { body: 'Mercury', symbol: '☿', color: 'rgba(232,232,232,0.98)' },
  { body: 'Venus', symbol: '♀', color: 'rgba(255,228,166,0.98)' },
  { body: 'Mars', symbol: '♂', color: 'rgba(255,159,131,0.98)' },
  { body: 'Jupiter', symbol: '♃', color: 'rgba(255,233,189,0.98)' },
  { body: 'Saturn', symbol: '♄', color: 'rgba(255,233,161,0.98)' },
];
const planetSprites = planetDefs.map((def) => {
  const sprite = createSymbolSprite(def.symbol, def.color);
  sprite.scale.set(3.2, 3.2, 1.0);
  solarSystemGroup.add(sprite);
  return { ...def, sprite };
});

function placeBodySprite({ body, sprite, minAlt = -0.8 }) {
  const now = new Date();
  const equ = Astronomy.Equator(body, now, observer, true, true);
  const hor = Astronomy.Horizon(now, observer, equ.ra, equ.dec, 'normal');
  if (hor.altitude <= minAlt) {
    sprite.visible = false;
    return;
  }
  sprite.visible = true;
  const pos = altAzToVector(hor.altitude, hor.azimuth, SYMBOL_RADIUS);
  sprite.position.copy(pos);
  return equ.dist;
}

function updateSolarSystemMarkers() {
  const sunDistAu = placeBodySprite({ body: 'Sun', sprite: sunSprite, minAlt: -2.0 });
  const moonDistAu = placeBodySprite({ body: 'Moon', sprite: moonSprite, minAlt: -2.0 });

  if (sunSprite.visible && Number.isFinite(sunDistAu)) {
    const deg = angularDiameterDeg(1392700.0, sunDistAu);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    sunSprite.scale.set(scale, scale, 1.0);
  }

  if (moonSprite.visible && Number.isFinite(moonDistAu)) {
    const deg = angularDiameterDeg(3474.8, moonDistAu);
    const scale = spriteScaleFromAngularDiameter(deg, SYMBOL_RADIUS);
    moonSprite.scale.set(scale, scale, 1.0);
  }

  for (const planet of planetSprites) {
    placeBodySprite({ body: planet.body, sprite: planet.sprite, minAlt: -0.8 });
  }
}

let lastSolarUpdateMs = 0;

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

      nextSession.addEventListener('end', () => {
        session = null;
        enterVrButton.textContent = 'Enter VR';
        setStatus('Desktop preview');
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
  }

  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    sky.position.setFromMatrixPosition(xrCam.matrixWorld);
    for (const mesh of starMeshes) {
      mesh.position.copy(sky.position);
    }
    solarSystemGroup.position.copy(sky.position);
  }

  renderer.render(scene, camera);
});

setStatus(`Desktop preview (Matsue ${MATSUE.lat.toFixed(3)}N, ${MATSUE.lon.toFixed(3)}E / North facing / stars: ${STAR_META.usedRows})`);
updateSolarSystemMarkers();
prepareVrButton();
