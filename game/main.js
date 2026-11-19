// SOLMAR CITY — boot, the one loop, camera, screens and the glue between
// every system. The game is an original open-world crime story: no Rockstar
// content, everything built here from primitives. Written fresh for gta6-01.
import * as THREE from 'three';
import { createRng, clamp } from './src/util.js';
import { createInput } from './src/input.js';
import { createAudio } from './src/audio.js';
import { buildCity } from './src/city.js';
import { spawnTraffic, updateTraffic, updatePolice, driveCar } from './src/vehicles.js';
import {
  createPlayerMesh, spawnPeds, updatePeds, updateEnemies,
  updatePlayerOnFoot, shoot, startReload,
} from './src/actors.js';
import { createFx } from './src/fx.js';
import { createWanted, addCrime, updateWanted, nearestCopDist, clearWanted } from './src/wanted.js';
import {
  createMissionState, initMissions, startStory, updateMissions,
  spawnPickups, updatePickups,
} from './src/missions.js';
import { createHud } from './src/hud.js';
import { loadSave, writeSave, clearSave } from './src/save.js';
import { stageShot } from './src/shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 60, 180);

const rng = createRng(seed);
const input = createInput(renderer.domElement);
const audio = createAudio();
const hud = createHud();

// ---- the shared game state every system reads and writes ----
const G = {
  scene, camera, renderer, rng, seed,
  input, audio, hud,
  time: 0,
  mode: 'title', // title | play | paused | over
  camYaw: Math.PI * 0.75,
  camPitch: 0.3,
  camDist: 7.5,
  camFar: false,
  shake: 0,
  hurtFlash: 0,
  fireT: 0,
  titleCam: null,
  city: null,
  cars: [],
  peds: [],
  enemies: [],
  pickups: [],
  beacon: null,
  wanted: createWanted(),
  mission: createMissionState(),
  player: null,
  fx: null,
  addCrime: (kind, stars) => addCrime(G, kind, stars),
  nearestCopDist: () => nearestCopDist(G),
  damagePlayer: (amount, source) => damagePlayer(amount, source),
  toast: (msg) => hud.toast(msg),
  banner: (title, sub) => hud.banner(title, sub),
  saveGame: () => writeSave(G),
  busted: () => endGame('busted'),
  spawnBurst: (x, y, z, color, n) => G.fx.spawnBurst(x, y, z, color, n),
  spawnTracer: (x1, y1, z1, x2, y2, z2, c) => G.fx.spawnTracer(x1, y1, z1, x2, y2, z2, c),
};
G.fx = createFx(G);
window.__game = G;

// ---- world ----
G.city = buildCity(scene, rng);
const meshParts = createPlayerMesh();
scene.add(meshParts.group);
G.player = {
  pos: new THREE.Vector3(-140, 0, -150),
  heading: Math.PI,
  velY: 0,
  onGround: true,
  health: 100,
  armor: 0,
  cash: 0,
  ammo: 12,
  reloadT: 0,
  inCar: null,
  moving: false,
  walkPhase: 0,
  meshParts,
};
spawnTraffic(G);
spawnPeds(G);
initMissions(G);
spawnPickups(G, []);

// ---- screens ----
const $ = (id) => document.getElementById(id);
const titleScreen = $('titleScreen');
const pauseScreen = $('pauseScreen');
const endScreen = $('endScreen');
const statusEl = $('status');
function announce(msg) { statusEl.textContent = msg; }
function showOnly(screen) {
  titleScreen.classList.toggle('hidden', screen !== 'title');
  pauseScreen.classList.toggle('hidden', screen !== 'pause');
  endScreen.classList.toggle('hidden', screen !== 'over');
  if (screen === null) {
    titleScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
  }
}

function damagePlayer(amount, source) {
  const p = G.player;
  if (G.mode !== 'play') return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  G.hurtFlash = 0.85;
  G.shake = Math.max(G.shake, 0.35);
  audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    endGame('wasted');
  }
}

function endGame(kind) {
  if (G.mode !== 'play') return;
  G.mode = 'over';
  G.lastDeath = kind;
  audio.setSiren(false);
  audio.setEngine(0, false);
  if (document.pointerLockElement) document.exitPointerLock();
  if (kind === 'wasted') {
    $('endTitle').textContent = 'WASTED';
    $('endTitle').style.color = '#ff3b30';
    $('endText').textContent = 'The Vipers got the last laugh. For now. You wake up at Solmar General, $100 lighter.';
    audio.busted();
  } else {
    $('endTitle').textContent = 'BUSTED';
    $('endTitle').style.color = '#4aa8ff';
    $('endText').textContent = 'The Solmar PD finally caught up with you. $200 bail, and the heat is off — this time.';
    audio.busted();
  }
  showOnly('over');
  announce(kind === 'wasted' ? 'Wasted.' : 'Busted.');
}

function respawn() {
  const p = G.player;
  if (p.inCar) { p.inCar.kind = 'parked'; p.inCar = null; }
  p.pos.set(160, 0, -146);
  p.heading = Math.PI;
  p.health = 100;
  p.armor = 0;
  p.velY = 0;
  p.cash = Math.max(0, p.cash - (G.lastDeath === 'wasted' ? 100 : 200));
  p.ammo = 12;
  p.reloadT = 0;
  p.meshParts.group.visible = true;
  clearWanted(G);
  G.mode = 'play';
  showOnly(null);
  hud.show();
  announce('Back on the streets.');
}

function startGame(kind) {
  const p = G.player;
  const save = loadSave();
  // Fresh run state.
  p.health = 100; p.armor = 0; p.ammo = 12; p.reloadT = 0;
  p.pos.set(-140, 0, -150);
  p.heading = Math.PI;
  p.velY = 0;
  if (p.inCar) { p.inCar.kind = 'parked'; p.inCar = null; }
  p.meshParts.group.visible = true;
  clearWanted(G);
  G.time = 0;
  if (kind === 'continue' && save) {
    p.cash = save.cash || 0;
    if (save.storyDone) {
      G.mission.storyDone = true;
      G.mission.active = false;
      G.mission.label = 'SOLMAR CITY IS YOURS';
      G.mission.desc = 'Story complete. Free roam — the city is yours, Danny.';
      clearTargetSafe();
    } else {
      startStory(G, save.missionIndex || 0);
    }
    // Restore taken pickups.
    for (const pk of G.pickups) {
      if (save.pickups && save.pickups.includes(pk.id)) { pk.taken = true; pk.mesh.visible = false; }
    }
  } else if (kind === 'free') {
    p.cash = 250;
    G.mission.active = false;
    G.mission.label = 'FREE ROAM';
    G.mission.desc = 'Explore Solmar City. Steal a car, take a mission, stay out of trouble.';
    clearTargetSafe();
  } else {
    p.cash = 150;
    clearSave();
    startStory(G, 0);
  }
  G.mode = 'play';
  showOnly(null);
  hud.show();
  audio.unlock();
  announce(kind === 'free' ? 'Free roam. Solmar City is open.' : 'Story started. Mission 1: The Pickup.');
}

function clearTargetSafe() {
  G.mission.target = null;
  if (G.beacon) G.beacon.group.visible = false;
}

$('btnStart').addEventListener('click', () => startGame('story'));
$('btnFree').addEventListener('click', () => startGame('free'));
$('btnContinue').addEventListener('click', () => startGame('continue'));
$('btnResume').addEventListener('click', () => { G.mode = 'play'; showOnly(null); });
$('btnRestart').addEventListener('click', () => startGame('story'));
$('btnQuit').addEventListener('click', () => { G.mode = 'title'; showOnly('title'); hud.hide(); });
$('btnRetry').addEventListener('click', () => respawn());
$('btnEndTitle').addEventListener('click', () => { G.mode = 'title'; showOnly('title'); hud.hide(); });
if (loadSave()) $('btnContinue').style.display = 'inline-block';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'play' && !shotName) {
    G.mode = 'paused';
    showOnly('pause');
  }
});

// ---- entering / exiting cars ----
function nearestCar(maxD) {
  const p = G.player;
  let best = null, bestD = maxD;
  for (const car of G.cars) {
    if (!car.alive) continue;
    if (car.kind === 'player') continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < bestD && Math.abs(car.speed) < 6) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  p.inCar = car;
  car.kind = 'player';
  car.speed = Math.max(car.speed, 0);
  p.pos.copy(car.pos);
  p.meshParts.group.visible = false;
  if (car.mine) {
    G.toast("Danny's sedan. It still runs. Mostly.");
  } else if (car.police) {
    addCrime(G, 'theft', 2);
    G.toast('You jacked a police cruiser! The whole force is coming.');
  } else {
    addCrime(G, 'theft', 1);
    G.toast('Car stolen! Lose the heat or lay low.');
  }
  audio.sirenBlip();
}

function exitCar() {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.kind = 'parked';
  const side = Math.PI / 2;
  p.pos.set(
    car.pos.x + Math.sin(car.heading + side) * 2.6,
    0,
    car.pos.z + Math.cos(car.heading + side) * 2.6,
  );
  p.inCar = null;
  p.meshParts.group.visible = true;
  p.meshParts.group.position.copy(p.pos);
}

// ---- camera ----
function updateCamera(dt) {
  const p = G.player;
  if (G.mode === 'title') {
    if (G.titleCam) {
      camera.position.set(G.titleCam.x, G.titleCam.y, G.titleCam.z);
      camera.lookAt(G.titleCam.lookX, G.titleCam.lookY, G.titleCam.lookZ);
    } else {
      const a = G.time * 0.045;
      camera.position.set(Math.sin(a) * 190, 58, Math.cos(a) * 190);
      camera.lookAt(0, 12, 0);
    }
    return;
  }
  const target = p.inCar ? p.inCar.pos : p.pos;
  const dist = G.camFar ? (p.inCar ? 13.5 : 11) : (p.inCar ? 10 : 7.5);
  const height = 2.4 + G.camPitch * 7;
  const cx = target.x + Math.sin(G.camYaw) * dist;
  const cz = target.z + Math.cos(G.camYaw) * dist;
  let cy = target.y + height;
  if (cy < 1.4) cy = 1.4;
  camera.position.set(cx, cy, cz);
  // Screen shake.
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.9;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.6;
    camera.position.z += (Math.random() - 0.5) * G.shake * 0.9;
  }
  // Look at a point ahead of the player, not at the player: the crosshair ray
  // then runs almost level, so the pistol can hit a target 30 units out
  // instead of digging into the ground 15 units ahead.
  const fwdX = -Math.sin(G.camYaw);
  const fwdZ = -Math.cos(G.camYaw);
  camera.lookAt(target.x + fwdX * 8, target.y + 1.5, target.z + fwdZ * 8);
}

// ---- one fixed step ----
function step(dt) {
  G.time += dt;
  if (G.mode === 'title') {
    // Space starts the story too — the title screen previously needed a
    // button click. Consuming pressed here also drops stale title-screen
    // key presses instead of letting them fire on the first play step.
    const pressed = input.takePressed();
    if (pressed.has('jump')) { startGame('story'); return; }
    updateTraffic(G, dt);
    updatePeds(G, dt);
    G.fx.update(dt);
    return;
  }
  if (G.mode !== 'play') return;

  const pressed = input.takePressed();
  const look = input.takeLook();
  G.camYaw -= look.dx * 0.0032;
  G.camPitch = clamp(G.camPitch - look.dy * 0.002, -0.1, 0.7);
  if (pressed.has('pause')) {
    G.mode = 'paused';
    showOnly('pause');
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (pressed.has('music')) {
    const on = audio.toggleMusic();
    G.toast(on ? 'Radio on.' : 'Radio off.');
  }
  if (pressed.has('camera')) G.camFar = !G.camFar;
  if (pressed.has('help')) {
    G.toast('WASD move/drive · E car · Click shoot · R reload · Space jump/brake · Shift sprint');
  }
  if (pressed.has('reload')) startReload(G);

  const p = G.player;
  // Shooting: edge-triggered clicks (a fast click must never fall between
  // frames) plus hold-to-fire at a steady rate.
  const clicks = input.takeClicks();
  if (!p.inCar) {
    if (clicks > 0) shoot(G);
    else if (input.mouseDown) {
      G.fireT -= dt;
      if (G.fireT <= 0) { shoot(G); G.fireT = 0.24; }
    } else G.fireT = 0;
  }

  // Enter / exit car.
  if (pressed.has('enter')) {
    if (p.inCar) exitCar();
    else {
      const car = nearestCar(6);
      if (car) enterCar(car);
    }
  }

  if (p.inCar) {
    p.pos.copy(p.inCar.pos);
    const events = driveCar(G, p.inCar, input, dt, pressed);
    if (events.hitPed) G.toast('You ran someone over! The cops saw that.');
    audio.setEngine(Math.abs(p.inCar.speed) / p.inCar.maxSpeed, true);
  } else {
    updatePlayerOnFoot(G, dt);
    audio.setEngine(0, false);
  }

  updateTraffic(G, dt);
  updatePolice(G, dt);
  updatePeds(G, dt);
  updateEnemies(G, dt);
  updateMissions(G, dt);
  updatePickups(G, dt);
  updateWanted(G, dt);
  G.fx.update(dt);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.8);
  G.shake = Math.max(0, G.shake - dt * 2.2);
  hud.update(G);
}

// ---- frame loop ----
let last = performance.now();
let accumulator = 0;
let painted = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(now - last, 250);
  last = now;
  if (shotName) {
    // Staged screenshot: paint a few frames, then signal readiness.
    updateCamera(0);
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 3) window.__shotReady = true;
    return;
  }
  accumulator += dtMs / 1000;
  let n = 0;
  while (accumulator >= STEP && n < 5) {
    step(STEP);
    accumulator -= STEP;
    n += 1;
  }
  if (n === 5) accumulator = 0;
  updateCamera(dtMs / 1000);
  renderer.render(scene, camera);
  if (painted === 0) {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
  }
  painted += 1;
}

// ---- boot ----
if (shotName) {
  // Deterministic staged scene for screenshots.
  G.mode = 'title';
  const mode = stageShot(G, shotName);
  if (mode === 'play') {
    showOnly(null);
    hud.show();
    hud.update(G);
  }
  updateCamera(0);
  renderer.render(scene, camera);
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  requestAnimationFrame(frame);
} else {
  announce('Solmar City. Press Start.');
  requestAnimationFrame(frame);
}
