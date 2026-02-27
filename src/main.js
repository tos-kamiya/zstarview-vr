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

function generateSkyTexture() {
  const width = 2048;
  const height = 1024;
  const cnv = document.createElement('canvas');
  cnv.width = width;
  cnv.height = height;
  const ctx = cnv.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a1020');
  grad.addColorStop(0.45, '#060b16');
  grad.addColorStop(1, '#02050b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const rng = mulberry32(20260228);

  for (let i = 0; i < 5200; i += 1) {
    const x = rng() * width;
    const y = rng() * height;

    // Denser near a rough diagonal "Milky Way" belt.
    const belt = Math.abs((y / height) - (0.5 + 0.12 * Math.sin((x / width) * Math.PI * 2.0)));
    const keepChance = belt < 0.1 ? 0.95 : 0.35;
    if (rng() > keepChance) continue;

    const base = rng();
    const r = base < 0.03 ? 1.8 : base < 0.18 ? 1.2 : 0.7;
    const alpha = base < 0.06 ? 0.95 : 0.68 + rng() * 0.22;

    const hueJitter = (rng() - 0.5) * 10;
    const sat = 16 + rng() * 30;
    const light = 74 + rng() * 22;
    ctx.fillStyle = `hsla(${220 + hueJitter}, ${sat}%, ${light}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(cnv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const skyTexture = generateSkyTexture();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(SKY_RADIUS, 96, 64),
  new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false })
);
sky.position.set(0, EYE_HEIGHT_M, 0);
scene.add(sky);

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
  // Keep the sky centered around the observer in desktop mode.
  if (!renderer.xr.isPresenting) {
    sky.position.copy(camera.position);
  }

  // In VR, align sky center with XR camera world position to keep observer at dome center.
  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    sky.position.setFromMatrixPosition(xrCam.matrixWorld);
  }

  renderer.render(scene, camera);
});

setStatus(`Desktop preview (Matsue ${MATSUE.lat.toFixed(3)}N, ${MATSUE.lon.toFixed(3)}E / North facing)`);
prepareVrButton();
