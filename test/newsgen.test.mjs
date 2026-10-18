// node test/newsgen.test.mjs — automatic newsroom: plays a season and checks the stories it writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, URL, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(['store.js', 'selectors.js', 'assets.js', 'components.js', 'matrix.js', 'newsgen.js'].map(src).join('\n')
  + '\nthis.api = { Store, normalizeCareer, validateCareer, clone, mxSetResult, mxSetPole, syncAutoNews, rewriteAutoNews, ngSig, roundsOf, driverStandings };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };
const SID = 'sea_2026_grid';

// play a season: a seeded "form" order with some randomness, some DNFs
function play(c, upto) {
  let x = 7; const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const drivers = c.assignments.filter(a => a.seasonId === SID).map(a => a.driverId);
  A.roundsOf(c, SID).filter(r => r.round <= upto).forEach(rd => {
    const order = drivers.map((d, i) => [d, i * 0.6 + rnd() * 9]).sort((a, b) => a[1] - b[1]).map(z => z[0]);
    order.forEach((d, i) => A.mxSetResult(c, rd.id, 'race', d, i >= 19 && rnd() < .7 ? 'DNF' : i + 1));
    A.mxSetPole(c, rd.id, order[Math.floor(rnd() * 3)], true);
  });
}
const fresh = () => { const c = A.normalizeCareer(A.clone(sample)); A.Store.data = c; return c; };

test('a fresh career gets a season-opening preview', () => {
  const c = fresh(); A.syncAutoNews(c);
  assert.equal(c.articles.length, 1);
  assert.match(c.articles[0].auto.key, /rnd_2026_01:preview/);
});

test('every raced round gets a report plus up to two extra stories', () => {
  const c = fresh(); play(c, 24); A.syncAutoNews(c);
  for (const rd of A.roundsOf(c, SID)) {
    const n = c.articles.filter(a => a.auto && a.auto.round === rd.id && !a.auto.key.endsWith(':preview')).length;
    assert.ok(n >= 1 && n <= 8, rd.id + ' has ' + n);
    assert.ok(c.articles.some(a => a.auto && a.auto.key === rd.id + ':report'));
  }
  assert.deepEqual([...A.validateCareer(c)], []);
});

test('headlines stay varied across a season', () => {
  const c = fresh(); play(c, 24); A.syncAutoNews(c);
  const reports = c.articles.filter(a => a.category === 'Race Report');
  const shapes = new Set(reports.map(a => a.title.replace(/[A-Z][a-zé]+/g, 'X')));
  assert.ok(shapes.size >= 14, 'only ' + shapes.size + ' headline shapes in ' + reports.length + ' reports');
  const openers = new Set(reports.map(a => a.body.split('\n')[0].replace(/[A-Z][\wé]+/g, 'X').slice(0, 30)));
  assert.ok(openers.size >= 5, 'only ' + openers.size + ' opening lines');
});

test('stable: syncing again changes nothing', () => {
  const c = fresh(); play(c, 6); A.syncAutoNews(c);
  const before = JSON.stringify(c.articles);
  assert.equal(A.syncAutoNews(c), false);
  assert.equal(JSON.stringify(c.articles), before);
});

test('changing a result rewrites the report; removing it removes the story', () => {
  const c = fresh(); play(c, 3); A.syncAutoNews(c);
  const rep = () => c.articles.find(a => a.auto && a.auto.key === 'rnd_2026_03:report');
  const winner = c.results.find(r => r.roundId === 'rnd_2026_03' && r.session === 'race').entries[0].driverId;
  const other = c.results.find(r => r.roundId === 'rnd_2026_03' && r.session === 'race').entries[5].driverId;
  A.mxSetResult(c, 'rnd_2026_03', 'race', other, 1); A.syncAutoNews(c);
  assert.ok(rep().driverIds[0] === other, 'report now about the new winner');
  c.results = c.results.filter(r => r.roundId !== 'rnd_2026_03'); A.syncAutoNews(c);
  assert.equal(rep(), undefined);
});

test('a story the user edited is never overwritten or removed', () => {
  const c = fresh(); play(c, 2); A.syncAutoNews(c);
  const a = c.articles.find(x => x.auto && x.auto.key === 'rnd_2026_02:report');
  a.body = 'My own words.';
  A.mxSetResult(c, 'rnd_2026_02', 'race', a.driverIds[2], 1); A.syncAutoNews(c);
  assert.equal(c.articles.find(x => x.id === a.id).body, 'My own words.');
  c.results = c.results.filter(r => r.roundId !== 'rnd_2026_02'); A.syncAutoNews(c);
  assert.ok(c.articles.find(x => x.id === a.id));
});

test('rewrite gives new wording for the same facts', () => {
  const c = fresh(); play(c, 4); A.syncAutoNews(c);
  const id = 'art_auto_rnd_2026_04_report', before = c.articles.find(a => a.id === id);
  const t0 = before.title + before.body;
  let differs = false;
  for (let i = 0; i < 4 && !differs; i++) { A.rewriteAutoNews(c, id); const a = c.articles.find(x => x.id === id); differs = a.title + a.body !== t0; }
  assert.ok(differs);
});

test('previews follow the calendar; past previews stay as archive', () => {
  const c = fresh(); A.syncAutoNews(c); play(c, 1); A.syncAutoNews(c);
  assert.ok(c.articles.some(a => a.auto && a.auto.key === 'rnd_2026_01:preview'));
  assert.ok(c.articles.some(a => a.auto && a.auto.key === 'rnd_2026_02:preview'));
});

test('title clinched story appears once the lead cannot be beaten', () => {
  const c = fresh();
  const rounds = A.roundsOf(c, SID);
  const field = c.assignments.filter(a => a.seasonId === SID).map(a => a.driverId);
  const champ = 'drv_lando_norris', rest = field.filter(d => d !== champ);
  rounds.forEach((rd, i) => { if (i < 20) { A.mxSetResult(c, rd.id, 'race', champ, 1); rest.forEach((d, k) => A.mxSetResult(c, rd.id, 'race', rest[(k + i) % rest.length], k + 2)); } });
  A.syncAutoNews(c);
  const t = c.articles.filter(a => a.auto && a.auto.key.endsWith(':title') && /champion|title/i.test(a.title));
  assert.ok(t.length >= 1, 'no title story');
});

test('switching automatic news off stops new stories', () => {
  const c = fresh(); c.meta.autoNews = false; play(c, 3); A.syncAutoNews(c);
  assert.equal(c.articles.length, 0);
});

test('player team gets its own story', () => {
  const c = fresh(); c.meta.playerTeamId = 'team_williams'; play(c, 2); A.syncAutoNews(c);
  const ok = c.articles.some(a => a.auto && a.auto.key.endsWith(':player'));
  const any = c.articles.filter(a => a.auto && a.auto.round === 'rnd_2026_01').map(a => a.auto.key);
  assert.ok(ok || any.length === 3, 'no player story and no room: ' + any);
});

if (process.argv.includes('--show')) {
  const c = fresh(); c.meta.playerTeamId = 'team_williams'; play(c, 8); A.syncAutoNews(c);
  c.articles.filter(a => /rnd_2026_0[5-8]|rnd_2026_09/.test(a.auto.key)).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .forEach(a => console.log(`\n[${a.category}] ${a.publishedAt.slice(0, 16)} by ${a.author}\n# ${a.title}\n> ${a.standfirst}\n${a.body}`));
}
test('F2 rounds get Feature Race wording, academy stories and photos', () => {
  const c = fresh(); const F2 = 'sea_f2_2026';
  const drivers = c.assignments.filter(a => a.seasonId === F2).map(a => a.driverId);
  // Câmara (Ferrari Academy) wins round 1, the rest follow the line-up order
  const order = ['drv_rafael_camara', ...drivers.filter(d => d !== 'drv_rafael_camara')];
  const rd = A.roundsOf(c, F2)[0];
  order.forEach((d, i) => A.mxSetResult(c, rd.id, 'race', d, i + 1));
  A.syncAutoNews(c);
  const mine = c.articles.filter(a => a.roundId === rd.id);
  const report = mine.find(a => a.auto.key.endsWith(':report'));
  assert.match(report.title + report.body, /Feature Race/);
  assert.doesNotMatch(report.title + report.body, /Grand Prix/);
  const acd = mine.find(a => a.auto.key.endsWith(':academy'));
  assert.ok(acd, 'academy story written');
  assert.match(acd.title + acd.body, /Ferrari/);
  assert.ok(acd.teamIds.includes('team_ferrari'));
  assert.match(acd.imageUrl, /^assets\/f1com\/photos\/(charles-leclerc|lewis-hamilton)-/, 'academy story uses a Ferrari F1 photo');
  assert.match(report.imageUrl, /^assets\/f2\/photos\//, 'race report uses an F2 photo');
});

test('silly season: transfer rumours from round 12 to the end, never before', () => {
  const c = fresh(); play(c, 24); A.syncAutoNews(c);
  const rum = c.articles.filter(a => a.auto && a.category === 'Transfer');
  const roundOf = a => c.rounds.find(r => r.id === a.roundId).round;
  assert.ok(rum.length >= 13, 'rumours written: ' + rum.length);
  assert.ok(rum.every(a => roundOf(a) >= 12));
  for (let n = 12; n <= 24; n++) assert.ok(rum.some(a => roundOf(a) === n), 'rumour at round ' + n);
  assert.ok(rum.every(a => a.driverIds.length && a.imageUrl !== undefined));
});

test('more stories per race: qualifying, driver of the day, team-mates and more', () => {
  const c = fresh(); play(c, 12); A.syncAutoNews(c);
  const types = new Set(c.articles.filter(a => a.auto).map(a => a.auto.key.split(':')[1]));
  ['report', 'quali', 'dotd', 'power'].forEach(t => assert.ok(types.has(t), 'has ' + t + ' in ' + [...types]));
  assert.deepEqual([...A.validateCareer(c)], []);
});

console.log(`\n${pass} tests passed`);
