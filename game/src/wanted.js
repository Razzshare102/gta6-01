// The wanted system: crimes raise the heat, police cars spawn to match it,
// the heat cools when Danny lays low, and lingering near a cop gets him busted.
// Written fresh for gta6-01.
import { dist2 } from './util.js';
import { spawnPoliceCar, removeCar } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    lastCrimeAt: -999,
    decayT: 0,
    bustT: 0,
  };
}

/** Distance to the nearest active police car (Infinity when none). */
export function nearestCopDist(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'police' || !car.alive) continue;
    const d = dist2(car.pos.x, car.pos.z, G.player.pos.x, G.player.pos.z);
    if (d < best) best = d;
  }
  return best;
}

/** Register a crime. stars 0 = noisy but only counts if police are near. */
export function addCrime(G, kind, stars) {
  const w = G.wanted;
  if (stars > 0) {
    w.level = Math.min(5, w.level + stars);
    w.lastCrimeAt = G.time;
    w.decayT = 0;
    G.audio.sirenBlip();
  }
  syncCops(G);
}

/** Keep the number of police cars on the street matched to the wanted level. */
export function syncCops(G) {
  const w = G.wanted;
  const want = w.level === 0 ? 0 : Math.min(w.level, 4);
  const cops = G.cars.filter((c) => c.kind === 'police' && c.alive);
  while (cops.length < want) {
    spawnPoliceCar(G);
    cops.push(G.cars[G.cars.length - 1]);
  }
  while (cops.length > want) {
    const c = cops.pop();
    removeCar(G, c);
  }
  G.audio.setSiren(w.level > 0);
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  const p = G.player;
  // Cool down: no crime for a while and no cop close by.
  if (w.level > 0 && G.time - w.lastCrimeAt > 10 && nearestCopDist(G) > 70) {
    w.decayT += dt;
    if (w.decayT >= 12) {
      w.decayT = 0;
      w.level -= 1;
      syncCops(G);
      if (w.level === 0) G.toast('You lost the cops.');
    }
  } else {
    w.decayT = 0;
  }
  // Busted: a cop car sits on Danny while he is slow or on foot.
  if (w.level > 0) {
    const d = nearestCopDist(G);
    const cornered = !p.inCar ? d < 4 : (d < 7 && Math.abs(p.inCar.speed) < 3);
    if (cornered) {
      w.bustT += dt;
      if (w.bustT > 0.6) G.toast('The cops are on you — MOVE!');
      if (w.bustT > 2.5) {
        w.bustT = 0;
        G.busted();
      }
    } else {
      w.bustT = Math.max(0, w.bustT - dt * 2);
    }
  } else {
    w.bustT = 0;
  }
}

/** Drop the heat entirely (mission complete, story beats). */
export function clearWanted(G) {
  G.wanted.level = 0;
  G.wanted.bustT = 0;
  G.wanted.decayT = 0;
  syncCops(G);
}
