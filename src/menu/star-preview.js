import * as THREE from 'three';

export function createStarPreviewRenderer({
  solarSystemGroup,
  symbolRadius,
  createCircleOutlineSprite,
  getCurrentForwardDirection,
  setStatus,
  arcConfig,
}) {
  const {
    minSegments,
    maxSegments,
    widthDeg,
    skipThresholdDeg,
  } = arcConfig;

  const menuTarget = new THREE.Vector3();
  let currentArc = null;
  let currentTargetCircle = null;
  let targetStar = null;

  function clear() {
    if (currentArc) {
      solarSystemGroup.remove(currentArc);
      currentArc.geometry.dispose();
      currentArc.material.dispose();
      currentArc = null;
    }
    if (currentTargetCircle) {
      solarSystemGroup.remove(currentTargetCircle);
      currentTargetCircle.material.dispose();
      currentTargetCircle = null;
    }
  }

  function createGreatCircleArcMesh(startDir, targetDir, angleRad) {
    const segments = angleRad >= THREE.MathUtils.degToRad(150.0)
      ? maxSegments
      : minSegments;
    const points = [];

    const axis = new THREE.Vector3().crossVectors(startDir, targetDir);
    if (axis.lengthSq() < 1e-6) {
      axis.set(1, 0, 0).cross(startDir);
      if (axis.lengthSq() < 1e-6) {
        axis.set(0, 1, 0).cross(startDir);
      }
    }
    axis.normalize();

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const currentAngle = angleRad * t;
      menuTarget.copy(startDir).applyAxisAngle(axis, currentAngle).normalize();
      const scaled = menuTarget.clone().multiplyScalar(symbolRadius - 0.4);
      points.push(scaled);
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeRadius = symbolRadius * Math.tan(THREE.MathUtils.degToRad(widthDeg) * 0.5) * 0.6;
    const geometry = new THREE.TubeGeometry(curve, segments * 3, Math.max(0.5, tubeRadius), 8, false);
    const material = new THREE.MeshBasicMaterial({
      color: 0x7fdbff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 30;
    solarSystemGroup.add(mesh);
    return mesh;
  }

  function updateTargetMarker() {
    if (currentTargetCircle) {
      solarSystemGroup.remove(currentTargetCircle);
      currentTargetCircle.material.dispose();
      currentTargetCircle = null;
    }
    if (!targetStar?.worldDirection) return;

    const targetDir = targetStar.worldDirection.clone().normalize();
    currentTargetCircle = createCircleOutlineSprite('rgba(127, 219, 255, 0.9)');
    currentTargetCircle.scale.set(6, 6, 1.0);
    currentTargetCircle.position.copy(targetDir).multiplyScalar(symbolRadius - 0.2);
    currentTargetCircle.renderOrder = 35;
    solarSystemGroup.add(currentTargetCircle);
  }

  function updateArc() {
    if (currentArc) {
      solarSystemGroup.remove(currentArc);
      currentArc.geometry.dispose();
      currentArc.material.dispose();
      currentArc = null;
    }
    if (!targetStar?.worldDirection) return;

    const forward = getCurrentForwardDirection();
    const targetDir = targetStar.worldDirection.clone().normalize();
    const angleRad = forward.angleTo(targetDir);

    if (angleRad >= THREE.MathUtils.degToRad(skipThresholdDeg)) {
      currentArc = createGreatCircleArcMesh(forward, targetDir, angleRad);
    }
  }

  function setTarget(star) {
    targetStar = star || null;
  }

  function refresh() {
    clear();
    if (!targetStar) return;
    updateTargetMarker();
    updateArc();
    setStatus(`Previewing ${targetStar.name}`);
  }

  function refreshArc() {
    if (!targetStar) {
      if (currentArc) {
        solarSystemGroup.remove(currentArc);
        currentArc.geometry.dispose();
        currentArc.material.dispose();
        currentArc = null;
      }
      return;
    }
    updateArc();
  }

  function getTarget() {
    return targetStar;
  }

  return {
    clear,
    setTarget,
    refresh,
    refreshArc,
    getTarget,
  };
}
