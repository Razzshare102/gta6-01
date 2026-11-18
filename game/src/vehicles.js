// Cars of Solmar City: boxy-but-pretty rides built from primitives, traffic
// that follows the road grid, stealable parked cars, and police interceptors.
// Written fresh for gta6-01.
import * as THREE from 'three';
import { clamp, angleDiff, dist2, collideCircle } from './util.js';
import { ROAD_COORDS, CITY_HALF } from './city.js';

const CAR_COLORS = [0xc23a2e, 0x2e6fc2, 0xd8c23a, 0x3aa655, 0x7a4fc2, 0xd8d8d8, 0x22262e, 0xc26a2e, 0x2ea8a0];
const TAXI_YELLOW = 0xf2c200;

export function createCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const sport = !!opts.sport;
  const police = !!opts.police;
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xe8e8e8 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const len = sport ? 4.8 : 4.4;
  const wid = 1.9;
  const bodyH = sport ? 0.55 : 0.75;
  const bodyY = sport ? 0.5 : 0.62;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = bodyY;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.25, 0.6, len * 0.48), darkMat);
  cabin.position.set(0, bodyY + bodyH / 2 + 0.28, sport ? 0.1 : -0.15);
  group.add(cabin);
  // Hood / trunk hints.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.1, 0.16, len * 0.2), bodyMat);
  hood.position.set(0, bodyY + bodyH / 2 + 0.02, len * 0.36);
  group.add(hood);

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e12 });
  const wheels = [];
  const wheelPos = [
    [-wid / 2, 0.36, len * 0.32], [wid / 2, 0.36, len * 0.32],
    [-wid / 2, 0.36, -len * 0.32], [wid / 2, 0.36, -len * 0.32],
  ];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    h.position.set(x, bodyY, len / 2 + 0.02);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(x, bodyY, -len / 2 - 0.02);
    group.add(t);
  }
  // Taxi sign / police light bar.
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: TAXI_YELLOW }));
    sign.position.set(0, bodyY + bodyH / 2 + 0.68, -0.1);
    group.add(sign);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.35;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, bodyY + bodyH / 2 + 0.62, -0.1);
    group.add(lightBar);
    // Black doors.
    const door = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.5, 1.4), new THREE.MeshLambertMaterial({ color: 0x16181d }));
    door.position.set(0, bodyY + 0.05, -0.1);
    group.add(door);
  }
  return { group, wheels, lightBar, length: len, width: wid };
}

export function makeCar(G, x, z, heading, color, opts = {}) {
  const built = createCarMesh(color, opts);
  built.group.position.set(x, 0, z);
  built.group.rotation.y = heading;
  G.scene.add(built.group);
  const car = {
    group: built.group,
    wheels: built.wheels,
    lightBar: built.lightBar,
    pos: built.group.position,
    heading,
    speed: 0,
    kind: opts.kind || 'traffic',
    color,
    sport: !!opts.sport,
    police: !!opts.police,
    taxi: !!opts.taxi,
    maxSpeed: opts.sport ? 36 : opts.police ? 30 : 26,
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    lane: opts.lane || 0,
    cruise: opts.cruise || 12,
    alive: true,
    flashT: 0,
    stuckT: 0,
    ramT: 0,
  };
  G.cars.push(car);
  return car;
}

function nearestRoadCoord(v) {
  let best = ROAD_COORDS[0], bd = Infinity;
  for (const c of ROAD_COORDS) {
    const d = Math.abs(c - v);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** Spawn the ambient traffic + parked cars for the city. */
export function spawnTraffic(G) {
  const rng = G.rng;
  for (let i = 0; i < 16; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(ROAD_COORDS);
    const along = rng.range(-CITY_HALF, CITY_HALF);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir * 2.4;
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(G, x, z, heading, rng.pick(CAR_COLORS), {
      kind: 'traffic', axis, dir, lane,
      cruise: rng.range(9, 14),
      taxi: rng.chance(0.15),
    });
    car.speed = car.cruise;
  }
  // Parked cars along road edges — free to steal.
  for (let i = 0; i < 9; i += 1) {
    const road = rng.pick(ROAD_COORDS);
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 1 : -1;
    const horiz = rng.chance(0.5);
    const x = horiz ? along : road + side * 4.2;
    const z = horiz ? road + side * 4.2 : along;
    const heading = horiz ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    makeCar(G, x, z, heading, rng.pick(CAR_COLORS), { kind: 'parked' });
  }
  // Danny's own starter sedan near the garage.
  const mine = makeCar(G, G.city.hideout.x + 16, G.city.hideout.z + 10, Math.PI / 2, 0x2e6fc2, { kind: 'parked' });
  mine.mine = true;
}

/** A police interceptor spawns on a road near the player. */
export function spawnPoliceCar(G) {
  const p = G.player.pos;
  const angle = G.rng.range(0, Math.PI * 2);
  const d = G.rng.range(55, 85);
  let x = p.x + Math.sin(angle) * d;
  let z = p.z + Math.cos(angle) * d;
  x = clamp(x, -CITY_HALF, CITY_HALF);
  z = clamp(z, -CITY_HALF, CITY_HALF);
  const heading = Math.atan2(p.x - x, p.z - z);
  return makeCar(G, x, z, heading, 0xe8e8e8, { kind: 'police', police: true });
}

/** Traffic follows its road; at intersections it sometimes turns. */
export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || !car.alive) continue;
    // Slow for a car ahead in the same lane.
    let target = car.cruise;
    for (const other of G.cars) {
      if (other === car || !other.alive) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
      const ahead = dx * fwdX + dz * fwdZ;
      const side = Math.abs(dx * fwdZ - dz * fwdX);
      if (ahead > 0 && ahead < 9 && side < 2.6) { target = Math.min(target, 3); break; }
    }
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    const step = car.speed * dt;
    car.pos.x += Math.sin(car.heading) * step;
    car.pos.z += Math.cos(car.heading) * step;
    // At an intersection, maybe turn onto the crossing road.
    const along = car.axis === 'x' ? car.pos.x : car.pos.z;
    const cross = car.axis === 'x' ? car.pos.z : car.pos.x;
    const road = nearestRoadCoord(cross);
    const alongRoad = nearestRoadCoord(along);
    if (Math.abs(cross - road) < 1.2 && Math.abs(along - alongRoad) < 2.5 && rng.chance(0.004)) {
      // Turn: swap axis, snap onto the crossing road.
      const newAxis = car.axis === 'x' ? 'z' : 'x';
      const newDir = rng.chance(0.5) ? 1 : -1;
      car.axis = newAxis;
      car.dir = newDir;
      car.lane = newDir * 2.4;
      if (newAxis === 'x') {
        car.pos.z = nearestRoadCoord(car.pos.z) + car.lane;
        car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.pos.x = nearestRoadCoord(car.pos.x) + car.lane;
        car.heading = newDir > 0 ? 0 : Math.PI;
      }
    }
    // Wrap around the city edge so traffic never runs out.
    if (car.pos.x > CITY_HALF + 10) car.pos.x = -CITY_HALF - 10;
    if (car.pos.x < -CITY_HALF - 10) car.pos.x = CITY_HALF + 10;
    if (car.pos.z > CITY_HALF + 10) car.pos.z = -CITY_HALF - 10;
    if (car.pos.z < -CITY_HALF - 10) car.pos.z = CITY_HALF + 10;
    car.group.rotation.y = car.heading;
    spinWheels(car, dt);
  }
}

function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
}

/** Police chase the player; they ram cars and push the player on foot. */
export function updatePolice(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.kind !== 'police' || !car.alive) continue;
    const d = dist2(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
    // Too far away: respawn closer so the heat never fizzles.
    if (d > 150) {
      const a = G.rng.range(0, Math.PI * 2);
      car.pos.x = clamp(p.pos.x + Math.sin(a) * 70, -CITY_HALF, CITY_HALF);
      car.pos.z = clamp(p.pos.z + Math.cos(a) * 70, -CITY_HALF, CITY_HALF);
    }
    const want = Math.atan2(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
    const turn = clamp(angleDiff(car.heading, want), -1.9 * dt, 1.9 * dt);
    car.heading += turn;
    const target = d > 12 ? 26 : 18;
    car.speed += clamp(target - car.speed, -20 * dt, 12 * dt);
    const step = car.speed * dt;
    car.pos.x += Math.sin(car.heading) * step;
    car.pos.z += Math.cos(car.heading) * step;
    if (collideCircle(car.pos, 2.1, G.city.colliders)) car.speed *= 0.5;
    car.group.rotation.y = car.heading;
    spinWheels(car, dt);
    // Flashing light bar.
    car.flashT += dt;
    if (car.lightBar) car.lightBar.visible = Math.floor(car.flashT * 4) % 2 === 0;
    // Ram the player's car: shove + shake + slow them.
    if (p.inCar && d < 4.6 && car.ramT <= 0) {
      car.ramT = 0.8;
      p.inCar.speed *= 0.55;
      G.shake = Math.max(G.shake, 0.5);
      G.audio.crash();
      G.damagePlayer(4, 'ram');
    }
    car.ramT -= dt;
    // On foot: a cop car that touches Danny hurts and knocks him.
    if (!p.inCar && d < 3.2 && car.ramT <= 0) {
      car.ramT = 1.0;
      G.damagePlayer(14, 'ram');
      const a = Math.atan2(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      p.pos.x += Math.sin(a) * 3;
      p.pos.z += Math.cos(a) * 3;
      G.shake = 0.7;
      G.audio.crash();
    }
  }
}

/**
 * Arcade driving for the player's car. Returns events for the caller:
 * { crashed, hitPed }.
 */
export function driveCar(G, car, input, dt) {
  const axis = input.axis();
  const events = { crashed: false, hitPed: false };
  const forward = axis.z < 0;
  const back = axis.z > 0;
  const handbrake = input.has('jump');
  if (forward) car.speed += 16 * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= 26 * dt; // brake
    else car.speed -= 9 * dt; // reverse
  }
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  }
  car.speed = clamp(car.speed, car.sport ? -12 : -10, car.maxSpeed);
  const steerInput = axis.x; // +1 = right
  const steerAuthority = clamp(Math.abs(car.speed) / 10, 0, 1) * (handbrake ? 1.5 : 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steerInput * 1.9 * steerAuthority * dir * dt;
  const prevX = car.pos.x, prevZ = car.pos.z;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  if (collideCircle(car.pos, 2.1, G.city.colliders)) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    car.pos.x = prevX; car.pos.z = prevZ;
    if (impact > 8) {
      events.crashed = true;
      G.shake = Math.max(G.shake, Math.min(0.8, impact / 40));
      G.audio.crash();
    }
  }
  // Car-vs-car: push apart, bleed speed.
  for (const other of G.cars) {
    if (other === car || !other.alive) continue;
    const d = dist2(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const nx = (car.pos.x - other.pos.x) / d;
      const nz = (car.pos.z - other.pos.z) / d;
      car.pos.x += nx * push; car.pos.z += nz * push;
      if (other.kind === 'traffic' || other.kind === 'parked') {
        other.pos.x -= nx * push; other.pos.z -= nz * push;
        other.speed = Math.max(0, other.speed - 4);
      }
      const impact = Math.abs(car.speed);
      car.speed *= 0.6;
      if (impact > 10) { events.crashed = true; G.audio.crash(); G.shake = Math.max(G.shake, 0.4); }
    }
  }
  // Running over pedestrians.
  for (const ped of G.peds) {
    if (!ped.alive || ped.down) continue;
    const d = dist2(car.pos.x, car.pos.z, ped.pos.x, ped.pos.z);
    if (d < 2.6 && Math.abs(car.speed) > 3) {
      ped.down = true;
      ped.downT = 0;
      ped.velX = Math.sin(car.heading) * 8;
      ped.velZ = Math.cos(car.heading) * 8;
      events.hitPed = true;
      car.speed *= 0.85;
    }
  }
  car.group.rotation.y = car.heading;
  // Front wheels steer visually.
  const steerAngle = steerInput * 0.42 * steerAuthority;
  if (car.wheels[0]) car.wheels[0].rotation.y = steerAngle;
  if (car.wheels[1]) car.wheels[1].rotation.y = steerAngle;
  spinWheels(car, dt);
  return events;
}

/** Remove a car from the world (police cleanup, mission cleanup). */
export function removeCar(G, car) {
  car.alive = false;
  G.scene.remove(car.group);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}
