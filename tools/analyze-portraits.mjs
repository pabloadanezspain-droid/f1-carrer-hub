// Analyses every library portrait (assets/f1com/drivers/*.webp, plus any extra folders given as args)
// with src/neckfit.js in headless Chrome and writes:
//   assets/f1com/masks/<name>-head.png, -body.png, -face.webp  (derived files; originals untouched)
//   tools/portrait-fit.json                          (neck/collar measurements, keyed by image path)
//   reference/build-shots/neckfit-debug.png           (contact sheet: detected collar line / neck top)
// Run: node tools/analyze-portraits.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openPage } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['assets/f1com/drivers', ...process.argv.slice(2)];
const paths = dirs.flatMap(d => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).filter(f => /\.(webp|png|jpe?g)$/i.test(f) && !/-number\./.test(f)).map(f => `${d}/${f}`) : []);
const maskDir = path.join(root, 'assets/f1com/masks'); fs.mkdirSync(maskDir, { recursive: true });

const page = await openPage(pathToFileURL(path.join(root, 'tools/analyze.html')).href);
const res = await page.evaluate(`analyzeAll(${JSON.stringify(paths)})`);
page.close();

const fitJson = {}, debug = [];
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
for (const [p, r] of Object.entries(res)) {
  if (!r.fit) { console.log('FAILED', p, r.reason); continue; }
  const base = path.basename(p).replace(/\.\w+$/, '');
  save(path.join(maskDir, base + '-head.png'), r.head); save(path.join(maskDir, base + '-body.png'), r.body); save(path.join(maskDir, base + '-face.webp'), r.faceExt);
  fitJson[p] = Object.assign(r.fit, { headMask: `assets/f1com/masks/${base}-head.png`, bodyMask: `assets/f1com/masks/${base}-body.png`, faceExt: `assets/f1com/masks/${base}-face.webp` });
  debug.push([base, r.debug]);
}
fs.writeFileSync(path.join(root, 'tools/portrait-fit.json'), JSON.stringify(fitJson, null, 1));
// contact sheet of the debug overlays (built in the browser again to avoid image libraries)
const sheet = await openPage(pathToFileURL(path.join(root, 'tools/analyze.html')).href, { port: 9335 });
const png = await sheet.evaluate(`(async () => {
  const items = ${JSON.stringify(debug)};
  const ims = await Promise.all(items.map(([n, u]) => new Promise(r => { const i = new Image(); i.onload = () => r([n, i]); i.src = u; })));
  const cols = 6, w = ims[0][1].width, h = ims[0][1].height + 18, c = document.createElement('canvas');
  c.width = cols * w; c.height = Math.ceil(ims.length / cols) * h; const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height); g.font = '13px sans-serif';
  ims.forEach(([n, i], k) => { const x = (k % cols) * w, y = Math.floor(k / cols) * h; g.drawImage(i, x, y + 18); g.fillStyle = '#fff'; g.fillText(n, x + 4, y + 13); });
  return c.toDataURL('image/png');
})()`);
sheet.close();
save(path.join(root, 'reference/build-shots/neckfit-debug.png'), png);
console.log(Object.keys(fitJson).length, 'portraits analysed;', Object.keys(res).length - Object.keys(fitJson).length, 'failed');
