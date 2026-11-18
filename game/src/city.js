// Solmar City itself: a coastal grid city built from a seeded RNG — roads,
// blocks, towers with lit windows, lamps, palms, a beach and the docks.
// Written fresh for gta6-01.
import * as THREE from 'three';
import { makeFacadeTexture, clamp } from './util.js';

export const CITY_HALF = 200;
export const ROAD_SPACING = 40;
export const ROAD_HALF = 5;
export const ROAD_COORDS = [];
for (let c = -180; c <= 180; c += ROAD_SPACING) ROAD_COORDS.push(c);

/** Canvas texture with big painted letters — garage / pier signs. */
function makeSignTexture(text, bg, fg, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = '900 56px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 52 : 64);
  if (sub) {
    g.font = '700 30px Arial, sans-serif';
    g.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#23262e'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#f5d76e';
  g.fillRect(28, 8, 8, 40); g.fillRect(28, 104, 8, 40); g.fillRect(28, 200, 8, 40);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(0, 0, 3, 256); g.fillRect(61, 0, 3, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the whole city. Returns { group, colliders, hideout, docks, hospital }. */
export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];

  // --- sky, fog, lights ---
  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0x8ec3e8, 180, 520);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6b52, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // --- ground, beach, sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x77815f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 26),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 216);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 90),
    new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, 274);
  group.add(sea);

  // --- roads (textured asphalt strips) ---
  const roadTexX = makeRoadTexture();
  const roadTexZ = makeRoadTexture();
  const roadMatX = new THREE.MeshLambertMaterial({ map: roadTexX });
  const roadMatZ = new THREE.MeshLambertMaterial({ map: roadTexZ });
  const roadLen = CITY_HALF * 2 + 24;
  for (const c of ROAD_COORDS) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen), roadMatX.clone());
    rx.material.map = roadTexX.clone();
    rx.material.map.repeat.set(1, roadLen / 16);
    rx.material.map.needsUpdate = true;
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(c, 0.03, 0);
    group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen), roadMatZ.clone());
    rz.material.map = roadTexZ.clone();
    rz.material.map.repeat.set(1, roadLen / 16);
    rz.material.map.needsUpdate = true;
    rz.rotation.x = -Math.PI / 2;
    rz.rotation.z = Math.PI / 2;
    rz.position.set(0, 0.03, c);
    group.add(rz);
  }

  // --- blocks: sidewalk slabs + buildings ---
  const facadeBases = ['#3a4256', '#4a3f35', '#35424a', '#4d3a4a', '#3d4a38', '#54422e'];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
  const blockSlabMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const blockSize = ROAD_SPACING - ROAD_HALF * 2; // 30
  const buildings = [];
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz += 1) {
      const x0 = ROAD_COORDS[ix] + ROAD_HALF;
      const z0 = ROAD_COORDS[iz] + ROAD_HALF;
      const cx = x0 + blockSize / 2;
      const cz = z0 + blockSize / 2;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 0.3, blockSize), blockSlabMat);
      slab.position.set(cx, 0.15, cz);
      group.add(slab);
      // 1-3 buildings per block, never covering the whole block.
      const count = rng.int(1, 3);
      const spots = [
        { x: cx - 7, z: cz - 7 }, { x: cx + 7, z: cz + 7 },
        { x: cx - 7, z: cz + 7 }, { x: cx + 7, z: cz - 7 },
        { x: cx, z: cz },
      ];
      for (let s = 0; s < count; s += 1) {
        const spot = spots[(ix * 3 + iz + s) % spots.length];
        const w = rng.range(9, 13);
        const d = rng.range(9, 13);
        const h = rng.chance(0.22) ? rng.range(28, 48) : rng.range(8, 24);
        const base = rng.pick(facadeBases);
        const tex = makeFacadeTexture(rng, base, 0.45);
        tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 15)));
        const side = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [side, side, roofMat, roofMat, side, side],
        );
        mesh.position.set(spot.x, h / 2 + 0.3, spot.z);
        group.add(mesh);
        buildings.push({ x: spot.x, z: spot.z, w, d, h });
        colliders.push({ x0: spot.x - w / 2, x1: spot.x + w / 2, z0: spot.z - d / 2, z1: spot.z + d / 2 });
        // Rooftop props on tall towers.
        if (h > 26 && rng.chance(0.6)) {
          const ant = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
            new THREE.MeshLambertMaterial({ color: 0x888888 }),
          );
          ant.position.set(spot.x + w / 4, h + 3.5, spot.z);
          group.add(ant);
          const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xff4444 }),
          );
          tip.position.set(spot.x + w / 4, h + 7, spot.z);
          group.add(tip);
        } else if (rng.chance(0.5)) {
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 1.2, 2.4),
            new THREE.MeshLambertMaterial({ color: 0x6a7078 }),
          );
          box.position.set(spot.x - w / 4, h + 0.9, spot.z);
          group.add(box);
        }
      }
      // A tree or two per block corner.
      if (rng.chance(0.55)) {
        const tx = cx + (rng.chance(0.5) ? -12 : 12);
        const tz = cz + (rng.chance(0.5) ? -12 : 12);
        addTree(group, tx, tz, rng);
      }
    }
  }

  // --- street lamps at every other intersection ---
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2f333a });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let ix = 0; ix < ROAD_COORDS.length; ix += 2) {
    for (let iz = 0; iz < ROAD_COORDS.length; iz += 2) {
      const x = ROAD_COORDS[ix] + 6.5;
      const z = ROAD_COORDS[iz] + 6.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), lampPoleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampHeadMat);
      head.position.set(x, 7.1, z);
      group.add(head);
    }
  }

  // --- palms along the beach ---
  for (let x = -190; x <= 190; x += 24) {
    if (rng.chance(0.75)) addPalm(group, x + rng.range(-4, 4), 206 + rng.range(-2, 2), rng);
  }

  // --- Rosa's Garage (hideout) at (-160, -160) block: low yellow building + sign ---
  const hideout = { x: -160, z: -160 };
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(20, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0xd8a020 }),
  );
  garage.position.set(hideout.x, 3.8, hideout.z);
  group.add(garage);
  colliders.push({ x0: hideout.x - 10, x1: hideout.x + 10, z0: hideout.z - 7, z1: hideout.z + 7 });
  const signTex = makeSignTexture("ROSA'S GARAGE", '#1c1c22', '#ffd23e', 'REPAIRS • NO QUESTIONS');
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(16, 4, 0.6),
    new THREE.MeshLambertMaterial({ map: signTex }),
  );
  sign.position.set(hideout.x, 8.6, hideout.z + 7.4);
  group.add(sign);

  // --- Pier 9 warehouse (docks) at (160, 160): the mission-3 shootout spot ---
  const docks = { x: 160, z: 160 };
  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(24, 10, 16),
    new THREE.MeshLambertMaterial({ color: 0x5a4a3a }),
  );
  warehouse.position.set(docks.x, 5.3, docks.z);
  group.add(warehouse);
  colliders.push({ x0: docks.x - 12, x1: docks.x + 12, z0: docks.z - 8, z1: docks.z + 8 });
  const pierTex = makeSignTexture('PIER 9', '#22303e', '#9fd4ff', 'SOLMAR DOCKS');
  const pierSign = new THREE.Mesh(
    new THREE.BoxGeometry(14, 3.4, 0.6),
    new THREE.MeshLambertMaterial({ map: pierTex }),
  );
  pierSign.position.set(docks.x, 11.4, docks.z - 8.4);
  group.add(pierSign);
  // Crates stacked by the pier.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const crateSpots = [[140, 142], [144, 146], [142, 148], [180, 144], [184, 150]];
  for (const [cx, cz] of crateSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), crateMat);
    crate.position.set(cx, 1.8, cz);
    crate.rotation.y = rng.range(0, Math.PI);
    group.add(crate);
    colliders.push({ x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.5, z1: cz + 1.5 });
  }

  // --- Solmar General Hospital (respawn point) at (160, -160) ---
  const hospital = { x: 160, z: -160 };
  const hosp = new THREE.Mesh(
    new THREE.BoxGeometry(22, 14, 16),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
  );
  hosp.position.set(hospital.x, 7.3, hospital.z);
  group.add(hosp);
  colliders.push({ x0: hospital.x - 11, x1: hospital.x + 11, z0: hospital.z - 8, z1: hospital.z + 8 });
  const hospTex = makeSignTexture('GENERAL HOSPITAL', '#ffffff', '#d43a2e', 'EMERGENCY');
  const hospSign = new THREE.Mesh(
    new THREE.BoxGeometry(15, 3.6, 0.6),
    new THREE.MeshLambertMaterial({ map: hospTex }),
  );
  hospSign.position.set(hospital.x, 15.2, hospital.z + 8.4);
  group.add(hospSign);

  scene.add(group);
  return { group, colliders, buildings, hideout, docks, hospital };
}

function addTree(group, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x6a4a28 }),
  );
  trunk.position.set(x, 1.6, z);
  group.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(rng.range(1.8, 2.6), 0),
    new THREE.MeshLambertMaterial({ color: 0x3f7a34 }),
  );
  leaves.position.set(x, 4.2, z);
  group.add(leaves);
}

function addPalm(group, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 }),
  );
  trunk.position.set(x, 3.5, z);
  trunk.rotation.z = rng.range(-0.12, 0.12);
  group.add(trunk);
  const top = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.4, 0),
    new THREE.MeshLambertMaterial({ color: 0x2e8b4a }),
  );
  top.scale.y = 0.45;
  top.position.set(x, 7.2, z);
  group.add(top);
}

// Keep a road coordinate inside the city, clamped to the drivable grid.
export function clampToCity(v) { return clamp(v, -CITY_HALF, CITY_HALF); }
