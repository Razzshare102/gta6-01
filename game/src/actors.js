// The people of Solmar City: Danny on foot, wandering pedestrians, and the
// Vipers — the rival gang that fights back in the docks. Plus the pistol.
// Written fresh for gta6-01.
import * as THREE from 'three';
import { clamp, angleDiff, dist2, collideCircle } from './util.js';
import { ROAD_COORDS, CITY_HALF } from './city.js';

const SHIRT_COLORS = [0xd8d8d8, 0x2e6fc2, 0xc23a2e, 0x3aa655, 0xd8c23a, 0x7a4fc2, 0xe08a2e, 0x4a4a52];
const PANTS_COLORS = [0x2a2f3a, 0x3a3f4a, 0x4a3a2a, 0x22262e];

function buildHumanoid(shirt, pants, skin = 0xd9a066) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  head.position.y = 1.78;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x1a1410 }));
  hair.position.y = 1.97;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.28), pantsMat);
  legL.position.set(-0.17, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), shirtMat);
  armL.position.set(-0.42, 1.2, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function createPlayerMesh() {
  // Danny Cole: yellow jacket, dark jeans.
  return buildHumanoid(0xf2b705, 0x2a2f3a, 0xd9a066);
}

/** Spawn the ambient pedestrians. */
export function spawnPeds(G) {
  const rng = G.rng;
  for (let i = 0; i < 24; i += 1) {
    const road = rng.pick(ROAD_COORDS);
    const along = rng.range(-180, 180);
    const horiz = rng.chance(0.5);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = horiz ? along : road + side * 7.5;
    const z = horiz ? road + side * 7.5 : along;
    const parts = buildHumanoid(rng.pick(SHIRT_COLORS), rng.pick(PANTS_COLORS));
    parts.group.position.set(x, 0, z);
    G.scene.add(parts.group);
    G.peds.push({
      group: parts.group, legL: parts.legL, legR: parts.legR,
      pos: parts.group.position,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      walkPhase: rng.range(0, Math.PI * 2),
      axis: horiz ? 'x' : 'z',
      dir: rng.chance(0.5) ? 1 : -1,
      lane: side * 7.5,
      road,
      fleeT: 0,
      fleeX: 0, fleeZ: 0,
      down: false, downT: 0,
      velX: 0, velZ: 0,
      alive: true,
      counted: false, // crime already counted for this ped
    });
  }
}

export function updatePeds(G, dt) {
  const rng = G.rng;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (ped.down) {
      ped.downT += dt;
      ped.pos.x += ped.velX * dt;
      ped.pos.z += ped.velZ * dt;
      ped.velX *= (1 - 3 * dt); ped.velZ *= (1 - 3 * dt);
      if (ped.downT > 4) {
        ped.down = false;
        ped.group.rotation.x = 0;
        ped.pos.y = 0;
        ped.fleeT = 3;
        ped.fleeX = ped.pos.x - G.player.pos.x;
        ped.fleeZ = ped.pos.z - G.player.pos.z;
      }
      continue;
    }
    let speed = ped.speed;
    let heading = ped.heading;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      speed = 5.2;
      heading = Math.atan2(ped.fleeX, ped.fleeZ);
    } else {
      // Walk the sidewalk of their road; turn at intersections sometimes.
      const along = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
      if (Math.abs(along % 40) < 1.5 && rng.chance(0.01)) {
        ped.axis = ped.axis === 'x' ? 'z' : 'x';
        ped.dir = rng.chance(0.5) ? 1 : -1;
        ped.lane = ped.dir * 7.5;
        if (ped.axis === 'x') ped.pos.z = ped.road + ped.lane;
        else ped.pos.x = ped.road + ped.lane;
      }
      heading = ped.axis === 'x'
        ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (ped.dir > 0 ? 0 : Math.PI);
      // Flee a nearby speeding car or a gunshot.
      const pd = dist2(ped.pos.x, ped.pos.z, G.player.pos.x, G.player.pos.z);
      if (G.player.inCar && pd < 9 && Math.abs(G.player.inCar.speed) > 8) {
        ped.fleeT = 2.5;
        ped.fleeX = ped.pos.x - G.player.pos.x;
        ped.fleeZ = ped.pos.z - G.player.pos.z;
      }
    }
    ped.heading += angleDiff(ped.heading, heading) * Math.min(1, 8 * dt);
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    ped.pos.x = clamp(ped.pos.x, -CITY_HALF, CITY_HALF);
    ped.pos.z = clamp(ped.pos.z, -CITY_HALF, CITY_HALF);
    ped.walkPhase += speed * dt * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.group.rotation.y = ped.heading;
  }
}

/** Knock a pedestrian down (car hit or bullet). Counts the crime once. */
export function knockPed(G, ped, vx, vz) {
  if (ped.down) return;
  ped.down = true;
  ped.downT = 0;
  ped.velX = vx; ped.velZ = vz;
  ped.group.rotation.x = -Math.PI / 2;
  ped.pos.y = 0.35;
  if (!ped.counted) {
    ped.counted = true;
    G.addCrime('assault', 1);
  }
}

/** A Viper gang member: red jacket, fights back with a pistol. */
export function spawnEnemy(G, x, z) {
  const parts = buildHumanoid(0xb02020, 0x1c1c22, 0xc98d5a);
  // Red bandana.
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34), new THREE.MeshLambertMaterial({ color: 0x8a0f0f }));
  band.position.y = 1.88;
  parts.group.add(band);
  parts.group.position.set(x, 0, z);
  G.scene.add(parts.group);
  // Health bar above the head.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
  barBg.position.y = 2.25;
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide }));
  barFg.position.set(0, 2.25, 0.01);
  parts.group.add(barBg); parts.group.add(barFg);
  const enemy = {
    group: parts.group, legL: parts.legL, legR: parts.legR,
    barFg, barBg,
    pos: parts.group.position,
    heading: 0,
    health: 100,
    shootT: G.rng.range(0.5, 1.5),
    walkPhase: 0,
    alive: true,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
    const want = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    e.heading += angleDiff(e.heading, want) * Math.min(1, 6 * dt);
    e.group.rotation.y = e.heading;
    // Close to firing range, then stand and shoot.
    if (d > 16) {
      e.pos.x += Math.sin(e.heading) * 3.4 * dt;
      e.pos.z += Math.cos(e.heading) * 3.4 * dt;
      collideCircle(e.pos, 0.6, G.city.colliders);
      e.walkPhase += dt * 9;
      e.legL.rotation.x = Math.sin(e.walkPhase) * 0.5;
      e.legR.rotation.x = -Math.sin(e.walkPhase) * 0.5;
    } else {
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 48) {
        e.shootT = 1.3 + G.rng.range(0, 0.7);
        G.audio.enemyShoot();
        G.spawnTracer(e.pos.x, 1.5, e.pos.z, p.pos.x, 1.2, p.pos.z, 0xffcc66);
        // Hit chance falls with distance; a hit hurts.
        const chance = clamp(0.55 - d * 0.008, 0.08, 0.55);
        if (G.rng.next() < chance) G.damagePlayer(7 + G.rng.range(0, 5), 'shot');
      }
    }
    // Health bar always faces the camera.
    e.barBg.lookAt(G.camera.position);
    e.barFg.lookAt(G.camera.position);
  }
}

export function damageEnemy(G, enemy, amount) {
  enemy.health -= amount;
  enemy.barFg.scale.x = Math.max(0.001, enemy.health / 100);
  // Bar shrinks from the left: shift it so the left edge stays put.
  enemy.barFg.position.x = -(1.06 * (1 - enemy.health / 100)) / 2;
  if (enemy.health <= 0) {
    enemy.alive = false;
    G.scene.remove(enemy.group);
    const i = G.enemies.indexOf(enemy);
    if (i >= 0) G.enemies.splice(i, 1);
    G.spawnBurst(enemy.pos.x, 1.2, enemy.pos.z, 0xff5040, 14);
    G.audio.hit();
    return true;
  }
  return false;
}

/** Hitscan pistol shot from the camera through the crosshair. */
// One star of heat at most every 2 s of game time, so a burst of shots
// doesn't jump straight to five stars. Module-level because shoot() is
// called with G, and G.time resets to 0 on a new run (guarded below).
let lastShotHeatAt = -999;

export function shoot(G) {
  const p = G.player;
  if (p.reloading || p.reloadT > 0) return;
  if (p.ammo <= 0) {
    G.audio.dryClick();
    startReload(G);
    return;
  }
  p.ammo -= 1;
  G.audio.shoot();
  G.shake = Math.max(G.shake, 0.12);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = G.camera.position.clone();
  const ray = new THREE.Raycaster(origin, dir, 0.1, 90);
  // Targets: enemies, then peds, then cars (sparks only).
  const targets = [];
  for (const e of G.enemies) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    box.position.set(e.pos.x, 1, e.pos.z);
    box.updateMatrixWorld();
    targets.push({ mesh: box, kind: 'enemy', ref: e });
  }
  for (const ped of G.peds) {
    if (ped.down) continue;
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    box.position.set(ped.pos.x, 1, ped.pos.z);
    box.updateMatrixWorld();
    targets.push({ mesh: box, kind: 'ped', ref: ped });
  }
  for (const car of G.cars) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6));
    box.position.set(car.pos.x, 0.9, car.pos.z);
    box.rotation.y = car.heading;
    box.updateMatrixWorld();
    targets.push({ mesh: box, kind: 'car', ref: car });
  }
  const hits = ray.intersectObjects(targets.map((t) => t.mesh), false);
  let end = origin.clone().add(dir.clone().multiplyScalar(60));
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    const target = targets.find((t) => t.mesh === hit.object);
    if (target) {
      if (target.kind === 'enemy') {
        const killed = damageEnemy(G, target.ref, 34);
        G.spawnBurst(end.x, end.y, end.z, 0xff5040, 8);
        if (killed) G.toast('Viper down!');
      } else if (target.kind === 'ped') {
        knockPed(G, target.ref, dir.x * 6, dir.z * 6);
        G.spawnBurst(end.x, end.y, end.z, 0xff5040, 8);
      } else {
        G.spawnBurst(end.x, end.y, end.z, 0xffd23e, 6);
        G.addCrime('shooting', 0); // shooting at cars is loud; heat only if cops near
      }
    }
  }
  G.spawnTracer(origin.x, origin.y, origin.z, end.x, end.y, end.z, 0xffe9a8);
  // A loud pistol shot on a public street is a crime — witnesses hear it.
  // One star per shot, at most one star every 2 s, so a single burst
  // doesn't jump straight to five stars. Before this fix a shot only
  // counted when a cop was already near, so firing on an empty street
  // left wanted at 0 forever and no police ever came.
  if (lastShotHeatAt > G.time) lastShotHeatAt = -999; // new run: the clock reset
  if (G.time - lastShotHeatAt >= 2) {
    lastShotHeatAt = G.time;
    G.addCrime('shooting', 1);
  }
  if (p.ammo === 0) startReload(G);
}

export function startReload(G) {
  const p = G.player;
  if (p.reloadT > 0 || p.ammo === 12) return;
  p.reloadT = 1.1;
  G.audio.reload();
}

/** On-foot movement: camera-relative WASD, sprint, jump, gravity, collision. */
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const axis = input.axis();
  const sprint = input.has('sprint');
  const speed = sprint ? 8.6 : 5.2;
  // Move relative to camera yaw.
  const yaw = G.camYaw;
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  let mx = fwdX * -axis.z + rightX * axis.x;
  let mz = fwdZ * -axis.z + rightZ * axis.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.moving = true;
  } else {
    p.moving = false;
  }
  collideCircle(p.pos, 0.6, G.city.colliders);
  p.pos.x = clamp(p.pos.x, -CITY_HALF - 20, CITY_HALF + 20);
  p.pos.z = clamp(p.pos.z, -CITY_HALF - 20, 250);
  // Jump + gravity.
  if (input.has('jump') && p.onGround) {
    p.velY = 8.5;
    p.onGround = false;
  }
  p.velY -= 24 * dt;
  p.pos.y += p.velY * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.velY = 0; p.onGround = true; }
  // Walk animation.
  p.walkPhase += (p.moving ? speed : 0) * dt * 1.9;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.meshParts.legL.rotation.x = swing;
  p.meshParts.legR.rotation.x = -swing;
  p.meshParts.group.position.copy(p.pos);
  p.meshParts.group.rotation.y = p.heading;
  // Reload timer.
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { p.ammo = 12; p.reloadT = 0; }
  }
}
