import * as THREE from 'three';

const MATSUE = {
  lat: 35.465,
  lon: 133.051,
};

const EYE_HEIGHT_M = 1.7;
const SKY_RADIUS = 450;
const GROUND_RADIUS = 260;

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

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createStarfield(radius, count, seed, options = {}) {
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const {
    rBase = 0.78,
    gBase = 0.82,
    bBase = 0.92,
    brightnessMin = 0.3,
    brightnessMax = 1.0,
    jitter = 0.12,
  } = options;

  for (let i = 0; i < count; i += 1) {
    // Uniform distribution over the sphere to avoid polar distortion.
    const u = rng();
    const v = rng();
    const theta = 2.0 * Math.PI * u;
    const z = 2.0 * v - 1.0;
    const t = Math.sqrt(1.0 - z * z);
    const x = t * Math.cos(theta);
    const y = z;
    const zAxis = t * Math.sin(theta);

    const idx = i * 3;
    positions[idx] = x * radius;
    positions[idx + 1] = y * radius;
    positions[idx + 2] = zAxis * radius;

    const b = brightnessMin + rng() * (brightnessMax - brightnessMin);
    colors[idx] = Math.min(1.0, Math.max(0.0, (rBase + (rng() - 0.5) * jitter) * b));
    colors[idx + 1] = Math.min(1.0, Math.max(0.0, (gBase + (rng() - 0.5) * jitter) * b));
    colors[idx + 2] = Math.min(1.0, Math.max(0.0, (bBase + (rng() - 0.5) * jitter) * b));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: options.size ?? 1.2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: options.opacity ?? 0.95,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(SKY_RADIUS, 96, 64),
  new THREE.MeshBasicMaterial({ color: 0x060b16, side: THREE.BackSide, depthWrite: false })
);
sky.position.set(0, EYE_HEIGHT_M, 0);
scene.add(sky);

const starsDim = createStarfield(SKY_RADIUS - 4, 9000, 20260301, {
  size: 1.05,
  opacity: 0.55,
  brightnessMin: 0.2,
  brightnessMax: 0.75,
  jitter: 0.07,
});
const starsBright = createStarfield(SKY_RADIUS - 5, 1400, 20260302, {
  size: 2.2,
  opacity: 0.98,
  rBase: 0.84,
  gBase: 0.88,
  bBase: 0.98,
  brightnessMin: 0.72,
  brightnessMax: 1.0,
  jitter: 0.14,
});
scene.add(starsDim);
scene.add(starsBright);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(GROUND_RADIUS, 96),
  new THREE.MeshStandardMaterial({
    color: 0x162436,
    roughness: 1.0,
    metalness: 0.0,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

const northMarker = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 1.3, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x6ec6ff, emissive: 0x1a3f63, emissiveIntensity: 0.3 })
);
// three.js default camera forward is -Z, so north is placed toward -Z.
northMarker.position.set(0, 0.65, -16);
scene.add(northMarker);

const northLabel = new THREE.Mesh(
  new THREE.PlaneGeometry(2.2, 0.65),
  new THREE.MeshBasicMaterial({ color: 0xa7e2ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
northLabel.position.set(0, 2.2, -16);
northLabel.lookAt(0, 2.2, 0);
scene.add(northLabel);

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
  // Keep sky and stars centered around the observer.
  if (!renderer.xr.isPresenting) {
    sky.position.copy(camera.position);
    starsDim.position.copy(camera.position);
    starsBright.position.copy(camera.position);
  }

  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    sky.position.setFromMatrixPosition(xrCam.matrixWorld);
    starsDim.position.copy(sky.position);
    starsBright.position.copy(sky.position);
  }

  renderer.render(scene, camera);
});

setStatus(`Desktop preview (Matsue ${MATSUE.lat.toFixed(3)}N, ${MATSUE.lon.toFixed(3)}E / North facing)`);
prepareVrButton();
