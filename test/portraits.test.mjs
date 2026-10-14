// node test/portraits.test.mjs — portrait resolution, transfers and composite versioning (no browser).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const ctx = { console, URL, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(`const PORTRAIT_FIT = ${fs.readFileSync(new URL('../tools/portrait-fit.json', import.meta.url), 'utf8')};\n`
  + ['store.js', 'selectors.js', 'assets.js', 'assetstore.js', 'neckfit.js', 'portraits.js'].map(src).join('\n')
  + '\nthis.api = { Store, AssetStore, normalizeCareer, validateCareer, clone, resolvePortrait, lineupAt, approvedComposite, referencesTo, newId };', ctx);
const A = ctx.api;
const sample = JSON.parse(src('sample-data.json'));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

const fresh = () => { const c = A.normalizeCareer(A.clone(sample)); A.Store.data = c; return c; };
const by = (c, coll, id) => c[coll].find(r => r.id === id);

// a 2027 season copying the 2026 grid, with Hamilton moved to McLaren (and Piastri to Ferrari)
function with2027(c) {
  c.seasons.push({ id: 'sea_2027', year: 2027, name: '2027', pointsRuleId: 'pts_standard' });
  c.rounds.push({ id: 'r27_1', seasonId: 'sea_2027', round: 1, name: 'Australia', sessions: [] });
  c.assignments.filter(a => a.seasonId === 'sea_2026_grid').forEach(a => {
    let teamId = a.teamId;
    if (a.driverId === 'drv_lewis_hamilton') teamId = 'team_mclaren';
    if (a.driverId === 'drv_oscar_piastri') teamId = 'team_ferrari';
    c.assignments.push({ ...a, id: a.id + '_27', seasonId: 'sea_2027', teamId });
  });
  return c;
}

test('real driver in his own team shows his real portrait', () => {
  const c = fresh();
  const r = A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_ferrari'));
  assert.equal(r.kind, 'photo');
  assert.equal(r.url, 'assets/f1com/drivers/lewis-hamilton.webp');
});

test('after a transfer the driver is shown in the NEW team suit (auto draft), identity = his own face', () => {
  const c = with2027(fresh());
  const r = A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_mclaren'));
  assert.equal(r.kind, 'draft');
  assert.equal(r.comp.face.url, 'assets/f1com/drivers/lewis-hamilton.webp');
  assert.match(r.comp.suit.url, /lando-norris|oscar-piastri/);          // body from a McLaren portrait
  assert.equal(r.comp.params.mode, 'fit');                                   // neck-fitted composite
  assert.equal(r.comp.params.fx, 0); assert.equal(r.comp.params.fs, 1);      // his head keeps its own framing
  assert.ok(Math.abs(r.comp.params.sx) < 5 && Math.abs(r.comp.params.sy) < 3); // suit moved to his collar
});

test('older season keeps the old pairing; new season shows the new one', () => {
  const c = with2027(fresh());
  assert.ok(A.lineupAt(c, 'sea_2026_grid', 1).team_ferrari.includes('drv_lewis_hamilton'));
  assert.ok(A.lineupAt(c, 'sea_2027', 1).team_mclaren.includes('drv_lewis_hamilton'));
  assert.ok(!A.lineupAt(c, 'sea_2027', 1).team_ferrari.includes('drv_lewis_hamilton'));
  // the Ferrari portrait is untouched and still used for Ferrari contexts
  assert.equal(A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_ferrari')).kind, 'photo');
});

test('approving creates a version; re-approving supersedes it but keeps history', () => {
  const c = with2027(fresh());
  const mk = v => ({ id: 'cmp_' + v, driverId: 'drv_lewis_hamilton', teamId: 'team_mclaren', version: v, face: { type: 'url', url: 'assets/f1com/drivers/lewis-hamilton.webp' },
    faceSrc: 'portrait', suit: { type: 'url', url: 'assets/f1com/drivers/lando-norris.webp' }, params: { fx: v }, status: 'approved' });
  c.composites.push(mk(1));
  assert.equal(A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_mclaren')).kind, 'approved');
  c.composites[0].status = 'superseded'; c.composites.push(mk(2));
  const r = A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_mclaren'));
  assert.equal(r.comp.version, 2);
  assert.equal(c.composites.length, 2);
  assert.deepEqual([...A.validateCareer(c)], []);
});

test('an approved composite whose uploaded file is missing falls back cleanly', () => {
  const c = with2027(fresh());
  c.assets.push({ id: 'ast_x', kind: 'headshot', name: 'face.png', driverId: 'drv_lewis_hamilton' });
  c.composites.push({ id: 'cmp_x', driverId: 'drv_lewis_hamilton', teamId: 'team_mclaren', version: 1, face: { type: 'asset', id: 'ast_x' }, faceSrc: 'headshot',
    suit: { type: 'placeholder' }, params: {}, status: 'approved' });
  const r = A.resolvePortrait(c, by(c, 'drivers', 'drv_lewis_hamilton'), by(c, 'teams', 'team_mclaren'));
  assert.equal(r.kind, 'draft');                    // AssetStore has no blob → not used
});

test('uploaded originals referenced by a composite cannot be deleted', () => {
  const c = fresh();
  c.assets.push({ id: 'ast_y', kind: 'suit', name: 'suit.png', teamId: 'team_mclaren' });
  c.composites.push({ id: 'cmp_y', driverId: 'drv_lewis_hamilton', teamId: 'team_mclaren', version: 1, face: { type: 'url', url: 'x' }, suit: { type: 'asset', id: 'ast_y' }, params: {}, status: 'superseded' });
  assert.ok(A.referencesTo(c, 'assets', 'ast_y').length);
  assert.throws(() => A.Store.remove('assets', 'ast_y'), /still used/);
});

test('driver without any photo gets the clean placeholder in the right team colours', () => {
  const c = fresh();
  const r = A.resolvePortrait(c, by(c, 'drivers', 'drv_marchetti'), by(c, 'teams', 'team_vantage'));
  assert.equal(r.kind, 'placeholder');
  assert.match(decodeURIComponent(r.url), /#2b6be0/);
});

test('every library portrait has a neck/collar analysis with derived masks', () => {
  const fits = JSON.parse(fs.readFileSync(new URL('../tools/portrait-fit.json', import.meta.url), 'utf8'));
  const c = fresh();
  c.drivers.filter(d => d.portraitUrl).forEach(d => {
    const f = fits[d.portraitUrl]; assert.ok(f && f.ok, 'missing fit for ' + d.portraitUrl);
    ['headMask', 'bodyMask', 'faceExt'].forEach(k => assert.ok(fs.existsSync(new URL('../' + f[k], import.meta.url)), k + ' file for ' + d.id));
    assert.ok(f.ct > 0.25 && f.ct < 0.5 && f.nw > 0.08 && f.nw < 0.3, 'implausible neck for ' + d.id);
  });
});

test('all driver × team pairs of the real grid produce a neck-fitted draft', () => {
  const c = fresh(); let n = 0;
  const lu = A.lineupAt(c, 'sea_2026_grid', 1);
  Object.entries(lu).forEach(([own, ids]) => ids.forEach(did => Object.keys(lu).filter(t => t !== own).forEach(t => {
    const r = A.resolvePortrait(c, by(c, 'drivers', did), by(c, 'teams', t));
    assert.equal(r.kind, 'draft'); assert.equal(r.comp.params.mode, 'fit'); n++;
  })));
  assert.equal(n, 220);
});

console.log(`\n${pass} tests passed`);
