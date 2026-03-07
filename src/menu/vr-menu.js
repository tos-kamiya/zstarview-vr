import * as THREE from 'three';

const MENU_PANEL_WIDTH = 0.34;
const MENU_PANEL_HEIGHT = 0.60;
const MENU_PANEL_FORWARD_DISTANCE = 0.95;
const MENU_PANEL_VERTICAL_OFFSET = -0.12;
const MENU_PANEL_SIDE_OFFSET = 0.32;
const MENU_PANEL_COLOR = new THREE.Color('#3e434b');
const MENU_PANEL_BORDER = 'rgba(205, 212, 220, 0.82)';
const MENU_PANEL_TEXT_COLOR = 'rgba(247, 249, 251, 0.98)';
const MENU_PANEL_TEXT_MUTED = 'rgba(219, 224, 230, 0.88)';
const MENU_PANEL_LINE_HEIGHT = 34;
const MENU_PANEL_PADDING = 26;
const MENU_PANEL_CANVAS_WIDTH = 512;
const MENU_PANEL_CANVAS_HEIGHT = 1120;
const MENU_PANEL_MENU_START_Y = 280;
const MENU_ROW_HEIGHT = 84;
const MENU_VISIBLE_STAR_LIMIT = 10;
const MENU_ITEM_FONT = '42px "Noto Sans JP", "Noto Sans", sans-serif';

export function createVrMenu({
  scene,
  renderer,
  appVersion,
  famousStarObjects,
  setStatus,
  createCircleOutlineSprite,
  onStateChange,
}) {
  const menuStarEntries = famousStarObjects.slice(0, MENU_VISIBLE_STAR_LIMIT);
  const menuPanelCanvas = document.createElement('canvas');
  menuPanelCanvas.width = MENU_PANEL_CANVAS_WIDTH;
  menuPanelCanvas.height = MENU_PANEL_CANVAS_HEIGHT;
  const menuPanelCtx = menuPanelCanvas.getContext('2d');
  const menuRaycaster = new THREE.Raycaster();
  const menuPointerOrigin = new THREE.Vector3();
  const menuPointerDirection = new THREE.Vector3();
  const menuPanelLocalHit = new THREE.Vector3();

  let menuPanelGroup = null;
  let menuPanelMaterial = null;
  let menuPanelTexture = null;
  let menuPanelMesh = null;
  let menuPointerMarker = null;
  let visible = false;
  let menuButtonStates = new WeakMap();
  let menuPanelEntries = [];
  let menuPage = 'root';
  let menuSelectedIndex = 0;
  let menuHoveredIndex = -1;
  let thumbstickDebounceTimer = 0;
  let activeController = null;

  const notifyStateChange = () => {
    if (typeof onStateChange === 'function') onStateChange();
  };

  function updateMenuPanelTexture() {
    const cnv = menuPanelCanvas;
    const ctx = menuPanelCtx;
    const bgColor = MENU_PANEL_COLOR.getStyle ? MENU_PANEL_COLOR.getStyle() : '#030711';
    const showPersistentSelection = menuPage === 'stars';
    const title = menuPage === 'stars' ? 'Jump to Star' : (menuPage === 'about' ? 'About' : 'Menu');
    const helpLines = menuPage === 'root'
      ? ['Menu: Button', 'Point: Hover item', 'Trigger: Open / Select']
      : ['Menu: Button to close', 'Trigger: Select'];
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cnv.width, cnv.height);
    ctx.strokeStyle = MENU_PANEL_BORDER;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, cnv.width - 8, cnv.height - 8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 32px "Noto Sans JP", "Noto Sans", sans-serif';
    ctx.fillStyle = MENU_PANEL_TEXT_COLOR;
    ctx.fillText(title, MENU_PANEL_PADDING, MENU_PANEL_PADDING);
    ctx.font = '20px "Noto Sans JP", "Noto Sans", sans-serif';
    let y = MENU_PANEL_PADDING + MENU_PANEL_LINE_HEIGHT * 2 + 12;
    for (const line of helpLines) {
      ctx.fillText(line, MENU_PANEL_PADDING, y);
      y += MENU_PANEL_LINE_HEIGHT;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillRect(MENU_PANEL_PADDING / 2, MENU_PANEL_MENU_START_Y - MENU_PANEL_LINE_HEIGHT / 2, cnv.width - MENU_PANEL_PADDING, MENU_ROW_HEIGHT * menuPanelEntries.length + MENU_PANEL_PADDING / 2);
    ctx.globalCompositeOperation = 'source-over';

    ctx.font = MENU_ITEM_FONT;
    let entryY = MENU_PANEL_MENU_START_Y;

    menuPanelEntries.forEach((entry, index) => {
      if (showPersistentSelection && index === menuSelectedIndex) {
        ctx.fillStyle = 'rgba(240, 244, 248, 0.24)';
        ctx.fillRect(MENU_PANEL_PADDING / 2, entryY - 4, cnv.width - MENU_PANEL_PADDING, MENU_ROW_HEIGHT);
      }
      if (index === menuHoveredIndex) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 3;
        ctx.strokeRect(MENU_PANEL_PADDING / 2 + 2, entryY - 2, cnv.width - MENU_PANEL_PADDING - 4, MENU_ROW_HEIGHT - 4);
      }
      ctx.fillStyle = index === menuHoveredIndex ? '#ffffff' : ((showPersistentSelection && index === menuSelectedIndex) ? 'rgba(240,246,250,0.96)' : MENU_PANEL_TEXT_COLOR);
      const text = entry.label ?? entry.name ?? '';
      ctx.fillText(text, MENU_PANEL_PADDING, entryY);
      if (entry.detail) {
        ctx.font = '18px "Noto Sans JP", "Noto Sans", sans-serif';
        ctx.fillStyle = index === menuHoveredIndex ? '#ffffff' : ((showPersistentSelection && index === menuSelectedIndex) ? 'rgba(240,246,250,0.92)' : MENU_PANEL_TEXT_MUTED);
        ctx.fillText(entry.detail, MENU_PANEL_PADDING + 12, entryY + 22);
        ctx.font = MENU_ITEM_FONT;
      }
      entryY += MENU_ROW_HEIGHT;
    });

    if (menuPanelTexture) {
      menuPanelTexture.needsUpdate = true;
    }
  }

  function buildMenuPanelTexture() {
    updateMenuPanelTexture();
    const texture = new THREE.CanvasTexture(menuPanelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function buildMenuEntriesForPage(page) {
    if (page === 'stars') {
      return menuStarEntries.map((star) => ({ key: `star:${star.name}`, label: star.name, action: 'star', star }));
    }
    if (page === 'about') {
      return [{ key: 'version', label: `Version ${appVersion}`, action: 'none' }];
    }
    return [
      { key: 'jump', label: 'Jump to Star', action: 'page', page: 'stars' },
      { key: 'about', label: 'About', action: 'page', page: 'about' },
    ];
  }

  function rebuildMenuEntries(preferredKey = null) {
    const previousKey = preferredKey ?? menuPanelEntries[menuSelectedIndex]?.key ?? null;
    menuPanelEntries = buildMenuEntriesForPage(menuPage);
    if (menuPage === 'stars' && preferredKey == null) {
      menuSelectedIndex = -1;
    } else if (menuPanelEntries.length === 0) {
      menuSelectedIndex = 0;
    } else {
      const preferredIndex = previousKey ? menuPanelEntries.findIndex((entry) => entry.key === previousKey) : -1;
      menuSelectedIndex = preferredIndex >= 0 ? preferredIndex : Math.min(menuSelectedIndex, menuPanelEntries.length - 1);
    }
  }

  function openMenuPage(page, preferredKey = null) {
    menuPage = page;
    menuHoveredIndex = -1;
    rebuildMenuEntries(preferredKey);
    updateMenuPanelTexture();
    notifyStateChange();
  }

  function activateEntry(entry) {
    if (!entry) return;
    if (entry.action === 'page' && entry.page) {
      openMenuPage(entry.page);
      return;
    }
    if (entry.action === 'star' && entry.star) {
      const selectedIndex = menuPanelEntries.findIndex((candidate) => candidate.key === entry.key);
      if (selectedIndex >= 0) {
        menuSelectedIndex = selectedIndex;
        updateMenuPanelTexture();
      }
      entry.star.highlightUntilMs = performance.now() + 3000;
      setStatus(`Selected ${entry.star.name}`);
      notifyStateChange();
    }
  }

  function ensurePanel() {
    if (menuPanelGroup) return menuPanelGroup;
    menuPanelTexture = buildMenuPanelTexture();
    menuPanelMaterial = new THREE.MeshBasicMaterial({
      map: menuPanelTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(MENU_PANEL_WIDTH, MENU_PANEL_HEIGHT);
    const panelMesh = new THREE.Mesh(geometry, menuPanelMaterial);
    panelMesh.renderOrder = 20;
    const outline = new THREE.Mesh(
      new THREE.PlaneGeometry(MENU_PANEL_WIDTH + 0.018, MENU_PANEL_HEIGHT + 0.018),
      new THREE.MeshBasicMaterial({ color: 0x5c8bff, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    outline.renderOrder = 15;
    const group = new THREE.Group();
    group.add(outline);
    group.add(panelMesh);
    const pointerMarker = createCircleOutlineSprite('rgba(255, 255, 255, 0.98)');
    pointerMarker.scale.set(0.028, 0.028, 1.0);
    pointerMarker.position.set(0, 0, 0.003);
    pointerMarker.renderOrder = 45;
    pointerMarker.visible = false;
    group.add(pointerMarker);
    group.visible = false;
    scene.add(group);
    menuPanelGroup = group;
    menuPanelMesh = panelMesh;
    menuPointerMarker = pointerMarker;
    return group;
  }

  function updateTransform(cameraObject, leftController, rightController) {
    if (!menuPanelGroup || !cameraObject) return;
    const basePos = new THREE.Vector3().setFromMatrixPosition(cameraObject.matrixWorld);
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(cameraObject.matrixWorld);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(baseQuat).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(baseQuat).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(baseQuat).normalize();
    let sideSign = 0;
    if (activeController) {
      sideSign = activeController === leftController ? -1 : (activeController === rightController ? 1 : 0);
    }
    menuPanelGroup.position.copy(basePos)
      .addScaledVector(forward, MENU_PANEL_FORWARD_DISTANCE)
      .addScaledVector(up, MENU_PANEL_VERTICAL_OFFSET)
      .addScaledVector(right, MENU_PANEL_SIDE_OFFSET * sideSign);
    menuPanelGroup.quaternion.copy(baseQuat);
  }

  function setVisible(nextVisible, cameraObject = null) {
    if (nextVisible && !menuPanelGroup) ensurePanel();
    if (!menuPanelGroup) return;
    if (nextVisible) {
      openMenuPage('root');
    } else {
      menuHoveredIndex = -1;
      menuSelectedIndex = 0;
      if (menuPointerMarker) menuPointerMarker.visible = false;
    }
    visible = nextVisible;
    menuPanelGroup.visible = nextVisible;
    if (nextVisible && cameraObject) {
      updateTransform(cameraObject, null, null);
    }
    notifyStateChange();
  }

  function toggle(cameraObject = null) {
    setVisible(!visible, cameraObject);
  }

  function handleControllerDisconnected(controller) {
    if (activeController === controller) {
      activeController = null;
    }
  }

  function handleControllerSelect(controller) {
    if (!visible || activeController !== controller) return;
    const activeIndex = menuHoveredIndex >= 0 ? menuHoveredIndex : menuSelectedIndex;
    if (activeIndex < 0) return;
    if (activeIndex >= 0) {
      menuSelectedIndex = activeIndex;
      updateMenuPanelTexture();
    }
    activateEntry(menuPanelEntries[activeIndex]);
  }

  function processGamepadInput({ session, leftController, rightController, xrCamera }) {
    if (!renderer.xr.isPresenting || !session) return;
    for (const src of session.inputSources) {
      if (src.handedness !== 'left' && src.handedness !== 'right') continue;
      const controller = src.handedness === 'left' ? leftController : rightController;
      if (!controller) continue;
      const gp = src.gamepad;
      if (!gp) continue;

      const isThisControllerActive = activeController === controller;

      if (gp.buttons) {
        let state = menuButtonStates.get(src);
        if (!state || state.length !== gp.buttons.length) {
          state = new Array(gp.buttons.length).fill(false);
        }
        for (let idx = 0; idx < gp.buttons.length; idx += 1) {
          const button = gp.buttons[idx];
          if (!button) continue;
          const wasPressed = state[idx];
          const isPressed = Boolean(button.pressed);

          if (isPressed && !wasPressed && idx > 2) {
            if (visible && isThisControllerActive) {
              setVisible(false);
              activeController = null;
            } else {
              activeController = controller;
              setVisible(true, xrCamera || controller);
            }
          }
          state[idx] = isPressed;
        }
        menuButtonStates.set(src, state);
      }

      if (visible && isThisControllerActive && gp.axes) {
        const nowMs = performance.now();
        if (nowMs - thumbstickDebounceTimer > 250) {
          let yAxis = 0;
          if (gp.axes.length >= 4) {
            yAxis = gp.axes[3];
          } else if (gp.axes.length >= 2) {
            yAxis = gp.axes[1];
          }

          if (yAxis > 0.5) {
            moveSelection(1);
            thumbstickDebounceTimer = nowMs;
          } else if (yAxis < -0.5) {
            moveSelection(-1);
            thumbstickDebounceTimer = nowMs;
          }
        }
      }
    }
  }

  function getMenuPointerHitFromController(controller) {
    if (!visible || !menuPanelMesh || !controller) return null;
    menuPointerOrigin.setFromMatrixPosition(controller.matrixWorld);
    menuPointerDirection.set(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(controller.matrixWorld),
    ).normalize();
    menuRaycaster.set(menuPointerOrigin, menuPointerDirection);
    const hits = menuRaycaster.intersectObject(menuPanelMesh, false);
    const hit = hits[0];
    if (!hit) return null;

    menuPanelLocalHit.copy(hit.point);
    menuPanelMesh.worldToLocal(menuPanelLocalHit);
    const yPx = (0.5 - (menuPanelLocalHit.y / MENU_PANEL_HEIGHT)) * MENU_PANEL_CANVAS_HEIGHT;
    const top = MENU_PANEL_MENU_START_Y - MENU_PANEL_LINE_HEIGHT / 2;
    const bottom = top + MENU_ROW_HEIGHT * menuPanelEntries.length + MENU_PANEL_PADDING / 2;
    const withinY = yPx >= top && yPx <= bottom;
    let index = -1;
    if (withinY) {
      const candidate = Math.floor((yPx - MENU_PANEL_MENU_START_Y) / MENU_ROW_HEIGHT);
      index = candidate >= 0 && candidate < menuPanelEntries.length ? candidate : -1;
    }
    return { localHit: menuPanelLocalHit.clone(), index };
  }

  function updatePointerHover() {
    if (!visible || !renderer.xr.isPresenting || !activeController) return;
    const pointerHit = getMenuPointerHitFromController(activeController);
    const hoveredIndex = pointerHit?.index ?? -1;
    if (menuPointerMarker) {
      if (pointerHit?.localHit) {
        menuPointerMarker.visible = true;
        menuPointerMarker.position.set(pointerHit.localHit.x, pointerHit.localHit.y, 0.003);
      } else {
        menuPointerMarker.visible = false;
      }
    }
    if (hoveredIndex !== menuHoveredIndex) {
      menuHoveredIndex = hoveredIndex;
      updateMenuPanelTexture();
      notifyStateChange();
    }
  }

  function moveSelection(delta) {
    if (menuPanelEntries.length === 0) return;
    if (menuSelectedIndex < 0) {
      menuSelectedIndex = delta >= 0 ? 0 : menuPanelEntries.length - 1;
    } else {
      menuSelectedIndex = (menuSelectedIndex + delta + menuPanelEntries.length) % menuPanelEntries.length;
    }
    updateMenuPanelTexture();
    notifyStateChange();
  }

  function activateCurrent() {
    const entry = menuPanelEntries[menuSelectedIndex];
    activateEntry(entry);
  }

  function getPreviewStarObject() {
    if (!visible || menuPage !== 'stars') {
      return null;
    }
    const activeIndex = menuSelectedIndex >= 0
      ? menuSelectedIndex
      : ((renderer.xr.isPresenting && menuHoveredIndex >= 0) ? menuHoveredIndex : -1);
    const selectedEntry = menuPanelEntries[activeIndex];
    if (!selectedEntry || selectedEntry.action !== 'star' || !selectedEntry.star) {
      return null;
    }
    return selectedEntry.star;
  }

  return {
    isVisible: () => visible,
    setVisible,
    toggle,
    updateTransform,
    handleControllerDisconnected,
    handleControllerSelect,
    processGamepadInput,
    updatePointerHover,
    moveSelection,
    activateCurrent,
    getPreviewStarObject,
  };
}
