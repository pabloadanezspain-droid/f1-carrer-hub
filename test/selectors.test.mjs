// node test/selectors.test.mjs — tests the data layer (store.js + selectors.js) without a browser.
// The starter career has no results, so the tests race a few rounds of their own on the real 2026 grid.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const mem = {};
const ctx = { console, localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } } };
vm.createContext(ctx);
vm.runInContext(src('store.js') + '\n' + src('selectors.js') + '\n' + src('matrix.js') + '\nthis.api = { mxSetResult, mxSetPole, mxSetFastestLap, mxCell, mxPoleOf, byId, Store, normalizeCareer, validateCareer, classify, standings, driverStandings, teamStandings, driverTeamAt, resultFor, lineupAt, nextRound, statsFor, referencesTo, clone };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

const SID = 'sea_2026_grid';
const RACED = 5;                                   // rounds with test results
const rid = n => `rnd_2026_${String(n).padStart(2, '0')}`;

// Test fixture on top of the starter career:
//  - Hamilton and Piastri swap seats (Ferrari <-> McLaren) from round 3
//  - Bortoleto is replaced at Audi by a reserve driver from round 4
//  - rounds 1..RACED get race results (plus a sprint where the round has one); the last car is a DNF, P3 sets fastest lap
function career() {
  const c = A.normalizeCareer(A.clone(sample));
  const asg = d => c.assignments.find(a => a.seasonId === SID && a.driverId === d && a.role === 'race');
  const swap = (d, team, from) => { const a = asg(d); a.toRound = from - 1; c.assignments.push({ ...a, id: a.id + '_t', teamId: team, fromRound: from, toRound: null }); };
  swap('drv_lewis_hamilton', 'team_mclaren', 3);
  swap('drv_oscar_piastri', 'team_ferrari', 3);
  c.drivers.push({ id: 'drv_reserve', firstName: 'Test', lastName: 'Reserve', code: 'RES', nationality: 'SUI' });
  swap('drv_gabriel_bortoleto', 'team_audi', 4);
  const b = c.assignments.find(a => a.id.endsWith('_t') && a.driverId === 'drv_gabriel_bortoleto'); b.driverId = 'drv_reserve';

  c.rounds.filter(r => r.seasonId === SID && r.round <= RACED).forEach(rd => {
    const field = Object.entries(A.lineupAt(c, SID, rd.round)).flatMap(([teamId, ids]) => ids.map(driverId => ({ driverId, teamId })));
    const order = field.map((_, i) => field[(i + rd.round * 3) % field.length]);   // a different winner each round
    const entries = (fl) => order.map((e, i) => ({ ...e, status: i === order.length - 1 ? 'DNF' : 'FIN', grid: i + 1, fastestLap: fl && i === 2 }));
    if (rd.sprint) c.results.push({ id: `res_${rd.id}_sprint`, roundId: rd.id, session: 'sprint', entries: entries(false) });
    c.results.push({ id: `res_${rd.id}_race`, roundId: rd.id, session: 'race', entries: entries(true) });
  });
  return c;
}
const c = career();
const racedSessions = () => c.results.filter(r => r.session !== 'qualifying');

test('starter career is internally consistent and holds the real 2026 F1 and F2 grids', () => {
  assert.deepEqual([...A.validateCareer(A.normalizeCareer(A.clone(sample)))], []);
  assert.deepEqual(sample.seasons.map(s => s.id), [SID, 'sea_f2_2026']);
  assert.equal(sample.teams.filter(t => t.series === 'f1').length, 11);
  assert.equal(sample.teams.filter(t => t.series === 'f2').length, 11);
  assert.equal(sample.drivers.length, 44);
  assert.equal(sample.results.length, 0);
});

test('test fixture is internally consistent', () => assert.deepEqual([...A.validateCareer(c)], []));

test('points follow the season rule incl. fastest-lap bonus', () => {
  const rows = A.classify(c, A.resultFor(c, rid(1), 'race'));
  assert.equal(rows[0].pts, 25 + (rows[0].fastestLap ? 1 : 0));
  const fl = rows.find(r => r.fastestLap);
  const base = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][fl.position - 1] || 0;
  assert.equal(fl.pts, base + (fl.position <= 10 ? 1 : 0));
});

test('non-finishers are NC and score nothing', () => {
  const rows = A.classify(c, A.resultFor(c, rid(2), 'race'));
  const out = rows.filter(r => r.status !== 'FIN');
  assert.ok(out.length);
  out.forEach(r => { assert.equal(r.posLabel, 'NC'); assert.equal(r.pts, 0); });
});

test('driver total equals sum of race + sprint points', () => {
  const st = A.driverStandings(c, SID);
  const lead = st[0];
  let sum = 0;
  racedSessions().forEach(r => A.classify(c, r).forEach(e => { if (e.driverId === lead.id) sum += e.pts; }));
  assert.equal(lead.points, sum);
  assert.ok(lead.points > 0);
  assert.equal(st[0].position, 1);
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].points >= st[i].points);
});

test('constructor points stay with the team raced for (transfer)', () => {
  // Hamilton raced for Ferrari R1–2 and McLaren from R3
  assert.equal(A.driverTeamAt(c, 'drv_lewis_hamilton', SID, 2), 'team_ferrari');
  assert.equal(A.driverTeamAt(c, 'drv_lewis_hamilton', SID, 3), 'team_mclaren');
  const r2 = A.resultFor(c, rid(2), 'race').entries.find(e => e.driverId === 'drv_lewis_hamilton');
  assert.equal(r2.teamId, 'team_ferrari');
  const teams = A.teamStandings(c, SID);
  const sumFor = tid => { let s = 0; racedSessions().forEach(r => A.classify(c, r).forEach(e => { if (e.teamId === tid) s += e.pts; })); return s; };
  teams.forEach(t => assert.equal(t.points, sumFor(t.id)));
});

test('team totals equal driver totals overall', () => {
  const d = A.driverStandings(c, SID).reduce((a, r) => a + r.points, 0);
  const t = A.teamStandings(c, SID).reduce((a, r) => a + r.points, 0);
  assert.equal(d, t);
});

test('line-up changes with replacements (reserve at Audi from R4)', () => {
  assert.deepEqual([...A.lineupAt(c, SID, 3).team_audi].sort(), ['drv_gabriel_bortoleto', 'drv_nico_hulkenberg']);
  assert.deepEqual([...A.lineupAt(c, SID, 4).team_audi].sort(), ['drv_nico_hulkenberg', 'drv_reserve']);
});

test('no hard-coded counts: adding a team, driver and round just works', () => {
  const x = career();
  const last = Math.max(...x.rounds.filter(r => r.seasonId === SID).map(r => r.round));
  x.teams.push({ id: 'team_new', name: 'Newco', color: '#fff', colorDark: '#000' });
  x.drivers.push({ id: 'drv_new', firstName: 'New', lastName: 'Driver', code: 'NEW', nationality: 'SUI' });
  x.assignments.push({ id: 'asg_new', seasonId: SID, driverId: 'drv_new', teamId: 'team_new', fromRound: RACED + 1, toRound: null, role: 'race' });
  x.rounds.push({ id: 'rnd_x', seasonId: SID, round: last + 1, name: 'Extra', sessions: [], sprint: false });
  x.results.push({ id: 'res_x', roundId: rid(RACED + 1), session: 'race', entries: [{ driverId: 'drv_new', teamId: 'team_new', status: 'FIN' }] });
  assert.deepEqual([...A.validateCareer(x)], []);
  assert.equal(A.teamStandings(x, SID).find(t => t.id === 'team_new').points, 25);
  assert.equal(A.nextRound(x, SID).round, RACED + 2);
});

test('multiple seasons are independent', () => {
  const x = career();
  x.seasons.push({ id: 'sea_2027', year: 2027, name: '2027', pointsRuleId: 'pts_classic' });
  x.rounds.push({ id: 'r27', seasonId: 'sea_2027', round: 1, name: 'Australia', sessions: [] });
  x.assignments.push({ id: 'a27', seasonId: 'sea_2027', driverId: 'drv_carlos_sainz', teamId: 'team_ferrari', fromRound: 1, toRound: null, role: 'race' });
  x.results.push({ id: 'res27', roundId: 'r27', session: 'race', entries: [{ driverId: 'drv_carlos_sainz', teamId: 'team_ferrari', status: 'FIN' }] });
  assert.equal(A.driverStandings(x, 'sea_2027')[0].points, 10); // classic rule
  assert.equal(A.driverTeamAt(x, 'drv_carlos_sainz', SID, 1), 'team_williams');
  assert.equal(A.statsFor(x, 'drivers', 'drv_carlos_sainz').races, A.statsFor(x, 'drivers', 'drv_carlos_sainz', SID).races + 1);
});

test('delete is refused while referenced; import validation rejects broken refs', () => {
  A.Store.data = career();
  assert.throws(() => A.Store.remove('teams', 'team_williams'), /still used/);
  const bad = career(); bad.results[0].entries[0].driverId = 'drv_ghost';
  assert.throws(() => A.Store.replace(bad), /unknown drivers id/);
});

test('persistence round-trips through localStorage', () => {
  A.Store.data = A.normalizeCareer(A.clone(sample));
  A.Store.data.meta.careerName = 'Round trip';
  A.Store.save();
  A.Store.data = null; A.Store.load(sample);
  assert.equal(A.Store.data.meta.careerName, 'Round trip');
});

test('matrix: typing a position into an empty race keeps the exact place and its points', () => {
  const x = A.normalizeCareer(A.clone(sample)); const R = 'rnd_2026_01';
  A.mxSetResult(x, R, 'race', 'drv_lando_norris', 5);
  const row = A.classify(x, A.resultFor(x, R, 'race'))[0];
  assert.equal(row.position, 5); assert.equal(row.pts, 10);
  assert.equal(A.byId(x.rounds, R).status, 'completed');
  assert.deepEqual([...A.validateCareer(x)], []);
});

test('matrix: a taken place pushes cars down, or swaps when the driver already had a place', () => {
  const x = A.normalizeCareer(A.clone(sample)); const R = 'rnd_2026_01';
  const pos = id => A.mxCell(x, A.byId(x.rounds, R), id).label;
  A.mxSetResult(x, R, 'race', 'drv_lando_norris', 5);
  A.mxSetResult(x, R, 'race', 'drv_oscar_piastri', 6);
  A.mxSetResult(x, R, 'race', 'drv_max_verstappen', 5);         // new driver into P5: Norris 6, Piastri 7
  assert.deepEqual([pos('drv_max_verstappen'), pos('drv_lando_norris'), pos('drv_oscar_piastri')], ['5', '6', '7']);
  A.mxSetResult(x, R, 'race', 'drv_oscar_piastri', 5);          // Piastri had P7: swaps with Verstappen
  assert.deepEqual([pos('drv_oscar_piastri'), pos('drv_lando_norris'), pos('drv_max_verstappen')], ['5', '6', '7']);
  A.mxSetResult(x, R, 'race', 'drv_george_russell', 1);
  assert.equal(A.mxCell(x, A.byId(x.rounds, R), 'drv_george_russell').tone, 'gold');
  assert.equal(A.mxCell(x, A.byId(x.rounds, R), 'drv_max_verstappen').tone, 'green');
});

test('matrix: Ret / DNS / DSQ, colours, clearing and the empty race', () => {
  const x = A.normalizeCareer(A.clone(sample)); const R = 'rnd_2026_02'; const rd = () => A.byId(x.rounds, R);
  A.mxSetResult(x, R, 'race', 'drv_charles_leclerc', 1);
  A.mxSetFastestLap(x, R, 'drv_charles_leclerc', true);
  A.mxSetResult(x, R, 'race', 'drv_charles_leclerc', 'DNF');
  const cell = A.mxCell(x, rd(), 'drv_charles_leclerc');
  assert.equal(cell.label, 'Ret'); assert.equal(cell.tone, 'purple'); assert.equal(cell.fastestLap, false);
  A.mxSetResult(x, R, 'race', 'drv_lewis_hamilton', 'DSQ');
  assert.equal(A.mxCell(x, rd(), 'drv_lewis_hamilton').tone, 'black');
  assert.throws(() => A.mxSetFastestLap(x, R, 'drv_lewis_hamilton', true), /position first/);
  A.mxSetResult(x, R, 'race', 'drv_charles_leclerc', '');
  A.mxSetResult(x, R, 'race', 'drv_lewis_hamilton', '');
  assert.equal(A.resultFor(x, R, 'race'), null);
  assert.equal(rd().status, 'scheduled');
});

test('matrix: pole and fastest lap are unique; sprint points count', () => {
  const x = A.normalizeCareer(A.clone(sample));
  const R = x.rounds.find(r => r.seasonId === SID && r.sprint).id;
  A.mxSetPole(x, R, 'drv_lando_norris', true); A.mxSetPole(x, R, 'drv_oscar_piastri', true);
  assert.equal(A.mxPoleOf(x, R), 'drv_oscar_piastri');
  A.mxSetPole(x, R, 'drv_oscar_piastri', false);
  assert.equal(A.mxPoleOf(x, R), 'drv_lando_norris');
  A.mxSetResult(x, R, 'race', 'drv_lando_norris', 1); A.mxSetResult(x, R, 'race', 'drv_oscar_piastri', 2);
  A.mxSetFastestLap(x, R, 'drv_lando_norris', true); A.mxSetFastestLap(x, R, 'drv_oscar_piastri', true);
  assert.equal(A.resultFor(x, R, 'race').entries.filter(e => e.fastestLap).length, 1);
  A.mxSetResult(x, R, 'sprint', 'drv_lando_norris', 1);
  const st = A.driverStandings(x, SID);
  assert.equal(st.find(r => r.id === 'drv_lando_norris').points, 25 + 8);
  assert.equal(st.find(r => r.id === 'drv_oscar_piastri').points, 18 + 1);
  assert.deepEqual([...A.validateCareer(x)], []);
});

console.log(`\n${pass} tests passed`);
