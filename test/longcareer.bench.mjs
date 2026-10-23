// node test/longcareer.bench.mjs [years] — plays a long career (F1 + F2) and reports news size and sync time.
import fs from 'node:fs';
import vm from 'node:vm';
const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, URL, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(['store.js', 'selectors.js', 'assets.js', 'components.js', 'matrix.js', 'newsgen.js'].map(src).join('\n')
  + '\nthis.api = { Store, normalizeCareer, clone, mxSetResult, mxSetPole, syncAutoNews, roundsOf, startNextSeason, storedCareer: typeof storedCareer === "function" ? storedCareer : null };', ctx);
const A = ctx.api, years = +process.argv[2] || 20;
const c = A.normalizeCareer(A.clone(JSON.parse(src('sample-data.json')))); A.Store.data = c;
let x = 7; const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
const play = sid => { const ds = [...new Set(c.assignments.filter(a => a.seasonId === sid).map(a => a.driverId))];
  A.roundsOf(c, sid).forEach(rd => { const o = ds.map((d, i) => [d, i * 0.6 + rnd() * 9]).sort((a, b) => a[1] - b[1]).map(z => z[0]);
    o.forEach((d, i) => A.mxSetResult(c, rd.id, 'race', d, i >= o.length - 3 && rnd() < .7 ? 'DNF' : i + 1)); A.mxSetPole(c, rd.id, o[0], true); }); };
let ids = c.seasons.map(s => s.id);
for (let y = 0; y < years; y++) { ids.forEach(play); if (y < years - 1) ids = ids.map(id => A.startNextSeason(c, id).id); }
let t = Date.now(); A.syncAutoNews(c); const first = Date.now() - t;
t = Date.now(); A.syncAutoNews(c); const again = Date.now() - t;
const full = JSON.stringify(c).length, stored = A.storedCareer ? JSON.stringify(A.storedCareer(c)).length : full;
console.log(`${years} years, ${c.rounds.length} rounds, ${c.articles.length} articles`);
console.log(`first sync ${first} ms, re-sync ${again} ms`);
console.log(`career in memory ${(full / 1e6).toFixed(2)} MB, saved to browser ${(stored / 1e6).toFixed(2)} MB`);
