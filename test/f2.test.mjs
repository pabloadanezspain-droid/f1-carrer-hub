// node test/f2.test.mjs — F2 series support in the data model: migration, academies, F2 points rule.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\nthis.api = { normalizeCareer, validateCareer, clone, F2_POINTS_RULE };', ctx);
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

console.log(`\n${pass} passed`);
