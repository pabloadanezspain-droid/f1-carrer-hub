/* ==========================================================================
   matrix.js — Wikipedia-style championship results matrix + click-to-edit cells.
   Data operations (mx*) are pure functions on a career object, so they run in the
   node tests too. Rendering and binding use the shared page helpers.
   ========================================================================== */

/* Wikipedia F1 results key */
const MX_KEY = [
  ['gold', 'Winner'], ['silver', 'Second place'], ['bronze', 'Third place'], ['green', 'Points finish'],
  ['blue', 'Finished, no points'], ['purple', 'Retired (Ret)'], ['white', 'Did not start (DNS)'], ['black', 'Disqualified (DSQ)'],
];
const MX_STATUS_LABEL = { DNF: 'Ret', DNS: 'DNS', DSQ: 'DSQ' };

/* --- data operations ------------------------------------------------------ */
function mxSeat(c, round, driverId) { return driverTeamAt(c, driverId, round.seasonId, round.round) || driverCurrentTeam(c, driverId, round.seasonId); }
function mxEnsure(c, round, session) {
  let r = resultFor(c, round.id, session);
  if (!r) { r = { id: `res_${round.id.replace(/^rnd_/, '')}_${session}`, roundId: round.id, session, entries: [] }; c.results.push(r); }
  return r;
}
function mxDropIfEmpty(c, res) { if (res && !res.entries.length) c.results = c.results.filter(r => r !== res); }
function mxSyncStatus(c, round) { round.status = resultFor(c, round.id, 'race') ? 'completed' : 'scheduled'; }

/* Set a driver's result in one session: a position number, 'DNF' | 'DNS' | 'DSQ', or '' to clear. */
function mxSetResult(c, roundId, session, driverId, value) {
  const round = byId(c.rounds, roundId); if (!round) throw new Error('Unknown round');
  if (value === '' || value == null) {
    const res = resultFor(c, roundId, session);
    if (res) { res.entries = res.entries.filter(e => e.driverId !== driverId); mxDropIfEmpty(c, res); }
    mxSyncStatus(c, round); return;
  }
  const res = mxEnsure(c, round, session);
  // freeze everyone's current position so edits never renumber other drivers by accident
  classify(c, res).forEach((e, i) => { if (e.position) res.entries[i].pos = e.position; });
  const old = res.entries.find(e => e.driverId === driverId);
  const entry = Object.assign({ driverId, teamId: mxSeat(c, round, driverId), grid: null, laps: null, time: '', fastestLap: false, points: null }, old || {});
  const others = res.entries.filter(e => e.driverId !== driverId);
  if (typeof value === 'number') {
    const p = Math.max(1, Math.round(value));
    const at = k => others.find(e => e.status === 'FIN' && e.pos === k);
    const oldPos = old && old.status === 'FIN' ? old.pos : null;
    if (at(p)) {
      if (oldPos) at(p).pos = oldPos;                       // swap places
      else {                                                // push the following cars down one place
        const chain = []; for (let k = p; at(k); k++) chain.push(at(k));
        chain.forEach(e => { e.pos++; });
      }
    }
    entry.status = 'FIN'; entry.pos = p;
  } else {
    entry.status = value; delete entry.pos; entry.fastestLap = false;
  }
  const fin = others.concat(entry).filter(e => e.status === 'FIN').sort((a, b) => a.pos - b.pos);
  res.entries = fin.concat(others.filter(e => e.status !== 'FIN'), entry.status === 'FIN' ? [] : [entry]);
  mxSyncStatus(c, round);
}

/* Pole = first place in qualifying. */
function mxPoleOf(c, roundId) { const q = classify(c, resultFor(c, roundId, 'qualifying')).find(e => e.position === 1); return q ? q.driverId : null; }
function mxSetPole(c, roundId, driverId, on) {
  const round = byId(c.rounds, roundId);
  if (on) {
    const q = mxEnsure(c, round, 'qualifying');
    const old = q.entries.find(e => e.driverId === driverId);
    q.entries = [Object.assign({ driverId, teamId: mxSeat(c, round, driverId), grid: null, laps: null, time: '', fastestLap: false, points: null }, old || {}, { status: 'FIN' })]
      .concat(q.entries.filter(e => e.driverId !== driverId));
    q.entries.forEach(e => { delete e.pos; });
  } else {
    const q = resultFor(c, roundId, 'qualifying');
    if (q && mxPoleOf(c, roundId) === driverId) { q.entries = q.entries.filter(e => e.driverId !== driverId); mxDropIfEmpty(c, q); }
  }
}
function mxSetFastestLap(c, roundId, driverId, on) {
  const res = resultFor(c, roundId, 'race'); if (!res) return;
  const e = res.entries.find(x => x.driverId === driverId);
  if (on && (!e || e.status !== 'FIN')) throw new Error('Give the driver a race position first.');
  res.entries.forEach(x => { x.fastestLap = on && x.driverId === driverId; });
}

/* Everything one matrix cell shows. */
function mxCell(c, round, driverId) {
  const rule = ruleFor(c, round.seasonId);
  const pick = s => classify(c, resultFor(c, round.id, s)).find(e => e.driverId === driverId) || null;
  const race = pick('race'), sprint = pick('sprint'), race2 = pick('race2');
  let label = '', tone = '';
  if (race) {
    if (race.position) {
      label = String(race.position);
      tone = race.position === 1 ? 'gold' : race.position === 2 ? 'silver' : race.position === 3 ? 'bronze' : race.position <= (rule.race || []).length ? 'green' : 'blue';
    } else { label = MX_STATUS_LABEL[race.status] || race.status; tone = { DNF: 'purple', DNS: 'white', DSQ: 'black' }[race.status] || 'purple'; }
  }
  return { race, sprint, race2, label, tone, pole: mxPoleOf(c, round.id) === driverId, fastestLap: !!(race && race.fastestLap) };
}

/* --- rendering ------------------------------------------------------------ */
function mxSup(cell, rule, edit) {
  const s = cell.sprint, bits = [];
  if (s && s.position && (edit || s.position <= (rule.sprint || []).length)) bits.push(s.position);
  if (cell.pole) bits.push('P');
  if (cell.fastestLap) bits.push('F');
  return bits.length ? `<sup>${bits.join(' ')}</sup>` : '';
}
/* Columns per round: F1 shows one cell (sprint as a superscript); F2 shows Sprint and Feature cells, like Wikipedia. */
function mxCols(c, round) { return isF2Round(c, round) ? ['sprint', 'race', ...(hasRace2(c, round) ? ['race2'] : [])] : ['race']; }
const MX_COL_ABBR = { sprint: 'SPR', race: 'FEA', race2: 'FEA' };
/* One F2 session cell: position + tone, pole on the feature race, fastest lap in that session. */
function mxSessionCell(c, round, driverId, session) {
  const rule = ruleFor(c, round.seasonId);
  const e = classify(c, resultFor(c, round.id, session)).find(x => x.driverId === driverId) || null;
  const table = session === 'sprint' ? rule.sprint || [] : rule.race || [];
  let label = '', tone = '';
  if (e) {
    if (e.position) { label = String(e.position); tone = e.position === 1 ? 'gold' : e.position === 2 ? 'silver' : e.position === 3 ? 'bronze' : e.position <= table.length ? 'green' : 'blue'; }
    else { label = MX_STATUS_LABEL[e.status] || e.status; tone = { DNF: 'purple', DNS: 'white', DSQ: 'black' }[e.status] || 'purple'; }
  }
  return { label, tone, sprint: null, pole: session === 'race' && mxPoleOf(c, round.id) === driverId, fastestLap: !!(e && e.fastestLap) };
}
function mxCellsFor(c, round, driverId, rule, edit) {
  const cols = mxCols(c, round);
  if (cols.length === 1) return mxTd(mxCell(c, round, driverId), rule, driverId, round, edit);
  return cols.map(s => mxTd(mxSessionCell(c, round, driverId, s), rule, driverId, round, edit)).join('');
}
function mxHead2(c, rounds) {
  return rounds.some(r => mxCols(c, r).length > 1) ? `<tr class="mx-sub"><th class="mx-pos"></th><th class="mx-name"></th>${rounds.map(r => mxCols(c, r).map(s => `<th class="mx-sess">${MX_COL_ABBR[s]}</th>`).join('')).join('')}<th class="mx-pts"></th></tr>` : '';
}
function mxHead(rounds) {
  return rounds.map(r => `<th class="mx-gp${resultFor(D(), r.id, 'race') ? '' : ' is-future'}" scope="col" colspan="${mxCols(D(), r).length}"><a href="#/schedule/${r.id}" title="R${r.round} ${esc(r.name)}">${flag(r.countryCode, 'mx-flag')}<span>${esc((r.countryCode || r.name.slice(0, 3)).toUpperCase())}</span></a></th>`).join('');
}
function mxTd(cell, rule, driverId, round, edit) {
  const attrs = edit ? ` tabindex="0" role="button" data-mx-cell="${driverId}|${round.id}" aria-label="Edit result"` : '';
  return `<td class="mx-c${cell.tone ? ' mx-' + cell.tone : ''}${edit ? ' is-edit' : ''}"${attrs}>${cell.label}${mxSup(cell, rule, edit)}</td>`;
}

function mxDriversTable(c, s, edit) {
  const rounds = roundsOf(c, s.id), rule = ruleFor(c, s.id);
  const rows = driverStandings(c, s.id).map(r => {
    const d = driverOf(r.id), t = teamOf(r.teamId);
    return `<tr data-mx-driver="${r.id}"><th class="mx-pos" scope="row">${r.position}</th>
      <th class="mx-name" style="--tc:${t ? t.color : '#606066'}">${d ? flag(d.nationality, 'mx-flag') : ''}<a href="#/drivers/${r.id}">${esc(d ? nameOf(d) : r.id)}</a></th>
      ${rounds.map(rd => mxCellsFor(c, rd, r.id, rule, edit)).join('')}
      <td class="mx-pts">${r.points}</td></tr>`;
  });
  return `<div class="mx-scroll" data-mx-scroll><table class="mx-table"><thead><tr><th class="mx-pos" scope="col">Pos.</th><th class="mx-name" scope="col">Driver</th>${mxHead(rounds)}<th class="mx-pts" scope="col">Points</th></tr>${mxHead2(c, rounds)}</thead>
    <tbody>${rows.join('')}</tbody></table></div>`;
}

function mxTeamsTable(c, s) {
  const rounds = roundsOf(c, s.id), rule = ruleFor(c, s.id);
  const rows = teamStandings(c, s.id).map(r => {
    const t = teamOf(r.id);
    // per round: this team's cars in classification order (Wikipedia: rows are cars, not drivers)
    const per = rounds.map(rd => classify(c, resultFor(c, rd.id, 'race')).filter(e => e.teamId === r.id).map(e => [rd, e.driverId]));
    const seats = Math.max(2, ...per.map(x => x.length), ...rounds.slice(0, 1).map(rd => (lineupAt(c, s.id, rd.round)[r.id] || []).length));
    return Array.from({ length: seats }, (_, i) => `<tr class="${i === 0 ? 'mx-group' : ''}">
      ${i === 0 ? `<th class="mx-pos" scope="row" rowspan="${seats}">${r.position}</th><th class="mx-name" rowspan="${seats}" style="--tc:${t ? t.color : '#606066'}"><a href="#/teams/${r.id}">${esc(t ? t.name : r.id)}</a></th>` : ''}
      ${per.map((list, k) => { const x = list[i]; return x ? mxCellsFor(c, x[0], x[1], rule, false).replace(/<td /g, `<td title="${esc(nameOf(driverOf(x[1])))}" `) : mxCols(c, rounds[k]).map(() => '<td class="mx-c"></td>').join(''); }).join('')}
      ${i === 0 ? `<td class="mx-pts" rowspan="${seats}">${r.points}</td>` : ''}</tr>`).join('');
  });
  return `<div class="mx-scroll" data-mx-scroll><table class="mx-table mx-teams"><thead><tr><th class="mx-pos" scope="col">Pos.</th><th class="mx-name" scope="col">Team</th>${mxHead(rounds)}<th class="mx-pts" scope="col">Points</th></tr>${mxHead2(c, rounds)}</thead>
    <tbody>${rows.join('')}</tbody></table></div>`;
}

function mxLegend() {
  return `<div class="mx-key" aria-label="Key">${MX_KEY.map(([k, l]) => `<span><i class="mx-c mx-${k}"></i>${l}</span>`).join('')}
    <span><b>P</b> Pole position</span><span><b>F</b> Fastest lap</span><span><b><sup>1–8</sup></b> Sprint position</span><span><i class="mx-c"></i>Did not enter</span></div>`;
}

/* --- live editing popover ------------------------------------------------- */
const MX = { reopen: null, scroll: 0 };

function mxPopover(driverId, roundId) {
  const c = D(), round = byId(c.rounds, roundId), d = driverOf(driverId);
  const cell = mxCell(c, round, driverId);
  const val = e => (e && e.position ? e.position : '');
  const stat = e => (e && !e.position ? e.status : '');
  const line = (session, label, e) => `<div class="mx-field"><label for="mx-${session}">${label}</label>
      <div class="mx-line"><input id="mx-${session}" type="number" min="1" max="99" inputmode="numeric" placeholder="P" value="${val(e)}" data-mx-pos="${session}">
      ${['DNF', 'DNS', 'DSQ'].map(st => `<button type="button" class="mx-chip${stat(e) === st ? ' is-on' : ''}" data-mx-status="${session}|${st}">${MX_STATUS_LABEL[st]}</button>`).join('')}
      <button type="button" class="mx-chip mx-chip-clear" data-mx-clear="${session}" ${e ? '' : 'disabled'} aria-label="Clear ${label.toLowerCase()}">✕</button></div></div>`;
  return `<div class="mx-pop" role="dialog" aria-label="Edit result" data-mx-pop="${driverId}|${roundId}">
    <div class="mx-pop-head"><div><b>${esc(nameOf(d))}</b><small>${flag(round.countryCode, 'mx-flag')} R${round.round} ${esc(round.name)}</small></div><button type="button" class="mx-x" data-mx-close aria-label="Close">✕</button></div>
    ${round.sprint || cell.sprint ? line('sprint', sessionName(c, round, 'sprint'), cell.sprint) : ''}
    ${line('race', sessionName(c, round, 'race'), cell.race)}
    ${hasRace2(c, round) ? line('race2', sessionName(c, round, 'race2'), cell.race2) : ''}
    <div class="mx-toggles">
      <label class="switch switch-sm"><input type="checkbox" data-mx-pole ${cell.pole ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span>Pole position</span></label>
      <label class="switch switch-sm"><input type="checkbox" data-mx-fl ${cell.fastestLap ? 'checked' : ''} ${cell.race && cell.race.position ? '' : 'disabled'}><span class="switch-ui" aria-hidden="true"></span><span>Fastest lap</span></label>
    </div>
    <p class="mx-hint">Type a position and press Enter to save and jump to the next driver. If the place is taken, the drivers swap.</p>
  </div>`;
}

function mxNextEmpty(wrap, roundId, session, fallback) {
  const c = D(), res = resultFor(c, roundId, session);
  const has = id => res && res.entries.some(e => e.driverId === id);
  const td = [...wrap.querySelectorAll(`[data-mx-cell$="|${roundId}"]`)].find(x => !has(x.dataset.mxCell.split('|')[0]));
  return td || wrap.querySelector(`[data-mx-cell="${fallback}"]`);
}

function bindMatrix(root) {
  document.querySelectorAll('[data-mx-pop]').forEach(x => x.remove());
  const wrap = root.querySelector('[data-mx-wrap]'); if (!wrap) return;
  const scroller = wrap.querySelector('[data-mx-scroll]');
  if (scroller) scroller.scrollLeft = MX.scroll;
  if (!wrap.querySelector('[data-mx-cell]')) return;
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; } wrap.querySelectorAll('.mx-c.is-open').forEach(x => x.classList.remove('is-open')); };
  MX.close = close;
  if (!MX.bound) {                                                 // one global outside-click handler for every render
    MX.bound = true;
    document.addEventListener('pointerdown', ev => { if (MX.close && !ev.target.closest('[data-mx-pop],[data-mx-cell]')) MX.close(); });
  }
  const commit = (fn, reopen) => {
    try { fn(D()); } catch (e) { toast(e.message, true); return; }
    MX.scroll = scroller ? scroller.scrollLeft : 0; MX.reopen = reopen;
    Store.save();                                                  // re-renders the page
  };
  const open = (td, focus) => {
    close();
    const key = td.dataset.mxCell, [driverId, roundId] = key.split('|');
    td.classList.add('is-open');
    document.body.insertAdjacentHTML('beforeend', mxPopover(driverId, roundId));
    pop = document.querySelector('[data-mx-pop]');
    const r = td.getBoundingClientRect(), w = pop.offsetWidth;
    if (window.innerWidth > 640) {
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + window.scrollX + 'px';
      pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    }
    const f = pop.querySelector(`[data-mx-pos="${focus || 'race'}"]`) || pop.querySelector('[data-mx-pos]');
    if (f) { f.focus({ preventScroll: true }); f.select(); }
    const next = sess => ({ next: true, roundId, session: sess, cell: key });
    const same = sess => ({ cell: key, focus: sess });

    pop.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { close(); td.focus(); return; }
      const inp = ev.target.closest('[data-mx-pos]');
      if (inp && ev.key === 'Enter') {
        ev.preventDefault();
        const sess = inp.dataset.mxPos, v = inp.value.trim();
        if (v !== '' && !(Number(v) >= 1)) return toast('Enter a position from 1 upwards.', true);
        commit(c => mxSetResult(c, roundId, sess, driverId, v === '' ? '' : Number(v)), v === '' ? same(sess) : next(sess));
      }
    });
    pop.addEventListener('change', ev => {
      const t = ev.target;
      if (t.matches('[data-mx-pole]')) commit(c => mxSetPole(c, roundId, driverId, t.checked), same('race'));
      if (t.matches('[data-mx-fl]')) commit(c => mxSetFastestLap(c, roundId, driverId, t.checked), same('race'));
    });
    pop.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-mx-close')) { close(); td.focus(); }
      if (b.dataset.mxStatus) { const [sess, st] = b.dataset.mxStatus.split('|'); commit(c => mxSetResult(c, roundId, sess, driverId, st), next(sess)); }
      if (b.dataset.mxClear) commit(c => mxSetResult(c, roundId, b.dataset.mxClear, driverId, ''), same(b.dataset.mxClear));
    });
  };
  wrap.addEventListener('click', ev => { const td = ev.target.closest('[data-mx-cell]'); if (td) open(td); });
  wrap.addEventListener('keydown', ev => {
    const td = ev.target.closest('[data-mx-cell]');
    if (td && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); open(td); }
  });
  if (MX.reopen) {
    const o = MX.reopen; MX.reopen = null;
    const td = o.next ? mxNextEmpty(wrap, o.roundId, o.session, o.cell) : wrap.querySelector(`[data-mx-cell="${o.cell}"]`);
    if (td) { td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); open(td, o.focus || o.session); }
  }
}
