// node test/quickorder.test.mjs — typed order for the results editor (matchOrder in selectors.js)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\n' + src('selectors.js') + '\nthis.matchOrder = matchOrder;', ctx);
const all = JSON.parse(src('sample-data.json'));
const f1 = new Set(all.assignments.filter(a => !String(a.seasonId).includes('f2')).map(a => a.driverId));
const drivers = all.drivers.filter(d => f1.has(d.id));   // the editor only matches drivers in the table, so one series
const name = id => drivers.find(d => d.id === id).lastName;
const run = t => { const r = ctx.matchOrder(t, drivers); return { names: [...r.ids].map(name), notes: r.notes }; };
let pass = 0; const test = (n, fn) => { fn(); pass++; console.log('ok -', n); };

test('car numbers', () => assert.deepEqual(run('1 16 44').names, ['Norris', 'Leclerc', 'Hamilton']));
test('codes and full names, any case', () => assert.deepEqual(run('VER nor, Leclerc').names, ['Verstappen', 'Norris', 'Leclerc']));
test('partial names and accents', () => assert.deepEqual(run('verst hulk perez').names, ['Verstappen', 'Hülkenberg', 'Pérez']));
test('unknown word is skipped', () => { const r = run('ver xyzq nor'); assert.deepEqual(r.names, ['Verstappen', 'Norris']); assert.equal(r.notes[1].kind, 'none'); });
test('unclear word is skipped, not guessed', () => { const r = run('l'); assert.equal(r.names.length, 0); assert.equal(r.notes[0].kind, 'many'); });
test('same driver twice counts once', () => { const r = run('nor NOR 1'); assert.deepEqual(r.names, ['Norris']); assert.equal(r.notes[1].kind, 'twice'); });
test('new lines work too', () => assert.deepEqual(run('rus\nant\n').names, ['Russell', 'Antonelli']));
console.log(`\n${pass} quick order tests passed`);
