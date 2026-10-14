// node test/selectors.test.mjs — tests the data layer (store.js + selectors.js) without a browser.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const mem = {};
const ctx = { console, localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\n' + src('selectors.js') + '\nthis.api = { Store, normalizeCareer, validateCareer, classify, standings, driverStandings, teamStandings, driverTeamAt, resultFor, lineupAt, nextRound, statsFor, referencesTo, clone };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

const c = A.normalizeCareer(A.clone(sample));

test('sample data is internally consistent', () => assert.deepEqual([...A.validateCareer(c)], []));

test('points follow the season rule incl. fastest-lap bonus', () => {
  const rows = A.classify(c, A.resultFor(c, 'rnd_2030_06', 'race'));
  assert.equal(rows[0].pts, 25 + (rows[0].fastestLap ? 1 : 0));
  const fl = rows.find(r => r.fastestLap);
  const base = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][fl.position - 1] || 0;
  assert.equal(fl.pts, base + (fl.position <= 10 ? 1 : 0));
});

test('non-finishers are NC and score nothing', () => {
  const rows = A.classify(c, A.resultFor(c, 'rnd_2030_08', 'race'));
  rows.filter(r => r.status !== 'FIN').forEach(r => { assert.equal(r.posLabel, 'NC'); assert.equal(r.pts, 0); });
});

test('driver total equals sum of race + sprint points', () => {
  const st = A.driverStandings(c, 'sea_2030');
  const lin = st.find(r => r.id === 'drv_lindqvist');
  let sum = 0;
  c.results.filter(r => r.session !== 'qualifying').forEach(r => A.classify(c, r).forEach(e => { if (e.driverId === 'drv_lindqvist') sum += e.pts; }));
  assert.equal(lin.points, sum);
  assert.equal(st[0].position, 1);
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].points >= st[i].points);
});

test('constructor points stay with the team raced for (transfer)', () => {
  // Okafor raced for Ironbridge R1–5 and Talon from R6
  assert.equal(A.driverTeamAt(c, 'drv_okafor', 'sea_2030', 3), 'team_ironbridge');
  assert.equal(A.driverTeamAt(c, 'drv_okafor', 'sea_2030', 7), 'team_talon');
  const r3 = A.resultFor(c, 'rnd_2030_03', 'race').entries.find(e => e.driverId === 'drv_okafor');
  assert.equal(r3.teamId, 'team_ironbridge');
  const teams = A.teamStandings(c, 'sea_2030');
  const sumFor = tid => { let s = 0; c.results.filter(r => r.session !== 'qualifying').forEach(r => A.classify(c, r).forEach(e => { if (e.teamId === tid) s += e.pts; })); return s; };
  teams.forEach(t => assert.equal(t.points, sumFor(t.id)));
});

test('team totals equal driver totals overall', () => {
  const d = A.driverStandings(c, 'sea_2030').reduce((a, r) => a + r.points, 0);
  const t = A.teamStandings(c, 'sea_2030').reduce((a, r) => a + r.points, 0);
  assert.equal(d, t);
});

test('line-up changes with replacements (Kowalska from R8)', () => {
  assert.deepEqual([...A.lineupAt(c, 'sea_2030', 7).team_kestrel].sort(), ['drv_grant', 'drv_moriyama']);
  assert.deepEqual([...A.lineupAt(c, 'sea_2030', 8).team_kestrel].sort(), ['drv_kowalska', 'drv_moriyama']);
});

test('no hard-coded counts: adding a team, driver and round just works', () => {
  const x = A.normalizeCareer(A.clone(sample));
  x.teams.push({ id: 'team_new', name: 'Newco', color: '#fff', colorDark: '#000' });
  x.drivers.push({ id: 'drv_new', firstName: 'New', lastName: 'Driver', code: 'NEW', nationality: 'SUI' });
  x.assignments.push({ id: 'asg_new', seasonId: 'sea_2030', driverId: 'drv_new', teamId: 'team_new', fromRound: 9, toRound: null, role: 'race' });
  x.rounds.push({ id: 'rnd_x', seasonId: 'sea_2030', round: 13, name: 'Extra', sessions: [], sprint: false });
  x.results.push({ id: 'res_x', roundId: 'rnd_2030_09', session: 'race', entries: [{ driverId: 'drv_new', teamId: 'team_new', status: 'FIN' }] });
  assert.deepEqual([...A.validateCareer(x)], []);
  assert.equal(A.teamStandings(x, 'sea_2030').find(t => t.id === 'team_new').points, 25);
  assert.equal(A.nextRound(x, 'sea_2030').round, 10);
});

test('multiple seasons are independent', () => {
  const x = A.normalizeCareer(A.clone(sample));
  x.seasons.push({ id: 'sea_2031', year: 2031, name: '2031', pointsRuleId: 'pts_classic' });
  x.rounds.push({ id: 'r31', seasonId: 'sea_2031', round: 1, name: 'Bahrain', sessions: [] });
  x.assignments.push({ id: 'a31', seasonId: 'sea_2031', driverId: 'drv_marchetti', teamId: 'team_aurora', fromRound: 1, toRound: null, role: 'race' });
  x.results.push({ id: 'res31', roundId: 'r31', session: 'race', entries: [{ driverId: 'drv_marchetti', teamId: 'team_aurora', status: 'FIN' }] });
  assert.equal(A.driverStandings(x, 'sea_2031')[0].points, 10); // classic rule
  assert.equal(A.driverTeamAt(x, 'drv_marchetti', 'sea_2030', 1), 'team_vantage');
  assert.equal(A.statsFor(x, 'drivers', 'drv_marchetti').races, A.statsFor(x, 'drivers', 'drv_marchetti', 'sea_2030').races + 1);
});

test('delete is refused while referenced; import validation rejects broken refs', () => {
  A.Store.data = A.normalizeCareer(A.clone(sample));
  assert.throws(() => A.Store.remove('teams', 'team_vantage'), /still used/);
  const bad = A.clone(sample); bad.results[0].entries[0].driverId = 'drv_ghost';
  assert.throws(() => A.Store.replace(bad), /unknown drivers id/);
});

test('persistence round-trips through localStorage', () => {
  A.Store.data = A.normalizeCareer(A.clone(sample));
  A.Store.data.meta.careerName = 'Round trip';
  A.Store.save();
  A.Store.data = null; A.Store.load(sample);
  assert.equal(A.Store.data.meta.careerName, 'Round trip');
});

console.log(`\n${pass} tests passed`);
