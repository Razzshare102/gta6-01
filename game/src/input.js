// Keyboard + mouse input for Solmar City. WASD/arrows move, mouse drag or
// pointer-lock orbits the camera, click shoots, E enters/exits cars.
// Written fresh for gta6-01.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed by takePressed()
  let mouseDX = 0, mouseDY = 0;
  let mouseDown = false;
  let clickCount = 0; // edge-triggered clicks: a fast click must never fall between frames
  let dragging = false;
  let lastX = 0, lastY = 0;
  let locked = false;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'jump',
    KeyE: 'enter',
    KeyR: 'reload',
    KeyM: 'music',
    KeyP: 'pause',
    KeyH: 'help',
    KeyC: 'camera',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const action = KEYMAP[e.code];
    if (action) {
      keys.add(action);
      pressed.add(action);
      if (action === 'jump' || action === 'pause') e.preventDefault();
    }
    if (e.code === 'Escape') pressed.add('pause');
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; dragging = false; });

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    clickCount += 1;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* drag-look still works */ }
    }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (locked) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    } else if (dragging) {
      mouseDX += e.clientX - lastX;
      mouseDY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    get locked() { return locked; },
    get mouseDown() { return mouseDown; },
    axis() {
      let x = 0, z = 0;
      if (keys.has('up')) z -= 1;
      if (keys.has('down')) z += 1;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      return { x, z };
    },
    takeLook() {
      const dx = mouseDX, dy = mouseDY;
      mouseDX = 0; mouseDY = 0;
      return { dx, dy };
    },
    /** Edge-triggered actions since the last call (clears them). */
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    /** Clicks since the last call (clears the count). */
    takeClicks() {
      const n = clickCount;
      clickCount = 0;
      return n;
    },
    has(action) { return keys.has(action); },
  };
}
