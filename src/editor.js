/* ==========================================================================
   editor.js — "Edit Career": CRUD forms for every collection + import/export.
   Generic form specs drive most collections; results get a dedicated grid editor.
   ========================================================================== */

const EDIT_GROUPS = [
  ['Race weekend', [['results', 'Enter results'], ['rounds', 'Calendar']]],
  ['Grid', [['drivers', 'Drivers'], ['teams', 'Teams'], ['assignments', 'Line-ups & transfers']]],
  ['Stories', [['articles', 'News']]],
  ['Pictures', [['studio', 'Portrait studio'], ['assets', 'Uploaded images']]],
  ['Setup', [['settings', 'Career settings'], ['seasons', 'Seasons'], ['points', 'Points rules'], ['data', 'Backup & reset']]],
];
const EDIT_SECTIONS = [['overview', 'Start'], ...EDIT_GROUPS.flatMap(([, items]) => items)];
const STATUS_LABELS = { FIN: 'Finished', DNF: 'Did not finish', DNS: 'Did not start', DSQ: 'Disqualified' };

const opt = (list, label) => () => list().map(r => [r.id, label(r)]);
const seasonOpts = opt(() => seasonsDesc(D()), s => `${s.year} — ${s.name}`);
const teamOpts = opt(() => [...D().teams].sort((a, b) => a.name.localeCompare(b.name)), t => t.name);
const driverOpts = opt(() => [...D().drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)), d => `${d.firstName} ${d.lastName}`);
const ruleOpts = opt(() => D().pointsRules, r => r.name);

const SPECS = {
  seasons: {
    title: 'Seasons', one: 'season', coll: 'seasons', sort: (a, b) => b.year - a.year,
    name: r => `${r.year} · ${r.name}`, sub: r => `${roundsOf(D(), r.id).length} races · ${(byId(D().pointsRules, r.pointsRuleId) || {}).name || 'no points rule'}`,
    fields: [
      { key: 'year', label: 'Year', type: 'number', required: true },
      { key: 'name', label: 'Season name', type: 'text', required: true, placeholder: '2027 Career Season' },
      { key: 'pointsRuleId', label: 'Points system', type: 'select', options: ruleOpts, required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', more: true },
    ],
  },
  points: {
    title: 'Points rules', one: 'points rule', coll: 'pointsRules',
    name: r => r.name, sub: r => `Race ${(r.race || []).join('-')}${(r.sprint || []).length ? ` · Sprint ${r.sprint.join('-')}` : ''}`,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'race', label: 'Race points', hint: 'Points for P1, P2, P3 … separated by commas', type: 'list', placeholder: '25,18,15,12,10,8,6,4,2,1' },
      { key: 'sprint', label: 'Sprint points', hint: 'Leave empty if sprints give no points', type: 'list', placeholder: '8,7,6,5,4,3,2,1' },
      { key: 'fastestLap.points', label: 'Bonus for fastest lap', type: 'number' },
      { key: 'fastestLap.maxPosition', label: 'Bonus only if finishing in the top …', type: 'number' },
    ],
    defaults: () => ({ race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [8, 7, 6, 5, 4, 3, 2, 1], fastestLap: { points: 0, maxPosition: 10 } }),
  },
  teams: {
    title: 'Teams', one: 'team', coll: 'teams', sort: (a, b) => a.name.localeCompare(b.name), cards: 'team',
    name: r => r.name, sub: r => r.powerUnit ? `${r.powerUnit} power` : (r.base || ''),
    fields: [
      { key: 'name', label: 'Team name', type: 'text', required: true },
      { key: 'color', label: 'Team colour', type: 'color', required: true },
      { key: 'logoUrl', label: 'Logo', type: 'image', lib: 'teams/' },
      { key: 'carUrl', label: 'Car picture', type: 'image', lib: 'teams/' },
      { key: 'fullName', label: 'Full official name', type: 'text', more: true },
      { key: 'colorDark', label: 'Second colour (darker)', type: 'color', more: true },
      { key: 'base', label: 'Base', type: 'text', more: true }, { key: 'principal', label: 'Team chief', type: 'text', more: true },
      { key: 'technicalChief', label: 'Technical chief', type: 'text', more: true }, { key: 'chassis', label: 'Chassis', type: 'text', more: true },
      { key: 'powerUnit', label: 'Engine', type: 'text', more: true }, { key: 'firstEntry', label: 'First season in F1', type: 'number', more: true },
      { key: 'championships', label: 'Titles won before this career', type: 'number', more: true },
      { key: 'bio', label: 'Team history', type: 'textarea', more: true },
    ],
    defaults: () => ({ color: '#e10600', colorDark: '#4a0200', championships: 0 }),
  },
  drivers: {
    title: 'Drivers', one: 'driver', coll: 'drivers', sort: (a, b) => a.lastName.localeCompare(b.lastName), cards: 'driver',
    name: r => `${r.firstName} ${r.lastName}`, sub: r => [r.number != null ? '#' + r.number : '', countryName(r.nationality) || r.nationality].filter(Boolean).join(' · '),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true }, { key: 'lastName', label: 'Last name', type: 'text', required: true },
      { key: 'number', label: 'Race number', type: 'number' },
      { key: 'code', label: 'Short code', hint: '3 letters, e.g. SAI', type: 'text', maxlength: 3, upper: true },
      { key: 'nationality', label: 'Nationality', hint: '3 letters, e.g. ESP', type: 'text', maxlength: 3, upper: true, datalist: Object.keys(COUNTRY_NAMES) },
      { key: 'portraitUrl', label: 'Portrait', type: 'image', lib: 'drivers/' },
      { key: 'dob', label: 'Date of birth', type: 'date', more: true }, { key: 'birthplace', label: 'Place of birth', type: 'text', more: true },
      { key: 'championships', label: 'Titles won before this career', type: 'number', more: true },
      { key: 'portraitTeamId', label: 'Team suit in the portrait', hint: 'Lets the Portrait studio swap the suit after a transfer', type: 'select', options: () => [['', 'Any / unknown'], ...teamOpts()], more: true },
      { key: 'numberUrl', label: 'Race-number artwork', type: 'image', lib: 'drivers/', more: true },
      { key: 'photoUrls', label: 'Track photos for news', hint: 'One picture per line', type: 'urls', lib: 'photos/', more: true },
      { key: 'bio', label: 'Biography', type: 'textarea', more: true },
    ],
    defaults: () => ({ championships: 0 }),
  },
  assignments: {
    title: 'Line-ups & transfers', one: 'seat', coll: 'assignments', seasonScoped: true,
    sort: (a, b) => { const ta = teamOf(a.teamId), tb = teamOf(b.teamId); return (ta ? ta.name : '').localeCompare(tb ? tb.name : '') || a.fromRound - b.fromRound; },
    name: r => nameOf(driverOf(r.driverId)), sub: r => `${(teamOf(r.teamId) || {}).name || '?'} · ${r.role === 'reserve' ? 'Reserve · ' : ''}${r.toRound ? `rounds ${r.fromRound}–${r.toRound}` : r.fromRound > 1 ? `from round ${r.fromRound}` : 'whole season'}`,
    dot: r => (teamOf(r.teamId) || {}).color,
    fields: [
      { key: 'driverId', label: 'Driver', type: 'select', options: driverOpts, required: true },
      { key: 'teamId', label: 'Team', type: 'select', options: teamOpts, required: true },
      { key: 'role', label: 'Role', type: 'select', options: () => [['race', 'Race driver'], ['reserve', 'Reserve']], required: true },
      { key: 'fromRound', label: 'From round', type: 'number', required: true },
      { key: 'toRound', label: 'Until round', hint: 'Empty = rest of the season', type: 'number' },
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true, more: true },
    ],
    defaults: () => ({ role: 'race', fromRound: 1, toRound: null }),
  },
  rounds: {
    title: 'Calendar', one: 'race', coll: 'rounds', seasonScoped: true, sort: (a, b) => a.round - b.round,
    name: r => `${flag(r.countryCode)} R${r.round} · ${esc(r.name)}`, nameHtml: true,
    sub: r => `${fmtRange(r.dateStart, r.dateEnd)}${r.sprint ? ' · Sprint' : ''}${resultFor(D(), r.id, 'race') ? ' · ✓ result entered' : ''}`,
    fields: [
      { key: 'round', label: 'Round', type: 'number', required: true },
      { key: 'name', label: 'Name', hint: 'Usually the country, e.g. Spain', type: 'text', required: true },
      { key: 'dateStart', label: 'First day', type: 'date' }, { key: 'dateEnd', label: 'Race day', type: 'date' },
      { key: 'circuit', label: 'Circuit', type: 'text' },
      { key: 'sprint', label: 'Sprint weekend', type: 'checkbox' },
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true, more: true },
      { key: 'country', label: 'Country', type: 'text', more: true },
      { key: 'countryCode', label: 'Country code', hint: '3 letters, used for the flag', type: 'text', maxlength: 3, upper: true, datalist: Object.keys(COUNTRY_NAMES), more: true },
      { key: 'officialName', label: 'Official event name', type: 'text', more: true },
      { key: 'city', label: 'City', type: 'text', more: true },
      { key: 'laps', label: 'Laps', type: 'number', more: true }, { key: 'lengthKm', label: 'Lap length (km)', type: 'number', step: '0.001', more: true },
      { key: 'imageUrl', label: 'Header picture', type: 'image', lib: 'circuits/', more: true },
      { key: 'sessions', label: 'Session times', hint: 'One per line: Name | YYYY-MM-DD | HH:MM', type: 'sessions', more: true },
    ],
    defaults: () => ({ sprint: false, sessions: [], status: 'scheduled' }),
  },
  articles: {
    title: 'News', one: 'story', coll: 'articles', sort: (a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)),
    name: r => r.title, sub: r => `${fmtDate(r.publishedAt)} · ${r.category}${r.featured ? ' · Lead story' : ''}`,
    fields: [
      { key: 'title', label: 'Headline', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: () => ARTICLE_CATEGORIES.map(x => [x, x]) },
      { key: 'featured', label: 'Show as lead story on the homepage', type: 'checkbox' },
      { key: 'standfirst', label: 'Short summary', hint: 'One or two sentences shown under the headline', type: 'textarea', rows: 2 },
      { key: 'body', label: 'Story', hint: 'Leave an empty line between paragraphs', type: 'textarea', rows: 10 },
      { key: 'driverIds', label: 'Drivers in this story', type: 'multi', options: driverOpts },
      { key: 'imageUrl', label: 'Picture', hint: 'Empty = a track photo of a driver in the story', type: 'image', lib: 'photos/', more: true },
      { key: 'teamIds', label: 'Teams in this story', type: 'multi', options: teamOpts, more: true },
      { key: 'roundId', label: 'Linked race', type: 'select', options: () => [['', 'None'], ...D().rounds.slice().sort((a, b) => a.round - b.round).map(r => [r.id, `${(seasonOf(D(), r.seasonId) || {}).year} R${r.round} ${r.name}`])], more: true },
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true, more: true },
      { key: 'publishedAt', label: 'Published', type: 'datetime', more: true },
      { key: 'author', label: 'Author', type: 'text', more: true },
    ],
    defaults: () => ({ category: 'News', author: 'Career Desk', publishedAt: new Date().toISOString(), driverIds: [], teamIds: [], body: '', featured: false, seasonId: (activeSeason(D()) || {}).id }),
  },
};

/* --- nested get/set for 'fastestLap.points' style keys ------------------- */
const getPath = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
function setPath(o, k, v) { const ps = k.split('.'); let a = o; ps.slice(0, -1).forEach(p => { a[p] = a[p] || {}; a = a[p]; }); a[ps[ps.length - 1]] = v; }

function fieldHtml(f, rec) {
  const v = getPath(rec, f.key);
  const id = 'f_' + f.key.replace(/\./g, '_');
  const req = f.required ? 'required' : '';
  let input;
  switch (f.type) {
    case 'textarea': input = `<textarea id="${id}" name="${f.key}" rows="${f.rows || 4}" ${req}>${esc(v || '')}</textarea>`; break;
    case 'select': input = `<select id="${id}" name="${f.key}" ${req}>${f.required ? '' : ''}${f.options().map(([val, lab]) => `<option value="${esc(val)}" ${String(v ?? '') === String(val) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`; break;
    case 'multi': input = `<div class="multi multi-chips" id="${id}">${f.options().map(([val, lab]) => `<label><input type="checkbox" name="${f.key}" value="${esc(val)}" ${(v || []).includes(val) ? 'checked' : ''}><span>${esc(lab)}</span></label>`).join('')}</div>`; break;
    case 'checkbox': return `<div class="field field-checkbox"><label class="switch"><input type="checkbox" id="${id}" name="${f.key}" ${v ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span>${esc(f.label)}</span></label></div>`;
    case 'list': input = `<input id="${id}" name="${f.key}" type="text" value="${esc((v || []).join(', '))}" placeholder="${esc(f.placeholder || '')}">`; break;
    case 'sessions': input = `<textarea id="${id}" name="${f.key}" rows="6" placeholder="Practice 1 | 2031-03-07 | 12:30">${esc((v || []).map(s => [s.label, s.date, s.time].join(' | ')).join('\n'))}</textarea>`; break;
    case 'datetime': input = `<input id="${id}" name="${f.key}" type="datetime-local" value="${esc(v ? String(v).slice(0, 16) : '')}">`; break;
    case 'image': input = `<span class="img-in"><input id="${id}" name="${f.key}" type="text" value="${esc(v || '')}" list="lib_${f.lib.replace('/', '')}" placeholder="Pick a picture or paste a link" data-img-input><img class="img-prev" src="${esc(v || '')}" alt="" ${v ? '' : 'hidden'}></span>${libDatalist(f.lib)}`; break;
    case 'urls': input = `<textarea id="${id}" name="${f.key}" rows="3" list="lib_${f.lib.replace('/', '')}" placeholder="assets/f1com/photos/...webp">${esc((v || []).join('\n'))}</textarea>${libDatalist(f.lib)}`; break;
    case 'color': input = `<span class="color-in"><input id="${id}" name="${f.key}" type="color" value="${esc(v || '#888888')}"><code>${esc(v || '')}</code></span>`; break;
    default: input = `<input id="${id}" name="${f.key}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" ${f.step ? `step="${f.step}"` : f.type === 'number' ? 'step="any"' : ''} value="${esc(v ?? '')}" ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.datalist ? `list="${id}_dl"` : ''} ${req}>${f.datalist ? `<datalist id="${id}_dl">${f.datalist.map(x => `<option value="${x}">`).join('')}</datalist>` : ''}`;
  }
  return `<div class="field field-${f.type}"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : ''}</div>`;
}

function readForm(form, spec, base) {
  const rec = clone(base);
  const fd = new FormData(form);
  spec.fields.forEach(f => {
    let v;
    if (f.type === 'multi') v = fd.getAll(f.key);
    else if (f.type === 'checkbox') v = fd.get(f.key) === 'on';
    else {
      v = fd.get(f.key); v = v == null ? '' : String(v).trim();
      if (f.upper) v = v.toUpperCase();
      if (f.type === 'number') v = v === '' ? null : Number(v);
      if (f.type === 'list') v = v ? v.split(/[,\s]+/).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];
      if (f.type === 'datetime') v = v ? new Date(v).toISOString() : new Date().toISOString();
      if (f.type === 'urls') v = v.split('\n').map(x => x.trim()).filter(Boolean);
      if (f.type === 'sessions') v = v.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).map(([label, date, time]) => ({ label, date: date || '', time: time || '' }));
    }
    setPath(rec, f.key, v);
  });
  return rec;
}

/* datalist of downloaded library images (IMAGE_LIBRARY is injected by build.mjs from assets/f1com) */
const libDone = {};
function libDatalist(prefix) {
  const id = 'lib_' + prefix.replace('/', '');
  if (libDone[id] === renderCount) return '';
  libDone[id] = renderCount;
  return `<datalist id="${id}">${IMAGE_LIBRARY.filter(p => p.includes('/' + prefix)).map(p => `<option value="${esc(p)}">`).join('')}</datalist>`;
}

/* Real 2026 grid records shipped as the starter career (season sea_2026_grid). */
function realGridRecords() {
  const S = SAMPLE_CAREER, sid = 'sea_2026_grid';
  const season = S.seasons.find(x => x.id === sid);
  if (!season) return null;
  const assignments = S.assignments.filter(a => a.seasonId === sid);
  const dIds = new Set(assignments.map(a => a.driverId)), tIds = new Set(assignments.map(a => a.teamId));
  return { season, assignments, rounds: S.rounds.filter(r => r.seasonId === sid),
    drivers: S.drivers.filter(d => dIds.has(d.id)), teams: S.teams.filter(t => tIds.has(t.id)),
    rule: S.pointsRules.find(p => p.id === season.pointsRuleId) };
}
function mergeRealGrid(c) {
  const g = realGridRecords(); if (!g) throw new Error('Real grid data missing from this build.');
  let added = 0;
  const put = (coll, recs) => recs.forEach(r => { if (r && !c[coll].some(x => x.id === r.id)) { c[coll].push(clone(r)); added++; } });
  put('pointsRules', [g.rule]); put('seasons', [g.season]); put('teams', g.teams); put('drivers', g.drivers);
  put('assignments', g.assignments); put('rounds', g.rounds);
  return added;
}

/* --- page ------------------------------------------------------------------ */
function pageEdit(section, q) {
  section = section || 'overview';
  const link = (k, l) => `<a class="${k === section ? 'is-active' : ''}" href="#/edit/${k}">${l}</a>`;
  const nav = `<nav class="edit-nav" aria-label="Edit sections">${link('overview', 'Start')}${EDIT_GROUPS.map(([g, items]) =>
    `<div class="edit-nav-group"><span class="edit-nav-label">${g}</span>${items.map(([k, l]) => link(k, l)).join('')}</div>`).join('')}</nav>`;
  let body;
  if (section === 'overview') body = editHome();
  else if (section === 'settings') body = editSettings();
  else if (section === 'results') body = editResults(q);
  else if (section === 'data') body = editData();
  else if (section === 'studio') body = editStudio(q);
  else if (section === 'assets') body = editAssets();
  else if (SPECS[section]) body = editCrud(section, q);
  else body = emptyState('Unknown section', '', { href: '#/edit', label: 'Back' });
  const label = (EDIT_SECTIONS.find(([k]) => k === section) || [])[1];
  return { title: 'Edit Career', nav: 'edit', html: `
    <div class="wrap page edit-page">
      <div class="edit-head"><h1 class="h-page">Edit Career</h1><span class="edit-saved">Everything saves automatically in this browser</span></div>
      <div class="edit-layout">${nav}<div class="edit-main">${section !== 'overview' && label ? `<h2 class="edit-title">${esc(label)}</h2>` : ''}${body}</div></div>
    </div>`, after: root => { bindEditor(root); bindStudio(root); bindAssets(root); } };
}

function editHome() {
  const c = D(); const s = activeSeason(c);
  const rounds = s ? roundsOf(c, s.id) : [];
  const done = rounds.filter(r => resultFor(c, r.id, 'race')).length;
  const next = s && nextRound(c, s.id);
  const tile = (href, title, text, primary) => `<a class="action-tile${primary ? ' is-primary' : ''}" href="${href}"><b>${title}</b><span>${text}</span><i aria-hidden="true">→</i></a>`;
  const errs = validateCareer(c);
  return `<div class="edit-hello"><h2 class="edit-title">What do you want to do?</h2>
      <p class="muted">${s ? `${esc(s.name)} · ${done} of ${rounds.length} races entered` : 'No season yet'}</p></div>
    <div class="action-tiles">
      ${tile('#/edit/results', 'Enter a race result', next ? `Next up: ${flag(next.countryCode)} R${next.round} ${esc(next.name)}` : 'All races are entered', true)}
      ${tile('#/edit/articles?id=new', 'Write a news story', `${c.articles.length} ${c.articles.length === 1 ? 'story' : 'stories'} so far`)}
      ${tile('#/edit/assignments', 'Transfer a driver', 'Move a driver to another team')}
      ${tile('#/edit/drivers', 'Edit drivers & teams', `${c.drivers.length} drivers · ${c.teams.length} teams`)}
    </div>
    ${errs.length ? `<div class="alert"><b>${errs.length} thing(s) need fixing</b><br>${errs.slice(0, 8).map(esc).join('<br>')}</div>` : ''}
    <p class="edit-foot muted">Tip: download a backup now and then in <a href="#/edit/data">Backup &amp; reset</a>.</p>`;
}

function editSettings() {
  const m = D().meta;
  return `<form class="edit-form panel" data-meta-form>
      <div class="form-grid">
        ${fieldHtml({ key: 'careerName', label: 'Career name', type: 'text', required: true }, m)}
        ${fieldHtml({ key: 'playerTeamId', label: 'Your team', hint: 'Highlighted across the site', type: 'select', options: () => [['', 'None'], ...teamOpts()] }, m)}
        ${fieldHtml({ key: 'activeSeasonId', label: 'Season shown by default', type: 'select', options: seasonOpts }, m)}
      </div>
      <details class="more-fields"><summary>More options</summary><div class="form-grid">
        ${fieldHtml({ key: 'isSample', label: 'Show the “sample career” banner', type: 'checkbox' }, m)}
      </div></details>
      <div class="form-actions"><button class="btn btn-red" type="submit">Save</button></div>
    </form>`;
}

function crudCard(spec, r, href) {
  const c = D();
  if (spec.cards === 'driver') {
    const s = activeSeason(c); const t = teamOf(s && driverCurrentTeam(c, r.id, s.id)) || null;
    return `<a class="ed-card" href="${href}" style="--tc:${t ? t.color : '#606066'}" data-filter-text="${esc((spec.name(r) + ' ' + (t ? t.name : '')).toLowerCase())}">
      <span class="ed-card-pic">${portraitImg(r, t, 'ed-portrait')}</span><span class="ed-card-txt"><b>${esc(spec.name(r))}</b><small>${esc(t ? t.name : spec.sub(r))}</small></span></a>`;
  }
  if (spec.cards === 'team') return `<a class="ed-card ed-card-team" href="${href}" style="--tc:${r.color}" data-filter-text="${esc(r.name.toLowerCase())}">
      <span class="ed-card-pic">${logoImg(r, 'ed-logo')}</span><span class="ed-card-txt"><b>${esc(r.name)}</b><small>${esc(spec.sub(r))}</small></span></a>`;
  const dot = spec.dot ? spec.dot(r) : null;
  return `<a class="ed-row" href="${href}" data-filter-text="${esc(String(spec.nameHtml ? r.name : spec.name(r)).toLowerCase())}">${dot ? `<span class="ed-dot" style="background:${dot}"></span>` : ''}
    <span class="ed-row-txt"><b>${spec.nameHtml ? spec.name(r) : esc(spec.name(r))}</b><small>${esc(spec.sub(r))}</small></span><span class="ed-row-go" aria-hidden="true">›</span></a>`;
}

function editCrud(section, q) {
  const spec = SPECS[section];
  const c = D();
  const season = spec.seasonScoped ? ((q.season && seasonOf(c, q.season)) || activeSeason(c)) : null;
  const sq = season ? 'season=' + season.id + '&' : '';
  const back = `#/edit/${section}${season ? '?season=' + season.id : ''}`;
  const editing = q.id === 'new' ? Object.assign({ id: '' }, spec.defaults ? spec.defaults() : {}, season ? { seasonId: season.id } : {}) : q.id ? byId(c[spec.coll], q.id) : null;

  if (editing) {                                    // focused edit screen
    const main = spec.fields.filter(f => !f.more), more = spec.fields.filter(f => f.more);
    return `<a class="back-link" href="${back}">‹ All ${esc(spec.title.toLowerCase())}</a>
      <form class="edit-form panel" data-crud="${section}" data-id="${esc(editing.id || '')}">
        <h3 class="h-card">${editing.id ? esc(String(spec.nameHtml ? editing.name : spec.name(editing))) : 'New ' + spec.one}</h3>
        <div class="form-grid">${main.map(f => fieldHtml(f, editing)).join('')}</div>
        ${more.length ? `<details class="more-fields"><summary>More details <span class="muted">(optional)</span></summary><div class="form-grid">${more.map(f => fieldHtml(f, editing)).join('')}</div></details>` : ''}
        <div class="form-actions form-actions-sticky"><button class="btn btn-red" type="submit">Save</button><a class="btn btn-ghost" href="${back}">Cancel</a>
          ${editing.id ? `<button class="btn btn-ghost btn-danger-text" type="button" data-delete="${spec.coll}|${editing.id}">Delete ${spec.one}</button>` : ''}</div>
      </form>`;
  }

  let list = c[spec.coll].filter(r => !season || r.seasonId === season.id);
  if (spec.sort) list = list.slice().sort(spec.sort);
  const tools = `<div class="page-tools">
      ${season ? seasonSelect(season.id, id => `#/edit/${section}?season=${id}`) : ''}
      ${list.length > 8 ? `<input class="ed-filter" type="search" placeholder="Search ${esc(spec.title.toLowerCase())}…" aria-label="Search" data-filter>` : ''}
      <a class="btn btn-red btn-add" href="#/edit/${section}?${sq}id=new">+ Add ${spec.one}</a></div>`;
  const items = list.map(r => crudCard(spec, r, `#/edit/${section}?${sq}id=${r.id}`)).join('');
  const transfer = section === 'assignments' && season ? transferForm(season) : '';
  return `${transfer}${tools}
    ${list.length ? `<div class="${spec.cards ? 'ed-cards' : 'ed-rows'}" data-filter-list>${items}</div><p class="muted ed-nomatch" hidden data-nomatch>Nothing matches.</p>`
      : emptyState(`No ${spec.title.toLowerCase()} yet`, '', { href: `#/edit/${section}?${sq}id=new`, label: `Add ${spec.one}` })}
    <p class="muted ed-tip">Click any ${spec.one} to change it.</p>`;
}

function transferForm(season) {
  return `<form class="edit-form panel panel-accent" data-transfer="${season.id}">
    <h3 class="h-card">Transfer a driver</h3>
    <p class="muted">Results already raced keep the old team.</p>
    <div class="form-grid form-grid-3">
      ${fieldHtml({ key: 'driverId', label: 'Driver', type: 'select', options: driverOpts, required: true }, {})}
      ${fieldHtml({ key: 'teamId', label: 'New team', type: 'select', options: teamOpts, required: true }, {})}
      ${fieldHtml({ key: 'fromRound', label: 'From round', type: 'number', required: true }, { fromRound: (nextRound(D(), season.id) || { round: 1 }).round })}
    </div>
    <div class="form-actions"><button class="btn btn-red" type="submit">Make transfer</button></div>
  </form>`;
}

/* --- results grid editor -------------------------------------------------- */
function editResults(q) {
  const c = D();
  const season = (q.season && seasonOf(c, q.season)) || (q.round && seasonOf(c, (byId(c.rounds, q.round) || {}).seasonId)) || activeSeason(c);
  if (!season) return emptyState('No season', 'Create a season first.', { href: '#/edit/seasons?id=new', label: 'Add season' });
  const rounds = roundsOf(c, season.id);
  const round = (q.round && byId(c.rounds, q.round)) || nextRound(c, season.id) || rounds[0];
  if (!round) return emptyState('No races', 'Add races to the calendar first.', { href: '#/edit/rounds?id=new', label: 'Add race' });
  const sessions = SESSION_TYPES.filter(s => s !== 'sprint' || round.sprint || resultFor(c, round.id, 'sprint'));
  const session = sessions.includes(q.session) ? q.session : 'race';
  const res = resultFor(c, round.id, session);
  let entries = res ? res.entries : lineupEntries(season.id, round.round);
  const tOpts = c.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const dOpts = [...c.drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(d => `<option value="${d.id}">${esc(d.firstName)} ${esc(d.lastName)}</option>`).join('');
  const sel = (opts, v) => opts.replace(`value="${v}"`, `value="${v}" selected`);
  const quali = session === 'qualifying';
  const row = (e, i) => `<tr data-row style="--tc:${(teamOf(e.teamId) || {}).color || 'transparent'}">
      <td class="pos-cell">${i + 1}</td>
      <td class="drv-cell"><select name="driverId" data-driver aria-label="Driver">${sel(dOpts, e.driverId)}</select></td>
      <td class="x-col"><select name="teamId" data-team aria-label="Team">${sel(tOpts, e.teamId)}</select></td>
      <td><select name="status" aria-label="Status">${RESULT_STATUSES.map(s => `<option value="${s}" ${e.status === s ? 'selected' : ''}>${STATUS_LABELS[s] || s}</option>`).join('')}</select></td>
      <td><input name="time" type="text" value="${esc(e.time || '')}" class="in-sm" aria-label="${quali ? 'Best lap' : 'Time or gap'}" placeholder="${quali ? '1:29.123' : i ? '+5.123s' : '1:32:10.456'}"></td>
      ${session === 'race' ? `<td class="fl-cell"><input type="radio" name="fastestLap" ${e.fastestLap ? 'checked' : ''} aria-label="Fastest lap"></td>` : ''}
      ${quali ? '' : `<td class="x-col"><input name="grid" type="number" min="1" value="${esc(e.grid ?? '')}" class="in-xs" aria-label="Grid"></td><td class="x-col"><input name="laps" type="number" min="0" value="${esc(e.laps ?? '')}" class="in-xs" aria-label="Laps"></td><td class="x-col"><input name="points" type="number" step="any" value="${esc(e.points ?? '')}" class="in-xs" placeholder="auto" aria-label="Points"></td>`}
      <td class="row-btns"><div class="actions"><button type="button" class="icon-btn" data-move="-1" aria-label="Move up">▲</button><button type="button" class="icon-btn" data-move="1" aria-label="Move down">▼</button><button type="button" class="icon-btn icon-btn-x" data-remove-row aria-label="Remove">✕</button></div></td>
    </tr>`;
  const roundSel = rounds.map(r => `<option value="${r.id}" ${r.id === round.id ? 'selected' : ''}>${resultFor(c, r.id, 'race') ? '✓ ' : ''}R${r.round} ${esc(r.name)}</option>`).join('');
  const seg = sessions.map(s => `<a class="seg${s === session ? ' is-active' : ''}" href="#/edit/results?round=${round.id}&session=${s}">${cap(s)}${resultFor(c, round.id, s) ? ' ✓' : ''}</a>`).join('');
  return `<div class="page-tools">
      ${seasonSelect(season.id, id => `#/edit/results?season=${id}`)}
      <label class="pill-select"><select data-nav-select="#/edit/results?round=__ID__&session=${session}" aria-label="Race">${roundSel}</select></label>
      <div class="segmented" role="tablist" aria-label="Session">${seg}</div>
    </div>
    <form class="edit-form panel" data-results="${round.id}|${session}">
      <div class="res-head"><h3 class="h-card">${flag(round.countryCode)} ${esc(round.name)} · ${cap(session)}</h3>${res ? '<span class="tag tag-dark">Saved</span>' : '<span class="tag tag-red">Not entered yet</span>'}</div>
      <p class="muted">Put the drivers in ${quali ? 'qualifying order, pole first' : 'finishing order'}. Use ▲ ▼ to move them. Points are worked out for you.</p>
      <label class="switch switch-sm"><input type="checkbox" data-xcols><span class="switch-ui" aria-hidden="true"></span><span>Show team, grid, laps &amp; points columns</span></label>
      <div class="table-scroll"><table class="f1-table edit-table res-table" data-res-table><thead><tr><th>Pos</th><th>Driver</th><th class="x-col">Team</th><th>Status</th><th>${quali ? 'Best lap' : 'Time / gap'}</th>${session === 'race' ? '<th title="Fastest lap">Fastest lap</th>' : ''}${quali ? '' : '<th class="x-col">Grid</th><th class="x-col">Laps</th><th class="x-col">Points</th>'}<th></th></tr></thead>
      <tbody data-rows>${entries.map(row).join('')}</tbody></table></div>
      <template data-row-template>${row({ driverId: '', teamId: '', status: 'FIN', time: '' }, 0)}</template>
      <div class="form-actions form-actions-sticky">
        <button class="btn btn-red" type="submit">Save result</button>
        <button class="btn btn-ghost" type="button" data-add-row>+ Add driver</button>
        <button class="btn btn-ghost" type="button" data-fill-lineup="${season.id}|${round.round}">Start over from line-up</button>
        ${res ? `<button class="btn btn-ghost btn-danger-text" type="button" data-delete="results|${res.id}">Delete result</button>` : ''}
        ${res ? `<a class="btn btn-ghost" href="#/results/${round.id}/${session}">View on site ›</a>` : ''}
      </div>
    </form>`;
}

function lineupEntries(seasonId, roundNo) {
  const lu = lineupAt(D(), seasonId, roundNo);
  return Object.entries(lu).flatMap(([teamId, ids]) => ids.map(driverId => ({ driverId, teamId, status: 'FIN', grid: null, laps: null, time: '', fastestLap: false, points: null })));
}

/* --- data ------------------------------------------------------------------ */
function editData() {
  return `<div class="panel"><h3 class="h-card">Save a backup</h3><p class="muted">Downloads your whole career as one file. Keep it somewhere safe.</p>
      <label class="switch switch-sm"><input type="checkbox" data-export-images checked><span class="switch-ui" aria-hidden="true"></span><span>Include my uploaded pictures (${D().assets.length})</span></label>
      <div class="form-actions"><button class="btn btn-red" type="button" data-export>Download backup</button></div></div>
    <div class="panel"><h3 class="h-card">Load a backup</h3><p class="muted">Replaces the current career with a backup file. Nothing changes if the file has errors.</p>
      <label class="btn btn-outline file-btn">Choose backup file<input type="file" accept="application/json,.json" data-import hidden></label></div>
    <div class="panel"><h3 class="h-card">Real 2026 grid</h3><p class="muted">The real 2026 drivers, teams and calendar with all pictures, but no results.</p>
      <div class="form-actions"><button class="btn btn-outline" type="button" data-add-real>Add to this career</button><button class="btn btn-ghost" type="button" data-start-real>Start a new career with it</button></div></div>
    <div class="panel panel-danger"><h3 class="h-card">Start over</h3><p class="muted">Deletes this browser's career. Download a backup first if you want to keep it.</p>
      <div class="form-actions"><button class="btn btn-outline" type="button" data-reset>Reset to 2026 grid</button><button class="btn btn-ghost" type="button" data-blank>Start an empty career</button></div></div>`;
}

/* --- event binding -------------------------------------------------------- */
function toast(msg, bad) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' toast-bad' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 6000 : 2600);
}

function bindEditor(root) {
  root.querySelectorAll('input[type=color]').forEach(i => i.addEventListener('input', () => { i.nextElementSibling.textContent = i.value; }));

  const meta = root.querySelector('[data-meta-form]');
  if (meta) meta.addEventListener('submit', ev => {
    ev.preventDefault(); const fd = new FormData(meta); const m = D().meta;
    m.careerName = String(fd.get('careerName') || 'My Career'); m.activeSeasonId = fd.get('activeSeasonId') || m.activeSeasonId;
    m.playerTeamId = fd.get('playerTeamId') || null; m.isSample = fd.get('isSample') === 'on';
    Store.save(); toast('Settings saved');
  });

  root.querySelectorAll('[data-crud]').forEach(form => form.addEventListener('submit', ev => {
    ev.preventDefault();
    const section = form.dataset.crud, spec = SPECS[section];
    const base = form.dataset.id ? byId(D()[spec.coll], form.dataset.id) : Object.assign({}, spec.defaults ? spec.defaults() : {});
    const rec = readForm(form, spec, base || {});
    if (spec.coll === 'articles' && !rec.slug) rec.slug = slugify(rec.title);
    if (spec.coll === 'rounds' && !rec.country) rec.country = rec.name;
    if (spec.coll === 'assignments' && rec.toRound != null && rec.toRound < rec.fromRound) return toast('“To round” must be after “From round”.', true);
    if (rec.featured && spec.coll === 'articles') D().articles.forEach(a => { if (a.id !== rec.id && a.seasonId === rec.seasonId) a.featured = false; });
    Store.upsert(spec.coll, rec);
    toast('Saved');
    location.hash = `#/edit/${section}${rec.seasonId && spec.seasonScoped ? '?season=' + rec.seasonId : ''}`;
  }));

  root.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
    const [coll, id] = b.dataset.delete.split('|');
    if (!confirm('Delete this for good? This cannot be undone.')) return;
    const form = b.closest('[data-crud]');
    try { Store.remove(coll, id); toast('Deleted'); if (form) location.hash = form.querySelector('.form-actions a').getAttribute('href'); }
    catch (e) { toast(e.message.replace(/still used/i, 'still used elsewhere, so it cannot be deleted yet'), true); }
  }));

  const filter = root.querySelector('[data-filter]');
  if (filter) filter.addEventListener('input', () => {
    const qv = filter.value.trim().toLowerCase(); let shown = 0;
    root.querySelectorAll('[data-filter-list] > *').forEach(el => { const ok = !qv || el.dataset.filterText.includes(qv); el.hidden = !ok; if (ok) shown++; });
    root.querySelector('[data-nomatch]').hidden = shown > 0;
  });

  const tf = root.querySelector('[data-transfer]');
  if (tf) tf.addEventListener('submit', ev => {
    ev.preventDefault(); const fd = new FormData(tf); const seasonId = tf.dataset.transfer;
    const driverId = fd.get('driverId'), teamId = fd.get('teamId'), from = Number(fd.get('fromRound'));
    if (!(from >= 1)) return toast('Enter a valid round.', true);
    const mine = a => a.seasonId === seasonId && a.driverId === driverId && a.role === 'race';
    // seats that start on/after the transfer round are superseded; the running seat ends the round before
    D().assignments = D().assignments.filter(a => !(mine(a) && a.fromRound >= from));
    D().assignments.filter(a => mine(a) && assignmentActive(a, from)).forEach(a => { a.toRound = from - 1; });
    Store.upsert('assignments', { id: newId('assignments'), seasonId, driverId, teamId, fromRound: from, toRound: null, role: 'race' });
    toast(`${nameOf(driverOf(driverId))} → ${teamOf(teamId).name} from round ${from}`);
  });

  const rf = root.querySelector('[data-results]');
  if (rf) {
    const tbody = rf.querySelector('[data-rows]');
    const table = rf.querySelector('[data-res-table]'), xc = rf.querySelector('[data-xcols]');
    let xOn = false; try { xOn = localStorage.getItem('f1hub.xcols') === '1'; } catch (e) {}
    xc.checked = xOn; table.classList.toggle('show-x', xOn);
    xc.addEventListener('change', () => { table.classList.toggle('show-x', xc.checked); try { localStorage.setItem('f1hub.xcols', xc.checked ? '1' : '0'); } catch (e) {} });
    const paint = tr => { const t = teamOf(tr.querySelector('[name=teamId]').value); tr.style.setProperty('--tc', t ? t.color : 'transparent'); };
    const renumber = () => tbody.querySelectorAll('[data-row]').forEach((tr, i) => { tr.querySelector('.pos-cell').textContent = i + 1; });
    rf.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      const tr = b.closest('[data-row]');
      if (b.dataset.move && tr) { const dir = Number(b.dataset.move); const sib = dir < 0 ? tr.previousElementSibling : tr.nextElementSibling; if (sib) dir < 0 ? sib.before(tr) : sib.after(tr); renumber(); }
      if (b.hasAttribute('data-remove-row') && tr) { tr.remove(); renumber(); }
      if (b.hasAttribute('data-add-row')) { tbody.insertAdjacentHTML('beforeend', rf.querySelector('[data-row-template]').innerHTML); renumber(); }
      if (b.dataset.fillLineup) {
        const [sid, rn] = b.dataset.fillLineup.split('|'); const [roundId, session] = rf.dataset.results.split('|');
        if (!confirm('Replace the rows with the contracted line-up for this round?')) return;
        const tmp = document.createElement('tbody');
        tmp.innerHTML = lineupEntries(sid, Number(rn)).map(() => rf.querySelector('[data-row-template]').innerHTML).join('');
        const list = lineupEntries(sid, Number(rn));
        [...tmp.children].forEach((tr, i) => { tr.querySelector('[name=driverId]').value = list[i].driverId; tr.querySelector('[name=teamId]').value = list[i].teamId; });
        tbody.replaceChildren(...tmp.children); tbody.querySelectorAll('[data-row]').forEach(paint); renumber();
      }
    });
    // picking a driver defaults the team to their seat at this round
    rf.addEventListener('change', ev => {
      if (ev.target.matches('[data-team]')) return paint(ev.target.closest('tr'));
      if (!ev.target.matches('[data-driver]')) return;
      const [roundId] = rf.dataset.results.split('|'); const rd = byId(D().rounds, roundId);
      const t = driverTeamAt(D(), ev.target.value, rd.seasonId, rd.round);
      if (t) ev.target.closest('tr').querySelector('[name=teamId]').value = t;
      paint(ev.target.closest('tr'));
    });
    rf.addEventListener('submit', ev => {
      ev.preventDefault();
      const [roundId, session] = rf.dataset.results.split('|');
      const entries = [...tbody.querySelectorAll('[data-row]')].map(tr => {
        const g = n => { const el = tr.querySelector(`[name=${n}]`); return el ? el.value.trim() : ''; };
        const num = n => (g(n) === '' ? null : Number(g(n)));
        return { driverId: g('driverId'), teamId: g('teamId'), status: g('status') || 'FIN', grid: num('grid'), laps: num('laps'), time: g('time'),
          fastestLap: !!(tr.querySelector('[name=fastestLap]') || {}).checked, points: num('points') };
      }).filter(e => e.driverId);
      const dup = entries.map(e => e.driverId).find((d, i, a) => a.indexOf(d) !== i);
      if (dup) return toast(`${nameOf(driverOf(dup))} appears twice.`, true);
      const existing = resultFor(D(), roundId, session);
      Store.upsert('results', { id: existing ? existing.id : `res_${roundId.replace(/^rnd_/, '')}_${session}`, roundId, session, entries });
      const rd = byId(D().rounds, roundId); if (session === 'race') { rd.status = 'completed'; Store.save(); }
      toast('Result saved, standings updated');
    });
  }

  const ex = root.querySelector('[data-export]');
  if (ex) ex.addEventListener('click', async () => {
    const out = clone(D());
    if (root.querySelector('[data-export-images]')?.checked && out.assets.length) out.assetBlobs = await AssetStore.exportBlobs(out.assets.map(a => a.id));
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${slugify(D().meta.careerName)}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const im = root.querySelector('[data-import]');
  if (im) im.addEventListener('change', async () => {
    const f = im.files[0]; if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      Store.replace(raw);                                   // validates first; throws without changing anything
      if (raw.assetBlobs) await AssetStore.importBlobs(raw.assetBlobs);
      const missing = D().assets.filter(a => !AssetStore.url(a.id)).length;
      toast('Career imported' + (missing ? ` · ${missing} image file(s) not in this export, placeholders will be shown` : ''));
      location.hash = '#/'; render();
    }
    catch (e) { toast(e.message, true); im.value = ''; }
  });
  const rs = root.querySelector('[data-reset]');
  if (rs) rs.addEventListener('click', () => { if (confirm('Replace everything with the 2026 starter grid?')) { Store.reset(SAMPLE_CAREER); toast('2026 grid restored'); location.hash = '#/'; } });
  const ar = root.querySelector('[data-add-real]');
  if (ar) ar.addEventListener('click', () => {
    try { const n = mergeRealGrid(D()); Store.save(); toast(n ? `Added ${n} records. Pick 2026 in any season menu.` : 'Already in this career'); }
    catch (e) { toast(e.message, true); }
  });
  const sr = root.querySelector('[data-start-real]');
  if (sr) sr.addEventListener('click', () => {
    if (!confirm('Start a new career on the real 2026 grid? Export first if you want to keep the current one.')) return;
    const c = emptyCareer(); mergeRealGrid(c);
    c.meta.careerName = 'My 2026 Career'; c.meta.activeSeasonId = 'sea_2026_grid';
    Store.replace(c); toast('New career on the 2026 grid'); location.hash = '#/edit';
  });
  root.querySelectorAll('[data-img-input]').forEach(i => i.addEventListener('input', () => {
    const im = i.nextElementSibling; im.hidden = !i.value; im.src = i.value;
  }));
  const bl = root.querySelector('[data-blank]');
  if (bl) bl.addEventListener('click', () => {
    if (!confirm('Start an empty career? Export first if you want to keep the current one.')) return;
    const c = emptyCareer();
    c.pointsRules.push(clone(SAMPLE_CAREER.pointsRules[0]));
    const y = new Date().getFullYear();
    c.seasons.push({ id: 'sea_' + y, year: y, name: `${y} Season`, pointsRuleId: c.pointsRules[0].id, notes: '' });
    c.meta.activeSeasonId = c.seasons[0].id;
    Store.replace(c); toast('Empty career created'); location.hash = '#/edit/teams?id=new';
  });
}
