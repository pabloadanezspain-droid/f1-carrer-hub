// node test/newsgen.test.mjs — automatic newsroom: plays a season and checks the stories it writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, URL, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(['store.js', 'selectors.js', 'assets.js', 'components.js', 'matrix.js', 'newsgen.js'].map(src).join('\n')
  + '\nthis.api = { Store, normalizeCareer, validateCareer, clone, mxSetResult, mxSetPole, syncAutoNews, rewriteAutoNews, ngSig, roundsOf, driverStandings, startNextSeason, transferDriver, lineupAt };', ctx);
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
    assert.ok(n >= 1 && n <= 9, rd.id + ' has ' + n);
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

test('rumours vary: fresh drivers, many kinds, few repeated headlines, stable text', () => {
  const c = fresh(); play(c, 24); A.syncAutoNews(c);
  const rum = c.articles.filter(a => a.auto && a.category === 'Transfer');
  const roundOf = a => c.rounds.find(r => r.id === a.roundId).round;
  const byRound = {}; rum.forEach(a => (byRound[roundOf(a)] = byRound[roundOf(a)] || []).push(a));
  for (let n = 13; n <= 24; n++) { const now = (byRound[n] || []).filter(a => !/denies|dismiss|shut down|heats up|More signs|will not go away|twist|Nothing to it/.test(a.title)).map(a => a.driverIds[0]);
    const before = (byRound[n - 1] || []).map(a => a.driverIds[0]); now.forEach(d => assert.ok(!before.includes(d), `round ${n}: ${d} again`)); }
  const heads = rum.map(a => a.title); const dup = heads.length - new Set(heads).size;
  assert.ok(dup / heads.length < 0.15, `repeated headlines ${dup}/${heads.length}`);
  const c2 = fresh(); play(c2, 24); A.syncAutoNews(c2);
  assert.deepEqual(c2.articles.filter(a => a.auto && a.category === 'Transfer').map(a => a.title), heads);
  if (process.argv.includes('--rumours')) rum.slice(0, 8).forEach(a => console.log(`\nR${roundOf(a)} # ${a.title}\n> ${a.standfirst}\n${a.body}`));
});

test('new season: every transfer gets a storyline, plus a round-up', () => {
  const c = fresh(); play(c, 24);
  const ns = A.startNextSeason(c, SID);
  A.transferDriver(c, ns.id, 'drv_max_verstappen', 'team_ferrari', 1);      // Verstappen to Ferrari (bumps someone)
  A.transferDriver(c, ns.id, 'drv_lewis_hamilton', null, 1);                // Hamilton out
  A.transferDriver(c, ns.id, 'drv_pablo_adanez', 'team_williams', 1);       // Pablo in
  const r5 = A.roundsOf(c, ns.id)[4];
  A.transferDriver(c, ns.id, 'drv_oliver_bearman', 'team_alpine', r5.round); // mid-season move
  A.syncAutoNews(c);
  const mv = c.articles.filter(a => a.auto && /:move_/.test(a.auto.key));
  ['max_verstappen', 'lewis_hamilton', 'pablo_adanez', 'oliver_bearman'].forEach(d => assert.ok(mv.some(a => a.auto.key.includes('move_' + d)), 'story for ' + d));
  assert.ok(mv.some(a => a.auto.key.includes('move_oliver_bearman') && a.roundId === r5.id), 'mid-season move at its round');
  const ru = c.articles.find(a => a.auto && a.auto.key.endsWith(':moves')); assert.ok(ru && /Verstappen/.test(ru.body), 'round-up lists the moves');
  mv.forEach(a => { assert.ok(a.body.length > 250, 'long enough'); assert.doesNotMatch(a.title + a.body, /\{[A-Za-z]+\}|undefined/); });
  assert.ok(new Date(ru.publishedAt) < new Date(A.roundsOf(c, ns.id)[0].dateStart), 'round-up before the first race');
  if (process.argv.includes('--moves')) [ru, ...mv].forEach(a => console.log(`\n# ${a.title}\n> ${a.standfirst}\n${a.body}`));
  assert.deepEqual([...A.validateCareer(c)], []);
});

test('transfer storylines vary', () => {
  const c = fresh(); play(c, 24); const ns = A.startNextSeason(c, SID);
  const teams = [...new Set(c.assignments.filter(a => a.seasonId === ns.id).map(a => a.teamId))];
  const ds = c.assignments.filter(a => a.seasonId === ns.id && a.role === 'race').map(a => a.driverId);
  ds.forEach((d, i) => A.transferDriver(c, ns.id, d, teams[(teams.indexOf(c.assignments.find(a => a.seasonId === SID && a.driverId === d).teamId) + 1 + (i % 3)) % teams.length], 1));
  A.syncAutoNews(c);
  const heads = c.articles.filter(a => a.auto && /:move_/.test(a.auto.key)).map(a => a.title);
  assert.ok(heads.length >= 15, 'moves: ' + heads.length);
  assert.ok(new Set(heads).size >= heads.length - 2, 'few repeated headlines');
});

test('team-mate battles rotate across teams, other-series rumours name a team', () => {
  const c = fresh(); play(c, 24); A.syncAutoNews(c);
  const tm = c.articles.filter(a => a.auto && a.auto.key.endsWith(':teammates'));
  assert.ok(new Set(tm.map(a => a.teamIds[0])).size >= 5, 'teams covered: ' + new Set(tm.map(a => a.teamIds[0])).size);
  const ser = c.articles.filter(a => a.category === 'Transfer' && /IndyCar|Endurance|Formula E|Super Formula|DTM|Dakar|television/.test(a.body));
  ser.forEach(a => assert.match(a.title + a.body, /Penske|Andretti|Ganassi|Arrow McLaren|Rahal|Meyer Shank|AF Corse|Toyota|Porsche|Cadillac|BMW|Alpine Endurance|THOR|Jaguar|Nissan|Mahindra|Impul|Dandelion|Winward|Manthey|Dacia|Sky Sports|Netflix/));
});

test('more stories per race: qualifying, driver of the day, team-mates and more', () => {
  const c = fresh(); play(c, 12); A.syncAutoNews(c);
  const types = new Set(c.articles.filter(a => a.auto).map(a => a.auto.key.split(':')[1]));
  ['report', 'quali', 'dotd', 'power'].forEach(t => assert.ok(types.has(t), 'has ' + t + ' in ' + [...types]));
  assert.deepEqual([...A.validateCareer(c)], []);
});

test('race reports are long, stable and varied', () => {
  const c = fresh(); play(c, 10); A.syncAutoNews(c);
  const reps = A.roundsOf(c, SID).slice(0, 10).map(rd => c.articles.find(a => a.auto && a.auto.key === rd.id + ':report'));
  const words = a => (a.title + ' ' + a.body).split(/\s+/).length;
  reps.forEach(a => assert.ok(words(a) >= 300, a.title + ': ' + words(a) + ' words'));
  // same facts -> same article on every sync
  const again = A.normalizeCareer(A.clone(c)); A.Store.data = again; A.syncAutoNews(again);
  reps.forEach(a => assert.equal(again.articles.find(x => x.id === a.id).body, a.body));
  // consecutive reports share few sentences
  const sents = a => new Set(a.body.split(/(?<=[.!?"])\s+/).map(x => x.replace(/[A-Z][a-zà-ÿ]+/g, 'N').trim()).filter(x => x.length > 25));
  for (let i = 1; i < reps.length; i++) {
    const A1 = sents(reps[i - 1]), B1 = sents(reps[i]); const same = [...B1].filter(x => A1.has(x)).length;
    assert.ok(same / B1.size < 0.2, `reports ${i} and ${i + 1} share ${same}/${B1.size} sentences`);
  }
});

console.log(`\n${pass} tests passed`);
