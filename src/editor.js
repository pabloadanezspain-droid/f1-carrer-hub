/* ==========================================================================
   editor.js — "Edit Career": CRUD forms for every collection + import/export.
   Generic form specs drive most collections; results get a dedicated grid editor.
   ========================================================================== */

const EDIT_SECTIONS = [
  ['overview', 'Career'], ['seasons', 'Seasons'], ['points', 'Points rules'], ['teams', 'Teams'], ['drivers', 'Drivers'],
  ['assignments', 'Line-ups & transfers'], ['rounds', 'Calendar'], ['results', 'Results'], ['articles', 'Articles'], ['studio', 'Portrait studio'], ['assets', 'Images'], ['data', 'Import / Export'],
];

const opt = (list, label) => () => list().map(r => [r.id, label(r)]);
const seasonOpts = opt(() => seasonsDesc(D()), s => `${s.year} — ${s.name}`);
const teamOpts = opt(() => [...D().teams].sort((a, b) => a.name.localeCompare(b.name)), t => t.name);
const driverOpts = opt(() => [...D().drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)), d => `${d.lastName}, ${d.firstName} (#${d.number ?? '–'})`);
const ruleOpts = opt(() => D().pointsRules, r => r.name);

const SPECS = {
  seasons: {
    title: 'Seasons', coll: 'seasons', sort: (a, b) => b.year - a.year,
    cols: [['Year', r => r.year], ['Name', r => r.name], ['Points rule', r => (byId(D().pointsRules, r.pointsRuleId) || {}).name || '—'], ['Rounds', r => roundsOf(D(), r.id).length]],
    fields: [
      { key: 'year', label: 'Year', type: 'number', required: true },
      { key: 'name', label: 'Season name', type: 'text', required: true, placeholder: '2031 Career Season' },
      { key: 'pointsRuleId', label: 'Points rule', type: 'select', options: ruleOpts, required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  points: {
    title: 'Points rules', coll: 'pointsRules',
    cols: [['Name', r => r.name], ['Race', r => (r.race || []).join('-')], ['Sprint', r => (r.sprint || []).join('-') || '—'], ['Fastest lap', r => r.fastestLap && r.fastestLap.points ? `${r.fastestLap.points} (top ${r.fastestLap.maxPosition})` : '—']],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'race', label: 'Race points by position (comma separated)', type: 'list', placeholder: '25,18,15,12,10,8,6,4,2,1' },
      { key: 'sprint', label: 'Sprint points by position', type: 'list', placeholder: '8,7,6,5,4,3,2,1' },
      { key: 'fastestLap.points', label: 'Fastest-lap bonus points', type: 'number' },
      { key: 'fastestLap.maxPosition', label: 'Fastest-lap bonus only if finishing in top…', type: 'number' },
    ],
    defaults: () => ({ race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [8, 7, 6, 5, 4, 3, 2, 1], fastestLap: { points: 0, maxPosition: 10 } }),
  },
  teams: {
    title: 'Teams', coll: 'teams', sort: (a, b) => a.name.localeCompare(b.name),
    cols: [['', r => teamDot(r)], ['Name', r => esc(r.name)], ['Base', r => esc(r.base || '')], ['Power unit', r => esc(r.powerUnit || '')]], html: true,
    fields: [
      { key: 'name', label: 'Short name', type: 'text', required: true },
      { key: 'fullName', label: 'Full team name', type: 'text' },
      { key: 'color', label: 'Team colour', type: 'color', required: true },
      { key: 'colorDark', label: 'Team colour (dark tone)', type: 'color' },
      { key: 'base', label: 'Base', type: 'text' }, { key: 'principal', label: 'Team chief', type: 'text' },
      { key: 'technicalChief', label: 'Technical chief', type: 'text' }, { key: 'chassis', label: 'Chassis', type: 'text' },
      { key: 'powerUnit', label: 'Power unit', type: 'text' }, { key: 'firstEntry', label: 'First entry (year)', type: 'number' },
      { key: 'championships', label: 'Prior world titles (before this career)', type: 'number' },
      { key: 'logoUrl', label: 'Logo image (optional)', type: 'image', lib: 'teams/' },
      { key: 'carUrl', label: 'Car image (optional)', type: 'image', lib: 'teams/' },
      { key: 'bio', label: 'Team history / notes', type: 'textarea' },
    ],
    defaults: () => ({ color: '#e10600', colorDark: '#4a0200', championships: 0 }),
  },
  drivers: {
    title: 'Drivers', coll: 'drivers', sort: (a, b) => a.lastName.localeCompare(b.lastName),
    cols: [['No.', r => esc(r.number ?? '')], ['Name', r => `${esc(r.firstName)} <b>${esc(r.lastName)}</b>`], ['Code', r => esc(r.code || '')], ['Nat.', r => flag(r.nationality) + ' ' + esc(r.nationality || '')]], html: true,
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true }, { key: 'lastName', label: 'Last name', type: 'text', required: true },
      { key: 'code', label: '3-letter code', type: 'text', maxlength: 3, upper: true }, { key: 'number', label: 'Race number', type: 'number' },
      { key: 'nationality', label: 'Nationality (3-letter code, e.g. GBR)', type: 'text', maxlength: 3, upper: true, datalist: Object.keys(COUNTRY_NAMES) },
      { key: 'dob', label: 'Date of birth', type: 'date' }, { key: 'birthplace', label: 'Place of birth', type: 'text' },
      { key: 'championships', label: 'Prior world titles', type: 'number' },
      { key: 'portraitUrl', label: 'Portrait image (optional)', type: 'image', lib: 'drivers/' },
      { key: 'portraitTeamId', label: 'Team suit worn in that portrait (blank = any team)', type: 'select', options: () => [['', '— any / unknown —'], ...teamOpts()] },
      { key: 'numberUrl', label: 'Race-number artwork (optional)', type: 'image', lib: 'drivers/' },
      { key: 'photoUrls', label: 'Trackside photos, one path/URL per line (used for news images)', type: 'urls', lib: 'photos/' },
      { key: 'bio', label: 'Biography', type: 'textarea' },
    ],
    defaults: () => ({ championships: 0 }),
  },
  assignments: {
    title: 'Line-ups & transfers', coll: 'assignments', seasonScoped: true,
    sort: (a, b) => { const ta = teamOf(a.teamId), tb = teamOf(b.teamId); return (ta ? ta.name : '').localeCompare(tb ? tb.name : '') || a.fromRound - b.fromRound; },
    cols: [['Team', r => teamLink(teamOf(r.teamId))], ['Driver', r => esc(nameOf(driverOf(r.driverId)))], ['Role', r => esc(r.role)], ['Rounds', r => `${r.fromRound}${r.toRound ? '–' + r.toRound : ' →'}`]], html: true,
    fields: [
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true },
      { key: 'driverId', label: 'Driver', type: 'select', options: driverOpts, required: true },
      { key: 'teamId', label: 'Team', type: 'select', options: teamOpts, required: true },
      { key: 'role', label: 'Role', type: 'select', options: () => [['race', 'Race driver'], ['reserve', 'Reserve']], required: true },
      { key: 'fromRound', label: 'From round', type: 'number', required: true },
      { key: 'toRound', label: 'To round (blank = rest of season)', type: 'number' },
    ],
    defaults: () => ({ role: 'race', fromRound: 1, toRound: null }),
  },
  rounds: {
    title: 'Calendar rounds', coll: 'rounds', seasonScoped: true, sort: (a, b) => a.round - b.round,
    cols: [['Rnd', r => r.round], ['Grand Prix', r => `${flag(r.countryCode)} ${esc(r.name)}`], ['Dates', r => esc(fmtRange(r.dateStart, r.dateEnd))], ['Results', r => sessionsWithResults(D(), r.id).map(cap).join(', ') || '—']], html: true,
    fields: [
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true },
      { key: 'round', label: 'Round number', type: 'number', required: true },
      { key: 'name', label: 'Short name (e.g. country)', type: 'text', required: true },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'countryCode', label: 'Country code (3 letters)', type: 'text', maxlength: 3, upper: true, datalist: Object.keys(COUNTRY_NAMES) },
      { key: 'officialName', label: 'Official event name', type: 'text' },
      { key: 'circuit', label: 'Circuit', type: 'text' }, { key: 'city', label: 'City', type: 'text' },
      { key: 'laps', label: 'Laps', type: 'number' }, { key: 'lengthKm', label: 'Lap length (km)', type: 'number', step: '0.001' },
      { key: 'dateStart', label: 'First day', type: 'date' }, { key: 'dateEnd', label: 'Race day', type: 'date' },
      { key: 'sprint', label: 'Sprint weekend', type: 'checkbox' },
      { key: 'sessions', label: 'Sessions — one per line: Label | YYYY-MM-DD | HH:MM', type: 'sessions' },
      { key: 'imageUrl', label: 'Header image (optional)', type: 'image', lib: 'circuits/' },
    ],
    defaults: () => ({ sprint: false, sessions: [], status: 'scheduled' }),
  },
  articles: {
    title: 'Articles', coll: 'articles', sort: (a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)),
    cols: [['Date', r => esc(fmtDate(r.publishedAt))], ['Title', r => `<a href="#/news/${r.id}">${esc(r.title)}</a>${r.featured ? ' ' + tag('Lead', 'red') : ''}`], ['Category', r => esc(r.category)]], html: true,
    fields: [
      { key: 'title', label: 'Headline', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: () => ARTICLE_CATEGORIES.map(x => [x, x]) },
      { key: 'seasonId', label: 'Season', type: 'select', options: seasonOpts, required: true },
      { key: 'roundId', label: 'Linked round (optional)', type: 'select', options: () => [['', '— none —'], ...D().rounds.slice().sort((a, b) => a.round - b.round).map(r => [r.id, `${(seasonOf(D(), r.seasonId) || {}).year} R${r.round} ${r.name}`])] },
      { key: 'publishedAt', label: 'Published', type: 'datetime' },
      { key: 'standfirst', label: 'Standfirst (summary)', type: 'textarea', rows: 2 },
      { key: 'body', label: 'Body — blank line between paragraphs', type: 'textarea', rows: 10 },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'featured', label: 'Lead story on the homepage', type: 'checkbox' },
      { key: 'imageUrl', label: 'Image (optional; otherwise a photo of a driver in the story)', type: 'image', lib: 'photos/' },
      { key: 'driverIds', label: 'Drivers in this story', type: 'multi', options: driverOpts },
      { key: 'teamIds', label: 'Teams in this story', type: 'multi', options: teamOpts },
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
    case 'multi': input = `<div class="multi" id="${id}">${f.options().map(([val, lab]) => `<label><input type="checkbox" name="${f.key}" value="${esc(val)}" ${(v || []).includes(val) ? 'checked' : ''}> ${esc(lab)}</label>`).join('')}</div>`; break;
    case 'checkbox': input = `<label class="check"><input type="checkbox" id="${id}" name="${f.key}" ${v ? 'checked' : ''}> Yes</label>`; break;
    case 'list': input = `<input id="${id}" name="${f.key}" type="text" value="${esc((v || []).join(', '))}" placeholder="${esc(f.placeholder || '')}">`; break;
    case 'sessions': input = `<textarea id="${id}" name="${f.key}" rows="6" placeholder="Practice 1 | 2031-03-07 | 12:30">${esc((v || []).map(s => [s.label, s.date, s.time].join(' | ')).join('\n'))}</textarea>`; break;
    case 'datetime': input = `<input id="${id}" name="${f.key}" type="datetime-local" value="${esc(v ? String(v).slice(0, 16) : '')}">`; break;
    case 'image': input = `<span class="img-in"><input id="${id}" name="${f.key}" type="text" value="${esc(v || '')}" list="lib_${f.lib.replace('/', '')}" placeholder="Pick from library or paste a URL" data-img-input><img class="img-prev" src="${esc(v || '')}" alt="" ${v ? '' : 'hidden'}></span>${libDatalist(f.lib)}`; break;
    case 'urls': input = `<textarea id="${id}" name="${f.key}" rows="3" list="lib_${f.lib.replace('/', '')}" placeholder="assets/f1com/photos/...webp">${esc((v || []).join('\n'))}</textarea>${libDatalist(f.lib)}`; break;
    case 'color': input = `<span class="color-in"><input id="${id}" name="${f.key}" type="color" value="${esc(v || '#888888')}"><code>${esc(v || '')}</code></span>`; break;
    default: input = `<input id="${id}" name="${f.key}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" ${f.step ? `step="${f.step}"` : f.type === 'number' ? 'step="any"' : ''} value="${esc(v ?? '')}" ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.datalist ? `list="${id}_dl"` : ''} ${req}>${f.datalist ? `<datalist id="${id}_dl">${f.datalist.map(x => `<option value="${x}">`).join('')}</datalist>` : ''}`;
  }
  return `<div class="field field-${f.type}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}</div>`;
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

/* Real 2026 grid records shipped inside the sample (season sea_2026_grid). */
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
  const nav = `<nav class="edit-nav" aria-label="Edit sections">${EDIT_SECTIONS.map(([k, l]) => `<a class="${k === section ? 'is-active' : ''}" href="#/edit/${k}">${l}</a>`).join('')}</nav>`;
  let body;
  if (section === 'overview') body = editOverview();
  else if (section === 'results') body = editResults(q);
  else if (section === 'data') body = editData();
  else if (section === 'studio') body = editStudio(q);
  else if (section === 'assets') body = editAssets();
  else if (SPECS[section]) body = editCrud(section, q);
  else body = emptyState('Unknown section', '', { href: '#/edit', label: 'Back' });
  return { title: 'Edit Career', nav: 'edit', html: `
    <div class="wrap page edit-page">
      <h1 class="h-page">Edit Career</h1>
      <p class="page-sub">Changes save to this browser immediately. Use Import / Export to back up or move your save.</p>
      <div class="edit-layout">${nav}<div class="edit-main">${body}</div></div>
    </div>`, after: root => { bindEditor(root); bindStudio(root); bindAssets(root); } };
}

function editOverview() {
  const c = D(); const m = c.meta;
  const counts = COLLECTIONS.map(k => `<div><dt>${k}</dt><dd>${c[k].length}</dd></div>`).join('');
  const errs = validateCareer(c);
  return `<form class="edit-form panel" data-meta-form>
      <h2 class="h-card">Career settings</h2>
      <div class="form-grid">
        ${fieldHtml({ key: 'careerName', label: 'Career name', type: 'text', required: true }, m)}
        ${fieldHtml({ key: 'activeSeasonId', label: 'Active season (shown by default)', type: 'select', options: seasonOpts }, m)}
        ${fieldHtml({ key: 'playerTeamId', label: 'Your team', type: 'select', options: () => [['', '— none —'], ...teamOpts()] }, m)}
        ${fieldHtml({ key: 'isSample', label: 'Show “fictional sample” banner', type: 'checkbox' }, m)}
      </div>
      <div class="form-actions"><button class="btn btn-red" type="submit">Save settings</button></div>
    </form>
    <div class="panel"><h2 class="h-card">Records</h2><dl class="facts two-col">${counts}</dl>
      ${errs.length ? `<div class="alert">${errs.length} integrity issue(s):<br>${errs.slice(0, 8).map(esc).join('<br>')}</div>` : '<p class="ok">✓ All references are consistent.</p>'}
    </div>`;
}

function editCrud(section, q) {
  const spec = SPECS[section];
  const c = D();
  const season = spec.seasonScoped ? ((q.season && seasonOf(c, q.season)) || activeSeason(c)) : null;
  let list = c[spec.coll].filter(r => !season || r.seasonId === season.id);
  if (spec.sort) list = list.slice().sort(spec.sort);
  const editing = q.id === 'new' ? Object.assign({ id: '' }, spec.defaults ? spec.defaults() : {}, season ? { seasonId: season.id } : {}) : q.id ? byId(c[spec.coll], q.id) : null;
  const seasonBar = spec.seasonScoped ? `<div class="page-tools">${seasonSelect(season ? season.id : '', id => `#/edit/${section}?season=${id}`)}<a class="btn btn-red" href="#/edit/${section}?season=${season ? season.id : ''}&id=new">+ Add</a></div>`
    : `<div class="page-tools"><a class="btn btn-red" href="#/edit/${section}?id=new">+ Add</a></div>`;
  const rows = list.map(r => `<tr class="${editing && editing.id === r.id ? 'is-editing' : ''}">${spec.cols.map(([, fn]) => `<td>${spec.html ? fn(r) : esc(fn(r))}</td>`).join('')}
      <td class="actions"><a class="chip" href="#/edit/${section}?${season ? 'season=' + season.id + '&' : ''}id=${r.id}">Edit</a><button class="chip chip-danger" type="button" data-delete="${spec.coll}|${r.id}">Delete</button></td></tr>`);
  const form = editing ? `<form class="edit-form panel" data-crud="${section}" data-id="${esc(editing.id || '')}">
      <h2 class="h-card">${editing.id ? 'Edit' : 'New'} ${esc(spec.title.replace(/s$/, '').toLowerCase())}${editing.id ? ` <code class="id">${esc(editing.id)}</code>` : ''}</h2>
      <div class="form-grid">${spec.fields.map(f => fieldHtml(f, editing)).join('')}</div>
      <div class="form-actions"><button class="btn btn-red" type="submit">Save</button><a class="btn btn-outline" href="#/edit/${section}${season ? '?season=' + season.id : ''}">Cancel</a></div>
    </form>` : '';
  const transfer = section === 'assignments' && season ? transferForm(season) : '';
  return `${seasonBar}${form}${transfer}
    ${dataTable([...spec.cols.map(([l]) => ({ label: l })), { label: '' }], rows, 'table-compact')}`;
}

function transferForm(season) {
  return `<form class="edit-form panel" data-transfer="${season.id}">
    <h2 class="h-card">Quick transfer</h2>
    <p class="muted">Ends the driver's current race seat after the previous round and starts a new one. Results already raced keep their original team.</p>
    <div class="form-grid">
      ${fieldHtml({ key: 'driverId', label: 'Driver', type: 'select', options: driverOpts, required: true }, {})}
      ${fieldHtml({ key: 'teamId', label: 'New team', type: 'select', options: teamOpts, required: true }, {})}
      ${fieldHtml({ key: 'fromRound', label: 'First round with new team', type: 'number', required: true }, { fromRound: (nextRound(D(), season.id) || { round: 1 }).round })}
    </div>
    <div class="form-actions"><button class="btn btn-red" type="submit">Apply transfer</button></div>
  </form>`;
}

/* --- results grid editor -------------------------------------------------- */
function editResults(q) {
  const c = D();
  const season = (q.season && seasonOf(c, q.season)) || (q.round && seasonOf(c, (byId(c.rounds, q.round) || {}).seasonId)) || activeSeason(c);
  if (!season) return emptyState('No season', 'Create a season first.', { href: '#/edit/seasons?id=new', label: 'Add season' });
  const rounds = roundsOf(c, season.id);
  const round = (q.round && byId(c.rounds, q.round)) || nextRound(c, season.id) || rounds[0];
  if (!round) return emptyState('No rounds', 'Add calendar rounds first.', { href: '#/edit/rounds?id=new', label: 'Add round' });
  const session = SESSION_TYPES.includes(q.session) ? q.session : 'race';
  const res = resultFor(c, round.id, session);
  let entries = res ? res.entries : lineupEntries(season.id, round.round);
  const tOpts = c.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const dOpts = [...c.drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(d => `<option value="${d.id}">${esc(d.lastName)}, ${esc(d.firstName)}</option>`).join('');
  const sel = (opts, v) => opts.replace(`value="${v}"`, `value="${v}" selected`);
  const row = (e, i) => `<tr data-row>
      <td class="pos-cell">${i + 1}</td>
      <td><select name="driverId" data-driver>${sel(dOpts, e.driverId)}</select></td>
      <td><select name="teamId">${sel(tOpts, e.teamId)}</select></td>
      <td><select name="status">${RESULT_STATUSES.map(s => `<option ${e.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      ${session === 'qualifying' ? '' : `<td><input name="grid" type="number" min="1" value="${esc(e.grid ?? '')}" class="in-xs"></td><td><input name="laps" type="number" min="0" value="${esc(e.laps ?? '')}" class="in-xs"></td>`}
      <td><input name="time" type="text" value="${esc(e.time || '')}" class="in-sm" placeholder="${session === 'qualifying' ? '1:29.123' : i ? '+5.123s' : '1:32:10.456'}"></td>
      ${session === 'race' ? `<td><input type="radio" name="fastestLap" ${e.fastestLap ? 'checked' : ''} aria-label="Fastest lap"></td>` : ''}
      ${session === 'qualifying' ? '' : `<td><input name="points" type="number" step="any" value="${esc(e.points ?? '')}" class="in-xs" placeholder="auto"></td>`}
      <td class="actions"><button type="button" class="icon-btn" data-move="-1" aria-label="Move up">▲</button><button type="button" class="icon-btn" data-move="1" aria-label="Move down">▼</button><button type="button" class="icon-btn" data-remove-row aria-label="Remove">✕</button></td>
    </tr>`;
  const roundSel = rounds.map(r => `<option value="${r.id}" ${r.id === round.id ? 'selected' : ''}>R${r.round} ${esc(r.name)}${resultFor(c, r.id, 'race') ? ' ✓' : ''}</option>`).join('');
  return `<div class="page-tools">
      ${seasonSelect(season.id, id => `#/edit/results?season=${id}`)}
      <label class="pill-select"><select data-nav-select="#/edit/results?round=__ID__&session=${session}" aria-label="Round">${roundSel}</select></label>
      <label class="pill-select"><select data-nav-select="#/edit/results?round=${round.id}&session=__ID__" aria-label="Session">${SESSION_TYPES.map(s => `<option value="${s}" ${s === session ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></label>
    </div>
    <form class="edit-form panel" data-results="${round.id}|${session}">
      <h2 class="h-card">${esc(round.name)} — ${cap(session)} ${res ? '<span class="tag tag-dark">saved</span>' : '<span class="tag tag-red">not entered</span>'}</h2>
      <p class="muted">Order rows in finishing order (pole first for qualifying). Status other than FIN is shown as NC/DQ and scores no points. The team defaults to the driver's seat at this round, but you can change it — the team stored here is the one shown forever in this result. Leave Pts blank to use the season's points rule.</p>
      <div class="table-scroll"><table class="f1-table edit-table"><thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Status</th>${session === 'qualifying' ? '' : '<th>Grid</th><th>Laps</th>'}<th>${session === 'qualifying' ? 'Best lap' : 'Time / gap'}</th>${session === 'race' ? '<th>FL</th>' : ''}${session === 'qualifying' ? '' : '<th>Pts override</th>'}<th></th></tr></thead>
      <tbody data-rows>${entries.map(row).join('')}</tbody></table></div>
      <template data-row-template>${row({ driverId: '', teamId: '', status: 'FIN', time: '' }, 0)}</template>
      <div class="form-actions">
        <button class="btn btn-red" type="submit">Save result</button>
        <button class="btn btn-outline" type="button" data-add-row>+ Add row</button>
        <button class="btn btn-outline" type="button" data-fill-lineup="${season.id}|${round.round}">Reset to line-up</button>
        ${res ? `<button class="btn btn-ghost" type="button" data-delete="results|${res.id}">Delete this result</button>` : ''}
        <a class="btn btn-ghost" href="#/results/${round.id}/${session}">View public page</a>
      </div>
    </form>`;
}

function lineupEntries(seasonId, roundNo) {
  const lu = lineupAt(D(), seasonId, roundNo);
  return Object.entries(lu).flatMap(([teamId, ids]) => ids.map(driverId => ({ driverId, teamId, status: 'FIN', grid: null, laps: null, time: '', fastestLap: false, points: null })));
}

/* --- data ------------------------------------------------------------------ */
function editData() {
  return `<div class="panel"><h2 class="h-card">Export</h2><p>Download the whole career (all seasons, records and stable IDs) as JSON.</p>
      <label class="check"><input type="checkbox" data-export-images checked> Include uploaded images (${D().assets.length}) so the file is a complete backup</label>
      <div class="form-actions"><button class="btn btn-red" type="button" data-export>Download career JSON</button></div></div>
    <div class="panel"><h2 class="h-card">Import</h2><p>Replace the current career with a JSON file. It is validated first; nothing changes if it has errors.</p>
      <input type="file" accept="application/json,.json" data-import></div>
    <div class="panel"><h2 class="h-card">Real 2026 grid</h2><p>The real 2026 line-up (22 drivers, 11 teams, 23 rounds) with the downloaded formula1.com portraits, cars, logos and circuit images. It has no results, so you can race your own season on it.</p>
      <div class="form-actions"><button class="btn btn-red" type="button" data-add-real>Add to this career</button><button class="btn btn-outline" type="button" data-start-real>Start new career from it</button></div></div>
    <div class="panel"><h2 class="h-card">Reset</h2><p>Discard this browser's career and reload the fictional sample season, or start from an empty career.</p>
      <div class="form-actions"><button class="btn btn-outline" type="button" data-reset>Reset to sample</button><button class="btn btn-ghost" type="button" data-blank>Start empty career</button></div></div>`;
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
    if (!confirm('Delete this record? This cannot be undone (export first if unsure).')) return;
    try { Store.remove(coll, id); toast('Deleted'); } catch (e) { toast(e.message, true); }
  }));

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
        tbody.replaceChildren(...tmp.children); renumber();
      }
    });
    // picking a driver defaults the team to their seat at this round
    rf.addEventListener('change', ev => {
      if (!ev.target.matches('[data-driver]')) return;
      const [roundId] = rf.dataset.results.split('|'); const rd = byId(D().rounds, roundId);
      const t = driverTeamAt(D(), ev.target.value, rd.seasonId, rd.round);
      if (t) ev.target.closest('tr').querySelector('[name=teamId]').value = t;
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
      toast('Result saved — standings updated');
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
  if (rs) rs.addEventListener('click', () => { if (confirm('Replace everything with the sample season?')) { Store.reset(SAMPLE_CAREER); toast('Sample restored'); location.hash = '#/'; } });
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
