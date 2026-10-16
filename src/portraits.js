/* ==========================================================================
   portraits.js — driver identity (face) × team suit compositing.

   Which picture represents driver D in team T?   resolvePortrait(c, D, T)
     1. an APPROVED composite for (D, T)                      → kind 'approved'
     2. a historical portrait of D taken in T's suit          → kind 'photo'
     3. an automatic DRAFT: D's face source on T's suit       → kind 'draft'
        (face = uploaded headshot or any portrait of D;
         suit = uploaded suit template, a T driver's portrait, or a generated placeholder suit)
     4. no face source at all → clean placeholder in T's colours → kind 'placeholder'

   Composites are never baked: they are layered at display time from the untouched
   originals plus a small params object, so the same record renders in HTML (CSS layers)
   and in exports (canvas, drawComposite).
   ========================================================================== */

const FRAME_ASPECT = 720 / 2069;      // formula1.com portrait framing (all library portraits)

/* Defaults by face-source type. Units: % of the face/suit element, scale = fraction of frame width. */
const COMP_DEFAULTS = {
  portrait: { fc: 14.5, fe: 2, fx: 0, fy: 0, fs: 1, fr: 0, oval: 0, oy: 7, ow: 22, oh: 10, br: 1, ct: 1, sa: 1, hu: 0, wa: 0 },
  headshot: { fc: 96, fe: 14, fx: 31, fy: 0.4, fs: 0.38, fr: 0, oval: 1, oy: 42, ow: 40, oh: 50, br: 1, ct: 1, sa: 1, hu: 0, wa: 0 },
  suit: { sc: 13.5, tint: '#ffffff', ta: 0, sb: 1 },
};
const PARAM_RANGES = {
  fc: [0, 100, .5, 'Face cut line (%)'], fe: [0, 30, .5, 'Edge feather (%)'], fx: [-60, 90, .5, 'Face X (%)'], fy: [-20, 40, .1, 'Face Y (%)'],
  fs: [.1, 2, .01, 'Face scale'], fr: [-25, 25, .5, 'Rotate (°)'], oval: [0, 1, 1, 'Oval mask'], oy: [0, 100, .5, 'Oval centre Y (%)'],
  ow: [5, 80, .5, 'Oval width (%)'], oh: [5, 80, .5, 'Oval height (%)'], br: [.5, 1.6, .01, 'Brightness'], ct: [.5, 1.6, .01, 'Contrast'],
  sa: [0, 2, .01, 'Saturation'], hu: [-60, 60, 1, 'Hue (°)'], wa: [0, .6, .01, 'Warmth'],
  sc: [0, 60, .5, 'Suit cut line (%)'], ta: [0, 1, .01, 'Suit tint amount'], sb: [.5, 1.6, .01, 'Suit brightness'],
  // fit mode (neck-fitted composites)
  cut: [0, 40, .1, 'Head over collar down to (%)'], cfe: [0, 6, .1, 'Head edge feather (%)'],
  sx: [-40, 40, .1, 'Suit X (%)'], sy: [-15, 15, .05, 'Collar height (%)'], ss: [.5, 1.6, .005, 'Suit scale'],
};

/* ---- sources ------------------------------------------------------------- */
const refKey = r => !r ? '' : r.type === 'asset' ? 'asset:' + r.id : r.type === 'url' ? 'url:' + r.url : 'placeholder';
function refUrl(ref, team) {
  if (!ref) return '';
  if (ref.type === 'asset') return AssetStore.url(ref.id);
  if (ref.type === 'url') return ref.url;
  if (ref.type === 'placeholder') return placeholderSuitSvg(team);
  return '';
}

/* Neck/collar analysis for a source (see neckfit.js). Library portraits: PORTRAIT_FIT (build time,
   tools/analyze-portraits.mjs). Uploads: asset.fit with derived mask assets. Placeholder suit: fixed. */
const PLACEHOLDER_FIT = { aspect: 2069 / 720, cx: .5, nw: 128 / 720, ct: 262 / 720, cd: 262 / 720, contour: [], bodyMask: '', headMask: '', faceExt: '' };
function fitOf(ref) {
  if (!ref) return null;
  if (ref.type === 'placeholder') return PLACEHOLDER_FIT;
  if (ref.type === 'url') { const f = PORTRAIT_FIT[ref.url]; return f && f.ok !== false ? f : null; }
  if (ref.type === 'asset') {
    const a = byId(Store.data.assets, ref.id); const f = a && a.fit;
    if (!f) return null;
    const u = id => id ? AssetStore.url(id) : '';
    const out = Object.assign({}, f, { headMask: u(f.headMask), bodyMask: u(f.bodyMask), faceExt: u(f.faceExt), upload: true });
    if (f.faceExt && !out.faceExt) return null;          // derived files missing → can't fit
    return out;
  }
  return null;
}
/* Neck-fitted parameters for a face source on a suit source, or null if either lacks an analysis. */
function autoFitFor(faceRef, suitRef) {
  const fF = fitOf(faceRef), fS = fitOf(suitRef);
  if (!fF || !fS || !fF.faceExt) return null;
  return autoFitParams(fF, fS, { normaliseFace: !!fF.upload, normaliseSuit: !!fS.upload });
}

/* Portrait photos of a driver, each tagged with the team whose suit is in it (null = unknown/any). */
function historicalPortraits(c, d) {
  const out = [];
  if (d.portraitUrl) out.push({ ref: { type: 'url', url: d.portraitUrl }, teamId: d.portraitTeamId || null, label: 'Portrait' });
  out.forEach(p => { if (p.teamId === 'plain') p.teamId = 'plain:'; });
  (d.portraits || []).forEach(p => out.push({ ref: p.ref || (p.url ? { type: 'url', url: p.url } : null), teamId: p.teamId || null, seasonId: p.seasonId || null, label: 'Portrait' }));
  c.assets.filter(a => a.kind === 'portrait' && a.driverId === d.id).forEach(a => out.push({ ref: { type: 'asset', id: a.id }, teamId: a.teamId || null, label: 'Uploaded portrait · ' + a.name }));
  return out.filter(p => p.ref && refUrl(p.ref));
}

function faceCandidates(c, d) {
  const ups = c.assets.filter(a => a.kind === 'headshot' && a.driverId === d.id && AssetStore.url(a.id))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
    .map(a => ({ ref: { type: 'asset', id: a.id }, src: 'headshot', label: 'Headshot · ' + a.name }));
  const ports = historicalPortraits(c, d).map(p => {
    const t = p.teamId && byId(c.teams, p.teamId);
    return { ref: p.ref, src: 'portrait', label: `${p.label}${t ? ' (' + t.name + ' suit)' : ''}` };
  });
  return ups.concat(ports);
}

function suitCandidates(c, team, exceptDriverId) {
  const out = c.assets.filter(a => a.kind === 'suit' && a.teamId === team.id && AssetStore.url(a.id))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
    .map(a => ({ ref: { type: 'asset', id: a.id }, label: 'Suit template · ' + a.name }));
  // any portrait shot in this team's suit can donate the body below the neck
  // a team can name the driver whose portrait shows its suit best (team.suitDriverId); that one goes first
  const donors = c.drivers.filter(d => d.id !== exceptDriverId).sort((a, b) => (b.id === team.suitDriverId) - (a.id === team.suitDriverId));
  donors.forEach(d => historicalPortraits(c, d)
    .filter(p => p.teamId === team.id)
    .forEach(p => out.push({ ref: p.ref, label: `${d.firstName} ${d.lastName}'s portrait (body)` })));
  out.push({ ref: { type: 'placeholder' }, label: 'Generated placeholder suit' });
  return out;
}

function defaultParams(faceSrc) {
  return Object.assign({}, COMP_DEFAULTS[faceSrc === 'headshot' ? 'headshot' : 'portrait'], COMP_DEFAULTS.suit);
}

/* Best automatic parameters: neck-fitted when both sources are analysed, otherwise the simple
   cut-line method (e.g. a headshot photo that is not a cut-out). */
function autoAlign(faceRef, faceSrc, suitRef) {
  const fit = autoFitFor(faceRef, suitRef);
  if (fit) return fit;
  if (faceSrc === 'headshot') return {};
  const f = fitOf(faceRef), s = fitOf(suitRef), out = { mode: undefined };
  if (f) { out.fc = +((f.ct + 0.01) / f.aspect * 100).toFixed(2); out.fe = 2; }
  if (s) out.sc = +((s.ct - 0.004) / s.aspect * 100).toFixed(2);
  return out;
}

function approvedComposite(c, driverId, teamId) {
  return c.composites.filter(x => x.driverId === driverId && x.teamId === teamId && x.status === 'approved')
    .sort((a, b) => b.version - a.version)[0] || null;
}

/* The draft the system would show for (d, team) right now. */
function draftComposite(c, d, team) {
  const face = faceCandidates(c, d)[0];
  if (!face) return null;
  const suit = suitCandidates(c, team, d.id)[0];
  // reuse face alignment the user already approved for this face source (keeps the identity consistent across teams)
  const prior = c.composites.filter(x => x.driverId === d.id && x.status === 'approved' && refKey(x.face) === refKey(face.ref)).sort((a, b) => b.version - a.version)[0];
  const auto = autoAlign(face.ref, face.src, suit.ref);
  // keep the user's approved face tweaks (position/scale/colour) for the same face source; the suit fit is recomputed
  const keep = prior && (prior.params || {}).mode === auto.mode ? pickFaceParams(prior.params) : {};
  const params = Object.assign(defaultParams(face.src), auto, keep);
  return { driverId: d.id, teamId: team.id, face: face.ref, faceSrc: face.src, suit: suit.ref, params, draft: true };
}
const FACE_KEYS = ['fx', 'fy', 'fs', 'fr', 'br', 'ct', 'sa', 'hu', 'wa', 'fc', 'fe', 'oval', 'oy', 'ow', 'oh'];
const pickFaceParams = p => Object.fromEntries(Object.entries(p || {}).filter(([k]) => FACE_KEYS.includes(k)));

function resolvePortrait(c, d, team) {
  if (!d) return { kind: 'placeholder', url: '' };
  if (!team) {
    const any = historicalPortraits(c, d)[0];
    return any ? { kind: 'photo', url: refUrl(any.ref) } : { kind: 'placeholder', url: portraitSvg(d, null) };
  }
  const man = (ASSET_MANIFEST.drivers[d.id] || {}).portrait;
  const ok = x => x && refUrl(x.face) && refUrl(x.suit, team) && ((x.params || {}).mode !== 'fit' || !!fitOf(x.face));
  const ap = approvedComposite(c, d.id, team.id);
  if (ok(ap)) return { kind: 'approved', comp: ap };
  const hist = historicalPortraits(c, d);
  // a portrait in a plain suit ('plain') never stands in for a team: the face goes onto the team's suit instead
  const own = hist.find(p => p.teamId === team.id) || hist.find(p => p.teamId == null);
  if (own) return { kind: 'photo', url: refUrl(own.ref) };
  if (man) return { kind: 'photo', url: man };
  const dr = draftComposite(c, d, team);
  if (ok(dr)) return { kind: 'draft', comp: dr };
  return { kind: 'placeholder', url: portraitSvg(d, team) };
}

/* ---- HTML (CSS-layered) rendering ---------------------------------------- */
function faceMask(p) {
  const lin = `linear-gradient(to bottom, #000 ${Math.max(0, p.fc - p.fe)}%, transparent ${p.fc}%)`;
  if (!+p.oval) return lin;
  return `${lin}, radial-gradient(ellipse ${p.ow}% ${p.oh}% at 50% ${p.oy}%, #000 62%, transparent 100%)`;
}
const faceFilter = p => `brightness(${p.br}) contrast(${p.ct}) saturate(${p.sa}) hue-rotate(${p.hu}deg) sepia(${p.wa})`;

/* Fit-mode layering (back → front):
     1. the driver's own head + neck (his head mask)               – face group
     2. his EXTENDED neck, visible only inside the suit's old head/neck area (the suit's head mask),
        so skin can only ever appear where the donor's neck was                 – suit box
     3. the suit with its own skin removed (body mask) + optional tint          – suit box
     4. his real head again, on top of the collar down to the cut line          – face group  */
function fitGeometry(comp, p) {
  const fF = fitOf(comp.face), fS = fitOf(comp.suit) || PLACEHOLDER_FIT;
  const frameH = 1 / FRAME_ASPECT;
  const g = {
    fF, fS,
    // face box & suit box in frame-width units
    fx: p.fx / 100, fy: p.fy / 100 * frameH, fw: p.fs, fh: p.fs * fF.aspect,
    sx: p.sx / 100, sy: p.sy / 100 * frameH, sw: p.ss, sh: p.ss * fS.aspect,
  };
  g.originY = fF.ct / fF.aspect * 100;      // rotate the head around the neck
  return g;
}
const maskCss = (u, extra) => u ? `-webkit-mask-image:url('${u}')${extra ? ',' + extra : ''};mask-image:url('${u}')${extra ? ',' + extra : ''};-webkit-mask-size:100% 100%;mask-size:100% 100%;${extra ? '-webkit-mask-composite:source-in;mask-composite:intersect;' : ''}` : '';

function fitHtml(comp, p, team, cls, extraAttrs) {
  const G = fitGeometry(comp, p), fF = G.fF, fS = G.fS;
  const faceOrig = refUrl(comp.face, team), suit = refUrl(comp.suit, team);
  const openMask = fS.headMask || placeholderOpeningSvg();
  const filt = `filter:${faceFilter(p)}`, rot = `transform:rotate(${p.fr}deg);transform-origin:50% ${G.originY}%`;
  const grp = `left:${p.fx}%;top:${p.fy}%;width:${p.fs * 100}%;${rot};${filt}`;
  const box = `left:${p.sx}%;top:${p.sy}%;width:${p.ss * 100}%;aspect-ratio:1 / ${fS.aspect}`;
  // the face expressed inside the suit box (percent of the suit box)
  const inBox = `left:${(G.fx - G.sx) / G.sw * 100}%;top:${(G.fy - G.sy) / G.sh * 100}%;width:${G.fw / G.sw * 100}%;${rot};${filt}`;
  const topMask = `linear-gradient(to bottom, #000 ${Math.max(0, p.cut - p.cfe)}%, transparent ${p.cut}%)`;
  const tint = +p.ta > 0 ? `<span class="comp-tint" style="background:${esc(p.tint)};opacity:${p.ta};${maskCss(fS.bodyMask || suit)}"></span>` : '';
  return `<span class="comp ${cls || ''}" style="--tc:${team ? team.color : '#606066'}" ${extraAttrs || ''}><span class="comp-frame">
    <span class="comp-fgrp" style="${grp}"><img src="${fF.faceExt}" alt="" style="${maskCss(fF.headMask)}"></span>
    <span class="comp-sbox" style="${box}"><span class="comp-open" style="${maskCss(openMask)}"><img src="${fF.faceExt}" alt="" style="${inBox}"></span></span>
    <span class="comp-sbox" style="${box}"><img src="${suit}" alt="" style="${maskCss(fS.bodyMask)}filter:brightness(${p.sb})">${tint}</span>
    <span class="comp-fgrp" style="${grp}"><img src="${fF.faceExt}" alt="" style="${maskCss(fF.headMask, topMask)}"></span>
  </span></span>`;
}

/* where a neck belongs in the generated placeholder suit (above its collar, between the collar tips) */
function placeholderOpeningSvg() {
  return svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 2069"><path d="M250 0 H470 V300 L436 318 C400 338 320 338 284 318 L250 300 Z" fill="#fff"/></svg>');
}

function compositeHtml(comp, team, cls, extraAttrs) {
  const p = Object.assign(defaultParams(comp.faceSrc), comp.params || {});
  if (p.mode === 'fit') return fitHtml(comp, p, team, cls, extraAttrs);
  const face = refUrl(comp.face, team), suit = refUrl(comp.suit, team);
  const mask = faceMask(p);
  const faceStyle = `left:${p.fx}%;top:${p.fy}%;width:${p.fs * 100}%;transform:rotate(${p.fr}deg);transform-origin:50% ${p.oy}%;filter:${faceFilter(p)};-webkit-mask-image:${mask};mask-image:${mask};${+p.oval ? '-webkit-mask-composite:source-in;mask-composite:intersect;' : ''}`;
  const tint = +p.ta > 0 ? `<span class="comp-tint" style="background:${esc(p.tint)};opacity:${p.ta};-webkit-mask-image:url('${suit}');mask-image:url('${suit}');clip-path:inset(${p.sc}% 0 0 0)"></span>` : '';
  return `<span class="comp ${cls || ''}" style="--tc:${team ? team.color : '#606066'}" ${extraAttrs || ''}><span class="comp-frame">
    <img class="comp-suit" src="${suit}" alt="" style="clip-path:inset(${p.sc}% 0 0 0);filter:brightness(${p.sb})">${tint}
    <img class="comp-face" src="${face}" alt="" style="${faceStyle}">
  </span></span>`;
}

/* <img>-equivalent for any portrait slot. cls = the slot's sizing class (driver-head, dc-portrait…). */
function portraitImg(driver, team, cls) {
  const r = resolvePortrait(Store.data, driver, team);
  if (r.kind === 'approved' || r.kind === 'draft') return compositeHtml(r.comp, team, (cls || '') + ' is-photo');
  return `<img class="${cls || ''}${isRealImg(r.url) ? ' is-photo' : ''}" src="${r.url}" alt="" loading="lazy" style="--tc:${team ? team.color : '#606066'}">`;
}

/* ---- placeholder suit (generated, team colours) ------------------------- */
function placeholderSuitSvg(team) {
  const c = (team && team.color) || '#606066', d = (team && team.colorDark) || '#26262b';
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 2069">
  <defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>
  <path d="M300 286 C240 296 150 318 118 380 C92 432 88 530 90 660 L92 2069 L628 2069 L630 660 C632 530 628 432 602 380 C570 318 480 296 420 286 Z" fill="url(#s)"/>
  <path d="M150 430 C160 640 166 980 172 2069 M570 430 C560 640 554 980 548 2069" stroke="rgba(0,0,0,.22)" stroke-width="4" fill="none"/>
  <path d="M118 520 L602 380 L618 470 L120 610 Z" fill="rgba(255,255,255,.16)"/>
  <path d="M360 330 V2069" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
  <path d="M296 262 H424 L436 318 C400 338 320 338 284 318 Z" fill="${d}" stroke="rgba(255,255,255,.6)" stroke-width="4"/>
  <g fill="rgba(255,255,255,.85)"><rect x="190" y="470" width="120" height="26" rx="4"/><rect x="420" y="560" width="110" height="22" rx="4"/><rect x="250" y="700" width="220" height="34" rx="5"/></g>
</svg>`);
}

/* ---- canvas rendering (exports) ----------------------------------------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (/^https?:/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im); im.onerror = () => reject(new Error('Could not load image ' + String(src).slice(0, 60)));
    im.src = src;
  });
}
const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); return cv; };

/* Draws a composite into ctx with its frame's top-left at (dx, dy) and frame width dw. */
async function drawFit(ctx, comp, p, team, dx, dy, dw) {
  const G = fitGeometry(comp, p), fF = G.fF, fS = G.fS, W = dw;
  const [ext, orig, suit, hm, bm, om] = await Promise.all([loadImage(fF.faceExt), loadImage(refUrl(comp.face, team)), loadImage(refUrl(comp.suit, team)),
    loadImage(fF.headMask), fS.bodyMask ? loadImage(fS.bodyMask) : Promise.resolve(null), loadImage(fS.headMask || placeholderOpeningSvg())]);
  const fw = W * G.fw, fh = W * G.fh, sw = W * G.sw, sh = W * G.sh;
  const fX = dx + W * G.fx, fY = dy + W * G.fy, sX = dx + W * G.sx, sY = dy + W * G.sy;
  const rotAt = (g2, x, y, cv) => { const oy = y + fh * G.originY / 100; g2.save(); g2.translate(x + fw / 2, oy); g2.rotate(p.fr * Math.PI / 180); g2.translate(-(x + fw / 2), -oy); g2.drawImage(cv, x, y); g2.restore(); };
  const faceLayer = (img, masks) => { const C = mkCanvas(fw, fh), c2 = C.getContext('2d'); c2.filter = faceFilter(p); c2.drawImage(img, 0, 0, fw, fh); c2.filter = 'none';
    c2.globalCompositeOperation = 'destination-in'; masks.forEach(m => typeof m === 'function' ? m(c2) : c2.drawImage(m, 0, 0, fw, fh)); return C; };
  // 1. own head + neck
  rotAt(ctx, fX, fY, faceLayer(ext, [hm]));
  // 2. extended neck inside the suit's old neck area
  const O = mkCanvas(sw, sh), o = O.getContext('2d');
  const E = mkCanvas(fw, fh), e = E.getContext('2d'); e.filter = faceFilter(p); e.drawImage(ext, 0, 0, fw, fh);
  rotAt(o, fX - sX, fY - sY, E);
  o.globalCompositeOperation = 'destination-in'; o.drawImage(om, 0, 0, sw, sh);
  ctx.drawImage(O, sX, sY);
  // 3. suit without skin (+ tint)
  const S = mkCanvas(sw, sh), s = S.getContext('2d'); s.filter = `brightness(${p.sb})`; s.drawImage(suit, 0, 0, sw, sh); s.filter = 'none';
  if (bm) { s.globalCompositeOperation = 'destination-in'; s.drawImage(bm, 0, 0, sw, sh); s.globalCompositeOperation = 'source-over'; }
  if (+p.ta > 0) { const T = mkCanvas(sw, sh), t = T.getContext('2d'); t.fillStyle = p.tint; t.fillRect(0, 0, sw, sh); t.globalCompositeOperation = 'destination-in'; t.drawImage(S, 0, 0);
    s.globalCompositeOperation = 'color'; s.globalAlpha = p.ta; s.drawImage(T, 0, 0); s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'; }
  ctx.drawImage(S, sX, sY);
  // 4. real head over the collar down to the cut line
  rotAt(ctx, fX, fY, faceLayer(ext, [hm, c2 => { const gr = c2.createLinearGradient(0, 0, 0, fh); gr.addColorStop(Math.max(0, (p.cut - p.cfe) / 100), '#000'); gr.addColorStop(Math.min(1, p.cut / 100), 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, fw, fh); }]));
}

async function drawComposite(ctx, comp, team, dx, dy, dw) {
  const p = Object.assign(defaultParams(comp.faceSrc), comp.params || {});
  if (p.mode === 'fit') return drawFit(ctx, comp, p, team, dx, dy, dw);
  const W = dw, H = dw / FRAME_ASPECT;
  const [suitIm, faceIm] = await Promise.all([loadImage(refUrl(comp.suit, team)), loadImage(refUrl(comp.face, team))]);
  // suit layer
  const sh = W * suitIm.naturalHeight / suitIm.naturalWidth;
  const S = mkCanvas(W, Math.max(H, sh)), s = S.getContext('2d');
  s.filter = `brightness(${p.sb})`; s.drawImage(suitIm, 0, 0, W, sh); s.filter = 'none';
  s.clearRect(0, 0, W, sh * p.sc / 100);
  if (+p.ta > 0) {
    const T = mkCanvas(S.width, S.height), t = T.getContext('2d');
    t.fillStyle = p.tint; t.fillRect(0, 0, T.width, T.height); t.globalCompositeOperation = 'destination-in'; t.drawImage(S, 0, 0);
    s.globalCompositeOperation = 'color'; s.globalAlpha = p.ta; s.drawImage(T, 0, 0); s.globalAlpha = 1; s.globalCompositeOperation = 'source-over';
  }
  // face layer
  const fw = W * p.fs, fh = fw * faceIm.naturalHeight / faceIm.naturalWidth;
  const F = mkCanvas(fw, fh), f = F.getContext('2d');
  f.filter = faceFilter(p); f.drawImage(faceIm, 0, 0, fw, fh); f.filter = 'none';
  f.globalCompositeOperation = 'destination-in';
  const g = f.createLinearGradient(0, 0, 0, fh);
  g.addColorStop(Math.max(0, (p.fc - p.fe) / 100), '#000'); g.addColorStop(Math.min(1, p.fc / 100), 'rgba(0,0,0,0)');
  f.fillStyle = g; f.fillRect(0, 0, fw, fh);
  if (+p.oval) {
    const M = mkCanvas(fw, fh), m = M.getContext('2d');
    m.translate(fw / 2, fh * p.oy / 100); m.scale(fw * p.ow / 100, fh * p.oh / 100);
    const rg = m.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(.62, '#000'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = rg; m.fillRect(-1, -1, 2, 2);
    f.drawImage(M, 0, 0);
  }
  ctx.save();
  ctx.drawImage(S, dx, dy);
  const ox = dx + W * p.fx / 100, oy = dy + H * p.fy / 100;
  ctx.translate(ox + fw / 2, oy + fh * p.oy / 100); ctx.rotate(p.fr * Math.PI / 180); ctx.translate(-(ox + fw / 2), -(oy + fh * p.oy / 100));
  ctx.drawImage(F, ox, oy);
  ctx.restore();
}

/* Draw whatever resolvePortrait picks (photo / composite / placeholder) into a frame. */
async function drawPortrait(ctx, d, team, dx, dy, dw) {
  const r = resolvePortrait(Store.data, d, team);
  if (r.kind === 'approved' || r.kind === 'draft') return drawComposite(ctx, r.comp, team, dx, dy, dw);
  const im = await loadImage(r.url);
  if (r.kind === 'placeholder') { const h = dw * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, dx, dy + dw * .2, dw, h); return; }
  ctx.drawImage(im, dx, dy, dw, dw * im.naturalHeight / im.naturalWidth);
}

/* Pairs in the current line-ups that are not showing an approved/real portrait (e.g. after a transfer). */
function portraitsNeedingAttention(c, seasonId) {
  const rounds = roundsOf(c, seasonId);
  const at = (nextRound(c, seasonId) || rounds[rounds.length - 1] || { round: 1 }).round;
  const lu = lineupAt(c, seasonId, at);
  const out = [];
  Object.entries(lu).forEach(([tid, ids]) => ids.forEach(did => {
    const d = byId(c.drivers, did), t = byId(c.teams, tid);
    const r = resolvePortrait(c, d, t);
    if (r.kind === 'draft' || r.kind === 'placeholder') out.push({ driver: d, team: t, kind: r.kind, season: seasonId });
  }));
  return out;
}
