/* ==========================================================================
   store.js — career data model, persistence, import/export.
   Pure data: no DOM access at load time (loaded by node tests too).
   See DATA_MODEL.md for the schema.
   ========================================================================== */

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'f1ch.career.v1';
const COLLECTIONS = ['seasons', 'pointsRules', 'teams', 'drivers', 'assignments', 'rounds', 'results', 'articles', 'assets', 'composites'];
const ID_PREFIX = {
  seasons: 'sea', pointsRules: 'pts', teams: 'team', drivers: 'drv',
  assignments: 'asg', rounds: 'rnd', results: 'res', articles: 'art',
  assets: 'ast', composites: 'cmp',
};
const ASSET_KINDS = ['headshot', 'suit', 'portrait', 'derived'];
const RESULT_STATUSES = ['FIN', 'DNF', 'DNS', 'DSQ'];
const SESSION_TYPES = ['race', 'sprint', 'qualifying'];
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
  const c = { schemaVersion: SCHEMA_VERSION, meta: { careerName: 'My Career', isSample: false, activeSeasonId: null, playerTeamId: null, updatedAt: null } };
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
      try { this.data = normalizeCareer(JSON.parse(raw)); this.dropOldSampleNews(); return; }
      catch (e) { console.warn('Saved career unreadable, loading sample', e); }
    }
    this.data = normalizeCareer(clone(sample));
  },
  save() {
    this.data.meta.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); this.storageOk = true; }
    catch (e) { this.storageOk = false; console.warn('localStorage unavailable', e); }
    this.listeners.forEach(fn => fn());
  },
  onChange(fn) { this.listeners.push(fn); },
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
