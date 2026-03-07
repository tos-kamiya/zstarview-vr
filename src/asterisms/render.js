import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export function createAsterismRenderer({
  solarSystemGroup,
  symbolRadius,
  setLabelAnchor,
  config,
}) {
  const {
    rotateSlotMs,
    ambientLineOpacity,
    ambientLineColor,
    ambientLineWidthPx,
    highlightLineOpacity,
    highlightLineColor,
    highlightLineWidthPx,
  } = config;

  let asterismObjects = [];
  let asterismKeysBySourceId = new Map();
  let activeAsterism = null;

  function createAsterismLineGroup(edgeCount, { color, opacity, lineWidthPx, renderOrder }) {
    const group = new THREE.Group();
    for (let i = 0; i < edgeCount; i += 1) {
      const geometry = new LineGeometry();
      const material = new LineMaterial({
        color,
        transparent: true,
        opacity,
        linewidth: lineWidthPx,
        depthWrite: false,
        depthTest: false,
        worldUnits: false,
      });
      material.resolution.set(window.innerWidth, window.innerHeight);
      const line = new Line2(geometry, material);
      line.renderOrder = renderOrder;
      group.add(line);
    }
    return group;
  }

  function updateLineGeometry(line, starA, starB) {
    if (!line || !line.geometry || !starA?.worldDirection || !starB?.worldDirection) return;
    line.geometry.setPositions([
      starA.worldDirection.x * (symbolRadius - 0.9),
      starA.worldDirection.y * (symbolRadius - 0.9),
      starA.worldDirection.z * (symbolRadius - 0.9),
      starB.worldDirection.x * (symbolRadius - 0.9),
      starB.worldDirection.y * (symbolRadius - 0.9),
      starB.worldDirection.z * (symbolRadius - 0.9),
    ]);
    line.computeLineDistances();
  }

  function attach({ objects, keysBySourceId }) {
    asterismObjects = objects;
    asterismKeysBySourceId = keysBySourceId;
  }

  function updateLineMaterialResolutions() {
    for (const asterism of asterismObjects) {
      for (const group of [asterism.ambientLineGroup, asterism.lineGroup]) {
        if (!group) continue;
        for (const line of group.children) {
          if (line?.material?.resolution) {
            line.material.resolution.set(window.innerWidth, window.innerHeight);
          }
        }
      }
    }
  }

  function refreshHighlightOverlay(asterism) {
    if (!asterism || !Array.isArray(asterism.edgeStars) || asterism.edgeStars.length === 0) {
      if (activeAsterism?.lineGroup) {
        activeAsterism.lineGroup.visible = false;
      }
      return;
    }

    if (!asterism.lineGroup) {
      asterism.lineGroup = createAsterismLineGroup(asterism.edgeStars.length, {
        color: highlightLineColor,
        opacity: highlightLineOpacity,
        lineWidthPx: highlightLineWidthPx,
        renderOrder: 6,
      });
      solarSystemGroup.add(asterism.lineGroup);
    }

    for (let i = 0; i < asterism.edgeStars.length; i += 1) {
      const [starA, starB] = asterism.edgeStars[i];
      updateLineGeometry(asterism.lineGroup.children[i], starA, starB);
    }

    asterism.lineGroup.visible = true;
  }

  function refreshAmbientOverlay(asterism) {
    if (!asterism || !Array.isArray(asterism.edgeStars) || asterism.edgeStars.length === 0) {
      return;
    }

    if (!asterism.ambientLineGroup) {
      asterism.ambientLineGroup = createAsterismLineGroup(asterism.edgeStars.length, {
        color: ambientLineColor,
        opacity: ambientLineOpacity,
        lineWidthPx: ambientLineWidthPx,
        renderOrder: 5,
      });
      solarSystemGroup.add(asterism.ambientLineGroup);
    }

    for (let i = 0; i < asterism.edgeStars.length; i += 1) {
      const [starA, starB] = asterism.edgeStars[i];
      updateLineGeometry(asterism.ambientLineGroup.children[i], starA, starB);
    }

    asterism.ambientLineGroup.visible = true;
  }

  function refreshAmbientOverlays() {
    for (const asterism of asterismObjects) {
      refreshAmbientOverlay(asterism);
    }
  }

  function updateHover(hoveredStar, enableLabelRender) {
    for (const asterism of asterismObjects) {
      asterism.label.visible = false;
      if (asterism.lineGroup) asterism.lineGroup.visible = false;
    }
    if (!enableLabelRender) {
      activeAsterism = null;
      return;
    }

    if (!hoveredStar) {
      activeAsterism = null;
      return;
    }

    const hoveredSourceId = String(hoveredStar.sourceId || '').trim().toUpperCase();
    const keys = asterismKeysBySourceId.get(hoveredSourceId) || [];
    if (keys.length === 0) {
      activeAsterism = null;
      return;
    }

    const slot = Math.floor(performance.now() / rotateSlotMs);
    const selectedKey = keys[slot % keys.length];
    const selected = asterismObjects.find((asterism) => asterism.key === selectedKey);
    if (!selected || !Array.isArray(selected.memberStars) || selected.memberStars.length < 2) {
      activeAsterism = null;
      return;
    }

    activeAsterism = selected;
    refreshHighlightOverlay(selected);
    selected.label.visible = true;

    const center = new THREE.Vector3();
    for (const star of selected.memberStars) {
      if (!star?.worldDirection) continue;
      center.add(star.worldDirection);
    }
    if (center.lengthSq() < 1e-8) return;
    center.multiplyScalar(1 / selected.memberStars.length).normalize();
    setLabelAnchor(selected.label, center.multiplyScalar(symbolRadius + 0.7));
  }

  function getActiveAsterism() {
    return activeAsterism;
  }

  return {
    attach,
    refreshAmbientOverlays,
    updateHover,
    updateLineMaterialResolutions,
    getActiveAsterism,
  };
}
