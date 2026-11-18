// Particles and tracers: tiny pooled meshes for impacts, and fading lines
// for gunfire. Written fresh for gta6-01.
import * as THREE from 'three';

export function createFx(G) {
  const particles = [];
  const tracers = [];
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  function spawnBurst(x, y, z, color, count = 10) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i += 1) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      G.scene.add(m);
      particles.push({
        mesh: m,
        vx: (G.rng.next() - 0.5) * 9,
        vy: G.rng.next() * 7 + 1,
        vz: (G.rng.next() - 0.5) * 9,
        life: 0.5 + G.rng.next() * 0.4,
      });
    }
  }

  function spawnTracer(x1, y1, z1, x2, y2, z2, color) {
    const geoLine = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2),
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geoLine, mat);
    G.scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        G.scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 16 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.08) { p.mesh.position.y = 0.08; p.vy *= -0.4; }
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.95;
      if (t.life <= 0) {
        G.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
  }

  return { spawnBurst, spawnTracer, update };
}
