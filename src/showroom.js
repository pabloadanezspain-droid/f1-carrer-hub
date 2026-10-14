/* ==========================================================================
   showroom.js — cinematic team-by-team Grid Showroom, full-grid reveal and
   exportable team cards (canvas → PNG).
   Routes: #/showroom[/teamId][?season=]   #/showroom/grid[?season=]
   ========================================================================== */

/* ---- motion preference: 'auto' follows the OS, or forced 'reduced' / 'full' ---- */
const Motion = {
  key: 'f1ch.prefs.motion',
  get() { try { return localStorage.getItem(this.key) || 'auto'; } catch (e) { return 'auto'; } },
  set(v) { try { localStorage.setItem(this.key, v); } catch (e) { /* per-viewer convenience only */ } this.apply(); },
  reduced() { const v = this.get(); return v === 'reduced' || (v === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); },
  apply() { document.documentElement.classList.toggle('reduce-motion', this.reduced()); },
};
let srDirection = 0; // +1 next, -1 previous: drives the wipe direction of the next render

function showroomContext(c, s) {
  const rounds = roundsOf(c, s.id);
  const cur = nextRound(c, s.id) || rounds[rounds.length - 1] || { round: 1 };
  const lu = lineupAt(c, s.id, cur.round);
  const order = teamStandings(c, s.id).map(r => r.id).filter(id => lu[id] && lu[id].length);
  Object.keys(lu).forEach(id => { if (!order.includes(id)) order.push(id); });
  return { cur, lu, order, done: completedRounds(c, s.id).length };
}

/* points a driver scored FOR this team (a transferred driver's earlier points stay with the old team) */
function pointsForTeam(c, seasonId, teamId, driverId) {
  let p = 0;
  roundsOf(c, seasonId).forEach(rd => ['race', 'sprint'].forEach(x => classify(c, resultFor(c, rd.id, x)).forEach(e => { if (e.teamId === teamId && e.driverId === driverId) p += e.pts; })));
  return p;
}

function motionToggle() {
  const v = Motion.get();
  const label = { auto: 'Motion: auto', reduced: 'Motion: reduced', full: 'Motion: full' }[v];
  return `<button class="chip" type="button" data-motion-cycle title="Cycle animation setting (auto follows your system's reduced-motion preference)">${label}</button>`;
}

function pageShowroom(teamId, q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const ctx = showroomContext(c, s);
  if (!ctx.order.length) return { title: 'Showroom', nav: 'showroom', html: `<div class="wrap page">${emptyState('No line-up yet', 'Assign drivers to teams for this season first.', { href: '#/edit/assignments', label: 'Line-ups' })}</div>` };
  const tid = ctx.order.includes(teamId) ? teamId : ctx.order[0];
  const t = teamOf(tid);
  const i = ctx.order.indexOf(tid);
  const prev = ctx.order[(i - 1 + ctx.order.length) % ctx.order.length], next = ctx.order[(i + 1) % ctx.order.length];
  const ts = teamStandings(c, s.id).find(r => r.id === tid) || { points: 0, wins: 0, podiums: 0, position: null };
  const tst = statsFor(c, 'teams', tid, s.id);
  const ds = driverStandings(c, s.id);
  const drivers = (ctx.lu[tid] || []).map(driverOf).filter(Boolean);
  const split = drivers.map(d => ({ d, p: pointsForTeam(c, s.id, tid, d.id) }));
  const splitTotal = split.reduce((a, x) => a + x.p, 0);
  const q2 = seasonQ(s);
  const started = ctx.done > 0;
  const pos = n => (started && n ? `P${n}` : '—');

  const driverHtml = (d, k) => {
    const row = ds.find(r => r.id === d.id) || {};
    const st = statsFor(c, 'drivers', d.id, s.id);
    return `<a class="sr-driver" href="#/drivers/${d.id}${q2}" style="--i:${k}">
      <span class="sr-portrait-wrap">${portraitImg(d, t, 'sr-portrait')}</span>
      <span class="sr-plate">
        ${numberArt(d, 'sr-num')}
        <span class="sr-dname"><span>${esc(d.firstName)}</span><b>${esc(d.lastName)}</b></span>
        <span class="sr-dmeta">${flag(d.nationality, 'flag-round')} ${esc(countryName(d.nationality))}</span>
        <span class="sr-dstats"><span><small>Pos</small>${pos(row.position)}</span><span><small>Pts</small>${row.points || 0}</span><span><small>Wins</small>${st.wins}</span><span><small>Podiums</small>${st.podiums}</span></span>
      </span></a>`;
  };

  return { title: `${t.name} · Showroom`, nav: 'showroom', html: `
    <section class="sr ${srDirection < 0 ? 'dir-prev' : 'dir-next'}" data-showroom data-prev="${prev}" data-next="${next}" data-season="${s.id}" style="--tc:${t.color};--td:${t.colorDark || '#111'}">
      <div class="sr-wipe" aria-hidden="true"></div>
      <div class="sr-bg" aria-hidden="true"><span class="sr-bigname">${esc(t.name)}</span></div>
      <div class="wrap sr-toolbar">
        ${seasonSelect(s.id, id => `#/showroom?season=${id}`)}
        <span class="spacer"></span>
        <a class="chip" href="#/showroom/grid${q2}">Full grid</a>
        <button class="chip" type="button" data-team-card="${tid}|${s.id}">Team card</button>
        ${motionToggle()}
      </div>
      <div class="wrap sr-stage">
        <header class="sr-title">
          <span class="eyebrow">Team ${i + 1} of ${ctx.order.length} · ${esc(s.year)} · ${started ? 'after round ' + ctx.done : 'pre-season'}</span>
          <h1 class="sr-teamname">${esc(t.name)}</h1>
          <p class="sr-full">${esc(t.fullName || '')}</p>
          ${logoImg(t, 'sr-logo')}
        </header>
        <div class="sr-drivers n${Math.min(drivers.length, 3)}">${drivers.slice(0, 3).map(driverHtml).join('')}</div>
      </div>
      <div class="wrap sr-carrow"><img class="sr-car" src="${teamCar(t)}" alt="${esc(t.name)} car"></div>
      <div class="wrap sr-stats">
        <div class="sr-stat"><small>Teams' Championship</small><b>${pos(ts.position)}</b></div>
        <div class="sr-stat"><small>Points</small><b>${ts.points}</b></div>
        <div class="sr-stat"><small>Wins</small><b>${ts.wins}</b></div>
        <div class="sr-stat"><small>Podiums</small><b>${ts.podiums}</b></div>
        <div class="sr-stat"><small>Poles</small><b>${tst.poles}</b></div>
        <div class="sr-stat"><small>Best finish</small><b>${tst.best ? 'P' + tst.best : '—'}</b></div>
        ${splitTotal ? `<div class="sr-split" title="Share of the team's points">${split.map(x => `<span style="flex:${x.p || 0.0001}"><b>${esc(x.d.code || x.d.lastName)}</b> ${x.p}</span>`).join('')}</div>` : ''}
      </div>
      <button class="sr-arrow sr-prev" type="button" data-sr-go="${prev}" aria-label="Previous team: ${esc(teamOf(prev).name)}">‹</button>
      <button class="sr-arrow sr-next" type="button" data-sr-go="${next}" aria-label="Next team: ${esc(teamOf(next).name)}">›</button>
      <nav class="sr-strip wrap" aria-label="Teams">${ctx.order.map(id => { const x = teamOf(id); return `<a class="${id === tid ? 'is-active' : ''}" href="#/showroom/${id}${q2}" style="--tc:${x.color}" title="${esc(x.name)}">${logoImg(x, 'sr-strip-logo')}<span>${esc(x.name)}</span></a>`; }).join('')}</nav>
    </section>`, after: root => {
      srDirection = 0;
      // warm the cache for the neighbours so the next transition is instant
      [prev, next].forEach(id => { const x = teamOf(id); new Image().src = teamCar(x); (ctx.lu[id] || []).forEach(did => { const r = resolvePortrait(c, driverOf(did), x); [r.url, r.comp && refUrl(r.comp.face, x), r.comp && refUrl(r.comp.suit, x)].filter(Boolean).forEach(u => { new Image().src = u; }); }); });
    } };
}

function pageShowroomGrid(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const ctx = showroomContext(c, s);
  const q2 = seasonQ(s);
  const tiles = ctx.order.map((tid, k) => {
    const t = teamOf(tid);
    const ds = (ctx.lu[tid] || []).map(driverOf).filter(Boolean);
    return `<a class="grid-tile" href="#/showroom/${tid}${q2}" style="--tc:${t.color};--td:${t.colorDark || '#111'};--i:${k}">
      <span class="gt-name">${esc(t.name)}</span>${logoImg(t, 'gt-logo')}
      <span class="gt-dnames">${ds.slice(0, 2).map(d => `<span>${esc(d.firstName)} <b>${esc(d.lastName.toUpperCase())}</b></span>`).join('')}</span>
      <span class="gt-drivers">${ds.slice(0, 2).map(d => `<span class="gt-driver">${portraitImg(d, t, 'gt-portrait')}</span>`).join('')}</span>
      <img class="gt-car" src="${teamCar(t)}" alt="">
    </a>`;
  }).join('');
  return { title: `${s.year} Grid`, nav: 'showroom', html: `
    <section class="grid-reveal" data-grid-reveal>
      <div class="wrap">
        <div class="sr-toolbar">${seasonSelect(s.id, id => `#/showroom/grid?season=${id}`)}<span class="spacer"></span><button class="chip" type="button" data-replay>Replay reveal</button>${motionToggle()}</div>
        <h1 class="h-page gr-title">${esc(s.year)} Grid</h1>
        <p class="page-sub">${ctx.order.length} teams · ${Object.values(ctx.lu).reduce((a, x) => a + x.length, 0)} drivers · line-up for round ${ctx.cur.round}${ctx.cur.name ? ' (' + esc(ctx.cur.name) + ')' : ''}</p>
        <div class="grid-tiles">${tiles}</div>
      </div>
    </section>` };
}

/* ---- team card export ---------------------------------------------------- */
async function renderTeamCard(teamId, seasonId, safe) {
  const c = D(); const s = seasonOf(c, seasonId) || activeSeason(c); const t = teamOf(teamId);
  const ctx = showroomContext(c, s);
  const drivers = (ctx.lu[teamId] || []).map(driverOf).filter(Boolean).slice(0, 2);
  const ts = teamStandings(c, s.id).find(r => r.id === teamId) || { points: 0, wins: 0, podiums: 0 };
  const ds = driverStandings(c, s.id);
  const started = ctx.done > 0;
  await Promise.all(['900 80px Formula1', '500 40px Formula1', '400 30px Formula1', '700 28px "Titillium Web"'].map(f => document.fonts.load(f).catch(() => null)));
  const local = u => /^(data:|blob:)/.test(u || '');
  const usable = u => !safe || local(u);

  const W = 1080, H = 1350, cv = mkCanvas(W, H), g = cv.getContext('2d');
  const bg = g.createLinearGradient(W, H, 0, 0); bg.addColorStop(0, t.color); bg.addColorStop(1, t.colorDark || '#000');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .07; g.fillStyle = '#fff';
  for (let x = -H; x < W + H; x += 46) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 6, H); g.lineTo(x + 6 + H * .5, 0); g.lineTo(x + H * .5, 0); g.fill(); }
  g.restore();
  g.save(); g.font = '900 210px Formula1, sans-serif'; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillText(t.name.toUpperCase(), 40, 470); g.restore();

  g.fillStyle = '#fff'; g.font = '700 26px "Titillium Web", sans-serif'; g.globalAlpha = .85;
  g.fillText(`${s.year} SEASON${started ? ' · AFTER ROUND ' + ctx.done : ''}`, 64, 92); g.globalAlpha = 1;
  g.font = '900 84px Formula1, sans-serif'; g.fillText(t.name.toUpperCase(), 64, 178);
  g.font = '600 26px "Titillium Web", sans-serif'; g.globalAlpha = .9; g.fillText(t.fullName || '', 64, 220); g.globalAlpha = 1;
  try { const lu = teamLogo(t); if (usable(lu)) { const lim = await loadImage(lu); g.save(); g.beginPath(); g.arc(W - 110, 130, 56, 0, 7); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill(); g.drawImage(lim, W - 150, 90, 80, 80); g.restore(); } } catch (e) { /* logo optional */ }

  // portraits (top part of each frame), behind the car
  const fw = 470, top = 250, clipH = 750;
  for (let k = 0; k < drivers.length; k++) {
    const d = drivers[k], x = drivers.length === 1 ? (W - fw) / 2 : 60 + k * 490;
    g.save(); g.beginPath(); g.rect(x - 40, top, fw + 80, clipH); g.clip();
    try {
      const r = resolvePortrait(c, d, t);
      const urls = r.comp ? [refUrl(r.comp.face, t), refUrl(r.comp.suit, t)] : [r.url];
      if (urls.every(usable)) await drawPortrait(g, d, t, x, top, fw);
      else { const im = await loadImage(portraitSvg(d, t)); g.drawImage(im, x + 60, top + 120, fw - 120, (fw - 120) * 1.2); }
    } catch (e) { console.warn(e); }
    g.restore();
  }
  const fade = g.createLinearGradient(0, top + clipH - 320, 0, top + clipH);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.75)');
  g.fillStyle = fade; g.fillRect(0, top + clipH - 320, W, 320);
  try { const cu = teamCar(t); const cim = await loadImage(usable(cu) ? cu : carSvg(t)); const cw = 1000, ch = cw * cim.naturalHeight / cim.naturalWidth; g.drawImage(cim, 40, top + clipH - ch * .92, cw, ch); } catch (e) { /* car optional */ }

  // bottom panel
  const py = 1000; g.fillStyle = 'rgba(0,0,0,.82)'; g.fillRect(0, py, W, H - py);
  g.fillStyle = t.color; g.fillRect(0, py, W, 6);
  drivers.forEach((d, k) => {
    const x = 64 + k * 500, row = ds.find(r => r.id === d.id) || {}, st = statsFor(c, 'drivers', d.id, s.id);
    g.fillStyle = t.color; g.font = 'italic 900 64px Formula1, sans-serif'; g.fillText(String(d.number ?? ''), x, py + 86);
    const nx = x + (String(d.number ?? '').length ? g.measureText(String(d.number)).width + 22 : 0);
    g.fillStyle = '#fff'; g.font = '400 28px Formula1, sans-serif'; g.fillText(d.firstName, nx, py + 50);
    g.font = '900 40px Formula1, sans-serif'; g.fillText(d.lastName.toUpperCase(), nx, py + 92);
    g.font = '700 24px "Titillium Web", sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText(`${started && row.position ? 'P' + row.position : '—'}  ·  ${row.points || 0} PTS  ·  ${st.podiums} PODIUMS`, x, py + 134);
  });
  const boxes = [["TEAMS' POS", started && ts.position ? 'P' + ts.position : '—'], ['POINTS', ts.points], ['WINS', ts.wins], ['PODIUMS', ts.podiums]];
  boxes.forEach(([k, v], j) => {
    const x = 64 + j * 245, y = py + 180;
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, y, 225, 110);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 20px "Titillium Web", sans-serif'; g.fillText(k, x + 18, y + 34);
    g.fillStyle = '#fff'; g.font = '900 46px Formula1, sans-serif'; g.fillText(String(v), x + 18, y + 88);
  });
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 18px "Titillium Web", sans-serif';
  g.fillText(`${c.meta.careerName} · ${ASSET_MANIFEST.brand.siteName}`, 64, H - 22);
  return cv;
}

async function openTeamCard(teamId, seasonId) {
  const modal = document.createElement('div');
  modal.className = 'modal'; modal.innerHTML = `<div class="modal-box"><button class="menu-close" type="button" data-close aria-label="Close">×</button><p class="muted">Rendering team card…</p></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) modal.remove(); });
  let cv, note = '';
  try {
    cv = await renderTeamCard(teamId, seasonId, false);
    cv.toDataURL(); // throws if a file:// image tainted the canvas
  } catch (e) {
    cv = await renderTeamCard(teamId, seasonId, true);
    note = 'Opened from a file, the browser blocks photos from being copied into an image. Exported with placeholders; open the site with “Open Career Hub.bat” for full photos.';
  }
  const t = teamOf(teamId), s = seasonOf(D(), seasonId);
  const url = cv.toDataURL('image/png');
  modal.querySelector('.modal-box').innerHTML = `<button class="menu-close" type="button" data-close aria-label="Close">×</button>
    <h2 class="h-card">${esc(t.name)} team card</h2>${note ? `<p class="alert">${esc(note)}</p>` : ''}
    <img class="card-preview" src="${url}" alt="${esc(t.name)} team card">
    <div class="form-actions"><a class="btn btn-red" href="${url}" download="${slugify(t.name)}-${s ? s.year : ''}-team-card.png">Download PNG</a><button class="btn btn-outline" type="button" data-close>Close</button></div>`;
}

/* ---- global behaviour (delegated, survives re-render) --------------------- */
function srGo(id) {
  const el = document.querySelector('[data-showroom]'); if (!el || !id) return;
  srDirection = id === el.dataset.prev ? -1 : 1;
  location.hash = `#/showroom/${id}?season=${el.dataset.season}`;
}
document.addEventListener('click', ev => {
  const go = ev.target.closest('[data-sr-go]'); if (go) { srGo(go.dataset.srGo); return; }
  const strip = ev.target.closest('.sr-strip a');
  if (strip) { const el = document.querySelector('[data-showroom]'); const ids = [...el.querySelectorAll('.sr-strip a')]; const cur = ids.findIndex(a => a.classList.contains('is-active')); srDirection = ids.indexOf(strip) < cur ? -1 : 1; }
  const mc = ev.target.closest('[data-motion-cycle]');
  if (mc) { const order = ['auto', 'reduced', 'full']; Motion.set(order[(order.indexOf(Motion.get()) + 1) % 3]); render(); return; }
  const tc = ev.target.closest('[data-team-card]'); if (tc) { const [t, s] = tc.dataset.teamCard.split('|'); openTeamCard(t, s); return; }
  const rp = ev.target.closest('[data-replay]');
  if (rp) { const g = document.querySelector('[data-grid-reveal]'); g.classList.remove('replay'); void g.offsetWidth; g.classList.add('replay'); }
});
document.addEventListener('keydown', ev => {
  const el = document.querySelector('[data-showroom]');
  if (!el || /input|select|textarea/i.test(document.activeElement && document.activeElement.tagName)) return;
  if (ev.key === 'ArrowRight') srGo(el.dataset.next);
  if (ev.key === 'ArrowLeft') srGo(el.dataset.prev);
  if (ev.key === 'g' || ev.key === 'G') location.hash = `#/showroom/grid?season=${el.dataset.season}`;
});
let srTouch = null;
document.addEventListener('touchstart', ev => { if (ev.target.closest('[data-showroom]') && !ev.target.closest('.sr-strip')) srTouch = [ev.touches[0].clientX, ev.touches[0].clientY]; }, { passive: true });
document.addEventListener('touchend', ev => {
  if (!srTouch) return; const dx = ev.changedTouches[0].clientX - srTouch[0], dy = ev.changedTouches[0].clientY - srTouch[1]; srTouch = null;
  const el = document.querySelector('[data-showroom]');
  if (el && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) srGo(dx < 0 ? el.dataset.next : el.dataset.prev);
}, { passive: true });
