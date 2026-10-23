/* ==========================================================================
   insights.js — numbers behind the stories.
   1. Car development tracker   #/development   pace index per team, race by race
   2. Title scenarios           #/scenarios     who can still win, and what the leader needs to clinch
   3. Season awards             #/awards        Driver of the Year, Rookie, Overtaker, Comeback and more
   4. Hall of Fame              #/hall-of-fame  champions, legends, records, farewells
   Everything is derived from results. Nothing here is saved.
   Charts are hand-written SVG so the site keeps working offline without libraries.
   ========================================================================== */

/* --- small helpers --------------------------------------------------------- */
const inAvg = xs => { const v = xs.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const inName = id => { const d = driverOf(id); return d ? nameOf(d) : id; };
const inLast = id => { const d = driverOf(id); return d ? d.lastName : id; };
const inTeamName = id => { const t = teamOf(id); return t ? t.name : id; };
// one cache per career state: cleared whenever results, rounds or seasons change
let IN_CACHE = { key: '', m: new Map() };
function inCacheClear() { IN_CACHE = { key: '', m: new Map() }; }
function inMemo(c, name, fn) {
  const key = `${c.results.length}|${c.rounds.length}|${c.seasons.length}|${c.assignments.length}|${c.meta.updatedAt || ''}`;
  if (IN_CACHE.key !== key) IN_CACHE = { key, m: new Map() };
  if (!IN_CACHE.m.has(name)) IN_CACHE.m.set(name, fn());
  return IN_CACHE.m.get(name);
}

/* ==========================================================================
   1. CAR DEVELOPMENT: a pace index from 0 (slowest) to 100 (fastest) per team per race.
   Each car's sample = average of its qualifying and finishing position (grid when there is no qualifying).
   The team's score leans on its best car (60%) and its average (40%), then a 3-race rolling average smooths it.
   ========================================================================== */
function teamPace(c, sid) {
  return inMemo(c, 'pace|' + sid, () => {
    const rounds = completedRounds(c, sid), raw = {};
    rounds.forEach((rd, i) => {
      const race = classify(c, resultFor(c, rd.id, 'race')), q = classify(c, resultFor(c, rd.id, 'qualifying'));
      const N = Math.max(race.length, 2), by = {};
      race.forEach(e => {
        const qp = (q.find(x => x.driverId === e.driverId) || {}).position || e.grid || null;
        const p = inAvg([qp, e.position || null]); if (p == null) return;
        (by[e.teamId] = by[e.teamId] || []).push(p);
      });
      Object.entries(by).forEach(([t, ps]) => {
        const p = Math.min(...ps) * 0.6 + inAvg(ps) * 0.4;
        (raw[t] = raw[t] || Array(rounds.length).fill(null))[i] = Math.max(0, Math.min(100, Math.round(100 * (1 - (p - 1) / (N - 1)))));
      });
    });
    const order = teamStandings(c, sid).map(r => r.id).filter(t => raw[t]);
    Object.keys(raw).forEach(t => { if (!order.includes(t)) order.push(t); });
    const teams = order.map(t => {
      const r = raw[t], smooth = r.map((_, i) => { const v = inAvg(r.slice(Math.max(0, i - 2), i + 1)); return v == null ? null : Math.round(v); });
      const vals = smooth.filter(x => x != null), last3 = inAvg(r.slice(-3)), prev3 = inAvg(r.slice(-6, -3));
      return { id: t, raw: r, smooth, now: vals[vals.length - 1] ?? null, first: vals[0] ?? null, trend: last3 != null && prev3 != null ? Math.round(last3 - prev3) : 0, best: vals.length ? Math.max(...vals) : null };
    });
    return { rounds, teams };
  });
}
// team development moments for the newsroom: a big step forward or back in the last three races
function paceMoments(c, round) {
  const sid = round.seasonId, rounds = completedRounds(c, sid), i = rounds.findIndex(r => r.id === round.id);
  if (i < 5) return [];
  const P = teamPace(c, sid), out = [], STEP = 15;
  const delta = (t, j) => { if (j < 5) return 0; const a = inAvg(t.raw.slice(j - 2, j + 1)), b = inAvg(t.raw.slice(j - 5, j - 2)); return a == null || b == null ? 0 : Math.round(a - b); };
  P.teams.forEach(t => {
    const d = delta(t, i); if (Math.abs(d) < STEP) return;
    for (let j = i - 4; j < i; j++) if (Math.abs(delta(t, j)) >= STEP) return;                  // already reported recently
    out.push({ team: t.id, delta: d, now: Math.round(inAvg(t.raw.slice(i - 2, i + 1))), before: Math.round(inAvg(t.raw.slice(i - 5, i - 2))) });
  });
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* --- power ranking: average gap per lap between the cars --------------------------------
   For every race weekend, each team's quicker car gives two samples:
   - qualifying: its lap time minus pole (from the times you entered)
   - race: its gap to the winner divided by the laps (lapped cars: laps down × the winner's average lap)
   With no times entered, the gap is estimated from the position (0.08 s per place in qualifying, 0.10 s per place per lap in the race).
   The season figure is the average of all samples. No score, only seconds per lap. */
function inSecs(t) {
  const m = String(t || '').trim().replace(/s$/i, '').replace(/^\+/, ''); if (!m || /lap/i.test(m)) return null;
  const parts = m.split(':').map(Number); if (parts.some(isNaN)) return null;
  return parts.reduce((a, b) => a * 60 + b, 0);
}
function powerRanking(c, sid) {
  return inMemo(c, 'power|' + sid, () => {
    const T = {}, get = id => (T[id] = T[id] || { id, q: [], r: [], est: 0, real: 0 });
    completedRounds(c, sid).forEach(rd => {
      const q = classify(c, resultFor(c, rd.id, 'qualifying')).filter(e => e.position).sort((a, b) => a.position - b.position);
      const poleT = q[0] && inSecs(q[0].time), bestQ = {};
      q.forEach(e => { if (bestQ[e.teamId] == null) { const t = inSecs(e.time); const real = poleT != null && t != null && t >= poleT;
        bestQ[e.teamId] = 1; const x = get(e.teamId); x.q.push(real ? t - poleT : (e.position - 1) * 0.08); real ? x.real++ : x.est++; } });
      const race = classify(c, resultFor(c, rd.id, 'race')).filter(e => e.position).sort((a, b) => a.position - b.position);
      if (!race.length) return;
      const W = race[0], laps = +W.laps || +rd.laps || 0, total = inSecs(W.time), avgLap = total && laps ? total / laps : 90, bestR = {};
      race.forEach(e => { if (bestR[e.teamId] != null) return; bestR[e.teamId] = 1; const x = get(e.teamId);
        if (e === W) { x.r.push(0); x.real++; return; }
        const down = /(\d+)\s*lap/i.exec(String(e.time || '')), g = inSecs(e.time);
        if (laps && g != null) { x.r.push(g / laps); x.real++; }
        else if (laps && down) { x.r.push(+down[1] * avgLap / laps); x.real++; }
        else { x.r.push((e.position - 1) * 0.10); x.est++; } });
    });
    const rows = Object.values(T).map(x => { const q = inAvg(x.q), r = inAvg(x.r); return Object.assign(x, { qAvg: q, rAvg: r, avg: inAvg([q, r]) }); }).filter(x => x.avg != null).sort((a, b) => a.avg - b.avg);
    const best = rows.length ? rows[0].avg : 0;
    rows.forEach((x, i) => { x.toFastest = x.avg - best; x.toAhead = i ? x.avg - rows[i - 1].avg : 0; });
    const P = teamPace(c, sid); rows.forEach(x => { const t = P.teams.find(z => z.id === x.id); x.trend = t ? t.trend : 0; });
    return { rows, estimated: rows.some(x => x.est > 0), allEstimated: rows.every(x => !x.real), races: completedRounds(c, sid).length };
  });
}
const inGap = v => v < 0.0005 ? '—' : `+${v.toFixed(3)}s`;
function powerBars(R) {
  const max = Math.max(0.05, ...R.rows.map(x => x.toFastest)), W = 760, rowH = 26, L = 150, Rr = 90, H = R.rows.length * rowH + 8;
  return `<figure class="pace-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average gap per lap to the fastest car">${R.rows.map((x, i) => {
    const T = teamOf(x.id) || {}, w = (W - L - Rr) * x.toFastest / max, y = 4 + i * rowH;
    return `<text x="${L - 8}" y="${y + 17}" class="pc-label" text-anchor="end" fill="currentColor">${esc(T.name || x.id)}</text><rect x="${L}" y="${y + 4}" width="${Math.max(2, w).toFixed(1)}" height="${rowH - 10}" rx="3" fill="${T.color || '#888'}"/><text x="${L + Math.max(2, w) + 6}" y="${y + 17}" class="pc-axis">${i ? inGap(x.toFastest) : 'Fastest'}</text>`;
  }).join('')}</svg><figcaption class="muted">Average gap per lap to the fastest car, over every qualifying session and race this season.</figcaption></figure>`;
}

function paceChart(P, opts) {
  opts = opts || {};
  const W = 760, H = opts.small ? 200 : 300, L = 34, R = opts.small ? 16 : 120, T = 14, B = 26;
  const n = P.rounds.length; if (n < 2) return `<p class="muted">The chart starts after two races.</p>`;
  const x = i => L + (W - L - R) * i / (n - 1), y = v => T + (H - T - B) * (1 - v / 100);
  const teams = opts.only ? P.teams.filter(t => t.id === opts.only) : P.teams, ends = [];
  const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="pc-grid"/><text x="${L - 6}" y="${y(v) + 4}" class="pc-axis" text-anchor="end">${v}</text>`).join('');
  const step = Math.ceil(n / 12);
  const xl = P.rounds.map((r, i) => i % step && i !== n - 1 ? '' : `<text x="${x(i)}" y="${H - 6}" class="pc-axis" text-anchor="middle">${r.round}</text>`).join('');
  const lines = teams.map(t => {
    const col = (teamOf(t.id) || {}).color || '#888';
    const pts = t.smooth.map((v, i) => v == null ? null : [x(i), y(v), v, i]).filter(Boolean); if (!pts.length) return '';
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${col}"><title>${esc(inTeamName(t.id))}, ${esc(P.rounds[p[3]].name)}: ${p[2]}</title></circle>`).join('');
    const end = pts[pts.length - 1]; if (!opts.small) ends.push({ x: end[0] + 6, y: end[1] + 4, col, name: inTeamName(t.id) });
    return `<g class="pc-team"><path d="${d}" stroke="${col}" class="pc-line"/>${dots}</g>`;
  }).join('');
  // team names at the end of each line, pushed apart so they never overlap
  ends.sort((a, b) => a.y - b.y).forEach((e, i) => { if (i && e.y < ends[i - 1].y + 13) e.y = ends[i - 1].y + 13; });
  const labels = ends.map(e => `<text x="${e.x}" y="${e.y.toFixed(1)}" class="pc-label" fill="${e.col}">${esc(e.name)}</text>`).join('');
  return `<figure class="pace-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pace index by round">${grid}${xl}${lines}${labels}</svg>
    <figcaption class="muted">Pace index by round (3-race average). 100 = fastest car of the weekend.</figcaption></figure>`;
}

/* ==========================================================================
   2. TITLE SCENARIOS
   Before a round: who can still win the title, and what the leader needs at that round to clinch it.
   Clinch rule: after the round, the lead must be bigger than the most points anyone can still score.
   Rivals are given their best case (win, fastest lap and the Sprint win on Sprint weekends); the leader
   gets only race points. A tie is not a clinch (countback could still go either way).
   ========================================================================== */
function titleMath(c, sid, kind, beforeRound) {
  kind = kind || 'drivers';
  const rule = ruleFor(c, sid), rounds = roundsOf(c, sid);
  const next = beforeRound ? rounds.find(r => r.round === beforeRound) : nextRound(c, sid);
  const R = next ? next.round : rounds.length + 1, left = rounds.filter(r => r.round >= R);
  const fl = (rule.fastestLap || {}).points || 0, race = rule.race || [], spr = rule.sprint || [];
  const cars = kind === 'teams' ? 2 : 1;
  const top = (arr, k) => arr.slice(0, k).reduce((a, b) => a + (b || 0), 0);
  const maxFor = r => top(race, cars) + fl + (r.sprint ? top(spr, cars) : 0);
  const maxLeft = left.reduce((a, r) => a + maxFor(r), 0);
  const st = kind === 'teams' ? teamStandings(c, sid, R - 1) : driverStandings(c, sid, R - 1);
  const L = st[0];
  if (!L || !L.points) return null;
  const alive = st.filter(r => r.points + maxLeft >= L.points).map(r => ({ id: r.id, points: r.points, behind: L.points - r.points, max: r.points + maxLeft }));
  const out = { kind, sid, next, left: left.length, maxLeft, leader: L.id, alive, eliminated: st.length - alive.length, champion: !left.length || alive.length === 1 ? L.id : null, table: null, summary: '' };
  if (!next || alive.length < 2 || kind !== 'drivers') return out;
  // the clinch table: leader's finish (rows) against the main rival's finish (columns)
  const afterNext = maxLeft - maxFor(next), nP = Math.min(race.length || 10, 10);
  const pos = [...Array(nP).keys()].map(i => i + 1).concat([nP + 1]);              // nP + 1 = outside the points
  const ptsAt = p => race[p - 1] || 0, flMax = (rule.fastestLap || {}).maxPosition || 10;
  const rivalGets = p => ptsAt(p) + (p <= flMax ? fl : 0) + (next.sprint ? (spr[0] || 0) : 0);
  const rival = alive[1], others = alive.slice(2);
  const clinch = (pl, pr) => {
    if (pl === pr && pl <= nP) return null;                                               // impossible: both in the same place
    const mine = L.points + ptsAt(pl);
    if (mine - (rival.points + rivalGets(pr)) <= afterNext) return false;
    return others.every(o => mine - (o.points + maxFor(next)) > afterNext);
  };
  out.table = { rival: rival.id, pos, nP, cells: pos.map(pl => pos.map(pr => clinch(pl, pr))) };
  out.canClinch = out.table.cells.some(row => row.some(Boolean));
  // a sentence for the newsroom and the panels
  const any = out.table.cells.some(row => row.some(Boolean));
  if (any) {
    const ok = pl => pos.filter(pr => pr !== pl || pl > nP).every(pr => clinch(pl, pr) !== false);
    const worstAlways = [...pos].reverse().find(pl => pl <= nP && ok(pl) && pos.filter(x => x <= pl).every(ok));
    const lab = p => p > nP ? 'outside the points' : 'P' + p;
    if (worstAlways) out.summary = worstAlways === 1 ? `${inLast(L.id)} is champion at the ${next.name} race if he wins it, whatever ${inLast(rival.id)} does.` : `${inLast(L.id)} is champion at the ${next.name} race if he finishes ${lab(worstAlways)} or higher, whatever ${inLast(rival.id)} does.`;
    else {
      const p1row = out.table.cells[0], worstRival = pos.find((pr, j) => p1row[j] === true);
      out.summary = worstRival ? `${inLast(L.id)} can clinch the title at the ${next.name} race. A win is enough if ${inLast(rival.id)} finishes ${lab(worstRival)} or lower.` : '';
      if (others.length && !others.every(o => L.points + ptsAt(1) - (o.points + maxFor(next)) > afterNext)) out.summary = `${inLast(L.id)} can win the title at the ${next.name} race, but only if ${others.map(o => inLast(o.id)).join(' and ')} also fall short.`;
    }
  } else out.summary = `Nobody can clinch the title at the ${next.name} race. ${alive.length} drivers are still in the fight with ${left.length} race${left.length > 1 ? 's' : ''} to go.`;
  return out;
}
function scenarioPanel(c, s, compact) {
  const m = titleMath(c, s.id, 'drivers'); if (!m) return '';
  if (m.champion && !m.left) return `<div class="panel scen-panel"><b>${esc(inName(m.champion))}</b> is the ${s.year} champion.</div>`;
  if (m.champion) return `<div class="panel scen-panel">🏆 <b>${esc(inName(m.champion))}</b> has already won the ${s.year} title, with ${m.left} race${m.left > 1 ? 's' : ''} to spare.</div>`;
  const alive = m.alive.map(a => `<li><span>${esc(inName(a.id))}</span><span class="muted">${a.behind ? `−${a.behind}` : 'leader'} · max ${a.max}</span></li>`).join('');
  return `<div class="panel scen-panel"><div class="panel-head"><span class="eyebrow">Title race · ${m.left} round${m.left > 1 ? 's' : ''} left · ${m.maxLeft} points to play for</span></div>
    ${m.summary ? `<p class="scen-summary">${esc(m.summary)}</p>` : ''}
    ${compact ? `<p class="muted">${m.alive.length} driver${m.alive.length > 1 ? 's' : ''} can still win the title. <a href="#/scenarios?season=${s.id}">All scenarios ›</a></p>` : `<ul class="scen-alive">${alive}</ul>`}</div>`;
}

/* ==========================================================================
   3. SEASON AWARDS (for completed seasons)
   ========================================================================== */
function seasonDone(c, sid) { const rs = roundsOf(c, sid); return rs.length > 0 && completedRounds(c, sid).length === rs.length; }
function seasonAwards(c, sid) {
  if (!seasonDone(c, sid)) return null;
  return inMemo(c, 'awards|' + sid, () => {
    const s = seasonOf(c, sid), rounds = completedRounds(c, sid), st = driverStandings(c, sid), ts = teamStandings(c, sid);
    const series = seriesOf(s), aw = [];
    const add = (key, title, o) => { if (o && (o.d || o.t)) aw.push(Object.assign({ key, title }, o)); };
    // per-driver season numbers
    const D = {};
    const get = id => (D[id] = D[id] || { id, rates: [], gained: 0, pointsFinishes: 0, dnfs: 0, poles: 0, team: null });
    rounds.forEach(rd => {
      const race = classify(c, resultFor(c, rd.id, 'race'));
      const rates = typeof ngRateRows === 'function' ? ngRateRows(c, rd, race) : [];
      race.forEach(e => { const x = get(e.driverId); x.team = e.teamId; if (e.position && e.grid) x.gained += e.grid - e.position; if (e.pts > 0) x.pointsFinishes++; if (e.status === 'DNF') x.dnfs++; });
      rates.forEach(r => get(r.e.driverId).rates.push(r.r));
      const q = resultFor(c, rd.id, 'qualifying'); if (q && q.entries.length) get(q.entries[0].driverId).poles++;
    });
    const list = Object.values(D), half = Math.ceil(rounds.length / 2);
    const best = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a))[0];
    // side awards prefer a driver who has not won one yet, when he is close enough to the top
    const won = () => new Set(aw.filter(a => !['champion', 'teamchamp', 'race'].includes(a.key)).map(a => a.d).filter(Boolean));
    const fresh = (arr, f) => { const top = best(arr, f); if (!top) return top; const alt = best(arr.filter(x => !won().has(x.id)), f); return alt && f(alt) > 0 && f(alt) >= f(top) * 0.75 ? alt : top; };
    if (st[0]) add('champion', "Drivers' Champion", { d: st[0].id, t: st[0].teamId, value: `${st[0].points} points, ${st[0].wins || 0} wins`, why: st[1] ? `${st[0].points - st[1].points} points clear of ${inLast(st[1].id)}.` : '' });
    if (ts[0]) add('teamchamp', "Teams' Champion", { t: ts[0].id, value: `${ts[0].points} points`, why: ts[1] ? `${ts[0].points - ts[1].points} points ahead of ${inTeamName(ts[1].id)}.` : '' });
    const doty = best(list.filter(x => x.rates.length >= half), x => inAvg(x.rates));
    if (doty) add('doty', 'Driver of the Year', { d: doty.id, t: doty.team, value: `${inAvg(doty.rates).toFixed(1)}/10 average rating`, why: 'The highest average in our race-by-race ratings.' });
    // rookies: first season in this series
    const earlier = new Set(c.seasons.filter(x => seriesOf(x) === series && x.year < s.year).flatMap(x => completedRounds(c, x.id)).flatMap(r => classify(c, resultFor(c, r.id, 'race')).map(e => e.driverId)));
    const rook = st.filter(r => !earlier.has(r.id) && D[r.id])[0];
    if (rook && c.seasons.some(x => seriesOf(x) === series && x.year < s.year)) add('rookie', 'Rookie of the Year', { d: rook.id, t: rook.teamId, value: `${rook.points} points, P${rook.position} overall`, why: 'The best-placed newcomer.' });
    const ov = fresh(list, x => x.gained); if (ov && ov.gained > 0) add('overtaker', 'Overtaker of the Year', { d: ov.id, t: ov.team, value: `+${ov.gained} places from the grid`, why: 'The most places gained between the start and the flag.' });
    const pole = fresh(list, x => x.poles); if (pole && pole.poles) add('qualifier', 'Qualifier of the Year', { d: pole.id, t: pole.team, value: `${pole.poles} pole position${pole.poles > 1 ? 's' : ''}`, why: 'Saturday speed nobody could match.' });
    const cons = fresh(list, x => x.pointsFinishes * 100 - x.dnfs); if (cons) add('consistent', 'Mr Consistent', { d: cons.id, t: cons.team, value: `${cons.pointsFinishes} of ${rounds.length} races in the points`, why: 'Always there when the points were handed out.' });
    // storylines from the newsroom memory
    const mem = typeof ngNarrative === 'function' ? ngNarrative(c).get(rounds[rounds.length - 1].id) : null;
    if (mem) {
      const cb = mem.ended.filter(z => z.kind === 'slump' && ['podium', 'points'].includes(z.outcome)).sort((a, b) => b.count - a.count)[0];
      if (cb) add('comeback', 'Comeback of the Year', { d: cb.drivers[0], t: cb.teams[0], value: `Back in the points after ${cb.count} races without`, why: `The drought began in ${cb.startCity} and ended in ${cb.endCity}.` });
      const rv = mem.ended.filter(z => z.kind === 'rivalry' || z.kind === 'teamwar').sort((a, b) => b.peak - a.peak)[0];
      if (rv) add('rivalry', 'Rivalry of the Year', { d: rv.drivers[0], d2: rv.drivers[1], t: rv.teams[0], value: `${inLast(rv.drivers[0])} against ${inLast(rv.drivers[1])}`, why: rv.kind === 'teamwar' ? `A team-mate battle at ${inTeamName(rv.teams[0])} that started in ${rv.startCity}.` : `They finished side by side ${rv.count} times.` });
      // race of the year: the most storyline moments, retirements and the closest finish
      const score = rd => { const m = ngNarrative(c).get(rd.id); const race = classify(c, resultFor(c, rd.id, 'race')); const gap = race[1] && /^\+?\d+(\.\d+)?s?$/.test(String(race[1].time || '').trim()) ? parseFloat(String(race[1].time).replace('+', '')) : 10;
        return (m ? m.events.length * 2 : 0) + race.filter(e => !e.position).length + Math.max(0, 10 - gap); };
      const roty = best(rounds, score);
      if (roty) { const w = classify(c, resultFor(c, roty.id, 'race')).find(e => e.position === 1); add('race', 'Race of the Year', { d: w && w.driverId, t: w && w.teamId, round: roty.id, value: `${roty.name} Grand Prix`, why: `Won by ${w ? inLast(w.driverId) : ''}. The race with the most twists of the season.` }); }
    }
    // team of the year: biggest climb against last season, and the most improved car
    const prev = c.seasons.find(x => seriesOf(x) === series && x.year === s.year - 1);
    if (prev && seasonDone(c, prev.id)) {
      const pts = teamStandings(c, prev.id), climb = ts.map(r => { const p = pts.find(x => x.id === r.id); return p ? { id: r.id, d: p.position - r.position, from: p.position, to: r.position } : null; }).filter(Boolean);
      const tm = best(climb, x => x.d); if (tm && tm.d > 0) add('team', 'Team of the Year', { t: tm.id, value: `P${tm.from} to P${tm.to} in the teams' table`, why: 'The biggest step forward from last season.' });
    }
    const P = teamPace(c, sid), dev = best(P.teams.filter(t => t.first != null && t.now != null), t => t.now - t.first);
    if (dev && dev.now - dev.first >= 5) add('development', 'Most Improved Car', { t: dev.id, value: `Pace index ${dev.first} to ${dev.now}`, why: 'The car that made the biggest step during the season.' });
    const hl = fresh(list, x => x.dnfs); if (hl && hl.dnfs >= 2) add('hardluck', 'Hard Luck Award', { d: hl.id, t: hl.team, value: `${hl.dnfs} retirements`, why: 'The season could have looked very different.' });
    return aw;
  });
}
function awardCard(a) {
  const d = a.d ? driverOf(a.d) : null, t = a.t ? teamOf(a.t) : null;
  const pic = d ? `<div class="award-pic">${driverHead(d, t)}</div>` : t ? `<div class="award-pic award-team">${logoImg(t, 'award-logo')}</div>` : '';
  const who = d ? `<a href="#/drivers/${d.id}">${esc(nameOf(d))}</a>${a.d2 ? ` &amp; <a href="#/drivers/${a.d2}">${esc(inName(a.d2))}</a>` : ''}` : t ? `<a href="#/teams/${t.id}">${esc(t.name)}</a>` : '';
  return `<article class="award-card" style="--tc:${t ? t.color : '#e10600'}">${pic}<div class="award-body"><span class="eyebrow">${esc(a.title)}</span><h3 class="h-card">${who}</h3>
    <p class="award-value">${esc(a.value || '')}</p>${a.why ? `<p class="muted">${esc(a.why)}</p>` : ''}</div></article>`;
}

/* ==========================================================================
   4. HALL OF FAME: one pass over every race of a series
   ========================================================================== */
function careerBook(c, series) {
  return inMemo(c, 'book|' + series, () => {
    const seasons = c.seasons.filter(s => seriesOf(s) === series).sort((a, b) => a.year - b.year), B = {}, champs = [], records = [];
    const get = id => (B[id] = B[id] || { id, starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, titles: 0, seasons: new Set(), teams: new Set(), first: null, last: null, streak: 0, bestStreak: 0, youngestWin: null, seasonWins: {} });
    let bestSeasonWins = null, bestMargin = null;
    seasons.forEach(s => {
      completedRounds(c, s.id).forEach(rd => {
        classify(c, resultFor(c, rd.id, 'race')).forEach(e => {
          const x = get(e.driverId); x.starts++; x.points += e.pts || 0; x.seasons.add(s.year); x.teams.add(e.teamId); x.first = x.first || s.year; x.last = s.year;
          if (e.position && e.position <= 3) x.podiums++;
          if (e.position === 1) { x.wins++; x.streak++; x.bestStreak = Math.max(x.bestStreak, x.streak); x.seasonWins[s.year] = (x.seasonWins[s.year] || 0) + 1;
            const age = typeof ngAge === 'function' ? ngAge(e.driverId, s.year) : 0; if (age && (x.youngestWin == null || age < x.youngestWin)) x.youngestWin = age; }
          else x.streak = 0;
        });
        const q = resultFor(c, rd.id, 'qualifying'); if (q && q.entries.length) get(q.entries[0].driverId).poles++;
      });
      Object.values(B).forEach(x => { const n = x.seasonWins[s.year] || 0; if (n && (!bestSeasonWins || n > bestSeasonWins.n)) bestSeasonWins = { id: x.id, n, year: s.year }; });
      if (seasonDone(c, s.id)) {
        const st = driverStandings(c, s.id), ts = teamStandings(c, s.id);
        if (st[0]) { get(st[0].id).titles++; champs.push({ year: s.year, sid: s.id, d: st[0].id, dt: st[0].teamId, pts: st[0].points, margin: st[1] ? st[0].points - st[1].points : 0, runner: st[1] && st[1].id, t: ts[0] && ts[0].id, tpts: ts[0] && ts[0].points });
          const m = st[1] ? st[0].points - st[1].points : 0; if (!bestMargin || m > bestMargin.m) bestMargin = { id: st[0].id, m, year: s.year }; }
      }
    });
    const all = Object.values(B), top = f => all.slice().sort((a, b) => f(b) - f(a))[0];
    const rec = (title, x, val) => x && val && records.push({ title, id: x.id, value: val });
    const w = top(x => x.wins); rec('Most wins', w, w && w.wins);
    const p = top(x => x.podiums); rec('Most podiums', p, p && p.podiums);
    const po = top(x => x.poles); rec('Most pole positions', po, po && po.poles);
    const t = top(x => x.titles); rec('Most titles', t, t && t.titles);
    const s0 = top(x => x.starts); rec('Most starts', s0, s0 && s0.starts);
    const pt = top(x => x.points); rec('Most points', pt, pt && Math.round(pt.points));
    const sk = top(x => x.bestStreak); rec('Longest winning streak', sk, sk && sk.bestStreak > 1 && `${sk.bestStreak} in a row`);
    const yw = all.filter(x => x.youngestWin).sort((a, b) => a.youngestWin - b.youngestWin)[0]; rec('Youngest winner', yw, yw && `${yw.youngestWin} years old`);
    if (bestSeasonWins) rec('Most wins in a season', { id: bestSeasonWins.id }, `${bestSeasonWins.n} in ${bestSeasonWins.year}`);
    if (bestMargin && bestMargin.m) rec('Biggest title margin', { id: bestMargin.id }, `${bestMargin.m} points in ${bestMargin.year}`);
    // farewells: raced in an earlier season of this series, no seat in the latest one
    const latest = seasons[seasons.length - 1];
    const seated = new Set(latest ? c.assignments.filter(a => a.seasonId === latest.id).map(a => a.driverId) : []);
    const gone = all.filter(x => latest && x.last < latest.year && !seated.has(x.id) && x.starts >= 5).sort((a, b) => b.last - a.last || b.starts - a.starts);
    const legends = all.filter(x => x.titles || x.wins >= 5).sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.podiums - a.podiums).slice(0, 12);
    return { book: B, champs: champs.reverse(), records, gone, legends, seasons: seasons.length };
  });
}

/* --- pages ---------------------------------------------------------------------- */
function insightsSubnav(s, active) {
  const href = k => `#/${k}${s ? `?season=${s.id}` : ''}`;
  return subnav([
    s && active !== 'hall-of-fame' ? { html: seasonSelect(s.id, id => `#/${active}?season=${id}`) } : null,
    { key: 'development', label: 'Car development', href: href('development') },
    { key: 'scenarios', label: 'Title scenarios', href: href('scenarios') },
    { key: 'driver-ranking', label: 'Driver ranking', href: href('driver-ranking') },
    { key: 'awards', label: 'Season awards', href: href('awards') },
    { key: 'hall-of-fame', label: 'Hall of Fame', href: '#/hall-of-fame' },
  ].filter(Boolean), active);
}
function pageDevelopment(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const P = teamPace(c, s.id);
  const R = powerRanking(c, s.id);
  const arrow = t => t.trend >= 5 ? '<span class="trend up" title="Faster over the last 3 races">▲</span>' : t.trend <= -5 ? '<span class="trend down" title="Slower over the last 3 races">▼</span>' : '<span class="trend">●</span>';
  const rows = R.rows.map((t, i) => { const T = teamOf(t.id);
    return `<tr><td>${i + 1}</td><td class="mx-left">${T ? `<span class="dot" style="--tc:${T.color}"></span> <a href="#/teams/${T.id}">${esc(T.name)}</a>` : esc(t.id)}</td><td class="num"><b>${i ? inGap(t.toFastest) : 'Fastest'}</b></td><td class="num">${i ? inGap(t.toAhead) : '—'}</td><td class="num">${t.qAvg != null ? inGap(t.qAvg) : '—'}</td><td class="num">${t.rAvg != null ? inGap(t.rAvg) : '—'}</td><td class="num">${arrow(t)}</td></tr>`; }).join('');
  return { title: `${s.year} Car development`, nav: 'insights', html: `
    ${insightsSubnav(s, 'development')}
    <div class="wrap page">
      <h1 class="h-page">${esc(s.year)} Car Development</h1>
      <p class="page-intro">How fast each car has been, race by race. The index uses qualifying and finishing positions, so it shows car pace rather than points.</p>
      ${P.rounds.length ? paceChart(P) : emptyState('No races yet', 'The tracker starts after the first race.', null)}
      ${rows ? `<h2 class="h-section spaced">Power ranking</h2>
      <p class="page-intro">Average gap per lap for each team's quicker car, across every qualifying session and race of the ${R.races} race weekend${R.races === 1 ? '' : 's'} so far. Qualifying gap: lap time to pole. Race pace: gap to the winner divided by the laps.${R.estimated ? ` ${R.allEstimated ? 'No lap times entered yet, so' : 'Where lap times are missing,'} gaps are estimated from positions.` : ''}</p>
      ${powerBars(R)}
      <div class="mx-scroll"><table class="mx-table stats-table"><thead><tr><th>#</th><th>Team</th><th>Gap to fastest</th><th>Gap to car ahead</th><th>Qualifying gap</th><th>Race pace gap</th><th>Last 3 races</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    </div>` };
}
function pageScenarios(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const m = titleMath(c, s.id, 'drivers'), mt = titleMath(c, s.id, 'teams');
  let table = '';
  if (m && m.table) {
    const lab = p => p > m.table.nP ? 'No pts' : 'P' + p;
    table = `<h2 class="h-section spaced">Can ${esc(inLast(m.leader))} clinch it at the ${esc(m.next.name)} race?</h2>
      <p class="page-intro">Rows: where ${esc(inLast(m.leader))} finishes. Columns: where ${esc(inLast(m.table.rival))} finishes. ✓ = champion. ${m.next.sprint ? 'Sprint points count as the best case for the rivals.' : ''} Fastest-lap points count for the rivals only.</p>
      <div class="mx-scroll"><table class="mx-table scen-table"><thead><tr><th></th>${m.table.pos.map(p => `<th>${lab(p)}</th>`).join('')}</tr></thead><tbody>
      ${m.table.cells.map((row, i) => `<tr><th>${lab(m.table.pos[i])}</th>${row.map(v => `<td class="${v ? 'scen-yes' : v === null ? 'scen-na' : 'scen-no'}">${v ? '✓' : v === null ? '' : ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }
  const aliveT = mt ? mt.alive.map(a => `<li><span>${esc(inTeamName(a.id))}</span><span class="muted">${a.behind ? `−${a.behind}` : 'leader'} · max ${a.max}</span></li>`).join('') : '';
  return { title: `${s.year} Title scenarios`, nav: 'insights', html: `
    ${insightsSubnav(s, 'scenarios')}
    <div class="wrap page">
      <h1 class="h-page">${esc(s.year)} Title Scenarios</h1>
      ${m ? scenarioPanel(c, s, false) : emptyState('No points yet', 'Scenarios appear once the first points are scored.', null)}
      ${table}
      ${mt && !mt.champion ? `<h2 class="h-section spaced">Teams' title</h2><div class="panel scen-panel"><ul class="scen-alive">${aliveT}</ul></div>` : mt && mt.champion ? `<div class="panel scen-panel">${esc(inTeamName(mt.champion))} ${mt.left ? 'have won' : 'won'} the teams' title.</div>` : ''}
    </div>` };
}
function pageAwards(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const aw = seasonAwards(c, s.id);
  const done = completedRounds(c, s.id).length, total = roundsOf(c, s.id).length;
  return { title: `${s.year} Awards`, nav: 'insights', html: `
    ${insightsSubnav(s, 'awards')}
    <div class="wrap page">
      <h1 class="h-page">${esc(s.year)} Season Awards</h1>
      ${aw ? `<div class="award-grid">${aw.map(awardCard).join('')}</div>` : emptyState('Awards night comes at the end', `The awards are given once every race has a result (${done} of ${total} so far).`, null)}
    </div>` };
}
function pageHallOfFame(q) {
  const c = D(), series = CUR_SERIES === 'f2' ? 'f2' : 'f1', H = careerBook(c, series);
  const champ = x => { const d = driverOf(x.d), t = teamOf(x.dt);
    return `<article class="hof-champ" style="--tc:${t ? t.color : '#e10600'}"><span class="hof-year">${x.year}</span>${d ? `<div class="hof-pic">${driverHead(d, t)}</div>` : ''}<div><a class="h-card" href="#/drivers/${x.d}">${esc(inName(x.d))}</a>
      <p class="muted">${esc(t ? t.name : '')} · ${x.pts} pts${x.runner ? ` · beat ${esc(inLast(x.runner))} by ${x.margin}` : ''}</p>${x.t ? `<p class="muted">Teams: ${esc(inTeamName(x.t))}</p>` : ''}</div></article>`; };
  const legend = x => { const d = driverOf(x.id);
    return `<article class="hof-legend"><a href="#/drivers/${x.id}">${d ? driverHead(d, teamOf([...x.teams].pop())) : ''}<b>${esc(inName(x.id))}</b></a>
      <dl class="hof-nums"><div><dt>Titles</dt><dd>${x.titles}</dd></div><div><dt>Wins</dt><dd>${x.wins}</dd></div><div><dt>Podiums</dt><dd>${x.podiums}</dd></div><div><dt>Starts</dt><dd>${x.starts}</dd></div></dl>
      <p class="muted">${x.first}${x.last !== x.first ? '–' + x.last : ''} · ${[...x.teams].map(inTeamName).join(', ')}</p></article>`; };
  const records = H.records.map(r => `<tr><td class="mx-left">${esc(r.title)}</td><td class="mx-left"><a href="#/drivers/${r.id}">${esc(inName(r.id))}</a></td><td class="num">${esc(r.value)}</td></tr>`).join('');
  const gone = H.gone.slice(0, 24).map(x => `<tr><td class="mx-left"><a href="#/drivers/${x.id}">${esc(inName(x.id))}</a></td><td>${x.first}–${x.last}</td><td class="num">${x.starts}</td><td class="num">${x.wins}</td><td class="num">${x.podiums}</td><td class="num">${x.titles || ''}</td></tr>`).join('');
  return { title: 'Hall of Fame', nav: 'insights', html: `
    ${insightsSubnav(activeSeason(c), 'hall-of-fame')}
    <div class="wrap page">
      <h1 class="h-page">Hall of Fame</h1>
      <p class="page-intro">Every ${series === 'f2' ? 'Formula 2' : 'Formula 1'} season of this career, ${H.seasons} so far. Titles count once a season is complete.</p>
      <h2 class="h-section spaced">Champions</h2>
      ${H.champs.length ? `<div class="hof-champs">${H.champs.map(champ).join('')}</div>` : '<p class="muted">The first champion is crowned at the end of the first season.</p>'}
      ${H.legends.length ? `<h2 class="h-section spaced">Legends</h2><div class="hof-legends">${H.legends.map(legend).join('')}</div>` : ''}
      ${records ? `<h2 class="h-section spaced">Records</h2><div class="mx-scroll"><table class="mx-table stats-table"><thead><tr><th>Record</th><th>Driver</th><th>Value</th></tr></thead><tbody>${records}</tbody></table></div>` : ''}
      ${gone ? `<h2 class="h-section spaced">They left the grid</h2><div class="mx-scroll"><table class="mx-table stats-table"><thead><tr><th>Driver</th><th>Years</th><th>Starts</th><th>Wins</th><th>Podiums</th><th>Titles</th></tr></thead><tbody>${gone}</tbody></table></div>` : ''}
    </div>` };
}

/* ==========================================================================
   5. DRIVER RANKING: how the paddock rates each driver.
   Three panels judge the same evidence with different priorities:
   - Team principals: pace relative to the car, beating the team-mate, bringing the car home.
   - Journalists:     race-by-race ratings, pace relative to the car, career record, recent form.
   - Fans:            wins and podiums, overtakes, momentum, big stories, career record.
   Each factor is scaled 0 to 100 across the grid (best driver = 100), each panel is a weighted sum,
   and the overall score is the average of the three panels. Rankings move race by race.
   ========================================================================== */
const DR_FACTORS = {
  car: 'Pace relative to the car', mate: 'Head-to-head with team-mate', rating: 'Average race rating', quali: 'Qualifying relative to the car',
  finish: 'Consistency (points finishes, few retirements)', overtake: 'Places gained in races', results: 'Wins and podiums this season',
  form: 'Form over the last 5 races', story: 'Storylines (comebacks, momentum)', record: 'Career record and awards',
};
const DR_PANELS = {
  tp: { name: 'Team principals', w: { car: 30, mate: 25, finish: 15, quali: 10, rating: 10, record: 10 } },
  press: { name: 'Journalists', w: { rating: 30, car: 20, record: 15, form: 15, mate: 10, quali: 10 } },
  fans: { name: 'Fans', w: { results: 25, overtake: 15, form: 15, story: 15, record: 15, car: 15 } },
};
function driverRanking(c, sid, upto) {
  const all = completedRounds(c, sid), N = upto == null ? all.length : Math.min(upto, all.length);
  return inMemo(c, `drank|${sid}|${N}`, () => {
    const rounds = all.slice(0, N); if (!rounds.length) return null;
    const P = teamPace(c, sid), s = seasonOf(c, sid);
    // car order after N races: average weekend pace of each team so far (both cars)
    const carAvg = {}; P.teams.forEach(t => { const v = inAvg(t.raw.slice(0, N)); if (v != null) carAvg[t.id] = v; });
    const carRank = Object.keys(carAvg).sort((a, b) => carAvg[b] - carAvg[a]);
    const expected = tid => { const k = carRank.indexOf(tid); return k < 0 ? 11 : 2 * k + 1.5; };   // where two cars of this pace should finish on average
    const X = {}, get = (id, tid) => (X[id] = X[id] || { id, team: tid, n: 0, car: [], quali: [], rating: [], gained: [], pts: 0, finish: 0, dnf: 0, wins: 0, pods: 0, qW: 0, qT: 0, rW: 0, rT: 0 });
    rounds.forEach(rd => {
      const race = classify(c, resultFor(c, rd.id, 'race')), q = classify(c, resultFor(c, rd.id, 'qualifying'));
      const rates = typeof ngRateRows === 'function' ? ngRateRows(c, rd, race) : [];
      race.forEach(e => {
        const x = get(e.driverId, e.teamId); x.team = e.teamId; x.n++;
        const exp = expected(e.teamId), qp = (q.find(z => z.driverId === e.driverId) || {}).position || e.grid;
        if (e.position) { x.car.push(exp - e.position); if (e.pts > 0) x.finish++; if (e.position === 1) x.wins++; if (e.position <= 3) x.pods++; if (e.grid) x.gained.push(e.grid - e.position); }
        else if (e.status === 'DNF') x.dnf++;
        if (qp) x.quali.push(exp - qp);
        x.pts += e.pts || 0;
        const rr = rates.find(r => r.e.driverId === e.driverId); if (rr) x.rating.push(rr.r);
      });
      // team-mate duels
      const byT = {}; race.forEach(e => (byT[e.teamId] = byT[e.teamId] || []).push(e));
      Object.values(byT).forEach(es => { if (es.length !== 2) return; const [a, b] = es.map(e => X[e.driverId]);
        const qa = (q.find(z => z.driverId === es[0].driverId) || {}).position || es[0].grid, qb = (q.find(z => z.driverId === es[1].driverId) || {}).position || es[1].grid;
        if (qa && qb) { a.qT++; b.qT++; (qa < qb ? a : b).qW++; }
        if (es[0].position && es[1].position) { a.rT++; b.rT++; (es[0].position < es[1].position ? a : b).rW++; } });
    });
    const minRaces = Math.max(1, Math.ceil(N / 3));
    const list = Object.values(X).filter(x => x.n >= minRaces);
    // career record and awards from earlier, completed seasons of this series
    const book = careerBook(c, seriesOf(s)).book;
    const awardsWon = {}; c.seasons.filter(z => seriesOf(z) === seriesOf(s) && z.year < s.year).forEach(z => (seasonAwards(c, z.id) || []).forEach(a => [a.d, a.d2].filter(Boolean).forEach(d => awardsWon[d] = (awardsWon[d] || 0) + 1)));
    const mem = typeof ngNarrative === 'function' ? ngNarrative(c).get(rounds[rounds.length - 1].id) : null;
    list.forEach(x => {
      const B = book[x.id] || {};
      const recentRates = x.rating.slice(-5);
      x.f = {
        car: inAvg(x.car) ?? -5,
        quali: inAvg(x.quali) ?? -5,
        mate: x.qT + x.rT ? (x.qW + x.rW) / (x.qT + x.rT) : 0.5,
        rating: inAvg(x.rating) ?? 5,
        finish: x.finish / x.n - 0.5 * x.dnf / x.n,
        overtake: inAvg(x.gained) ?? 0,
        results: x.wins * 3 + x.pods,
        form: inAvg(recentRates) ?? 5,
        story: (() => { if (!mem) return 0; let v = 0; const m = (mem.mood || {})[x.id];
          v += { flying: 3, good: 1.5, steady: 0, low: -1.5, crisis: -3 }[m] || 0;
          mem.ended.forEach(z => { if (z.kind === 'slump' && z.drivers[0] === x.id && ['podium', 'points'].includes(z.outcome)) v += 2; if (z.kind === 'form' && z.drivers[0] === x.id) v += 1; });
          mem.open.forEach(z => { if (z.drivers.includes(x.id)) v += { form: 2, rivalry: 1, title: 2, slump: -2, saga: 0.5 }[z.kind] || 0; }); return v; })(),
        record: (B.titles || 0) * 10 + (B.wins || 0) * 1.5 + (B.podiums || 0) * 0.5 + (B.poles || 0) * 0.5 + (awardsWon[x.id] || 0) * 3 + Math.min(B.starts || 0, 200) * 0.02,
      };
    });
    // scale every factor 0..100 across the grid
    const S = {};
    Object.keys(DR_FACTORS).forEach(k => { const vs = list.map(x => x.f[k]), lo = Math.min(...vs), hi = Math.max(...vs);
      list.forEach(x => { (S[x.id] = S[x.id] || {})[k] = hi > lo ? Math.round(100 * (x.f[k] - lo) / (hi - lo)) : 50; }); });
    list.forEach(x => {
      x.s = S[x.id]; x.panels = {};
      Object.entries(DR_PANELS).forEach(([pk, p]) => { const tot = Object.values(p.w).reduce((a, b) => a + b, 0);
        x.panels[pk] = Object.entries(p.w).reduce((a, [k, w]) => a + x.s[k] * w, 0) / tot; });
      x.score = Math.round(inAvg(Object.values(x.panels)) * 10) / 10;
      // what stands out: the two factors furthest above this driver's own average
      const mean = inAvg(Object.values(x.s));
      x.strengths = Object.keys(DR_FACTORS).filter(k => x.s[k] >= 70).sort((a, b) => x.s[b] - x.s[a]).slice(0, 2);
      x.weak = Object.keys(DR_FACTORS).filter(k => x.s[k] <= 30 && x.s[k] < mean - 20 && !(['car', 'quali'].includes(k) && x.f[k] >= -2)).sort((a, b) => x.s[a] - x.s[b])[0] || null;
    });
    list.sort((a, b) => b.score - a.score);
    Object.keys(DR_PANELS).forEach(pk => [...list].sort((a, b) => b.panels[pk] - a.panels[pk]).forEach((x, i) => { (x.ranks = x.ranks || {})[pk] = i + 1; }));
    list.forEach((x, i) => { x.rank = i + 1; });
    return { rounds: N, list, minRaces };
  });
}
const DR_NOTE = {
  car: x => `${x.f.car >= 0 ? '+' : ''}${x.f.car.toFixed(1)} places vs the car`, quali: x => `${x.f.quali >= 0 ? '+' : ''}${x.f.quali.toFixed(1)} grid places vs the car`,
  mate: x => `beats his team-mate ${Math.round(x.f.mate * 100)}% of the time`, rating: x => `${x.f.rating.toFixed(1)}/10 average rating`,
  finish: x => `${x.finish} of ${x.n} races in the points`, overtake: x => `${x.f.overtake >= 0 ? '+' : ''}${x.f.overtake.toFixed(1)} places per race`,
  results: x => `${x.wins} wins, ${x.pods} podiums`, form: x => `${x.f.form.toFixed(1)}/10 over the last 5 races`, story: () => 'a story the fans follow', record: () => 'a strong career record',
};
function pageDriverRanking(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const R = driverRanking(c, s.id), prev = R && R.rounds > 1 ? driverRanking(c, s.id, R.rounds - 1) : null;
  if (!R) return { title: 'Driver ranking', nav: 'insights', html: `${insightsSubnav(s, 'driver-ranking')}<div class="wrap page"><h1 class="h-page">Driver Ranking</h1>${emptyState('No races yet', 'The ranking starts after the first race.', null)}</div>` };
  const move = x => { const p = prev && prev.list.find(z => z.id === x.id); if (!p) return '<span class="trend">new</span>'; const d = p.rank - x.rank;
    return d > 0 ? `<span class="trend up">▲ ${d}</span>` : d < 0 ? `<span class="trend down">▼ ${-d}</span>` : '<span class="trend">●</span>'; };
  const dLink = x => { const d = driverOf(x.id), t = teamOf(x.team); return `${t ? `<span class="dot" style="--tc:${t.color}"></span> ` : ''}<a href="#/drivers/${x.id}">${esc(d ? nameOf(d) : x.id)}</a><small class="muted"> ${esc(t ? t.name : '')}</small>`; };
  const note = x => [...x.strengths.map(k => DR_NOTE[k](x)), x.weak ? `weak spot: ${DR_FACTORS[x.weak].toLowerCase()}` : ''].filter(Boolean).join(' · ');
  const top3 = R.list.slice(0, 3).map(x => { const d = driverOf(x.id), t = teamOf(x.team);
    return `<article class="award-card dr-top" style="--tc:${t ? t.color : '#e10600'}"><div class="award-pic">${d ? driverHead(d, t) : ''}</div><div class="award-body"><span class="eyebrow">No. ${x.rank} in the paddock</span>
      <h3 class="h-card"><a href="#/drivers/${x.id}">${esc(d ? nameOf(d) : x.id)}</a></h3><p class="award-value">${x.score.toFixed(1)} / 100</p>
      <p class="muted">Team principals #${x.ranks.tp} · Journalists #${x.ranks.press} · Fans #${x.ranks.fans}</p><p class="muted">${esc(note(x))}</p></div></article>`; }).join('');
  const rows = R.list.map(x => `<tr><td>${x.rank}</td><td class="num">${move(x)}</td><td class="mx-left">${dLink(x)}</td>
    <td class="mx-left"><span class="dr-bar"><span style="width:${x.score}%;background:${(teamOf(x.team) || {}).color || '#888'}"></span></span> <b>${x.score.toFixed(1)}</b></td>
    <td class="num">${x.ranks.tp}</td><td class="num">${x.ranks.press}</td><td class="num">${x.ranks.fans}</td><td class="mx-left muted dr-note">${esc(note(x))}</td></tr>`).join('');
  const method = Object.entries(DR_PANELS).map(([, p]) => `<li><b>${esc(p.name)}:</b> ${Object.entries(p.w).map(([k, w]) => `${esc(DR_FACTORS[k].toLowerCase())} ${w}%`).join(', ')}.</li>`).join('');
  return { title: `${s.year} Driver ranking`, nav: 'insights', html: `
    ${insightsSubnav(s, 'driver-ranking')}
    <div class="wrap page">
      <h1 class="h-page">${esc(s.year)} Driver Ranking</h1>
      <p class="page-intro">Who the paddock rates highest after ${R.rounds} race${R.rounds > 1 ? 's' : ''}. Team principals, journalists and fans each judge every driver against the car he drives, his team-mate, his results and his record. Arrows show the change since the last race.</p>
      <div class="award-grid">${top3}</div>
      <div class="mx-scroll"><table class="mx-table stats-table dr-table"><thead><tr><th>#</th><th></th><th>Driver</th><th>Score</th><th>Team principals</th><th>Journalists</th><th>Fans</th><th>What stands out</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details class="panel dr-method"><summary>How the ranking works</summary>
        <p>Every factor is measured for each driver who started at least ${R.minRaces} race${R.minRaces > 1 ? 's' : ''}, then scaled from 0 (lowest on the grid) to 100 (highest). Each panel adds the factors with its own weights. The score is the average of the three panels.</p>
        <ul>${method}</ul>
        <p>"Relative to the car": the car's place in the field comes from the team's average pace so far. A car ranked 3rd should put its drivers around 5th and 6th. Finishing ahead of that counts as plus, behind it as minus.</p>
      </details>
    </div>` };
}
