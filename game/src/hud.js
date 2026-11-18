// The HUD: health, armor, cash, ammo, wanted stars, clock, objective, a
// live canvas minimap, banners and toasts. All DOM — the 3D view stays clean.
// Written fresh for gta6-01.
import { CITY_HALF } from './city.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    healthFill: $('healthFill'), healthNum: $('healthNum'),
    armorFill: $('armorFill'), armorNum: $('armorNum'),
    cash: $('cash'), ammo: $('ammo'),
    wanted: $('wanted'), clock: $('clock'),
    objTitle: document.querySelector('#objective .t'),
    objDesc: document.querySelector('#objective .d'),
    speedo: $('speedo'), speedNum: document.querySelector('#speedo .n'),
    crosshair: $('crosshair'),
    banner: $('banner'), toast: $('toast'),
    vignette: $('vignette'),
    minimap: $('minimap'),
  };
  const mctx = el.minimap.getContext('2d');
  let bannerT = null, toastT = null;

  function showBanner(title, sub) {
    el.banner.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    el.banner.style.opacity = '1';
    if (bannerT) window.clearTimeout(bannerT);
    bannerT = window.setTimeout(() => { el.banner.style.opacity = '0'; }, 3400);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.style.opacity = '1';
    if (toastT) window.clearTimeout(toastT);
    toastT = window.setTimeout(() => { el.toast.style.opacity = '0'; }, 2600);
  }

  // Minimap: north-up, city roads + buildings + markers.
  function drawMinimap(G) {
    const S = 190;
    const scale = S / (CITY_HALF * 2 + 40);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#10141c';
    mctx.fillRect(0, 0, S, S);
    // Sea + beach at the south edge.
    mctx.fillStyle = '#1d5f8a';
    mctx.fillRect(0, toY(205), S, S - toY(205));
    mctx.fillStyle = '#8a7a52';
    mctx.fillRect(0, toY(200), S, toY(205) - toY(200));
    // Blocks.
    mctx.fillStyle = '#2c313c';
    for (const b of G.city.buildings) {
      mctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), Math.max(1, b.w * scale), Math.max(1, b.d * scale));
    }
    // Roads.
    mctx.strokeStyle = '#565e6e';
    mctx.lineWidth = Math.max(1, 10 * scale);
    for (const c of [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180]) {
      mctx.beginPath(); mctx.moveTo(toX(c), 0); mctx.lineTo(toX(c), S); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, toY(c)); mctx.lineTo(S, toY(c)); mctx.stroke();
    }
    // Hideout / docks.
    mctx.fillStyle = '#ffd23e';
    mctx.fillRect(toX(G.city.hideout.x) - 3, toY(G.city.hideout.z) - 3, 6, 6);
    mctx.fillStyle = '#9fd4ff';
    mctx.fillRect(toX(G.city.docks.x) - 3, toY(G.city.docks.z) - 3, 6, 6);
    // Mission target: pulsing diamond.
    const m = G.mission;
    if (m.target) {
      const pulse = 4 + Math.sin(G.time * 5) * 2;
      mctx.fillStyle = '#ffd23e';
      mctx.beginPath();
      mctx.moveTo(toX(m.target.x), toY(m.target.z) - pulse);
      mctx.lineTo(toX(m.target.x) + pulse, toY(m.target.z));
      mctx.lineTo(toX(m.target.x), toY(m.target.z) + pulse);
      mctx.lineTo(toX(m.target.x) - pulse, toY(m.target.z));
      mctx.closePath(); mctx.fill();
    }
    // Police (flashing).
    const flash = Math.floor(G.time * 4) % 2 === 0;
    for (const car of G.cars) {
      if (car.kind === 'police') {
        mctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
        mctx.beginPath();
        mctx.arc(toX(car.pos.x), toY(car.pos.z), 3.4, 0, Math.PI * 2);
        mctx.fill();
      }
    }
    // Player arrow.
    const p = G.player;
    const px = toX(p.pos.x), py = toY(p.pos.z);
    const heading = p.inCar ? p.inCar.heading : p.heading;
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(-heading + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(0, 2.5); mctx.lineTo(-4.5, 5);
    mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  function update(G) {
    const p = G.player;
    el.healthFill.style.width = `${Math.max(0, p.health)}%`;
    el.healthNum.textContent = Math.ceil(Math.max(0, p.health));
    el.armorFill.style.width = `${Math.max(0, p.armor)}%`;
    el.armorNum.textContent = Math.ceil(Math.max(0, p.armor));
    el.cash.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
    el.ammo.textContent = p.reloadT > 0 ? 'RELOADING…' : `PISTOL ${p.ammo} / ∞`;
    // Wanted stars.
    const stars = el.wanted.children.length ? el.wanted.children : null;
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      const lit = i < G.wanted.level;
      const cls = lit ? (G.wanted.level >= 4 ? 'hot' : 'lit') : '';
      html += `<span class="${cls}">★</span>`;
    }
    el.wanted.innerHTML = html;
    // Clock: game time starts 08:00, one game hour per 150 real seconds.
    const mins = 480 + Math.floor(G.time / 150 * 60);
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    el.objTitle.textContent = G.mission.label;
    el.objDesc.textContent = G.mission.desc;
    // Speedo.
    if (p.inCar) {
      el.speedo.style.display = 'block';
      el.speedNum.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6);
    } else {
      el.speedo.style.display = 'none';
    }
    el.crosshair.style.display = (!p.inCar && G.mode === 'play') ? 'block' : 'none';
    el.vignette.style.opacity = String(Math.min(0.9, G.hurtFlash));
    drawMinimap(G);
  }

  return {
    show: () => el.hud.classList.add('on'),
    hide: () => el.hud.classList.remove('on'),
    update,
    banner: showBanner,
    toast: showToast,
  };
}
