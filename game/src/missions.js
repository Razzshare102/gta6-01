// The story of Solmar City: three jobs for Mama Rosa, chained — a pickup, a
// hot car, and a shootout at Pier 9 — plus cash stashes hidden around town.
// Written fresh for gta6-01.
import * as THREE from 'three';
import { dist2 } from './util.js';
import { makeCar } from './vehicles.js';
import { spawnEnemy } from './actors.js';
import { clearWanted, addCrime } from './wanted.js';

export const MISSION_NAMES = ['The Pickup', 'Hot Wheels', 'Harbor Heat'];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    storyDone: false,
    target: null, // { x, z }
    label: 'FREE ROAM',
    desc: 'Explore Solmar City. Steal a car, take a mission, stay out of trouble.',
    targetCar: null,
    packageMesh: null,
  };
}

function makeBeacon(G) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  group.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  gem.position.y = 4.5;
  group.add(gem);
  group.visible = false;
  G.scene.add(group);
  return { group, gem };
}

function setTarget(G, x, z, label, desc) {
  const m = G.mission;
  m.target = { x, z };
  m.label = label;
  m.desc = desc;
  G.beacon.group.position.set(x, 0, z);
  G.beacon.group.visible = true;
}

function clearTarget(G) {
  G.mission.target = null;
  G.beacon.group.visible = false;
}

/** Cash pickups scattered around the city. */
export function spawnPickups(G, takenIds = []) {
  const spots = [
    [-100, -140], [60, -180], [180, -60], [-180, 60], [20, 140],
    [140, 20], [-60, 100], [100, 60], [-20, -60], [180, 180],
  ];
  G.pickups = spots.map(([x, z], i) => {
    const mesh = new THREE.Group();
    const bill = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x37d67a }),
    );
    mesh.add(bill);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x37d67a, transparent: true, opacity: 0.18 }),
    );
    mesh.add(glow);
    mesh.position.set(x, 1.4, z);
    G.scene.add(mesh);
    return { id: i, pos: { x, z }, mesh, value: 60 + i * 15, taken: takenIds.includes(i) };
  });
  for (const p of G.pickups) if (p.taken) p.mesh.visible = false;
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 2.2;
    pk.mesh.position.y = 1.4 + Math.sin(G.time * 2 + pk.id) * 0.25;
    const d = dist2(pk.pos.x, pk.pos.z, p.pos.x, p.pos.z);
    if (d < 2.4) {
      pk.taken = true;
      pk.mesh.visible = false;
      p.cash += pk.value;
      G.audio.cash();
      G.toast(`+$${pk.value} stash found!`);
      G.saveGame();
    }
  }
}

/** Start (or resume) the story at mission `index`. */
export function startStory(G, index = 0) {
  const m = G.mission;
  m.index = index;
  m.step = 0;
  m.active = true;
  m.storyDone = false;
  if (index === 0) {
    // A glowing package waits at the Pier 9 intersection.
    if (!m.packageMesh) {
      const pkg = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 1.2),
        new THREE.MeshLambertMaterial({ color: 0x8a5a2a, emissive: 0x664411 }),
      );
      pkg.position.set(140, 0.6, 160);
      G.scene.add(pkg);
      m.packageMesh = pkg;
    }
    m.packageMesh.visible = true;
    setTarget(G, 140, 160, 'MISSION 1 — THE PICKUP', "Rosa's package is waiting at Pier 9. Go get it.");
    G.banner('MISSION 1: THE PICKUP', "Rosa's package is at Pier 9");
  } else if (index === 1) {
    startHotWheels(G);
  } else if (index === 2) {
    setTarget(G, 160, 176, 'MISSION 3 — HARBOR HEAT', 'Get to the docks. The Vipers are waiting.');
    G.banner('MISSION 3: HARBOR HEAT', 'Take the docks back');
  }
}

function startHotWheels(G) {
  const m = G.mission;
  if (!m.targetCar || !m.targetCar.alive) {
    m.targetCar = makeCar(G, 100, -100, Math.PI / 2, 0xd41f2e, { kind: 'special', sport: true });
  }
  setTarget(G, 100, -100, 'MISSION 2 — HOT WHEELS', 'A red Comet GT is parked uptown. Take it.');
  G.banner('MISSION 2: HOT WHEELS', 'Steal the Comet GT');
}

function completeMission(G, reward, next) {
  const m = G.mission;
  const p = G.player;
  p.cash += reward;
  G.audio.missionDone();
  clearWanted(G);
  G.banner(`MISSION COMPLETE  +$${reward}`, MISSION_NAMES[m.index]);
  G.toast(`Mission complete! +$${reward}`);
  G.saveGame();
  clearTarget(G);
  m.index = next;
  m.step = 0;
  if (next >= MISSION_NAMES.length) {
    m.storyDone = true;
    m.active = false;
    m.label = 'SOLMAR CITY IS YOURS';
    m.desc = 'Story complete. Free roam — the city is yours, Danny.';
    G.banner('SOLMAR CITY IS YOURS', 'Story complete — free roam');
  } else {
    startStory(G, next);
  }
}

export function updateMissions(G, dt) {
  const m = G.mission;
  const p = G.player;
  if (G.beacon.group.visible) G.beacon.gem.rotation.y += dt * 2.5;
  if (!m.active || m.storyDone) return;
  const t = m.target;
  if (!t) return;
  const d = dist2(t.x, t.z, p.pos.x, p.pos.z);

  if (m.index === 0) {
    if (m.step === 0 && d < 3.5) {
      if (m.packageMesh) m.packageMesh.visible = false;
      G.audio.pickup();
      G.banner('PACKAGE SECURED', 'Get it back to Rosa\'s Garage');
      m.step = 1;
      setTarget(G, -140, -160, 'MISSION 1 — THE PICKUP', 'Bring the package to Rosa\'s Garage.');
    } else if (m.step === 1 && d < 6) {
      completeMission(G, 500, 1);
    }
  } else if (m.index === 1) {
    if (m.step === 0) {
      if (p.inCar === m.targetCar) {
        m.step = 1;
        addCrime(G, 'theft', 2);
        G.banner('HOT CAR!', 'Lose the heat, then bring it to Rosa\'s');
        setTarget(G, -140, -160, 'MISSION 2 — HOT WHEELS', 'Deliver the Comet GT to Rosa\'s Garage.');
      } else if (m.targetCar && !m.targetCar.alive) {
        startHotWheels(G);
      }
    } else if (m.step === 1 && p.inCar === m.targetCar && d < 7) {
      completeMission(G, 900, 2);
    }
  } else if (m.index === 2) {
    if (m.step === 0 && d < 8) {
      m.step = 1;
      G.banner('THE VIPERS ARE HERE', 'Clear the docks!');
      setTarget(G, 160, 160, 'MISSION 3 — HARBOR HEAT', 'Take down all 4 Vipers.');
      const spots = [[145, 150], [175, 150], [148, 172], [172, 174]];
      for (const [x, z] of spots) spawnEnemy(G, x, z);
    } else if (m.step === 1 && G.enemies.length === 0) {
      m.step = 2;
      G.audio.missionDone();
      G.banner('DOCKS CLEAR', 'Grab the getaway car');
      const car = makeCar(G, 160, 185, Math.PI, 0x14141a, { kind: 'special', sport: true });
      m.targetCar = car;
      setTarget(G, 160, 185, 'MISSION 3 — HARBOR HEAT', 'Take the getaway car.');
    } else if (m.step === 2 && p.inCar === m.targetCar) {
      m.step = 3;
      setTarget(G, -140, -160, 'MISSION 3 — HARBOR HEAT', 'Drive the getaway car to Rosa\'s Garage.');
      G.banner('GO! GO! GO!', 'Lose any heat on the way home');
    } else if (m.step === 3 && p.inCar === m.targetCar && d < 7) {
      completeMission(G, 1500, 3);
    }
  }
}

export function initMissions(G) {
  G.beacon = makeBeacon(G);
}
