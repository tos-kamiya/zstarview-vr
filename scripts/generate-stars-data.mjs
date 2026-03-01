import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const inputPath = resolve(ROOT, 'data/stars.csv');
const outputBaseBinPath = resolve(ROOT, 'public/data/stars-data-base.bin');
const outputExtra7BinPath = resolve(ROOT, 'public/data/stars-data-extra-7.bin');
const outputExtra8BinPath = resolve(ROOT, 'public/data/stars-data-extra-8.bin');
const outputExtra9BinPath = resolve(ROOT, 'public/data/stars-data-extra-9.bin');
const outputExtra10BinPath = resolve(ROOT, 'public/data/stars-data-extra-10.bin');

const BASE_MAX_VMAG = 6.0;
const EXTRA7_MAX_VMAG = 7.0;
const EXTRA8_MAX_VMAG = 8.0;
const EXTRA9_MAX_VMAG = 9.0;
const EXTRA10_MAX_VMAG = 10.0;
const LAYER_COUNT = 10;
const BRIGHTEST_VMAG = -1.5;
const BRIGHT_LAYER_SIZE = 2.8;
const FAINT_LAYER_SIZE = 1.0;
const BRIGHT_LAYER_OPACITY = 1.0;
const FAINT_LAYER_OPACITY = 0.03;
const OPACITY_CURVE_EXP = 2.2;
const FAINT_SIZE_BOOST_START_T = 0.65;
const FAINT_SIZE_BOOST_EXP = 1.2;
const MAX_FAINT_SIZE_BOOST = 1.8;
const OPACITY_FLOOR = 0.006;

function bvToRgb(bvRaw) {
  const bv = Number.isFinite(bvRaw) ? bvRaw : NaN;
  if (Number.isNaN(bv)) return [248, 247, 255];
  if (bv < 0.0) return [170, 191, 255];
  if (bv < 0.3) return [202, 215, 255];
  if (bv < 0.6) return [248, 247, 255];
  if (bv < 1.0) return [255, 210, 161];
  return [255, 204, 111];
}

function brightnessFromVmag(vmag) {
  const bright = BRIGHTEST_VMAG;
  const faint = EXTRA10_MAX_VMAG;
  const t = Math.max(0, Math.min(1, (faint - vmag) / (faint - bright)));
  return 0.16 + 0.84 * Math.pow(t, 1.2);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function layerIndexForVmag(vmag) {
  const t = Math.max(0, Math.min(1, (vmag - BRIGHTEST_VMAG) / (EXTRA10_MAX_VMAG - BRIGHTEST_VMAG)));
  return Math.max(0, Math.min(LAYER_COUNT - 1, Math.floor(t * LAYER_COUNT)));
}

function toCartesian(raHours, decDeg) {
  const ra = (raHours * Math.PI) / 12.0;
  const dec = (decDeg * Math.PI) / 180.0;
  const c = Math.cos(dec);
  const x = c * Math.cos(ra);
  const y = Math.sin(dec);
  // Keep RA increasing toward the east in our world coordinate system.
  const z = -c * Math.sin(ra);
  return [x, y, z];
}

function createEmptyLayers() {
  const layers = [];
  for (let i = 0; i < LAYER_COUNT; i += 1) {
    const t = i / Math.max(1, LAYER_COUNT - 1);
    const tOpacity = Math.pow(t, OPACITY_CURVE_EXP);
    const tBoostRaw = (t - FAINT_SIZE_BOOST_START_T) / Math.max(1e-6, 1 - FAINT_SIZE_BOOST_START_T);
    const tBoost = Math.max(0, Math.min(1, tBoostRaw));
    const sizeBoost = lerp(1, MAX_FAINT_SIZE_BOOST, Math.pow(tBoost, FAINT_SIZE_BOOST_EXP));
    const baseSize = lerp(BRIGHT_LAYER_SIZE, FAINT_LAYER_SIZE, t);
    const size = baseSize * sizeBoost;
    const baseOpacity = lerp(BRIGHT_LAYER_OPACITY, FAINT_LAYER_OPACITY, tOpacity);
    // Keep faint stars visible by enlarging sprites, then reduce opacity to avoid over-brightening.
    const opacityCompensated = baseOpacity / (sizeBoost * sizeBoost);
    layers.push({
      name: `l${String(i).padStart(2, '0')}`,
      size,
      opacity: Math.max(OPACITY_FLOOR, opacityCompensated),
      positions: [],
      colors: [],
    });
  }
  return layers;
}

const lines = readFileSync(inputPath, 'utf-8').split(/\r?\n/);
const baseLayers = createEmptyLayers();
const extra7Layers = createEmptyLayers();
const extra8Layers = createEmptyLayers();
const extra9Layers = createEmptyLayers();
const extra10Layers = createEmptyLayers();
let usedBase = 0;
let usedExtra7 = 0;
let usedExtra8 = 0;
let usedExtra9 = 0;
let usedExtra10 = 0;

for (let i = 1; i < lines.length; i += 1) {
  const line = lines[i];
  if (!line) continue;
  const cols = line.split(',');
  if (cols.length < 7) continue;

  const ra = Number.parseFloat(cols[3]);
  const dec = Number.parseFloat(cols[4]);
  const vmag = Number.parseFloat(cols[5]);
  const bv = Number.parseFloat(cols[6]);

  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(vmag)) continue;
  if (vmag > EXTRA10_MAX_VMAG) continue;

  const [x, y, z] = toCartesian(ra, dec);
  const [r255, g255, b255] = bvToRgb(bv);
  const brightness = brightnessFromVmag(vmag);
  const color = [(r255 / 255) * brightness, (g255 / 255) * brightness, (b255 / 255) * brightness];
  const layerIndex = layerIndexForVmag(vmag);

  if (vmag <= BASE_MAX_VMAG) {
    const layer = baseLayers[layerIndex];
    layer.positions.push(x, y, z);
    layer.colors.push(...color);
    usedBase += 1;
  } else if (vmag <= EXTRA7_MAX_VMAG) {
    const layer = extra7Layers[layerIndex];
    layer.positions.push(x, y, z);
    layer.colors.push(...color);
    usedExtra7 += 1;
  } else if (vmag <= EXTRA8_MAX_VMAG) {
    const layer = extra8Layers[layerIndex];
    layer.positions.push(x, y, z);
    layer.colors.push(...color);
    usedExtra8 += 1;
  } else if (vmag <= EXTRA9_MAX_VMAG) {
    const layer = extra9Layers[layerIndex];
    layer.positions.push(x, y, z);
    layer.colors.push(...color);
    usedExtra9 += 1;
  } else {
    const layer = extra10Layers[layerIndex];
    layer.positions.push(x, y, z);
    layer.colors.push(...color);
    usedExtra10 += 1;
  }
}

function packLayersToBinary(layers) {
  const layerCount = layers.length;
  const headerBytes = 8 + layerCount * 12;
  let payloadBytes = 0;
  for (const layer of layers) {
    payloadBytes += (layer.positions.length + layer.colors.length) * 4;
  }
  const buffer = new ArrayBuffer(headerBytes + payloadBytes);
  const view = new DataView(buffer);
  let off = 0;

  // Header:
  // - magic "ZSV1" (uint32 LE)
  // - layer_count (uint32 LE)
  // For each layer:
  // - size (float32 LE)
  // - opacity (float32 LE)
  // - star_count (uint32 LE)
  view.setUint32(off, 0x3156535a, true); // "ZSV1"
  off += 4;
  view.setUint32(off, layerCount, true);
  off += 4;
  for (const layer of layers) {
    view.setFloat32(off, layer.size, true);
    off += 4;
    view.setFloat32(off, layer.opacity, true);
    off += 4;
    view.setUint32(off, layer.positions.length / 3, true);
    off += 4;
  }

  let byteOff = headerBytes;
  for (const layer of layers) {
    const pos = new Float32Array(buffer, byteOff, layer.positions.length);
    pos.set(layer.positions);
    byteOff += layer.positions.length * 4;
    const col = new Float32Array(buffer, byteOff, layer.colors.length);
    col.set(layer.colors);
    byteOff += layer.colors.length * 4;
  }
  return Buffer.from(buffer);
}

writeFileSync(outputBaseBinPath, packLayersToBinary(baseLayers));
writeFileSync(outputExtra7BinPath, packLayersToBinary(extra7Layers));
writeFileSync(outputExtra8BinPath, packLayersToBinary(extra8Layers));
writeFileSync(outputExtra9BinPath, packLayersToBinary(extra9Layers));
writeFileSync(outputExtra10BinPath, packLayersToBinary(extra10Layers));
console.log(`Generated ${outputBaseBinPath} with ${usedBase} stars.`);
console.log(`Generated ${outputExtra7BinPath} with ${usedExtra7} stars.`);
console.log(`Generated ${outputExtra8BinPath} with ${usedExtra8} stars.`);
console.log(`Generated ${outputExtra9BinPath} with ${usedExtra9} stars.`);
console.log(`Generated ${outputExtra10BinPath} with ${usedExtra10} stars.`);
