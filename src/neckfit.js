/* ==========================================================================
   neckfit.js — portrait analysis for face × suit compositing.
   One implementation, two runtimes:
     • offline for the library portraits (tools/analyze-portraits.mjs, headless Chrome)
     • live in the browser for uploads (uploaded blobs are not canvas-tainted)

   analyzeFit(image) measures, in units of the image WIDTH (u = px / width, both axes):
     cx  neck centre x      nw  neck / collar-opening width     fw  face width
     ct  collar tips (where the collar meets the neck sides)    cd  collar depth (lowest skin point)
     contour  [[x, y, isNeck]…] the collar line across the neck
   and produces three derived images (canvases; originals are never modified):
     head     alpha mask: head, hair and the driver's own neck (everything above the collar line)
     body     alpha mask: the suit below the collar line, with all skin removed
     faceExt  the driver's head + neck, with the neck EXTENDED downwards/outwards from his own
              neck skin, so it can fill any other suit's collar opening
   ========================================================================== */

const NECKFIT_VERSION = 2;

function median(a) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[s.length >> 1]; }

function analyzeFit(img, opts) {
  opts = opts || {};
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const W = Math.min(opts.width || 720, iw), H = Math.round(W * ih / iw), k = W / 360;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cv = mk(), g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const src = g.getImageData(0, 0, W, H), px = src.data;
  const N = W * H, Yv = new Float32Array(N), Cb = new Float32Array(N), Cr = new Float32Array(N), A = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
    Yv[i] = 0.299 * r + 0.587 * gg + 0.114 * b; Cb[i] = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b; Cr[i] = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b; A[i] = px[i * 4 + 3];
  }
  let transparent = 0; for (let i = 0; i < N; i += 4) if (A[i] < 20) transparent++;
  const cutout = transparent / (N / 4) > 0.08;
  if (!cutout) return { ok: false, reason: 'needs a cut-out image (transparent background)', cutout };

  // 0. silhouette: top row and shoulders (first row much wider than the head) — the face is above them
  const rowW = new Float32Array(H); let y0 = -1;
  for (let y = 0; y < H; y++) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (A[y * W + x] > 128) { if (l < 0) l = x; r = x; } rowW[y] = l < 0 ? 0 : r - l + 1; if (l >= 0 && y0 < 0) y0 = y; }
  if (y0 < 0) return { ok: false, reason: 'empty image', cutout };
  let headRef = 1; for (let y = y0; y < Math.min(H, y0 + W * .25); y++) headRef = Math.max(headRef, rowW[y]);
  let shoulderY = H - 1;
  for (let y = y0 + Math.round(headRef * .6); y < H; y++) if (rowW[y] > headRef * 1.8) { shoulderY = y; break; }
  shoulderY = Math.min(shoulderY, y0 + Math.round(headRef * 2.6));
  const yLimit = Math.min(H, shoulderY + 2);

  // 1. broad skin → biggest connected blob above the shoulders = face (+ neck)
  const broad = new Uint8Array(N);
  for (let i = 0; i < W * yLimit; i++) {
    if (A[i] < 160) continue;
    if (Cr[i] > 133 && Cr[i] < 182 && Cb[i] > 78 && Cb[i] < 135 && Yv[i] > 35 && Cr[i] - Cb[i] > 12) broad[i] = 1;
  }
  const lab = new Int32Array(N); const stack = []; let best = 0, bestN = 0, nextL = 0;
  const nb = [1, -1, W, -W];
  for (let i = 0; i < W * yLimit; i++) {
    if (!broad[i] || lab[i]) continue;
    nextL++; let n = 0; stack.push(i); lab[i] = nextL;
    while (stack.length) {
      const q = stack.pop(); n++; const x = q % W;
      for (const d of nb) { const q2 = q + d; if (q2 < 0 || q2 >= W * yLimit || (d === 1 && x === W - 1) || (d === -1 && x === 0)) continue; if (broad[q2] && !lab[q2]) { lab[q2] = nextL; stack.push(q2); } }
    }
    if (n > bestN) { bestN = n; best = nextL; }
  }
  if (bestN < 600 * k * k) return { ok: false, reason: 'no face found', cutout };
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0, sx = 0, cnt = 0;
  for (let i = 0; i < W * yLimit; i++) if (lab[i] === best) { const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; sx += x; cnt++; }
  const faceW = bx1 - bx0 + 1, faceH = by1 - by0 + 1, fcx = sx / cnt;

  // 2. this driver's skin model (robust median/MAD of chroma on cheeks/nose)
  const cbs = [], crs = [], rr = [], gs = [], bs = [];
  for (let y = Math.round(by0 + faceH * .28); y < by0 + faceH * .62; y++) for (let x = Math.round(fcx - faceW * .28); x < fcx + faceW * .28; x++) {
    const i = y * W + x; if (x < 0 || x >= W || lab[i] !== best) continue; cbs.push(Cb[i]); crs.push(Cr[i]); rr.push(px[i * 4]); gs.push(px[i * 4 + 1]); bs.push(px[i * 4 + 2]);
  }
  const faceRGB = [median(rr), median(gs), median(bs)];
  const mCb = median(cbs), mCr = median(crs);
  const sCb = Math.max(3, 1.4826 * median(cbs.map(v => Math.abs(v - mCb)))), sCr = Math.max(3, 1.4826 * median(crs.map(v => Math.abs(v - mCr))));
  const kk = opts.skinK || 3.6;
  const skinCol = i => A[i] > 128 && Yv[i] > 22 && Math.abs(Cb[i] - mCb) < kk * sCb && Math.abs(Cr[i] - mCr) < kk * sCr;
  let chestY = Math.min(H - 1, Math.round(Math.max(by1, shoulderY) + faceW * 0.9));
  while (chestY > by1 && A[chestY * W + Math.round(fcx)] < 128) chestY--;

  // only skin CONNECTED to the face counts (papaya / red / pink suit areas never do)
  const faceSkin = new Uint8Array(N);
  for (let i = 0; i < W * yLimit; i++) if (lab[i] === best && skinCol(i)) { faceSkin[i] = 1; stack.push(i); }
  while (stack.length) {
    const q = stack.pop(); const x = q % W;
    for (const d of nb) { const q2 = q + d; if (q2 < 0 || q2 >= W * chestY || (d === 1 && x === W - 1) || (d === -1 && x === 0)) continue; if (!faceSkin[q2] && skinCol(q2)) { faceSkin[q2] = 1; stack.push(q2); } }
  }
  const isSkin = (x, y) => faceSkin[y * W + x] === 1;

  // 3. collar line: from the chest, walk up each column through the suit until face skin or background
  const xa = Math.max(0, Math.round(fcx - faceW * 1.4)), xb = Math.min(W - 1, Math.round(fcx + faceW * 1.4));
  const contour = new Float32Array(W).fill(-1), stopSkin = new Uint8Array(W);
  for (let x = xa; x <= xb; x++) {
    // column empty at chest height (e.g. beside a raised arm): start from its lowest body pixel above instead
    let y = chestY, run = 0;
    if (A[chestY * W + x] < 128) { while (y > 0 && A[y * W + x] < 128) y--; if (y <= 0) { contour[x] = chestY; continue; } y++; }
    while (y > 0 && A[(y - 1) * W + x] >= 128) {
      if (isSkin(x, y - 1)) { run++; if (run >= 2) { y += 1; stopSkin[x] = 1; break; } } else run = 0;
      y--;
    }
    contour[x] = y;
  }
  // 3b. beards: hair below the nose is head, not suit. Learn this driver's beard colour (dark + warm, unlike
  //     neutral black/white collars) and let the head reach down through beard pixels to the real collar.
  { const bY = [], bCb = [], bCr = [];
    for (let x = Math.round(fcx - faceW * .35); x <= fcx + faceW * .35; x++) for (let y = Math.round(by0 + faceH * .62); y < contour[x]; y++) {
      const i = y * W + x; if (x < 0 || x >= W || A[i] < 200 || faceSkin[i]) continue;
      if (Yv[i] < 125 && Cr[i] - Cb[i] > 5) { bY.push(Yv[i]); bCb.push(Cb[i]); bCr.push(Cr[i]); }
    }
    if (bY.length > 120 * k * k) {
      const mY = median(bY), mb = median(bCb), mr = median(bCr);
      const sY = Math.max(8, 1.4826 * median(bY.map(v => Math.abs(v - mY)))), sb = Math.max(3, 1.4826 * median(bCb.map(v => Math.abs(v - mb)))), sr = Math.max(3, 1.4826 * median(bCr.map(v => Math.abs(v - mr))));
      const isBeard = i => A[i] > 128 && Math.abs(Yv[i] - mY) < 3 * sY && Math.abs(Cb[i] - mb) < 3 * sb && Math.abs(Cr[i] - mr) < 3 * sr && Cr[i] - Cb[i] > 4;
      const maxDown = Math.round(W * .05);
      for (let x = xa; x <= xb; x++) {
        if (!stopSkin[x]) continue;
        let y = contour[x], miss = 0, steps = 0, last = y;
        while (y < chestY && steps < maxDown) { const i = y * W + x; if (isBeard(i) || faceSkin[i]) { last = y + 1; miss = 0; } else if (++miss > 2) break; y++; steps++; }
        contour[x] = last;
      }
    }
  }
  const R = Math.round(4 * k), sm = Float32Array.from(contour);
  for (let x = xa + R; x <= xb - R; x++) { const w = []; for (let j = -R; j <= R; j++) w.push(contour[x + j]); sm[x] = median(w); }

  // 4. neck span = contiguous skin-stop columns around the face centre
  let c0 = Math.round(fcx);
  if (!stopSkin[c0]) { let d = 1; while (d < faceW * .5 && !stopSkin[c0 + d] && !stopSkin[c0 - d]) d++; c0 = stopSkin[c0 + d] ? c0 + d : c0 - d; }
  if (!stopSkin[c0]) return { ok: false, reason: 'no neck found', cutout };
  let nl = c0, nr = c0; const gapOk = Math.round(2 * k);
  const anyStop = (a, b) => { for (let x = a; x <= b; x++) if (stopSkin[x]) return true; return false; };
  while (nl - 1 >= xa && anyStop(nl - 1 - gapOk, nl - 1)) nl--;
  while (nr + 1 <= xb && anyStop(nr + 1, nr + 1 + gapOk)) nr++;
  const span = []; for (let x = nl; x <= nr; x++) span.push(sm[x]);
  const ct = Math.min(...span), cd = Math.max(...span.slice(Math.round(span.length * .2), Math.round(span.length * .8) + 1));
  const ncx = (nl + nr) / 2, nw = nr - nl + 1;

  // 5. masks
  const head = mk(), body = mk(), hd = head.getContext('2d').createImageData(W, H), bd = body.getContext('2d').createImageData(W, H);
  const trim = Math.round(2 * k);
  const inHead = (x, y) => x >= xa && x <= xb && y < chestY && y < sm[x] - (stopSkin[x] ? trim : 0);
  // keep only the region joined to the face: stray bits of shoulder or trim that pass the collar test stay with the suit
  const conn = new Uint8Array(W * H);
  { const sx = Math.round(fcx), sy = Math.max(0, Math.min(H - 1, Math.round(ct - nw * .6)));
    const st = [sy * W + sx]; if (A[st[0]] && inHead(sx, sy)) conn[st[0]] = 1; else st.length = 0;
    while (st.length) { const i = st.pop(), x = i % W, y = (i - x) / W;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && !conn[j] && A[j] > 20 && inHead(nx, ny)) { conn[j] = 1; st.push(j); } }); } }
  const anyConn = conn.some(v => v);
  const isHeadPx = (x, y) => inHead(x, y) && (!anyConn || conn[y * W + x] === 1 || !A[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = A[i]; if (!a) continue;
    const isH = isHeadPx(x, y);
    // beard or neck shadow beside the neck, above the collar, is never suit: leave it out of the body layer
    if (!isH && y < ct && Math.abs(x - ncx) < nw * .9) continue;
    const t = isH ? hd : bd; const j = i * 4;
    t.data[j] = t.data[j + 1] = t.data[j + 2] = 255; t.data[j + 3] = a;
  }
  // the suit layer is one piece: drop loose bits (stray hair, specks) not joined to the chest
  { const keep = new Uint8Array(W * H), sx = Math.round(ncx), sy = Math.min(H - 1, Math.round(cd + nw));
    const st = bd.data[(sy * W + sx) * 4 + 3] > 20 ? [sy * W + sx] : []; if (st.length) keep[st[0]] = 1;
    while (st.length) { const i = st.pop(), x = i % W, y = (i - x) / W;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && !keep[j] && bd.data[j * 4 + 3] > 20) { keep[j] = 1; st.push(j); } }); }
    if (keep.some(v => v)) for (let i = 0; i < W * H; i++) if (!keep[i]) bd.data[i * 4 + 3] = 0; }
  head.getContext('2d').putImageData(hd, 0, 0); body.getContext('2d').putImageData(bd, 0, 0);
  const soften = (c, r) => { const o = mk(), x = o.getContext('2d'); x.filter = `blur(${r}px)`; x.drawImage(c, 0, 0); return o; };

  // 6. faceExt: the driver's head + neck, and below his collar line an extension made from his own neck skin
  const ext = mk(), eg = ext.getContext('2d'), ed = eg.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isHeadPx(x, y)) { const i = (y * W + x) * 4; ed.data[i] = px[i]; ed.data[i + 1] = px[i + 1]; ed.data[i + 2] = px[i + 2]; ed.data[i + 3] = px[i + 3]; }
  const L = Math.round(W * 0.16), side = Math.round(nw * 0.35), samp = Math.max(3, Math.round(3 * k));
  const colourAt = x => {          // average of the last skin rows above the collar line in column x
    let r = 0, gg = 0, b = 0, n = 0; const yc = Math.round(sm[x]) - trim - Math.round(3 * k);   // skip rows lit by the old collar
    for (let y = yc - 1; y >= yc - 1 - samp * 3 && n < samp; y--) if (y > 0 && isSkin(x, y)) { const i = (y * W + x) * 4; r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
    // necks sit in shadow: blend the column's own neck colour with his (slightly darkened) cheek tone —
    // keeps bearded drivers / high collars (few neck pixels) from getting a grey or pale extension
    const shadow = faceRGB.map(v => v * 0.84);
    if (!n) return shadow;
    const w = n >= samp ? 0.55 : 0.25;
    return [0, 1, 2].map(j => [r, gg, b][j] / n * w + shadow[j] * (1 - w));
  };
  const cols = []; for (let x = nl; x <= nr; x++) cols[x] = colourAt(x);
  for (let x = nl; x <= nr; x++) if (!cols[x]) cols[x] = cols[x - 1] || null;
  for (let x = nr; x >= nl; x--) if (!cols[x]) cols[x] = cols[x + 1] || null;
  { const Rs = Math.max(2, Math.round(nw * .12)), sm2 = [];
    for (let x = nl; x <= nr; x++) { let r = 0, gg = 0, b = 0, n = 0; for (let j = -Rs; j <= Rs; j++) { const c = cols[x + j]; if (c) { r += c[0]; gg += c[1]; b += c[2]; n++; } } sm2[x] = n ? [r / n, gg / n, b / n] : cols[x]; }
    for (let x = nl; x <= nr; x++) cols[x] = sm2[x]; }
  const yTop = x => Math.round(sm[Math.min(nr, Math.max(nl, x))]);
  for (let x = nl - side; x <= nr + side; x++) {
    if (x < 0 || x >= W) continue;
    const c = cols[Math.min(nr, Math.max(nl, x))]; if (!c) continue;
    const out = x < nl ? (nl - x) / side : x > nr ? (x - nr) / side : 0;          // 0 inside the neck, →1 at the outer edge
    const startY = yTop(x) - trim - 1;
    for (let y = Math.max(0, startY); y < Math.min(H, startY + L); y++) {
      const i = (y * W + x) * 4; if (ed.data[i + 3] > 200) continue;
      const t = (y - startY) / L, shade = 1 - 0.18 * t - 0.12 * out;               // a touch darker lower down / outwards
      const a = 255 * Math.min(1, (1 - t) / 0.25) * (1 - out * out);
      ed.data[i] = c[0] * shade; ed.data[i + 1] = c[1] * shade; ed.data[i + 2] = c[2] * shade; ed.data[i + 3] = Math.max(ed.data[i + 3], a);
    }
  }
  // blend the last real neck rows into the extension colour (no hard beard / skin edge at the old collar line)
  const B = Math.round(7 * k);
  for (let x = nl; x <= nr; x++) {
    const c = cols[x]; if (!c) continue; const yc = Math.round(sm[x]) - trim;
    for (let y = Math.max(0, yc - B); y < yc; y++) {
      const i = (y * W + x) * 4, t = Math.pow((y - (yc - B)) / B, 1.5);
      if (!isSkin(x, y) && Yv[y * W + x] > 60) continue;   // keep non-skin highlights (e.g. jewellery) untouched
      for (let j = 0; j < 3; j++) ed.data[i + j] = ed.data[i + j] * (1 - t) + c[j] * t;
    }
  }
  eg.putImageData(ed, 0, 0);
  // soften only the extension (keep the real face sharp): blurred copy underneath, real head on top
  const faceExt = mk(), fg = faceExt.getContext('2d');
  fg.filter = `blur(${1.6 * k}px)`; fg.drawImage(ext, 0, 0); fg.filter = 'none';
  const hm = mk(), hg = hm.getContext('2d'); hg.putImageData(hd, 0, 0); hg.globalCompositeOperation = 'source-in'; hg.drawImage(ext, 0, 0);
  fg.drawImage(hm, 0, 0);

  const u = v => +(v / W).toFixed(4);
  const samples = []; for (let x = Math.round(ncx - nw * .8); x <= ncx + nw * .8; x += Math.max(1, Math.round(2 * k))) if (x >= xa && x <= xb) samples.push([u(x), u(sm[x]), stopSkin[x] ? 1 : 0]);
  return {
    ok: true, v: NECKFIT_VERSION, cutout, aspect: +(H / W).toFixed(4),
    cx: u(ncx), nw: u(nw), ct: u(ct), cd: u(cd), fw: u(faceW), faceTop: u(by0), ext: u(L),
    skin: { cb: +mCb.toFixed(1), cr: +mCr.toFixed(1) },
    contour: samples, masks: { head: soften(head, 0.8 * k), body: soften(body, 0.8 * k), faceExt },
  };
}

/* Automatic placement of a face (fitF) onto a suit (fitS), in FRAME-WIDTH units
   (frame = 1 wide × 1/FRAME_ASPECT tall). The suit moves; the driver's head keeps its framing. */
function autoFitParams(fitF, fitS, opts) {
  opts = opts || {};
  const frameH = 1 / FRAME_ASPECT;
  let s = 1, X = 0, Y = 0;
  if (opts.normaliseFace) { s = 0.18 / fitF.nw; X = 0.5 - s * fitF.cx; Y = 0.388 - s * fitF.ct; }
  const ss = opts.normaliseSuit ? (s * fitF.nw * 1.04) / fitS.nw : 1;
  const sxx = X + s * fitF.cx - ss * fitS.cx;          // neck centres aligned
  const syy = Y + s * fitF.ct - ss * fitS.ct;          // new collar tips where the driver's own collar was
  return {
    mode: 'fit',
    fx: +(X * 100).toFixed(2), fy: +(Y / frameH * 100).toFixed(3), fs: +s.toFixed(4), fr: 0,
    cut: +((fitF.ct - 0.012) / fitF.aspect * 100).toFixed(3),   // head drawn over the suit down to here (% of face image)
    cfe: 1.4,                                                    // feather of that edge (%)
    sx: +(sxx * 100).toFixed(2), sy: +(syy / frameH * 100).toFixed(3), ss: +ss.toFixed(4),
    br: 1, ct: 1, sa: 1, hu: 0, wa: 0, tint: '#ffffff', ta: 0, sb: 1,
  };
}

/* A suit TEMPLATE without a person: the collar line is simply the top edge of the suit; the opening
   is the dip between the two collar tips around the centre. */
function analyzeSuitTemplate(img) {
  const iw = img.naturalWidth, ih = img.naturalHeight, W = Math.min(720, iw), H = Math.round(W * ih / iw);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  const top = new Float32Array(W).fill(H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3] > 128) { top[x] = y; break; }
  const cx0 = Math.round(W / 2); if (top[cx0] >= H) return { ok: false, reason: 'no suit at the centre' };
  let l = cx0, r = cx0;
  while (l > 1 && top[l - 1] <= top[l] + 1) l--;
  while (r < W - 2 && top[r + 1] <= top[r] + 1) r++;
  const u = v => +(v / W).toFixed(4);
  const samples = []; for (let x = l; x <= r; x += 2) samples.push([u(x), u(top[x]), 1]);
  const op = document.createElement('canvas'); op.width = W; op.height = H; const og = op.getContext('2d'); og.fillStyle = '#fff';
  for (let x = l; x <= r; x++) og.fillRect(x, 0, 1, top[x] + 2);
  return { ok: true, v: NECKFIT_VERSION, cutout: true, aspect: +(H / W).toFixed(4), cx: u((l + r) / 2), nw: u(r - l), ct: u(Math.min(top[l], top[r])), cd: u(top[cx0]),
    contour: samples, masks: { body: c, head: op } };
}
