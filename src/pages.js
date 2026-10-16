/* ==========================================================================
   pages.js — public pages. Each returns { title, nav, html, after? }.
   ========================================================================== */

function pickSeason(q) { const c = D(); return (q.season && seasonOf(c, q.season)) || activeSeason(c); }
const seasonQ = s => `?season=${s.id}`;
function noSeason() { return { title: 'No season', nav: '', html: `<div class="wrap page">${emptyState('No season yet', 'Create a season in Edit Career to get started.', { href: '#/edit/seasons', label: 'Add a season' })}</div>` }; }

/* ======================= HOME ============================================ */
function pageHome() {
  const c = D(); const s = activeSeason(c);
  if (!s) return noSeason();
  const arts = articlesFor(c, { seasonId: s.id });
  const lead = arts.find(a => a.featured) || arts[0];
  const rest = arts.filter(a => a !== lead);
  const nx = nextRound(c, s.id), last = lastRound(c, s.id);

  const leadGrid = lead ? `<section class="lead-grid wrap">
      <div class="lead-main">${articleCard(lead, 'lead')}</div>
      <div class="lead-four">${rest.slice(0, 4).map(a => articleCard(a, 'grid')).join('')}</div>
      <div class="lead-side">${rest.slice(4, 8).map(a => articleCard(a, 'list')).join('')}</div>
    </section>` : `<section class="wrap">${emptyState('No stories yet', 'Write your first career article.', { href: '#/edit/articles', label: 'Add article' })}</section>`;

  const chips = `<div class="wrap chip-row">${pill('Latest news', '#/news')}${pill('Schedule', '#/schedule')}${pill('Results', '#/results')}${pill("Drivers' standings", '#/standings/drivers')}${pill("Teams' standings", '#/standings/teams')}${pill('Edit Career', '#/edit')}</div>`;

  return { title: 'Home', nav: 'home', html: `
    ${chips}
    ${leadGrid}
    <section class="wrap home-duo">
      ${nx ? nextRaceCard(nx) : `<div class="panel">${emptyState('Season complete', 'Every round has a result.', null)}</div>`}
      ${last ? lastResultCard(last) : `<div class="panel">${emptyState('No results yet', 'Add race results in Edit Career.', { href: '#/edit/results', label: 'Add results' })}</div>`}
    </section>
    <section class="band-dark"><div class="wrap">
      ${sectionHead(`${s.year} Season`, null)}
      ${standingsWidget(s)}
    </div></section>
    <section class="wrap section">
      ${sectionHead('Latest career news', { href: '#/news', label: 'View all' })}
      <div class="row-cards">${arts.slice(0, 6).map(a => articleCard(a, 'row')).join('') || '<p class="muted">No articles.</p>'}</div>
    </section>` };
}

function nextRaceCard(r) {
  const c = D();
  const raceSess = r.sessions.find(x => /^race$/i.test(x.label)) || r.sessions[r.sessions.length - 1];
  return `<article class="panel next-race">
    <div class="panel-head"><span class="eyebrow">Next race · Round ${r.round}</span>${r.sprint ? tag('Sprint', 'dark') : ''}</div>
    <a class="next-race-title" href="#/schedule/${r.id}">${flag(r.countryCode, 'flag-lg')}<span><span class="h-card">${esc(r.name)}</span><span class="muted">${esc(r.officialName)}</span></span></a>
    <div class="next-race-date">${esc(fmtRange(r.dateStart, r.dateEnd))}</div>
    <ul class="session-list">${r.sessions.map(x => `<li class="${x === raceSess ? 'is-race' : ''}"><span>${esc(x.label)}</span><span class="muted">${esc(fmtDay(x.date))}</span><b>${esc(x.time || '')}</b></li>`).join('')}</ul>
    <a class="btn btn-outline" href="#/schedule/${r.id}">Race weekend</a>
  </article>`;
}

function lastResultCard(r) {
  const c = D();
  const rows = classify(c, resultFor(c, r.id, 'race')).slice(0, 5);
  return `<article class="panel last-result">
    <div class="panel-head"><span class="eyebrow">Latest result · Round ${r.round}</span></div>
    <a class="next-race-title" href="#/results/${r.id}">${flag(r.countryCode, 'flag-lg')}<span><span class="h-card">${esc(r.name)}</span><span class="muted">${esc(fmtRange(r.dateStart, r.dateEnd))}</span></span></a>
    <ol class="mini-result">${rows.map(e => { const d = driverOf(e.driverId), t = teamOf(e.teamId); return `<li style="--tc:${t ? t.color : '#666'}"><span class="pos">${e.posLabel}</span><span class="bar"></span>${driverLink(d, t, { head: false })}<span class="muted hide-sm">${esc(t ? t.name : '')}</span><span class="time">${esc(e.time)}</span></li>`; }).join('')}</ol>
    <a class="btn btn-outline" href="#/results/${r.id}">Full result</a>
  </article>`;
}

function podiumCards(rows, kind) {
  const c = D();
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return `<div class="podium">${order.map(r => {
    if (kind === 'teams') {
      const t = teamOf(r.id); if (!t) return '';
      return `<a class="podium-card ${r.position === 1 ? 'is-first' : ''}" href="#/teams/${t.id}" style="--tc:${t.color};--td:${t.colorDark}">
        <span class="podium-pos">${r.position}<sup>${ordinal(r.position)}</sup></span>
        <span class="podium-name"><b>${esc(t.name)}</b></span><span class="podium-sub">${esc(t.powerUnit || '')}</span>
        <img class="podium-car" src="${teamCar(t)}" alt="">
        <span class="podium-pts">${r.points}<small>PTS</small></span></a>`;
    }
    const d = driverOf(r.id), t = teamOf(r.teamId); if (!d) return '';
    return `<a class="podium-card ${r.position === 1 ? 'is-first' : ''}" href="#/drivers/${d.id}" style="--tc:${t ? t.color : '#606066'};--td:${t ? t.colorDark : '#26262b'}">
      <span class="podium-pos">${r.position}<sup>${ordinal(r.position)}</sup></span>
      <span class="podium-name">${esc(d.firstName)} <b>${esc(d.lastName)}</b></span><span class="podium-sub">${esc(t ? t.name : '')}</span>
      ${flag(d.nationality, 'flag-round podium-flag')}
      ${portraitImg(d, t, 'podium-portrait')}
      <span class="podium-pts">${r.points}<small>PTS</small></span></a>`;
  }).join('')}</div>`;
}

function standingsWidget(s) {
  const c = D();
  const dr = driverStandings(c, s.id), tm = teamStandings(c, s.id);
  const dRows = dr.slice(0, 10).map(r => { const d = driverOf(r.id), t = teamOf(r.teamId); return `<tr><td>${r.position}</td><td>${driverLink(d, t)}</td><td class="hide-sm">${d ? flag(d.nationality) + ' ' + esc(countryName(d.nationality)) : ''}</td><td>${teamLink(t)}</td><td class="num">${r.points}</td></tr>`; });
  const tRows = tm.slice(0, 10).map(r => `<tr><td>${r.position}</td><td>${teamLink(teamOf(r.id))}</td><td class="num">${r.wins}</td><td class="num">${r.points}</td></tr>`);
  return `<div class="tabs" data-tabs>
    <div class="tablist" role="tablist"><button role="tab" class="is-active" data-tab="d">Drivers</button><button role="tab" data-tab="t">Teams</button></div>
    <div data-panel="d">${podiumCards(dr, 'drivers')}${dataTable([{ label: 'Pos.' }, { label: 'Driver' }, { label: 'Nationality', cls: 'hide-sm' }, { label: 'Team' }, { label: 'Pts.', cls: 'num' }], dRows, 'table-inset')}
      <div class="center"><a class="btn btn-outline" href="#/standings/drivers${seasonQ(s)}">Full standings</a></div></div>
    <div data-panel="t" hidden>${podiumCards(tm, 'teams')}${dataTable([{ label: 'Pos.' }, { label: 'Team' }, { label: 'Wins', cls: 'num' }, { label: 'Pts.', cls: 'num' }], tRows, 'table-inset')}
      <div class="center"><a class="btn btn-outline" href="#/standings/teams${seasonQ(s)}">Full standings</a></div></div>
  </div>`;
}

/* ======================= SCHEDULE ======================================== */
/* F2 has rounds and feature races, not Grands Prix. */
const gpCol = () => CUR_SERIES === 'f2' ? 'Round' : 'Grand Prix';
const gpWord = () => CUR_SERIES === 'f2' ? 'Feature' : 'Grand Prix';

/* Wikipedia-style F2 calendar: round, circuit, sprint and feature dates, winners once raced. */
function f2CalendarTable(c, rounds) {
  const dateOf = (r, key) => { const x = (r.sessions || []).filter(s => sessionKeyOf(s.label) === key).map(s => s.date); return x.length ? x.map(d => fmtDay(d)).join(' & ') : '—'; };
  const winner = (r, key) => { const e = classify(c, resultFor(c, r.id, key)).find(x => x.position === 1); const d = e && driverOf(e.driverId); return d ? `${flag(d.nationality, 'mx-flag')} <a href="#/drivers/${d.id}">${esc(nameOf(d))}</a>` : ''; };
  const rows = rounds.map(r => {
    const fea = [dateOf(r, 'race'), hasRace2(c, r) ? dateOf(r, 'race2') : null].filter(Boolean).join(' & ');
    const feaWin = [winner(r, 'race'), hasRace2(c, r) ? winner(r, 'race2') : ''].filter(Boolean).join('<br>');
    return `<tr><th scope="row"><a href="#/schedule/${r.id}">${r.round}</a></th>
      <td class="mx-left">${flag(r.countryCode, 'mx-flag')} ${esc(r.circuit || r.name)}, ${esc(r.city || '')}</td>
      <td>${esc(dateOf(r, 'sprint'))}</td><td>${esc(fea)}</td>
      <td class="mx-left">${winner(r, 'sprint')}</td><td class="mx-left">${feaWin}</td></tr>`;
  }).join('');
  return `<div class="mx-scroll"><table class="mx-table mx-cal"><thead><tr><th>Round</th><th>Circuit</th><th>Sprint race</th><th>Feature race(s)</th><th>Sprint winner</th><th>Feature winner</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function pageSchedule(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const rounds = roundsOf(c, s.id);
  const nx = nextRound(c, s.id), last = lastRound(c, s.id);
  const after = nx ? rounds.filter(r => r.round > nx.round).slice(0, 2) : [];
  const hero = [last && ['Previous', last], nx && ['Next', nx], ...after.map((r, i) => [i ? '' : 'Upcoming', r])].filter(Boolean);
  const heroCard = ([label, r]) => `<div class="hero-col"><span class="hero-col-label">${label || '&nbsp;'}</span><a class="sched-hero" href="#/schedule/${r.id}"><img src="${roundImage(r)}" alt=""><span class="sched-hero-text"><span class="eyebrow">Round ${r.round}</span><span class="h-card">${esc(r.name)}</span><span class="date-font">${esc(fmtRange(r.dateStart, r.dateEnd))}</span></span></a></div>`;
  const card = r => {
    const res = classify(c, resultFor(c, r.id, 'race')).slice(0, 3);
    const isNext = nx && r.id === nx.id;
    return `<a class="sched-card ${isNext ? 'is-next' : ''}" href="#/schedule/${r.id}">
      <span class="sched-top"><span class="eyebrow">Round ${r.round}${r.sprint ? ' · Sprint' : ''}</span><span class="date-font">${esc(fmtRange(r.dateStart, r.dateEnd))}</span></span>
      <span class="sched-name">${flag(r.countryCode, 'flag-round')}<span class="h-card">${esc(r.name)}</span></span>
      <span class="sched-official">${esc(r.officialName)}</span>
      ${res.length ? `<span class="sched-podium">${res.map(e => { const d = driverOf(e.driverId), t = teamOf(e.teamId); return `<span style="--tc:${t ? t.color : '#666'}"><b>${e.posLabel}</b>${portraitImg(d, t, '')}<span><b>${esc(d ? d.code : '')}</b><small>${esc(e.time)}</small></span></span>`; }).join('')}</span>`
        : `<span class="sched-status">${isNext ? tag('Next race', 'red') : '<span class="muted">Upcoming</span>'}</span>`}
    </a>`;
  };
  if (seriesOf(s) === 'f2') return { title: `${s.year} Calendar`, nav: 'schedule', html: `
    <div class="wrap page">
      <div class="page-tools">${seasonSelect(s.id, id => `#/schedule?season=${id}`)}</div>
      <h1 class="h-page">${esc(s.year)} FIA Formula 2 Calendar</h1>
      ${hero.length ? `<div class="sched-heroes">${hero.map(heroCard).join('')}</div>` : ''}
      ${rounds.length ? f2CalendarTable(c, rounds) : emptyState('No rounds', 'Add calendar rounds in Edit Career.', { href: '#/edit/rounds', label: 'Add round' })}
    </div>` };
  return { title: `${s.year} Schedule`, nav: 'schedule', html: `
    <div class="wrap page">
      <div class="page-tools">${seasonSelect(s.id, id => `#/schedule?season=${id}`)}</div>
      <h1 class="h-page">${esc(s.year)} Career Race Calendar</h1>
      ${hero.length ? `<div class="sched-heroes">${hero.map(heroCard).join('')}</div>` : ''}
      ${rounds.length ? `<div class="sched-grid">${rounds.map(card).join('')}</div>` : emptyState('No rounds', 'Add calendar rounds in Edit Career.', { href: '#/edit/rounds', label: 'Add round' })}
    </div>` };
}

function pageRound(id) {
  const c = D(); const r = byId(c.rounds, id); if (!r) return notFound();
  const s = seasonOf(c, r.seasonId);
  const sessions = sessionsWithResults(c, r.id);
  const race = classify(c, resultFor(c, r.id, 'race'));
  const arts = articlesFor(c, { roundId: r.id });
  const dist = r.laps && r.lengthKm ? (r.laps * r.lengthKm).toFixed(3) : '';
  return { title: r.name, nav: 'schedule', html: `
    ${subnav([{ key: 'back', label: '‹ Schedule', href: `#/schedule${seasonQ(s)}` }, { key: 'wk', label: 'Race weekend', href: `#/schedule/${r.id}` }, ...sessions.map(x => ({ key: x, label: cap(x) + ' result', href: `#/results/${r.id}/${x}` }))], 'wk')}
    <section class="round-hero" style="--img:url('${roundImage(r)}')">
      <div class="wrap round-hero-inner">
        <span class="eyebrow">Round ${r.round} · ${esc(s ? s.year : '')}</span>
        <h1 class="h-hero">${flag(r.countryCode, 'flag-xl')} ${esc(r.name)}</h1>
        <p class="round-official">${esc(r.officialName)}</p>
        <p class="date-font round-date">${esc(fmtRange(r.dateStart, r.dateEnd))} ${esc(parseDate(r.dateEnd)?.getUTCFullYear() || '')}</p>
      </div>
    </section>
    <div class="wrap page round-body">
      <div class="round-main">
        <h2 class="h-section">Schedule</h2>
        <ul class="timetable">${r.sessions.map(x => { const key = sessionKeyOf(x.label); const has = key && resultFor(c, r.id, key);
          return `<li><span class="tt-day"><b>${esc(fmtDay(x.date).split(' ')[0])}</b><small>${esc(fmtDay(x.date).split(' ')[1] || '')}</small></span><span class="tt-name">${esc(x.label)}</span><span class="tt-time">${esc(x.time || 'TBC')}</span>${has ? `<a class="chip" href="#/results/${r.id}/${key}">Results</a>` : '<span></span>'}</li>`; }).join('') || '<li class="muted">No sessions listed.</li>'}</ul>
        ${race.length ? `<h2 class="h-section">Race podium</h2><div class="round-podium">${race.slice(0, 3).map(e => { const d = driverOf(e.driverId), t = teamOf(e.teamId); return `<a href="#/drivers/${d ? d.id : ''}" class="rp" style="--tc:${t ? t.color : '#666'};--td:${t ? t.colorDark : '#222'}"><span class="podium-pos">${e.position}<sup>${ordinal(e.position)}</sup></span>${portraitImg(d, t, '')}<span class="podium-name">${esc(d ? d.firstName : '')} <b>${esc(d ? d.lastName : '')}</b></span><span class="podium-sub">${esc(t ? t.name : '')} · ${esc(e.time)}</span></a>`; }).join('')}</div>
          <a class="btn btn-outline" href="#/results/${r.id}">Full race result</a>` : ''}
      </div>
      <aside class="round-side">
        <div class="panel">
          <h3 class="h-card">Circuit</h3>
          <dl class="facts">
            <div><dt>Circuit</dt><dd>${esc(r.circuit || '—')}</dd></div>
            <div><dt>Location</dt><dd>${esc([r.city, r.country].filter(Boolean).join(', '))}</dd></div>
            <div><dt>Number of laps</dt><dd>${esc(r.laps || '—')}</dd></div>
            <div><dt>Circuit length</dt><dd>${r.lengthKm ? esc(r.lengthKm) + '<small>km</small>' : '—'}</dd></div>
            <div><dt>Race distance</dt><dd>${dist ? esc(dist) + '<small>km</small>' : '—'}</dd></div>
            <div><dt>Format</dt><dd>${r.sprint ? 'Sprint weekend' : 'Standard'}</dd></div>
          </dl>
        </div>
      </aside>
    </div>
    ${arts.length ? `<section class="wrap section">${sectionHead('Weekend stories', { href: '#/news', label: 'All news' })}<div class="row-cards">${arts.map(a => articleCard(a, 'row')).join('')}</div></section>` : ''}` };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ======================= RESULTS ========================================= */
function resultsSubnav(s, active) {
  return subnav([
    { html: seasonSelect(s.id, id => `#/${active === 'races' ? 'results' : 'standings/' + active}?season=${id}`) },
    { key: 'races', label: 'Races', href: `#/results${seasonQ(s)}` },
    { key: 'drivers', label: 'Drivers', href: `#/standings/drivers${seasonQ(s)}` },
    { key: 'teams', label: 'Teams', href: `#/standings/teams${seasonQ(s)}` },
  ], active);
}

function pageResultsIndex(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const rows = roundsOf(c, s.id).map(r => {
    const res = classify(c, resultFor(c, r.id, 'race'));
    const w = res[0]; const d = w && driverOf(w.driverId), t = w && teamOf(w.teamId);
    return `<tr><td><a class="strong-link" href="#/results/${r.id}">${flag(r.countryCode)} ${esc(r.name)}</a></td><td>${esc(fmtDate(r.dateEnd))}</td>
      <td>${w ? driverLink(d, t) : '<span class="muted">Not raced</span>'}</td><td>${w ? teamLink(t) : ''}</td><td class="num hide-sm">${w ? esc(w.laps ?? '') : ''}</td><td class="num hide-sm">${w ? esc(w.time) : ''}</td></tr>`;
  });
  return { title: `${s.year} Race Results`, nav: 'results', html: `
    ${resultsSubnav(s, 'races')}
    <div class="wrap page"><h1 class="h-page">${esc(s.year)} Race Results</h1>
    ${dataTable([{ label: gpCol() }, { label: 'Date' }, { label: 'Winner' }, { label: 'Team' }, { label: 'Laps', cls: 'num hide-sm' }, { label: 'Time', cls: 'num hide-sm' }], rows)}</div>` };
}

function pageRaceResult(roundId, session) {
  const c = D(); const r = byId(c.rounds, roundId); if (!r) return notFound();
  const s = seasonOf(c, r.seasonId);
  const avail = sessionsWithResults(c, r.id);
  session = session || (avail.includes('race') ? 'race' : avail[0] || 'race');
  const res = resultFor(c, r.id, session);
  const rows = classify(c, res);
  const roundOpts = roundsOf(c, r.seasonId).map(x => `<option value="${x.id}" ${x.id === r.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const sessOpts = avail.map(x => `<option value="${x}" ${x === session ? 'selected' : ''}>${esc(sessionName(c, r, x))} Result</option>`).join('');
  const isQ = session === 'qualifying';
  const headers = isQ ? [{ label: 'Pos.' }, { label: 'No.', cls: 'hide-sm' }, { label: 'Driver' }, { label: 'Team' }, { label: 'Time', cls: 'num' }]
    : [{ label: 'Pos.' }, { label: 'No.', cls: 'hide-sm' }, { label: 'Driver' }, { label: 'Team' }, { label: 'Laps', cls: 'num hide-sm' }, { label: 'Time / Retired', cls: 'num' }, { label: 'Pts.', cls: 'num' }];
  const trs = rows.map(e => {
    const d = driverOf(e.driverId), t = teamOf(e.teamId);
    const fl = e.fastestLap ? ' <span class="fl" title="Fastest lap">FL</span>' : '';
    return isQ ? `<tr><td>${e.posLabel}</td><td class="hide-sm">${esc(d ? d.number : '')}</td><td>${driverLink(d, t)}</td><td>${teamLink(t)}</td><td class="num">${esc(e.time)}</td></tr>`
      : `<tr class="${e.position ? '' : 'is-nc'}"><td>${e.posLabel}</td><td class="hide-sm">${esc(d ? d.number : '')}</td><td>${driverLink(d, t)}${fl}</td><td>${teamLink(t)}</td><td class="num hide-sm">${esc(e.laps ?? '')}</td><td class="num">${esc(e.time)}</td><td class="num">${e.pts}</td></tr>`;
  });
  return { title: `${r.name} ${sessionName(c, r, session)} Result`, nav: 'results', html: `
    ${resultsSubnav(s, 'races')}
    <div class="wrap page">
      <div class="page-tools">
        <label class="pill-select"><select data-nav-select="#/results/__ID__/${session}" aria-label="Race">${roundOpts}</select></label>
        ${avail.length ? `<label class="pill-select"><select data-nav-select="#/results/${r.id}/__ID__" aria-label="Session">${sessOpts}</select></label>` : ''}
        <span class="spacer"></span>${flag(r.countryCode, 'flag-round flag-lg')}
      </div>
      <h1 class="h-page">${esc(r.officialName || r.name)} - ${esc(sessionName(c, r, session))} Result</h1>
      <p class="page-sub"><b>${esc(fmtRange(r.dateStart, r.dateEnd)).toUpperCase()} ${esc(parseDate(r.dateEnd)?.getUTCFullYear() || '')}</b><br>${esc([r.circuit, r.city].filter(Boolean).join(', '))}</p>
      ${res ? dataTable(headers, trs) : emptyState('No result yet', 'This session has not been entered.', { href: `#/edit/results?round=${r.id}`, label: 'Enter result' })}
      ${res && !isQ ? '<p class="footnote">Team shown is the team the driver raced for at this round. FL = fastest lap.</p>' : ''}
    </div>` };
}

/* ======================= STANDINGS ======================================= */
function pageStandings(kind, q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const done = completedRounds(c, s.id).length, total = roundsOf(c, s.id).length;
  const edit = kind === 'drivers' && q.edit === '1';
  const base = `#/standings/${kind}?season=${s.id}`;
  const title = `${s.year} ${kind === 'drivers' ? "Drivers'" : "Teams'"} Standings`;
  const tools = kind === 'drivers'
    ? (edit ? `<a class="btn btn-red mx-edit-btn" href="${base}">Done editing</a>` : `<a class="btn btn-outline mx-edit-btn" href="${base}&edit=1">Edit results</a>`)
    : `<a class="btn btn-ghost mx-edit-btn" href="#/standings/drivers?season=${s.id}&edit=1">Edit results in drivers' table ›</a>`;
  return { title, nav: 'standings', html: `
    ${resultsSubnav(s, kind)}
    <div class="wrap page" data-mx-wrap>
      <div class="mx-top"><div><h1 class="h-page">${esc(title)}</h1>
        <p class="page-sub">After ${done} of ${total} rounds · ${esc(ruleFor(c, s.id).name || 'Points')}</p></div>${tools}</div>
      ${edit ? '<p class="mx-editing"><b>Editing.</b> Click any cell to set the position, Ret, DNS or DSQ, pole and fastest lap. Changes save and update the standings instantly.</p>' : ''}
      ${kind === 'drivers' ? mxDriversTable(c, s, edit) : mxTeamsTable(c, s)}
      ${mxLegend()}
    </div>`, after: bindMatrix };
}

/* ======================= DRIVERS ========================================= */
function pageDrivers(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const order = teamStandings(c, s.id).map(r => r.id);
  const nx = nextRound(c, s.id) || roundsOf(c, s.id).slice(-1)[0] || { round: 1 };
  const lu = lineupAt(c, s.id, nx.round);
  const current = [];
  order.forEach(tid => (lu[tid] || []).forEach(did => current.push([did, tid])));
  Object.keys(lu).filter(t => !order.includes(t)).forEach(tid => lu[tid].forEach(did => current.push([did, tid])));
  const curIds = new Set(current.map(x => x[0]));
  const former = driversInSeason(c, s.id).filter(d => !curIds.has(d.id));
  const card = (d, t) => `<a class="driver-card" href="#/drivers/${d.id}" style="--tc:${t ? t.color : '#606066'};--td:${t ? t.colorDark : '#26262b'}">
      <span class="dc-text"><span class="dc-first">${esc(d.firstName)}</span><span class="dc-last">${esc(d.lastName)}</span><span class="dc-team">${esc(t ? t.name : 'No seat')}</span>${numberArt(d, 'dc-num')}${flag(d.nationality, 'flag-round')}</span>
      ${portraitImg(d, t, 'dc-portrait')}</a>`;
  return { title: `${s.year} Drivers`, nav: 'drivers', html: `
    <div class="wrap page">
      <div class="page-tools">${seasonSelect(s.id, id => `#/drivers?season=${id}`)}</div>
      <h1 class="h-page">${esc(s.year)} Drivers</h1>
      <p class="page-intro">The race line-up for Round ${nx.round}${nx.name ? ' · ' + esc(nx.name) : ''}.</p>
      <div class="card-grid-2">${current.map(([did, tid]) => { const d = driverOf(did); return d ? card(d, teamOf(tid)) : ''; }).join('') || emptyState('No drivers', 'Assign drivers to teams in Edit Career.', { href: '#/edit/assignments', label: 'Assign drivers' })}</div>
      ${former.length ? `<h2 class="h-section spaced">Also raced or contracted this season</h2><div class="card-grid-2">${former.map(d => card(d, teamOf(driverCurrentTeam(c, d.id, s.id)))).join('')}</div>` : ''}
    </div>` };
}

function pageDriver(id, q) {
  const c = D(); const d = driverOf(id); if (!d) return notFound();
  const s = pickSeason(q);
  const tId = s ? driverCurrentTeam(c, d.id, s.id) : null; const t = teamOf(tId);
  const st = s ? statsFor(c, 'drivers', d.id, s.id) : null;
  const career = statsFor(c, 'drivers', d.id);
  const pos = s ? (driverStandings(c, s.id).find(r => r.id === d.id) || {}).position : null;
  const hist = s ? driverTeamHistory(c, d.id, s.id) : [];
  const seasonRes = s ? driverSeasonResults(c, d.id, s.id) : [];
  const arts = articlesFor(c, { driverId: d.id }).slice(0, 4);
  const age = d.dob ? Math.floor((Date.now() - parseDate(d.dob)) / 31557600000) : null;
  const statDl = (pairs) => `<dl class="stat-grid">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  return { title: nameOf(d), nav: 'drivers', html: `
    ${subnav([{ key: 'back', label: '‹ All drivers', href: '#/drivers' }, { key: 'stats', label: 'Statistics', href: '#stats', anchor: 1 }, { key: 'results', label: 'Results', href: '#results' }, { key: 'bio', label: 'Profile', href: '#bio' }], '')}
    <section class="profile-hero" style="--tc:${t ? t.color : '#606066'};--td:${t ? t.colorDark : '#26262b'}">
      <div class="wrap profile-hero-inner">
        <div class="ph-text">
          ${numberArt(d, 'ph-number')}
          <h1 class="ph-name"><span>${esc(d.firstName)}</span><b>${esc(d.lastName)}</b></h1>
          <p class="ph-meta">${flag(d.nationality, 'flag-round')} ${esc(countryName(d.nationality))} ${t ? `· <a href="#/teams/${t.id}">${esc(t.name)}</a>` : ''}${acdBadge(c, d)}</p>
        </div>
        ${portraitImg(d, t, 'ph-portrait')}
      </div>
    </section>
    <div class="wrap page" id="stats">
      <div class="profile-cols">
        <div>
          <h2 class="h-section">${s ? esc(s.year) + ' Season' : 'Season'}</h2>
          ${st ? statDl([['Season position', pos && completedRounds(c, s.id).length ? pos + ordinal(pos) : '—'], ['Season points', st.points], [gpWord() + ' races', st.races], ['Wins', st.wins], ['Podiums', st.podiums], ['Poles', st.poles], ['Top 10s', st.top10], ['Fastest laps', st.fastestLaps], ['DNFs', st.dnfs], ['Sprint points', st.sprintPoints]]) : ''}
        </div>
        <div class="panel panel-raised">
          <h2 class="h-card">Career summary</h2>
          <dl class="facts">${[['Grands Prix entered', career.races], ['Career points', career.points], ['Wins', career.wins], ['Podiums', career.podiums], ['Pole positions', career.poles], ['Highest race finish', career.best ? career.best + ordinal(career.best) : '—'], ['World Championships', (Number(d.championships) || 0) + career.titles]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </div>
      </div>
      ${hist.length ? `<h2 class="h-section spaced">${esc(s.year)} Teams</h2><ul class="history">${hist.map(a => { const tt = teamOf(a.teamId); return `<li style="--tc:${tt ? tt.color : '#666'}">${teamLink(tt)}<span class="muted">${a.role === 'reserve' ? 'Reserve · ' : ''}Round ${a.fromRound}${a.toRound ? '–' + a.toRound : ' onwards'}</span></li>`; }).join('')}</ul>` : ''}
      <h2 class="h-section spaced" id="results">${s ? esc(s.year) + ' Results' : 'Results'}</h2>
      ${dataTable([{ label: 'Rnd' }, { label: gpCol() }, { label: 'Team' }, { label: 'Grid', cls: 'num hide-sm' }, { label: 'Pos.', cls: 'num' }, { label: 'Sprint', cls: 'num hide-sm' }, { label: 'Pts.', cls: 'num' }],
        seasonRes.map(x => `<tr><td>${x.round.round}</td><td><a class="strong-link" href="#/results/${x.round.id}">${flag(x.round.countryCode)} ${esc(x.round.name)}</a></td><td>${teamLink(teamOf((x.entry || x.sprint).teamId))}</td><td class="num hide-sm">${esc(x.entry ? x.entry.grid ?? '' : '')}</td><td class="num">${x.entry ? x.entry.posLabel + (x.entry.status !== 'FIN' ? ` <small class="muted">${esc(x.entry.status)}</small>` : '') : '—'}</td><td class="num hide-sm">${x.sprint ? x.sprint.posLabel : ''}</td><td class="num">${x.points}</td></tr>`))}
      <h2 class="h-section spaced" id="bio">Profile</h2>
      <div class="profile-cols">
        <dl class="facts panel">${[['Team', t ? esc(t.name) : '—'], ['Country', esc(countryName(d.nationality))], ['Date of birth', d.dob ? esc(fmtDate(d.dob)) + (age ? ` <small>(${age})</small>` : '') : '—'], ['Place of birth', esc(d.birthplace || '—')], ['Driver code', esc(d.code || '—')], ['Race number', esc(d.number ?? '—')]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="prose">${d.bio ? d.bio.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('') : `<p class="muted">No biography yet. Add one in <a href="#/edit/drivers?id=${d.id}">Edit Career</a>.</p>`}</div>
      </div>
      ${arts.length ? `${sectionHead('Latest news', { href: '#/news', label: 'View all' })}<div class="row-cards">${arts.map(a => articleCard(a, 'row')).join('')}</div>` : ''}
    </div>` };
}

/* ======================= TEAMS =========================================== */
function pageTeams(q) {
  const c = D(); const s = pickSeason(q); if (!s) return noSeason();
  const order = teamStandings(c, s.id).map(r => r.id);
  const nx = nextRound(c, s.id) || roundsOf(c, s.id).slice(-1)[0] || { round: 1 };
  const lu = lineupAt(c, s.id, nx.round);
  const teams = order.map(teamOf).filter(Boolean);
  return { title: `${s.year} Teams`, nav: 'teams', html: `
    <div class="wrap page">
      <div class="page-tools">${seasonSelect(s.id, id => `#/teams?season=${id}`)}</div>
      <h1 class="h-page">${esc(s.year)} Teams</h1>
      <p class="page-intro">Find the teams of the ${esc(s.name)}.</p>
      <div class="card-grid-2">${teams.map(t => `<a class="team-card" href="#/teams/${t.id}" style="--tc:${t.color};--td:${t.colorDark}">
        <span class="tc-head"><span class="tc-name">${esc(t.name)}</span>${logoImg(t, 'tc-logo')}</span>
        <span class="tc-drivers">${(lu[t.id] || []).map(did => { const d = driverOf(did); return d ? `<span>${driverHead(d, t)}${esc(d.firstName)} <b>${esc(d.lastName.toUpperCase())}</b></span>` : ''; }).join('')}</span>
        <img class="tc-car" src="${teamCar(t)}" alt=""></a>`).join('') || emptyState('No teams', 'Add teams and assign drivers in Edit Career.', { href: '#/edit/teams', label: 'Add team' })}</div>
    </div>` };
}

function pageTeam(id, q) {
  const c = D(); const t = teamOf(id); if (!t) return notFound();
  const s = pickSeason(q);
  const st = s ? statsFor(c, 'teams', t.id, s.id) : null;
  const all = statsFor(c, 'teams', t.id);
  const pos = s ? (teamStandings(c, s.id).find(r => r.id === t.id) || {}).position : null;
  const pts = s ? (teamStandings(c, s.id).find(r => r.id === t.id) || {}).points : 0;
  const nx = s ? (nextRound(c, s.id) || roundsOf(c, s.id).slice(-1)[0]) : null;
  const drivers = s && nx ? (lineupAt(c, s.id, nx.round)[t.id] || []).map(driverOf).filter(Boolean) : [];
  const everDrove = s ? [...new Set(assignmentsOf(c, s.id).filter(a => a.teamId === t.id).map(a => a.driverId))].filter(x => !drivers.some(d => d.id === x)).map(driverOf).filter(Boolean) : [];
  const arts = articlesFor(c, { teamId: t.id }).slice(0, 4);
  const rounds = s ? completedRounds(c, s.id) : [];
  const resRows = rounds.map(r => {
    const mine = classify(c, resultFor(c, r.id, 'race')).filter(e => e.teamId === t.id);
    const sp = classify(c, resultFor(c, r.id, 'sprint')).filter(e => e.teamId === t.id);
    const ptsR = mine.reduce((a, e) => a + e.pts, 0) + sp.reduce((a, e) => a + e.pts, 0);
    return `<tr><td>${r.round}</td><td><a class="strong-link" href="#/results/${r.id}">${flag(r.countryCode)} ${esc(r.name)}</a></td><td>${mine.map(e => { const d = driverOf(e.driverId); return `<span class="res-chip"><b>${esc(d ? d.code : '?')}</b> ${e.posLabel}</span>`; }).join(' ')}</td><td class="num">${ptsR}</td></tr>`;
  });
  const statDl = (pairs) => `<dl class="stat-grid">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  return { title: t.name, nav: 'teams', html: `
    ${subnav([{ key: 'back', label: '‹ All teams', href: '#/teams' }, { key: 'd', label: 'Drivers', href: '#drivers' }, { key: 's', label: 'Statistics', href: '#stats' }, { key: 'p', label: 'Profile', href: '#profile' }], '')}
    <section class="team-hero" style="--tc:${t.color};--td:${t.colorDark}">
      <div class="wrap team-hero-inner">
        <img class="th-car" src="${teamCar(t)}" alt="">
        <h1 class="th-name">${esc(t.name)}</h1>
        <p class="th-drivers">${drivers.map(d => `${esc(d.firstName)} <b>${esc(d.lastName)}</b>`).join(' &nbsp; ')}</p>
        ${logoImg(t, 'th-logo')}
        <span class="th-actions"><a class="btn btn-outline" href="#/showroom/${t.id}${s ? seasonQ(s) : ''}">Open in showroom</a>${s ? `<button class="btn btn-outline" type="button" data-team-card="${t.id}|${s.id}">Team card</button>` : ''}</span>
      </div>
    </section>
    <div class="wrap page">
      <h2 class="h-section" id="drivers">Drivers</h2>
      <div class="card-grid-2">${drivers.map(d => `<a class="driver-card" href="#/drivers/${d.id}" style="--tc:${t.color};--td:${t.colorDark}"><span class="dc-text"><span class="dc-first">${esc(d.firstName)}</span><span class="dc-last">${esc(d.lastName)}</span><span class="dc-team">${esc(t.name)}</span>${numberArt(d, 'dc-num')}${flag(d.nationality, 'flag-round')}</span>${portraitImg(d, t, 'dc-portrait')}</a>`).join('') || '<p class="muted">No race drivers assigned for the next round.</p>'}</div>
      ${academySection(c, t)}
      ${everDrove.length ? `<p class="footnote">Also drove for ${esc(t.name)} this season: ${everDrove.map(d => `<a href="#/drivers/${d.id}">${esc(nameOf(d))}</a>`).join(', ')}.</p>` : ''}
      <h2 class="h-section spaced" id="stats">Statistics</h2>
      <div class="profile-cols">
        <div><h3 class="h-sub">${s ? esc(s.year) + ' Season' : ''}</h3>
          ${st ? statDl([['Season position', pos && completedRounds(c, s.id).length ? pos + ordinal(pos) : '—'], ['Season points', pts], [gpWord() + ' races', st.races], [gpWord() + ' wins', st.wins], [gpWord() + ' podiums', st.podiums], [gpWord() + ' poles', st.poles], ['Top 10s', st.top10], ['Fastest laps', st.fastestLaps], ['DNFs', st.dnfs], ['Sprint points', st.sprintPoints]]) : ''}
        </div>
        <div class="panel panel-raised"><h3 class="h-sub">Team summary</h3>
          <dl class="facts">${[['Grands Prix entered (career)', all.races], ['Team points (career)', all.points], ['Highest race finish', all.best ? all.best + ordinal(all.best) : '—'], ['Podiums', all.podiums], ['Pole positions', all.poles], ['World Championships', (Number(t.championships) || 0) + all.titles]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </div>
      </div>
      ${resRows.length ? `<h3 class="h-sub spaced">Results by round</h3>${dataTable([{ label: 'Rnd' }, { label: gpCol() }, { label: 'Finishes' }, { label: 'Pts.', cls: 'num' }], resRows)}` : ''}
      <h2 class="h-section spaced" id="profile">Team profile</h2>
      <dl class="facts panel two-col">${[['Full team name', t.fullName], ['Base', t.base], ['Team chief', t.principal], ['Technical chief', t.technicalChief], ['Chassis', t.chassis], ['Power unit', t.powerUnit], ['First team entry', t.firstEntry]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>
      ${t.bio ? `<div class="prose">${t.bio.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
      ${arts.length ? `${sectionHead('Latest news', { href: '#/news', label: 'View all' })}<div class="row-cards">${arts.map(a => articleCard(a, 'row')).join('')}</div>` : ''}
    </div>` };
}

/* ======================= ACADEMIES ======================================= */
/* "Ferrari Academy" badge on a driver's profile; links to the F1 team in the F1 section. */
function acdBadge(c, d) {
  const a = academyOf(c, d.id); const ft = a && teamOf(a.f1TeamId);
  return ft ? ` · <a class="acd-badge" style="--tc:${ft.color}" data-series="f1" href="#/teams/${ft.id}">${logoImg(ft, 'acd-logo')}${esc(a.name || ft.name + ' Academy')}</a>` : '';
}
/* An F1 team's junior drivers, shown in their current F2 suits with their F2 standing. */
function academySection(c, t) {
  if (seriesOf(t) !== 'f1') return '';
  const ds = academyDrivers(c, t.id); if (!ds.length) return '';
  const f2 = allSeasonsDesc(c).find(x => seriesOf(x) === 'f2');
  const stand = f2 ? driverStandings(c, f2.id) : [];
  return `<h2 class="h-section spaced" id="academy">${esc(t.name)} Academy</h2>
    <div class="card-grid-2">${ds.map(d => {
      const ft = f2 ? teamOf(driverCurrentTeam(c, d.id, f2.id)) : null;
      const row = stand.find(r => r.id === d.id); const done = f2 && completedRounds(c, f2.id).length;
      return `<a class="driver-card" data-series="f2" href="#/f2/drivers/${d.id}" style="--tc:${ft ? ft.color : t.color};--td:${ft ? ft.colorDark : t.colorDark}"><span class="dc-text"><span class="dc-first">${esc(d.firstName)}</span><span class="dc-last">${esc(d.lastName)}</span><span class="dc-team">${ft ? 'F2 · ' + esc(ft.name) : 'Junior driver'}${row && done ? ` · ${row.position}${ordinal(row.position)} in F2` : ''}</span>${numberArt(d, 'dc-num')}${flag(d.nationality, 'flag-round')}</span>${portraitImg(d, ft, 'dc-portrait')}</a>`;
    }).join('')}</div>`;
}

/* ======================= NEWS ============================================ */
function pageNews(q) {
  const c = D();
  const cat = q.category || '';
  const s = q.season ? seasonOf(c, q.season) : null;
  const list = articlesFor(c, { category: cat || null, seasonId: s ? s.id : null });
  const cats = ARTICLE_CATEGORIES.filter(k => c.articles.some(a => a.category === k));
  return { title: 'Latest News', nav: 'news', html: `
    <div class="wrap page">
      <h1 class="h-page">Latest Career News</h1>
      <div class="chip-row chip-row-tight">${pill('All', '#/news', !cat)}${cats.map(k => pill(k, `#/news?category=${encodeURIComponent(k)}`, cat === k)).join('')}</div>
      <div class="news-list">${list.map(a => articleCard(a, 'row')).join('') || emptyState('No stories', 'Nothing in this category yet.', { href: '#/edit/articles', label: 'Write one' })}</div>
    </div>` };
}

function pageArticle(id) {
  const c = D(); const a = byId(c.articles, id); if (!a) return notFound();
  const more = articlesFor(c, { seasonId: a.seasonId }).filter(x => x.id !== a.id).slice(0, 4);
  const rd = a.roundId ? byId(c.rounds, a.roundId) : null;
  return { title: a.title, nav: 'news', html: `
    <article class="article">
      <div class="article-hero"><img src="${articleImage(a)}" alt=""></div>
      <header class="article-head wrap">
        <div class="article-tags">${tag(a.category || 'News', a.category === 'Race Report' ? 'red' : 'dark')}${rd ? `<a class="chip" href="#/schedule/${rd.id}">${esc(rd.name)}</a>` : ''}</div>
        <h1 class="h-article">${esc(a.title)}</h1>
        ${a.standfirst ? `<p class="standfirst">${esc(a.standfirst)}</p>` : ''}
        <p class="byline">${esc(a.author || 'Career Desk')} · ${esc(fmtDate(a.publishedAt))}</p>
      </header>
      <div class="article-body prose">${String(a.body || '').split(/\n\s*\n|\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${(a.driverIds.length || a.teamIds.length) ? `<div class="article-related prose"><h4>In this story</h4><div class="chip-row chip-row-tight">${a.driverIds.map(driverOf).filter(Boolean).map(d => pill(nameOf(d), `#/drivers/${d.id}`)).join('')}${a.teamIds.map(teamOf).filter(Boolean).map(t => pill(t.name, `#/teams/${t.id}`)).join('')}</div></div>` : ''}
    </article>
    ${more.length ? `<section class="wrap section">${sectionHead('More news', { href: '#/news', label: 'View all' })}<div class="row-cards">${more.map(x => articleCard(x, 'row')).join('')}</div></section>` : ''}` };
}

function notFound() {
  return { title: 'Not found', nav: '', html: `<div class="wrap page">${emptyState('Page not found', 'This record may have been deleted or renamed.', { href: '#/', label: 'Back home' })}</div>` };
}
