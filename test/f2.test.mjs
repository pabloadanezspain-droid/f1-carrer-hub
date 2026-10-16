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

test('old saves migrate to F1-only', () => {
  const c = A.normalizeCareer(A.clone(sample));
  assert.equal(c.meta.mode, 'f1');
  assert.ok(c.seasons.every(s => s.series === 'f1'));
  assert.ok(c.teams.every(t => t.series === 'f1'));
  assert.equal(c.academies.length, 0);
  assert.equal(A.validateCareer(c).length, 0);
});

test('an F2 season adds the F2 points rule once', () => {
  const raw = A.clone(sample);
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

console.log(`\n${pass} passed`);
