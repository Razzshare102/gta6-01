// Screenshot scenes behind ?shot=cover|drive|chase|mission. Each one stages
// the real game from a fixed seed and plays it forward a few seconds with a
// simple autopilot, so the frame is what the game really looks like — the
// same seed always gives the same frame. Written fresh for gta6-01.
import { makeCar, driveCar, updateTraffic, updatePolice } from './vehicles.js';
import { spawnEnemy } from './actors.js';
import { syncCops } from './wanted.js';

const STEP = 1 / 60;
const fakeInput = {
  axis: () => ({ x: 0, z: -1 }),
  has: () => false,
};

function runSteps(G, seconds, drive) {
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    if (drive && G.player.inCar) driveCar(G, G.player.inCar, fakeInput, STEP);
    updateTraffic(G, STEP);
    updatePolice(G, STEP);
    G.time += STEP;
  }
}

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'drive') {
    // Danny in a red Comet GT, cruising the avenue with traffic around.
    const car = makeCar(G, 20, -120, Math.PI, 0xd41f2e, { kind: 'player', sport: true });
    p.inCar = car;
    car.speed = 20;
    p.pos.copy(car.pos);
    p.meshParts.group.visible = false;
    G.mode = 'play';
    G.camYaw = Math.PI;
    runSteps(G, 2.5, true);
    return 'play';
  }
  if (name === 'chase') {
    // Three stars, three interceptors on his tail, all on the same avenue.
    const car = makeCar(G, 60, 40, 0, 0x2e6fc2, { kind: 'player', sport: true });
    p.inCar = car;
    car.speed = 22;
    p.pos.copy(car.pos);
    p.meshParts.group.visible = false;
    G.wanted.level = 3;
    G.wanted.lastCrimeAt = G.time;
    syncCops(G);
    // Pull the interceptors in close: one oncoming (timed to meet Danny
    // head-on as the shot is taken) and two chasing from behind.
    const cops = G.cars.filter((c) => c.kind === 'police');
    if (cops[0]) { cops[0].pos.set(60, 0, 150); cops[0].heading = Math.PI; cops[0].speed = 24; }
    if (cops[1]) { cops[1].pos.set(55, 0, 14); cops[1].heading = 0; cops[1].speed = 24; }
    if (cops[2]) { cops[2].pos.set(65, 0, 8); cops[2].heading = 0; cops[2].speed = 24; }
    G.mode = 'play';
    G.camYaw = Math.PI;
    runSteps(G, 2.0, true);
    return 'play';
  }
  if (name === 'mission') {
    // On foot at Pier 9, Vipers in the open just ahead, mission banner up.
    p.pos.set(156, 0, 188);
    p.heading = Math.atan2(160 - 156, 170 - 188);
    p.meshParts.group.position.copy(p.pos);
    p.meshParts.group.rotation.y = p.heading;
    G.mission.index = 2;
    G.mission.step = 1;
    G.mission.active = true;
    G.mission.label = 'MISSION 3 — HARBOR HEAT';
    G.mission.desc = 'Take down all 4 Vipers.';
    G.mission.target = { x: 160, z: 160 };
    G.beacon.group.position.set(160, 0, 160);
    G.beacon.group.visible = true;
    spawnEnemy(G, 152, 172);
    spawnEnemy(G, 162, 174);
    spawnEnemy(G, 168, 170);
    spawnEnemy(G, 148, 174);
    G.mode = 'play';
    G.camYaw = p.heading + Math.PI;
    return 'play';
  }
  // Default: cover — the title screen over a high view of the city.
  G.mode = 'title';
  G.titleCam = { x: 130, y: 75, z: 235, lookX: -30, lookY: 6, lookZ: -60 };
  return 'title';
}
