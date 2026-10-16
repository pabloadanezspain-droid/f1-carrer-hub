/* ==========================================================================
   store.js — career data model, persistence, import/export.
   Pure data: no DOM access at load time (loaded by node tests too).
   See DATA_MODEL.md for the schema.
   ========================================================================== */

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'f1ch.career.v1';
const COLLECTIONS = ['seasons', 'pointsRules', 'teams', 'drivers', 'assignments', 'rounds', 'results', 'articles', 'assets', 'composites', 'academies'];
const ID_PREFIX = {
  seasons: 'sea', pointsRules: 'pts', teams: 'team', drivers: 'drv',
  assignments: 'asg', rounds: 'rnd', results: 'res', articles: 'art',
  assets: 'ast', composites: 'cmp', academies: 'acd',
};
const SERIES = ['f1', 'f2'];
const CAREER_MODES = ['f1', 'f2', 'both'];
const F2_POINTS_RULE = { id: 'pts_f2', name: 'FIA Formula 2', race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [10, 8, 6, 5, 4, 3, 2, 1], fastestLap: { points: 1, maxPosition: 10 }, fastestLapSprint: true, pole: 2, f2v2: true };
const ASSET_KINDS = ['headshot', 'suit', 'portrait', 'derived'];
const RESULT_STATUSES = ['FIN', 'DNF', 'DNS', 'DSQ'];
// race2 = a second feature race in the same round (F2 Baku 2026)
const SESSION_TYPES = ['race', 'sprint', 'qualifying', 'race2'];
const ARTICLE_CATEGORIES = ['News', 'Race Report', 'Feature', 'Analysis', 'Interview', 'Transfer'];

function newId(collection) {
  const p = ID_PREFIX[collection] || 'rec';
  return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function emptyCareer() {
  const c = { schemaVersion: SCHEMA_VERSION, meta: { careerName: 'My Career', isSample: false, activeSeasonId: null, playerTeamId: null, mode: 'f1', updatedAt: null } };
  COLLECTIONS.forEach(k => { c[k] = []; });
  return c;
}

/* --- normalisation / migration ------------------------------------------ */
function normalizeCareer(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a career object');
  const c = emptyCareer();
  c.schemaVersion = SCHEMA_VERSION;
  c.meta = Object.assign(c.meta, raw.meta || {});
  COLLECTIONS.forEach(k => {
    if (raw[k] != null && !Array.isArray(raw[k])) throw new Error(`"${k}" must be an array`);
    c[k] = (raw[k] || []).map(r => Object.assign({}, r));
  });
  // Fill defaults that older/handwritten files may omit.
  c.results.forEach(r => { r.entries = (r.entries || []).map(e => Object.assign({ status: 'FIN', grid: null, laps: null, time: '', fastestLap: false, points: null }, e)); });
  c.rounds.forEach(r => { r.sessions = r.sessions || []; r.status = r.status || 'scheduled'; r.sprint = !!r.sprint; });
  c.articles.forEach(a => { a.driverIds = a.driverIds || []; a.teamIds = a.teamIds || []; a.body = a.body || ''; });
  c.drivers.forEach(d => { d.portraits = d.portraits || []; d.photoUrls = d.photoUrls || []; });
  // Series: saves made before F2 support are all F1.
  if (!CAREER_MODES.includes(c.meta.mode)) c.meta.mode = 'f1';
  c.seasons.forEach(s => { if (!SERIES.includes(s.series)) s.series = 'f1'; });
  c.teams.forEach(t => { if (!SERIES.includes(t.series)) t.series = 'f1'; });
  c.academies.forEach(a => { a.driverIds = a.driverIds || []; a.fromSeasonId = a.fromSeasonId || null; a.toSeasonId = a.toSeasonId || null; });
  if (c.seasons.some(s => s.series === 'f2') && !c.pointsRules.some(r => r.id === F2_POINTS_RULE.id)) c.pointsRules.push(clone(F2_POINTS_RULE));
  // the first F2 release missed pole points and the sprint fastest-lap point
  c.pointsRules.forEach(r => { if (r.id === F2_POINTS_RULE.id && !r.f2v2) { r.pole = 2; r.fastestLapSprint = true; r.f2v2 = true; } });
  c.composites.forEach(x => { x.status = x.status || 'approved'; x.params = x.params || {}; x.version = x.version || 1; });
  // Library portraits are photos in a specific team's suit: infer that team for saves made before portraitTeamId existed.
  c.drivers.forEach(d => {
    if (d.portraitUrl && !d.portraitTeamId && /^assets\/f1com\//.test(d.portraitUrl)) {
      const a = c.assignments.filter(x => x.driverId === d.id).sort((x, y) => x.fromRound - y.fromRound)[0];
      if (a) d.portraitTeamId = a.teamId;
    }
  });
  c.assignments.forEach(a => { a.fromRound = Number(a.fromRound) || 1; a.toRound = a.toRound == null || a.toRound === '' ? null : Number(a.toRound); a.role = a.role || 'race'; });
  if (!c.meta.activeSeasonId && c.seasons.length) c.meta.activeSeasonId = [...c.seasons].sort((a, b) => b.year - a.year)[0].id;
  return c;
}

/* Copies the starter F2 season (and everything it needs) into a career that has none. Runs once per career. */
function addStarterF2(c, sample) {
  // the first F2 release had the wrong session days and cities: refresh starter F2 rounds once (dates, sessions, cities only)
  let fixed = false;
  if (!c.meta.f2CalV2) {
    c.meta.f2CalV2 = true; fixed = true;
    const src = sample.rounds || [];
    c.rounds.forEach(r => { const n = src.find(x => x.id === r.id); if (n && /^rnd_f2_/.test(r.id)) Object.assign(r, { city: n.city, dateStart: n.dateStart, dateEnd: n.dateEnd, sessions: clone(n.sessions) }); });
  }
  // drivers added to the starter career later (e.g. your own driver) join existing saves once, as free agents
  { const art = c.teams.find(t => t.id === 'team_f2_art'); if (art && art.suitDriverId === undefined) { art.suitDriverId = 'drv_tasanapol_inthraphuvasak'; fixed = true; } }
  c.meta.addedDrivers = c.meta.addedDrivers || [];
  (sample.drivers || []).filter(d => /^drv_pablo_/.test(d.id) && !c.meta.addedDrivers.includes(d.id)).forEach(d => {
    c.meta.addedDrivers.push(d.id); fixed = true;
    if (!c.drivers.some(x => x.id === d.id)) c.drivers.push(clone(d));
  });
  if (c.meta.f2Added || c.seasons.some(s => s.series === 'f2')) return fixed;
  c.meta.f2Added = true;
  const src = normalizeCareer(clone(sample));
  const f2 = new Set(src.seasons.filter(s => s.series === 'f2').map(s => s.id));
  if (!f2.size) return true;
  const add = (k, list) => { const have = new Set(c[k].map(r => r.id)); list.forEach(r => { if (!have.has(r.id)) c[k].push(clone(r)); }); };
  const asg = src.assignments.filter(a => f2.has(a.seasonId));
  const teamIds = new Set(asg.map(a => a.teamId)), drvIds = new Set(asg.map(a => a.driverId));
  add('seasons', src.seasons.filter(s => f2.has(s.id)));
  add('pointsRules', src.pointsRules.filter(r => src.seasons.some(s => f2.has(s.id) && s.pointsRuleId === r.id)));
  add('teams', src.teams.filter(t => teamIds.has(t.id)));
  add('drivers', src.drivers.filter(d => drvIds.has(d.id)));
  add('assignments', asg);
  add('rounds', src.rounds.filter(r => f2.has(r.seasonId)));
  const teams = new Set(c.teams.map(t => t.id));
  add('academies', src.academies.filter(a => teams.has(a.f1TeamId)));
  if (c.meta.mode !== 'f2') c.meta.mode = 'both';
  return true;
}

/* Returns a list of human-readable integrity problems (empty = OK). */
function validateCareer(c) {
  const errs = [];
  const ids = {};
  COLLECTIONS.forEach(k => {
    ids[k] = new Set();
    c[k].forEach((r, i) => {
      if (!r.id) errs.push(`${k}[${i}] has no id`);
      else if (ids[k].has(r.id)) errs.push(`${k}: duplicate id ${r.id}`);
      else ids[k].add(r.id);
    });
  });
  const need = (coll, id, where) => { if (id && !ids[coll].has(id)) errs.push(`${where} → unknown ${coll} id "${id}"`); };
  c.seasons.forEach(s => need('pointsRules', s.pointsRuleId, `season ${s.id}`));
  c.assignments.forEach(a => { need('seasons', a.seasonId, `assignment ${a.id}`); need('drivers', a.driverId, `assignment ${a.id}`); need('teams', a.teamId, `assignment ${a.id}`); });
  c.academies.forEach(a => { need('teams', a.f1TeamId, `academy ${a.id}`); a.driverIds.forEach(id => need('drivers', id, `academy ${a.id}`)); });
  c.rounds.forEach(r => need('seasons', r.seasonId, `round ${r.id}`));
  c.results.forEach(r => {
    need('rounds', r.roundId, `result ${r.id}`);
    if (!SESSION_TYPES.includes(r.session)) errs.push(`result ${r.id}: bad session "${r.session}"`);
    r.entries.forEach((e, i) => { need('drivers', e.driverId, `result ${r.id} #${i + 1}`); need('teams', e.teamId, `result ${r.id} #${i + 1}`); });
  });
  c.articles.forEach(a => { need('seasons', a.seasonId, `article ${a.id}`); if (a.roundId) need('rounds', a.roundId, `article ${a.id}`); });
  c.assets.forEach(a => { if (!ASSET_KINDS.includes(a.kind)) errs.push(`asset ${a.id}: bad kind "${a.kind}"`); need('drivers', a.driverId, `asset ${a.id}`); need('teams', a.teamId, `asset ${a.id}`); });
  c.composites.forEach(x => {
    need('drivers', x.driverId, `composite ${x.id}`); need('teams', x.teamId, `composite ${x.id}`);
    [x.face, x.suit].forEach(r => { if (r && r.type === 'asset') need('assets', r.id, `composite ${x.id}`); });
  });
  return errs;
}

/* --- persistence ---------------------------------------------------------- */
const Store = {
  data: null,
  listeners: [],
  storageOk: true,

  load(sample) {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { this.storageOk = false; }
    if (raw) {
      try { this.data = normalizeCareer(JSON.parse(raw)); this.dropOldSampleNews(); this.addStarterF2(sample); this.syncNewsQuietly(); return; }
      catch (e) { console.warn('Saved career unreadable, loading sample', e); }
    }
    this.data = normalizeCareer(clone(sample));
    if (typeof syncAutoNews === 'function') syncAutoNews(this.data);
  },
  save() {
    if (typeof syncAutoNews === 'function') syncAutoNews(this.data);   // keep auto-written news in step with results
    this.data.meta.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); this.storageOk = true; }
    catch (e) { this.storageOk = false; console.warn('localStorage unavailable', e); }
    this.listeners.forEach(fn => fn());
  },
  onChange(fn) { this.listeners.push(fn); },
  syncNewsQuietly() {
    if (typeof syncAutoNews === 'function' && syncAutoNews(this.data)) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {} }
  },
  // one-time upgrade: saves made before F2 support get the starter F2 grid, academies and the F1 / F2 switch
  addStarterF2(sample) {
    if (!addStarterF2(this.data, sample)) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  // one-time cleanup: news stories from the old fictional 2030 sample career
  dropOldSampleNews() {
    const old = new Set(['art_season_preview', 'art_r1_report', 'art_r2_report', 'art_r3_report', 'art_transfer_swap', 'art_r6_report', 'art_grant_injury', 'art_r8_report', 'art_vantage_analysis']);
    const n = this.data.articles.length;
    this.data.articles = this.data.articles.filter(a => !old.has(a.id));
    if (this.data.articles.length !== n) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {} }
  },
  reset(sample) { this.data = normalizeCareer(clone(sample)); this.save(); },
  replace(raw) {
    const c = normalizeCareer(raw);
    const errs = validateCareer(c);
    if (errs.length) throw new Error('Import rejected:\n' + errs.slice(0, 12).join('\n'));
    this.data = c; this.save();
  },
  exportJSON() { return JSON.stringify(this.data, null, 2); },

  /* generic CRUD — keeps ids stable */
  get(coll, id) { return this.data[coll].find(r => r.id === id) || null; },
  upsert(coll, rec) {
    if (!rec.id) rec.id = newId(coll);
    const i = this.data[coll].findIndex(r => r.id === rec.id);
    if (i >= 0) this.data[coll][i] = rec; else this.data[coll].push(rec);
    this.save();
    return rec;
  },
  /* Removes a record. Refuses when other records still reference it. */
  remove(coll, id) {
    const refs = referencesTo(this.data, coll, id);
    if (refs.length) throw new Error(`Cannot delete — still used by ${refs.length} record(s): ${refs.slice(0, 4).join(', ')}`);
    this.data[coll] = this.data[coll].filter(r => r.id !== id);
    if (coll === 'seasons' && this.data.meta.activeSeasonId === id) this.data.meta.activeSeasonId = this.data.seasons[0]?.id || null;
    this.save();
  },
};

function referencesTo(c, coll, id) {
  const out = [];
  if (coll === 'pointsRules') c.seasons.forEach(s => s.pointsRuleId === id && out.push('season ' + s.name));
  if (coll === 'seasons') {
    c.rounds.forEach(r => r.seasonId === id && out.push('round ' + r.name));
    c.assignments.forEach(a => a.seasonId === id && out.push('assignment ' + a.id));
    c.articles.forEach(a => a.seasonId === id && out.push('article ' + a.title));
  }
  if (coll === 'rounds') {
    c.results.forEach(r => r.roundId === id && out.push('result ' + r.session));
    c.articles.forEach(a => a.roundId === id && out.push('article ' + a.title));
  }
  if (coll === 'drivers' || coll === 'teams') {
    const key = coll === 'drivers' ? 'driverId' : 'teamId';
    c.assignments.forEach(a => a[key] === id && out.push('assignment ' + a.id));
    c.results.forEach(r => r.entries.some(e => e[key] === id) && out.push('result ' + r.id));
    if (coll === 'teams' && c.meta.playerTeamId === id) out.push('career meta (player team)');
    c.composites.forEach(x => x[key] === id && out.push('portrait composite v' + x.version));
    c.assets.forEach(a => a[key] === id && out.push('uploaded image ' + a.name));
  }
  if (coll === 'assets') c.composites.forEach(x => [x.face, x.suit].some(r => r && r.type === 'asset' && r.id === id) && out.push(`composite v${x.version} (${x.status})`));
  return out;
}
