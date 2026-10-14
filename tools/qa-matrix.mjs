// Renders every driver of a season in every team's suit (automatic drafts) and writes contact sheets:
//   reference/build-shots/qa-matrix-<n>.png   rows = drivers, first column = own real portrait
// Run (after node build.mjs):  node tools/qa-matrix.mjs [seasonId]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openPage } from './cdp.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const season = process.argv[2] && !process.argv[2].includes(':') ? process.argv[2] : 'sea_2026_grid';
const pairs = process.argv.slice(2).find(a => a.includes(':'));   // e.g. drv_franco_colapinto:team_racing_bulls,drv_x:team_y → close-ups
const page = await openPage(pathToFileURL(path.join(root, 'index.html')).href + '#/', { port: 9340, width: 1400, height: 900 });
const closeups = pairs ? await page.evaluate(`(async () => {
  await new Promise(r => setTimeout(r, 800));
  const H = window.CareerHubDebug, c = H.data(), list = ${JSON.stringify(pairs || '')}.split(',').map(x => x.split(':'));
  const FW = 720, TW = 220, TH = 190, PER = 4, cv = document.createElement('canvas'); cv.width = TW * 2 * PER + (PER - 1) * 10; cv.height = (TH + 4) * Math.ceil(list.length / PER);
  const g = cv.getContext('2d'); g.fillStyle = '#1b1b22'; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < list.length; i++) {
    const d = c.drivers.find(x => x.id === list[i][0]), t = c.teams.find(x => x.id === list[i][1]);
    const own = c.teams.find(x => x.id === d.portraitTeamId);
    for (const [j, team, draft] of [[0, own, false], [1, t, true]]) {
      const tile = document.createElement('canvas'); tile.width = FW; tile.height = FW / H.FRAME_ASPECT; const tg = tile.getContext('2d');
      tg.fillStyle = team.color; tg.fillRect(0, 0, tile.width, tile.height);
      if (draft) await H.drawComposite(tg, H.draftComposite(c, d, team), team, 0, 0, FW); else await H.drawPortrait(tg, d, team, 0, 0, FW);
      g.drawImage(tile, 180, 140, 360, 311, (i % PER) * (TW * 2 + 10) + TW * j, (TH + 4) * Math.floor(i / PER), TW, TH);
    }
  }
  return cv.toDataURL('image/png');
})()`) : null;
if (closeups) { fs.writeFileSync(path.join(root, 'reference/build-shots/qa-closeups.png'), Buffer.from(closeups.split(',')[1], 'base64')); console.log('closeups written'); page.close(); process.exit(0); }
const sheets = await page.evaluate(`(async () => {
  await new Promise(r => setTimeout(r, 800));
  const H = window.CareerHubDebug, c = H.data();
  const lu = H.lineupAt(c, ${JSON.stringify(season)}, 1);
  const teams = Object.keys(lu).map(id => c.teams.find(t => t.id === id));
  const rows = teams.flatMap(t => lu[t.id].map(did => [c.drivers.find(d => d.id === did), t]));
  const TW = 150, TH = 170, FW = 300;                // tile size; frame drawn 300 wide then the neck area cropped
  const perSheet = 6, out = [];
  for (let s0 = 0; s0 < rows.length; s0 += perSheet) {
    const part = rows.slice(s0, s0 + perSheet);
    const cv = document.createElement('canvas'); cv.width = TW * (teams.length + 1); cv.height = (TH + 16) * part.length + 20;
    const g = cv.getContext('2d'); g.fillStyle = '#1b1b22'; g.fillRect(0, 0, cv.width, cv.height); g.font = '11px sans-serif'; g.fillStyle = '#ccc';
    teams.forEach((t, j) => g.fillText(t.name, TW * (j + 1) + 4, 13));
    g.fillText('own', 4, 13);
    for (let i = 0; i < part.length; i++) {
      const [d, own] = part[i], y = 20 + i * (TH + 16);
      g.fillStyle = '#fff'; g.fillText(d.lastName + ' (' + own.name + ')', 4, y + 11);
      const cols = [own, ...teams];
      for (let j = 0; j < cols.length; j++) {
        const t = cols[j]; if (j > 0 && t.id === own.id) continue;
        const tile = document.createElement('canvas'); tile.width = FW; tile.height = FW / H.FRAME_ASPECT;
        const tg = tile.getContext('2d');
        try {
          if (j === 0) await H.drawPortrait(tg, d, t, 0, 0, FW);
          else { const comp = H.draftComposite(c, d, t); await H.drawComposite(tg, comp, t, 0, 0, FW); }
        } catch (e) { tg.fillStyle = 'red'; tg.fillRect(0, 0, FW, 40); }
        g.fillStyle = t.color; g.fillRect(TW * j, y + 14, TW - 2, TH);
        g.drawImage(tile, FW * .18, FW * .08, FW * .64, FW * .64 * TH / TW, TW * j, y + 14, TW - 2, TH);
      }
    }
    out.push(cv.toDataURL('image/png'));
  }
  return out;
})()`);
page.close();
sheets.forEach((u, i) => fs.writeFileSync(path.join(root, `reference/build-shots/qa-matrix-${i + 1}.png`), Buffer.from(u.split(',')[1], 'base64')));
console.log(sheets.length, 'sheets written');
