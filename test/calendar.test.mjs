// node test/calendar.test.mjs — restoring the original 2026 calendar never changes a result.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const mem = {};
const ctx = { console, localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; }, key: i => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\n' + src('selectors.js') + '\n' + src('matrix.js') + '\nthis.api = { normalizeCareer, validateCareer, clone, restoreOriginalCalendar, originalCalendarPlan, startNextSeason, nextSeasonOf, allTimeStats, seatsAt, completedRounds, mxSetResult, mxSetPole, driverStandings, roundsOf, Store };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
const SID = 'sea_2026_grid';
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

// A save from the post-war calendar: 22 rounds, Bahrain in October, no Saudi Arabia (ids rnd_2026_01..22 in that order).
const POSTWAR = ['Australia', 'China', 'Japan', 'Miami', 'Canada', 'Monaco', 'Barcelona-Catalunya', 'Austria', 'Great Britain', 'Belgium', 'Hungary',
  'Netherlands', 'Italy', 'Spain', 'Azerbaijan', 'Bahrain', 'Singapore', 'United States', 'Mexico', 'Brazil', 'Las Vegas', 'Abu Dhabi'];
function oldSave() {
  const c = A.normalizeCareer(A.clone(sample)); A.Store.data = c;
  const keep = c.rounds.filter(r => r.seasonId !== SID);
  const f1 = POSTWAR.map((name, i) => {
    const t = c.rounds.find(r => r.seasonId === SID && r.name === name);
    return Object.assign(A.clone(t), { id: `rnd_2026_${String(i + 1).padStart(2, '0')}`, round: i + 1, dateEnd: name === 'Bahrain' ? '2026-10-04' : t.dateEnd });
  });
  c.rounds = [...keep, ...f1];
  c.results = []; c.articles = [];
  // results for the first five races and a pole at Miami
  const ds = c.assignments.filter(a => a.seasonId === SID).map(a => a.driverId);
  for (let n = 1; n <= 5; n++) ds.forEach((d, i) => A.mxSetResult(c, `rnd_2026_0${n}`, 'race', d, ((i + n) % ds.length) + 1));
  A.mxSetPole(c, 'rnd_2026_04', ds[3], true);
  // a transfer from round 5 (Canada in the old numbering)
  const a = c.assignments.find(x => x.seasonId === SID && x.driverId === 'drv_lewis_hamilton'); a.toRound = 4;
  c.assignments.push(Object.assign(A.clone(a), { id: 'asg_x', teamId: 'team_mclaren', fromRound: 5, toRound: null }));
  return c;
}

test('restoring changes no result, pole or standing', () => {
  const c = oldSave();
  const before = JSON.stringify(c.results), table = JSON.stringify(A.driverStandings(c, SID).map(r => [r.id, r.points]));
  assert.equal(A.restoreOriginalCalendar(c, sample), true);
  assert.equal(JSON.stringify(c.results), before);
  assert.equal(JSON.stringify(A.driverStandings(c, SID).map(r => [r.id, r.points])), table);
  assert.equal(A.validateCareer(c).length, 0);
});

test('races keep their results and move to their original round numbers', () => {
  const c = oldSave(); A.restoreOriginalCalendar(c, sample);
  const r = id => c.rounds.find(x => x.id === id);
  assert.equal(r('rnd_2026_04').name, 'Miami'); assert.equal(r('rnd_2026_04').round, 6);    // Miami: R4 -> R6, results still on it
  assert.equal(c.results.filter(x => x.roundId === 'rnd_2026_04').length, 2);
  const bah = r('rnd_2026_16'); assert.equal(bah.name, 'Bahrain'); assert.equal(bah.round, 4); assert.equal(bah.dateEnd, '2026-04-12');
  const sau = c.rounds.find(x => x.seasonId === SID && x.name === 'Saudi Arabia'); assert.equal(sau.round, 5);
  assert.equal(A.roundsOf(c, SID).length, 24);
  assert.deepEqual(A.roundsOf(c, SID).map(x => x.round), Array.from({ length: 24 }, (_, i) => i + 1));
});

test('a transfer still starts at the same race', () => {
  const c = oldSave(); A.restoreOriginalCalendar(c, sample);
  const t = c.assignments.find(x => x.id === 'asg_x'); assert.equal(t.fromRound, 7);   // Canada is R7 now
  const old = c.assignments.find(x => x.seasonId === SID && x.driverId === 'drv_lewis_hamilton' && x.id !== 'asg_x'); assert.equal(old.toRound, 6);
});

test('running it twice does nothing the second time', () => {
  const c = oldSave(); A.restoreOriginalCalendar(c, sample);
  const snap = JSON.stringify(c);
  assert.equal(A.restoreOriginalCalendar(c, sample), false);
  assert.equal(JSON.stringify(c), snap);
});

test('continuing to 2027 keeps every 2026 result and copies line-ups and calendar', () => {
  const c = oldSave(); A.restoreOriginalCalendar(c, sample);
  const before = JSON.stringify(c.results), arts = c.articles.length;
  const ns = A.startNextSeason(c, SID);
  assert.equal(ns.year, 2027); assert.equal(ns.series, 'f1');
  assert.equal(JSON.stringify(c.results), before);                       // nothing raced is touched
  assert.equal(A.roundsOf(c, ns.id).length, 24);
  const r1 = A.roundsOf(c, ns.id)[0]; assert.equal(r1.dateEnd, '2027-03-07'); assert.equal(r1.status, 'scheduled');   // a Sunday again
  assert.equal(new Date(r1.dateEnd + 'T12:00:00Z').getUTCDay(), 0);
  assert.ok(A.seatsAt(c, ns.id, 1).team_mclaren.race.includes('drv_lewis_hamilton'));   // seat as at the last race
  assert.equal(c.meta.activeSeasonId, ns.id);
  assert.equal(A.startNextSeason(c, SID).id, ns.id);                     // asking twice does not make a second 2027
  assert.equal(A.validateCareer(c).length, 0);
  assert.equal(c.articles.length, arts);
});

test('all-time stats add up seasons of one series', () => {
  const c = oldSave();
  const ns = A.startNextSeason(c, SID);
  const ds = c.assignments.filter(a => a.seasonId === ns.id).map(a => a.driverId);
  ds.forEach((d, i) => A.mxSetResult(c, A.roundsOf(c, ns.id)[0].id, 'race', d, i + 1));
  const t = A.allTimeStats(c, 'f1', 'drivers');
  const win = t.find(r => r.id === ds[0]);
  assert.equal(win.seasons, 2);
  assert.ok(win.wins >= 1);
  assert.ok(!t.some(r => r.id === 'drv_rafael_camara'), 'F2 drivers are not in the F1 table');
});

test('an existing save is moved to the original calendar on load, results unchanged', () => {
  const old = oldSave();
  const content = r => JSON.stringify(r.map(x => [x.id, x.roundId, x.session, x.entries.map(e => [e.driverId, e.teamId, e.status, e.pos, e.grid, e.laps, e.time, e.fastestLap, e.points])]));
  const before = content(old.results);
  mem['f1ch.career.v1'] = JSON.stringify(old);
  A.Store.load(sample);
  const c = A.Store.data;
  assert.equal(content(c.results), before);
  assert.equal(A.roundsOf(c, SID).length, 24);
  assert.equal(c.rounds.find(r => r.id === 'rnd_2026_04').name, 'Miami');
  assert.equal(content(JSON.parse(mem['f1ch.career.v1']).results), before);       // saved, still identical
  assert.ok(Object.keys(mem).some(k => k.startsWith('f1ch.backup.')), 'backup kept');
  const snap = mem['f1ch.career.v1']; A.Store.load(sample);
  assert.equal(content(A.Store.data.results), before);                                // second load: nothing more happens
  assert.equal(A.roundsOf(A.Store.data, SID).length, 24);
});

// The same old save, but its 2026 season has another id and the first (skipped) upgrade already marked it done.
function customIdSave() {
  const c = oldSave(), NEW = 'sea_mine_2026';
  c.seasons.find(x => x.id === SID).id = NEW;
  [c.rounds, c.assignments, c.articles].forEach(list => list.forEach(r => { if (r.seasonId === SID) r.seasonId = NEW; }));
  if (c.meta.activeSeasonId === SID) c.meta.activeSeasonId = NEW;
  c.meta.calendarV2 = true;
  return { c, NEW };
}
const content = r => JSON.stringify(r.map(x => [x.id, x.roundId, x.session, x.entries.map(e => [e.driverId, e.teamId, e.status, e.pos, e.grid, e.laps, e.time, e.fastestLap, e.points])]));

test('a 2026 season with another id is fixed too, results unchanged', () => {
  const { c, NEW } = customIdSave(); const before = content(c.results);
  assert.equal(A.restoreOriginalCalendar(c, sample), true);
  assert.equal(content(c.results), before);
  const rs = A.roundsOf(c, NEW);
  assert.deepEqual(rs.slice(0, 6).map(r => r.name), ['Australia', 'China', 'Japan', 'Bahrain', 'Saudi Arabia', 'Miami']);
  assert.ok(rs.every(r => r.seasonId === NEW));
  assert.equal(A.validateCareer(c).length, 0);
});

test('a career the first upgrade skipped is fixed on the next load', () => {
  const { c, NEW } = customIdSave(); const before = content(c.results);
  Object.keys(mem).forEach(k => delete mem[k]);
  mem['f1ch.career.v1'] = JSON.stringify(c);
  A.Store.load(sample);
  assert.equal(content(A.Store.data.results), before);
  assert.equal(A.roundsOf(A.Store.data, NEW)[3].name, 'Bahrain');
  assert.equal(content(JSON.parse(mem['f1ch.career.v1']).results), before);
  assert.ok(Object.keys(mem).some(k => k.startsWith('f1ch.backup.')));
});

console.log(`\n${pass} passed`);
