// Shared helpers for Solmar City: seeded randomness, maths, canvas textures
// and the circle-vs-building collision the whole city runs on.
// Written fresh for gta6-01; no code copied from any other game.
import * as THREE from 'three';

/** Deterministic RNG (mulberry32) so ?seed=N replays the same city. */
export function createRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) { return min + this.next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(list) { return list[Math.floor(this.next() * list.length)]; },
    chance(p) { return this.next() < p; },
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Shortest signed angle from a to b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Push a circle (x, z, radius) out of every axis-aligned box collider it
 * overlaps. Returns true when a push happened. Colliders are {x0, z0, x1, z1}.
 */
export function collideCircle(p, radius, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const cx = clamp(p.x, c.x0, c.x1);
    const cz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * radius;
      p.z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: shove out along the smallest penetration.
      const pl = p.x - c.x0, pr = c.x1 - p.x, pt = p.z - c.z0, pb = c.z1 - p.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = c.x0 - radius;
      else if (m === pr) p.x = c.x1 + radius;
      else if (m === pt) p.z = c.z0 - radius;
      else p.z = c.z1 + radius;
    }
  }
  return hit;
}

/** True when point (x, z) is inside any collider (with optional padding). */
export function insideAny(x, z, colliders, pad = 0) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}

/** A building facade: dark wall with a grid of windows, some lit warm. */
export function makeFacadeTexture(rng, base, litRatio) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical grime.
  for (let i = 0; i < 40; i += 1) {
    g.fillStyle = `rgba(0,0,0,${0.05 + rng.next() * 0.08})`;
    g.fillRect(rng.range(0, 120), 0, rng.range(2, 8), 256);
  }
  const cols = 6, rows = 12;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd98a' : '#9fd4ff') : '#10151f';
      g.fillRect(8 + c * 20, 10 + r * 20, 12, 13);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Flat colour texture helper for tinted box faces. */
export function makeColorTexture(hex) {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 4;
  const g = cv.getContext('2d');
  g.fillStyle = hex;
  g.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
