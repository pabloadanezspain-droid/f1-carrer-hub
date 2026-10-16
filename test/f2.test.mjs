// node test/f2.test.mjs — F2 series support in the data model: migration, academies, F2 points rule.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\n' + src('selectors.js') + '\n' + src('matrix.js') + '\nthis.api = { normalizeCareer, validateCareer, clone, F2_POINTS_RULE, addStarterF2, mxSetResult, mxSetPole, mxSetFastestLap, driverStandings, roundsOf, sessionKeyOf, sessionName, roundSessionKeys, Store, transferDriver, freeAgents, seatsAt };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

// A save from before F2 support: only the F1 season and teams, no series fields.
const oldSave = () => {
  const raw = A.clone(sample); delete raw.meta.mode; delete raw.academies;
  raw.seasons = raw.seasons.filter(s => s.series !== 'f2'); raw.teams = raw.teams.filter(t => t.series !== 'f2');
  const f2Drivers = new Set(raw.assignments.filter(a => a.seasonId === 'sea_f2_2026').map(a => a.driverId));
  raw.drivers = raw.drivers.filter(d => !f2Drivers.has(d.id)); raw.assignments = raw.assignments.filter(a => a.seasonId !== 'sea_f2_2026');
  raw.rounds = raw.rounds.filter(r => r.seasonId !== 'sea_f2_2026'); raw.pointsRules = raw.pointsRules.filter(r => r.id !== 'pts_f2');
  raw.seasons.forEach(s => delete s.series); raw.teams.forEach(t => delete t.series);
  return raw;
};

test('old saves migrate to F1-only', () => {
  const c = A.normalizeCareer(oldSave());
  assert.equal(c.meta.mode, 'f1');
  assert.ok(c.seasons.every(s => s.series === 'f1'));
  assert.ok(c.teams.every(t => t.series === 'f1'));
  assert.equal(c.academies.length, 0);
  assert.equal(A.validateCareer(c).length, 0);
});

test('an F2 season adds the F2 points rule once', () => {
  const raw = oldSave();
  raw.seasons.push({ id: 'sea_f2_2026', year: 2026, name: 'F2 2026', series: 'f2', pointsRuleId: 'pts_f2' });
  const c = A.normalizeCareer(raw);
  assert.equal(c.pointsRules.filter(r => r.id === 'pts_f2').length, 1);
  assert.deepEqual([...c.pointsRules.find(r => r.id === 'pts_f2').sprint], [10, 8, 6, 5, 4, 3, 2, 1]);
  assert.equal(A.validateCareer(A.normalizeCareer(c)).length, 0);
});

test('academies validate their team and drivers', () => {
  const raw = A.clone(sample);
  raw.academies = [{ id: 'acd_x', f1TeamId: 'team_nope', driverIds: ['drv_nope'] }];
  const errs = A.validateCareer(A.normalizeCareer(raw));
  assert.equal(errs.length, 2);
});

test('starter career has the F2 grid, its academies and the F2 rule', () => {
  const c = A.normalizeCareer(A.clone(sample));
  assert.equal(c.meta.mode, 'both');
  assert.equal(c.academies.find(a => a.f1TeamId === 'team_ferrari').driverIds.length, 2);
  assert.equal(c.pointsRules.filter(r => r.id === 'pts_f2').length, 1);
  assert.equal(c.rounds.filter(r => r.seasonId === 'sea_f2_2026').length, 14);
});

test('an old save gets the starter F2 grid once, keeping its own data', () => {
  const c = A.normalizeCareer(oldSave()); c.meta.careerName = 'Mine';
  assert.equal(A.addStarterF2(c, sample), true);
  assert.equal(c.meta.mode, 'both');
  assert.equal(c.meta.careerName, 'Mine');
  assert.equal(c.seasons.filter(s => s.series === 'f2').length, 1);
  assert.equal(c.teams.filter(t => t.series === 'f2').length, 11);
  assert.equal(c.academies.length, 6);
  assert.equal(A.validateCareer(c).length, 0);
  assert.equal(A.addStarterF2(c, sample), false);
});

test('F2 points: feature 25, sprint 10, pole 2, fastest lap 1 in both races', () => {
  const c = A.normalizeCareer(A.clone(sample)); A.Store.data = c;
  const F2 = 'sea_f2_2026'; const rd = A.roundsOf(c, F2)[0];
  const ds = c.assignments.filter(a => a.seasonId === F2).map(a => a.driverId);
  ds.forEach((d, i) => A.mxSetResult(c, rd.id, 'race', d, i + 1));
  ds.forEach((d, i) => A.mxSetResult(c, rd.id, 'sprint', d, i + 1));
  A.mxSetPole(c, rd.id, ds[0], true);
  A.mxSetFastestLap(c, rd.id, ds[1], true);
  const sp = c.results.find(r => r.roundId === rd.id && r.session === 'sprint'); sp.entries.find(e => e.driverId === ds[2]).fastestLap = true;
  const pts = id => A.driverStandings(c, F2).find(r => r.id === id).points;
  assert.equal(pts(ds[0]), 25 + 10 + 2);          // feature win + sprint win + pole
  assert.equal(pts(ds[1]), 18 + 8 + 1);           // + feature fastest lap
  assert.equal(pts(ds[2]), 15 + 6 + 1);           // + sprint fastest lap
});

test('Baku has a second feature race that scores like the first', () => {
  const c = A.normalizeCareer(A.clone(sample)); A.Store.data = c;
  const baku = c.rounds.find(r => r.seasonId === 'sea_f2_2026' && r.city === 'Baku');
  assert.deepEqual([...A.roundSessionKeys(c, baku)], ['qualifying', 'sprint', 'race', 'race2']);
  assert.equal(A.sessionName(c, baku, 'race'), 'Feature Race 1');
  assert.equal(A.sessionKeyOf('Feature Race 2'), 'race2');
  assert.equal(A.sessionKeyOf('Sprint Race'), 'sprint');
  const d = c.assignments.find(a => a.seasonId === 'sea_f2_2026').driverId;
  A.mxSetResult(c, baku.id, 'race2', d, 1);
  assert.equal(A.driverStandings(c, 'sea_f2_2026').find(r => r.id === d).points, 25);
  assert.equal(A.validateCareer(c).length, 0);
});

test('line-up board moves: transfer, release to free agency, F2 junior listed for promotion', () => {
  const c = A.normalizeCareer(A.clone(sample)); const F1 = 'sea_2026_grid';
  A.transferDriver(c, F1, 'drv_lewis_hamilton', null, 5);              // released from round 5
  assert.equal(A.seatsAt(c, F1, 4).team_ferrari.race.includes('drv_lewis_hamilton'), true);
  assert.equal(A.seatsAt(c, F1, 5).team_ferrari.race.includes('drv_lewis_hamilton'), false);
  assert.ok(A.freeAgents(c, F1, 5).free.some(d => d.id === 'drv_lewis_hamilton'));
  assert.ok(A.freeAgents(c, F1, 5).other.some(d => d.id === 'drv_rafael_camara'), 'F2 drivers offered for promotion');
  A.transferDriver(c, F1, 'drv_rafael_camara', 'team_ferrari', 5, 'race');  // promote the junior
  assert.deepEqual([...A.seatsAt(c, F1, 5).team_ferrari.race].sort(), ['drv_charles_leclerc', 'drv_rafael_camara']);
  A.transferDriver(c, F1, 'drv_lewis_hamilton', 'team_ferrari', 8, 'reserve');
  assert.deepEqual([...A.seatsAt(c, F1, 8).team_ferrari.reserve], ['drv_lewis_hamilton']);
  assert.equal(A.validateCareer(c).length, 0);
});

console.log(`\n${pass} passed`);
