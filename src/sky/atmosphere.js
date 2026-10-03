// RGB spherical-atmosphere model ported from ../zstarview's render/atmosphere.py.
const PI = Math.PI;
const EARTH = 6371.0;
const TOP = 100.0;
const VIEW_STEPS = 32;
const SUN_STEPS = 12;
const AOD550 = 0.15;
const SKY_DISPLAY_GAIN = 0.16;
const WAVELENGTHS = [650, 550, 450];
const rayleighScatter = WAVELENGTHS.map((w) => (450 / w) ** 4);
const aerosolScatter = WAVELENGTHS.map((w) => (550 / w) ** 0.7);
const ozoneExtinction = [0.0025, 0.005, 0.0001875];
const sunRadiance = [0.45, 0.625, 1.0];
const twilightRadiance = [0.0224, 0.056, 0.196];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function raySphere(origin, direction, radius) {
  const b = origin[0] * direction[0] + origin[1] * direction[1] + origin[2] * direction[2];
  const c = origin[0] ** 2 + origin[1] ** 2 + origin[2] ** 2 - radius ** 2;
  const discriminant = b * b - c;
  return { b, c, discriminant, far: -b + Math.sqrt(Math.max(0, discriminant)) };
}

function hitsEarth(origin, direction) {
  const hit = raySphere(origin, direction, EARTH);
  return hit.b < 0 && hit.b * hit.b >= hit.c;
}

function shellPath(origin, direction, distance, inner, outer) {
  const b = origin[0] * direction[0] + origin[1] * direction[1] + origin[2] * direction[2];
  const c = origin[0] ** 2 + origin[1] ** 2 + origin[2] ** 2;
  const interval = (radius) => {
    const d = b * b - (c - radius * radius);
    if (d < 0) return 0;
    const root = Math.sqrt(d);
    return Math.max(0, Math.min(distance, -b + root) - Math.max(0, -b - root));
  };
  return interval(outer) - interval(inner);
}

function density(point, scaleHeight) {
  return Math.exp(-Math.max(0, Math.hypot(...point) - EARTH) / scaleHeight);
}

function direction(altitudeDeg, azimuthDeg) {
  const alt = altitudeDeg * PI / 180;
  const az = azimuthDeg * PI / 180;
  return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
}

function sunColumns(point, sun, steps, aerosolScale) {
  const distance = raySphere(point, sun, EARTH + TOP).far;
  let rayleigh = 0;
  let aerosol = 0;
  for (let j = 0; j < steps; j += 1) {
    const t = (j + 0.5) / steps * distance;
    const p = [point[0] + sun[0] * t, point[1] + sun[1] * t, point[2] + sun[2] * t];
    rayleigh += density(p, 8.0);
    aerosol += 0.025 * aerosolScale * density(p, 1.4);
  }
  return [rayleigh * distance / steps, aerosol * distance / steps];
}

export function atmosphereColor(altitudeDeg, azimuthDeg, sunAltDeg, sunAzDeg, quality = {}) {
  if (altitudeDeg < 0) return [0, 0, 0];
  const viewSteps = Math.max(1, Math.floor(quality.viewSteps ?? VIEW_STEPS));
  const sunSteps = Math.max(1, Math.floor(quality.sunSteps ?? SUN_STEPS));
  const aod550 = Math.max(0, quality.aod550 ?? AOD550);
  const view = direction(altitudeDeg, azimuthDeg);
  const sun = direction(sunAltDeg, sunAzDeg);
  const observer = [0, 0, EARTH];
  const maxDistance = raySphere(observer, view, EARTH + TOP).far;
  const stepDistance = maxDistance / viewSteps;
  const aerosolScale = aod550 / 0.15;
  const rayleighExt = rayleighScatter;
  const aerosolExt = aerosolScatter;
  let rgb = [0, 0, 0];
  let previousRayleigh = 0;
  let previousAerosol = 0;

  for (let i = 0; i < viewSteps; i += 1) {
    const t = (i + 0.5) / viewSteps * maxDistance;
    const point = [observer[0] + view[0] * t, observer[1] + view[1] * t, observer[2] + view[2] * t];
    const rhoR = density(point, 8.0);
    const rhoA = 0.025 * aerosolScale * density(point, 1.4);
    const viewR = previousRayleigh + 0.5 * rhoR * stepDistance;
    const viewA = previousAerosol + 0.5 * rhoA * stepDistance;
    previousRayleigh += rhoR * stepDistance;
    previousAerosol += rhoA * stepDistance;
    const [sunR, sunA] = sunColumns(point, sun, sunSteps, aerosolScale);
    const visible = hitsEarth(point, sun) ? 0 : 1;
    const ozoneView = shellPath(observer, view, t, EARTH + 15, EARTH + 35) / 20;
    const sunDistance = raySphere(point, sun, EARTH + TOP).far;
    const ozoneSun = shellPath(point, sun, sunDistance, EARTH + 15, EARTH + 35) / 20;
    const cosine = Math.max(-1, Math.min(1, sun[0] * view[0] + sun[1] * view[1] + sun[2] * view[2]));
    const phaseR = 3 / (16 * PI) * (1 + cosine * cosine);
    const g = 0.76;
    const phaseA = (1 - g * g) / (4 * PI * (1 + g * g - 2 * g * cosine) ** 1.5);
    for (let k = 0; k < 3; k += 1) {
      const transR = Math.exp(-0.018 * (sunR + viewR) * rayleighExt[k]);
      const transA = Math.exp(-0.018 * (sunA + viewA) * aerosolExt[k]);
      const transO = Math.exp(-(ozoneView + ozoneSun) * ozoneExtinction[k]);
      const scattering = rhoR * rayleighScatter[k] * phaseR + rhoA * aerosolScatter[k] * phaseA;
      rgb[k] += scattering * sunRadiance[k] * transR * transA * transO * visible * stepDistance;
    }
  }

  const sunWeight = smoothstep(-12, 3, sunAltDeg);
  const viewWeight = smoothstep(0, 90, altitudeDeg);
  const display = rgb.map((value, k) => (
    1 - Math.exp(-Math.max(0, value + viewWeight * sunWeight * twilightRadiance[k]) * 2.8)
  ) * SKY_DISPLAY_GAIN);
  const luminance = display[0] * 0.2126 + display[1] * 0.7152 + display[2] * 0.0722;
  const ambientScale = 1 + smoothstep(-18, -9, sunAltDeg);
  for (let k = 0; k < 3; k += 1) {
    const ambient = [0.5, 1.0, 2.5][k] / 255 * ambientScale;
    rgb[k] = Math.min(1, display[k] + 0.18 * (luminance - display[k]) + ambient);
  }
  return rgb;
}

export function renderAtmosphereGrid({ width = 128, height = 64, sunAltDeg, sunAzDeg, quality, chunkSize = 32, onChunk }) {
  const data = new Uint8Array(width * height * 4);
  const total = width * height;
  let index = 0;
  const run = () => {
    const end = Math.min(total, index + chunkSize);
    for (; index < end; index += 1) {
      const x = index % width;
      const y = Math.floor(index / width);
      const altitude = Math.asin(Math.max(0, Math.min(1, (y + 0.5) / height))) * 180 / PI;
      const azimuth = (x + 0.5) / width * 360;
      const rgb = atmosphereColor(altitude, azimuth, sunAltDeg, sunAzDeg, quality);
      const offset = index * 4;
      data[offset] = Math.round(rgb[0] * 255);
      data[offset + 1] = Math.round(rgb[1] * 255);
      data[offset + 2] = Math.round(rgb[2] * 255);
      data[offset + 3] = 255;
    }
    onChunk?.(Math.min(1, index / total));
    return index >= total;
  };
  return { data, run };
}
