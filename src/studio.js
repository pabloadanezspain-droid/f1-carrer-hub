/* ==========================================================================
   studio.js — Edit Career › Portrait studio (compose face × suit, approve, version)
               Edit Career › Images (uploaded originals + usage tracking)
   ========================================================================== */

const studio = { key: '', work: null };   // working (unsaved) composite for the selected pair

function studioPair(q) {
  const c = D(); const s = activeSeason(c);
  const d = driverOf(q.driver) || (s && driversInSeason(c, s.id)[0]) || c.drivers[0];
  const tId = q.team || (d && s && driverCurrentTeam(c, d.id, s.id)) || (c.teams[0] && c.teams[0].id);
  return { d, t: teamOf(tId) };
}

function studioLoad(d, t) {
  const c = D(); const key = d.id + '|' + t.id;
  if (studio.key === key && studio.work) return studio.work;
  const ap = approvedComposite(c, d.id, t.id);
  const base = ap ? clone(ap) : draftComposite(c, d, t) ||
    { driverId: d.id, teamId: t.id, face: null, faceSrc: 'portrait', suit: { type: 'placeholder' }, params: defaultParams('portrait') };
  base.params = Object.assign(defaultParams(base.faceSrc), base.params);
  studio.key = key; studio.work = base; studio.from = ap ? 'v' + ap.version : 'auto draft';
  return base;
}

function editStudio(q) {
  const c = D();
  const { d, t } = studioPair(q);
  if (!d || !t) return emptyState('Nothing to compose', 'Add drivers and teams first.', { href: '#/edit/drivers?id=new', label: 'Add driver' });
  const w = studioLoad(d, t);
  const faces = faceCandidates(c, d), suits = suitCandidates(c, t, d.id);
  const res = resolvePortrait(c, d, t);
  const statusTxt = { approved: `Showing approved v${res.comp && res.comp.version}`, photo: 'Showing a real portrait taken in this team’s suit (composites are optional here)', draft: 'Showing an automatic draft. Approve it to lock it in.', placeholder: 'No face source yet: showing the placeholder' }[res.kind];
  const history = c.composites.filter(x => x.driverId === d.id && x.teamId === t.id).sort((a, b) => b.version - a.version);
  const attention = c.seasons.flatMap(x => portraitsNeedingAttention(c, x.id));
  const drafts = attention.filter((a, i) => a.kind === 'draft' && attention.findIndex(b => b.driver.id === a.driver.id && b.team.id === a.team.id) === i);
  const noFace = new Set(attention.filter(a => a.kind === 'placeholder').map(a => a.driver.id)).size;
  const sel = (name, list, cur) => `<select name="${name}" data-studio-src="${name}">${list.map((x, i) => `<option value="${i}" ${refKey(x.ref) === refKey(cur) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  const fitMode = w.params.mode === 'fit';
  const slider = k => { const [mn, mx, st, label] = PARAM_RANGES[k]; return `<label class="slider"><span>${label}</span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${w.params[k]}" data-p="${k}"><output>${w.params[k]}</output></label>`; };
  const dOpts = [...c.drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.lastName)}, ${esc(x.firstName)}</option>`).join('');
  const tOpts = [...c.teams].sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  return `
    ${drafts.length || noFace ? `<div class="panel attention"><h2 class="h-card">Portraits to review</h2>
      ${drafts.length ? `<p class="muted">These line-up drivers are wearing a suit they were never photographed in (usually after a transfer), so an automatic composite is shown. Check and approve it:</p>
      <div class="chip-row chip-row-tight">${drafts.map(a => `<a class="chip" href="#/edit/studio?driver=${a.driver.id}&team=${a.team.id}">${esc(a.driver.lastName)} → ${esc(a.team.name)}</a>`).join('')}</div>` : ''}
      ${noFace ? `<p class="muted">${noFace} line-up driver(s) have no photo at all and show the generated placeholder. Upload a headshot below (or under Images) to give them a face.</p>` : ''}</div>` : ''}
    <div class="panel studio" data-studio="${d.id}|${t.id}">
      <div class="page-tools studio-pick">
        <label class="pill-select"><select data-nav-select="#/edit/studio?driver=__ID__&team=${t.id}" aria-label="Driver">${dOpts}</select></label>
        <span class="muted">in</span>
        <label class="pill-select"><select data-nav-select="#/edit/studio?driver=${d.id}&team=__ID__" aria-label="Team suit">${tOpts}</select></label>
        <span class="studio-status">${esc(statusTxt)} · editing ${esc(studio.from)}</span>
      </div>
      <div class="studio-grid">
        <div class="studio-preview">
          <div class="studio-stage" data-stage style="--tc:${t.color};--td:${t.colorDark}" title="Drag to move the face · scroll to scale">${w.face ? compositeHtml(w, t, 'studio-big') : `<div class="empty"><p>Upload a headshot or give the driver a portrait to start.</p></div>`}</div>
          <div class="studio-minis" data-minis>${studioMinis(w, t)}</div>
        </div>
        <div class="studio-controls">
          <h3 class="h-sub">Face (identity)</h3>
          <div class="field">${faces.length ? sel('face', faces, w.face) : '<p class="muted">No face source yet.</p>'}
            <label class="upload-btn">Upload headshot…<input type="file" accept="image/*" data-upload="headshot" hidden></label></div>
          ${fitMode ? `<p class="footnote fit-note">Neck-fitted: the suit's own skin is removed, the driver's neck is extended from his own neck, and his head stays on top down to the collar line.</p>
          <div class="sliders">${['fx', 'fy', 'fs', 'fr', 'cut', 'cfe'].map(slider).join('')}</div>`
          : `<div class="sliders">${['fc', 'fe', 'fx', 'fy', 'fs', 'fr'].map(slider).join('')}</div>
          <details ${+w.params.oval ? 'open' : ''}><summary>Oval mask (for photos with a background)</summary><div class="sliders">${['oval', 'oy', 'ow', 'oh'].map(slider).join('')}</div></details>`}
          <details><summary>Colour match</summary><div class="sliders">${['br', 'ct', 'sa', 'hu', 'wa'].map(slider).join('')}</div></details>
          <h3 class="h-sub">Suit (${esc(t.name)})</h3>
          <div class="field">${sel('suit', suits, w.suit)}
            <label class="upload-btn">Upload suit template…<input type="file" accept="image/*" data-upload="suit" hidden></label></div>
          <div class="sliders">${(fitMode ? ['sx', 'sy', 'ss', 'sb', 'ta'] : ['sc', 'sb', 'ta']).map(slider).join('')}
            <label class="slider"><span>Suit tint colour</span><input type="color" value="${esc(w.params.tint)}" data-p="tint"><output></output></label></div>
          <div class="form-actions">
            <button class="btn btn-red" type="button" data-approve ${w.face ? '' : 'disabled'}>Approve${history.some(x => x.status === 'approved') ? ' as new version' : ''}</button>
            <button class="btn btn-outline" type="button" data-auto-align>${fitMode ? 'Auto-fit neck & collar' : 'Auto-align neck'}</button>
            <button class="btn btn-outline" type="button" data-reset-params>Reset sliders</button>
            <a class="btn btn-ghost" href="#/showroom/${t.id}">View in showroom</a>
          </div>
          <p class="footnote">Originals are never changed. Approving saves only the source references and these settings, so you can replace a version later without losing older ones.</p>
        </div>
      </div>
      <h3 class="h-sub spaced">Versions for ${esc(d.lastName)} in ${esc(t.name)}</h3>
      ${history.length ? `<div class="versions">${history.map(x => `<div class="version ${x.status}">
          <span class="version-thumb" style="--tc:${t.color}">${compositeHtml(x, t, 'version-img')}</span>
          <span class="version-meta"><b>v${x.version}</b> ${tag(x.status, x.status === 'approved' ? 'red' : 'dark')}<br><small>${esc(fmtDate(x.approvedAt || x.createdAt))}</small><br>
            <small class="muted">Face: ${esc(sourceLabel(x.face))}<br>Suit: ${esc(sourceLabel(x.suit))}</small></span>
          <span class="actions"><button class="chip" type="button" data-restore="${x.id}">Edit from this</button>${x.status !== 'approved' ? `<button class="chip chip-danger" type="button" data-del-version="${x.id}">Delete</button>` : `<button class="chip" type="button" data-unapprove="${x.id}">Withdraw</button>`}</span>
        </div>`).join('')}</div>` : '<p class="muted">No approved versions yet.</p>'}
    </div>`;
}

function sourceLabel(ref) {
  if (!ref) return '—';
  if (ref.type === 'asset') { const a = byId(D().assets, ref.id); return a ? `${a.kind} upload “${a.name}”${AssetStore.url(a.id) ? '' : ' (file missing)'}` : 'missing upload'; }
  if (ref.type === 'url') return ref.url.split('/').pop();
  return 'generated placeholder suit';
}

function studioMinis(w, t) {
  if (!w.face) return '';
  return `<span class="mini"><span class="mini-head">${compositeHtml(w, t, 'driver-head is-photo')}</span><small>Table</small></span>
    <span class="mini mini-card" style="--tc:${t.color};--td:${t.colorDark}">${compositeHtml(w, t, 'dc-portrait is-photo')}<small>Card</small></span>
    <span class="mini mini-sr" style="--tc:${t.color};--td:${t.colorDark}">${compositeHtml(w, t, 'mini-sr-img')}<small>Showroom</small></span>`;
}

function bindStudio(root) {
  const box = root.querySelector('[data-studio]'); if (!box) return;
  const [did, tid] = box.dataset.studio.split('|');
  const d = driverOf(did), t = teamOf(tid), w = studio.work;
  const repaint = () => {
    const st = box.querySelector('[data-stage]'); if (w.face) st.innerHTML = compositeHtml(w, t, 'studio-big');
    box.querySelector('[data-minis]').innerHTML = studioMinis(w, t);
  };
  box.addEventListener('input', ev => {
    const k = ev.target.dataset.p; if (!k) return;
    w.params[k] = k === 'tint' ? ev.target.value : Number(ev.target.value);
    const o = ev.target.nextElementSibling; if (o && k !== 'tint') o.textContent = ev.target.value;
    repaint();
  });
  box.addEventListener('change', async ev => {
    const src = ev.target.dataset.studioSrc;
    if (src === 'face') {
      const f = faceCandidates(D(), d)[Number(ev.target.value)];
      const keepSuit = Object.fromEntries(Object.keys(COMP_DEFAULTS.suit).map(k => [k, w.params[k]]));
      if (f.src !== w.faceSrc) w.params = Object.assign(defaultParams(f.src), keepSuit);
      w.face = f.ref; w.faceSrc = f.src; Object.assign(w.params, autoAlign(w.face, w.faceSrc, w.suit)); render();
    }
    if (src === 'suit') { w.suit = suitCandidates(D(), t, d.id)[Number(ev.target.value)].ref; Object.assign(w.params, autoAlign(w.face, w.faceSrc, w.suit)); render(); }
    const up = ev.target.dataset.upload;
    if (up && ev.target.files[0]) {
      try {
        const rec = await AssetStore.upload(ev.target.files[0], up, up === 'headshot' ? { driverId: d.id } : { teamId: t.id });
        D().assets.push(rec); await deriveFit(rec); Store.save();
        if (up === 'headshot') { w.face = { type: 'asset', id: rec.id }; w.faceSrc = 'headshot'; w.params = Object.assign(defaultParams('headshot'), autoAlign(w.face, 'headshot', w.suit)); }
        else { w.suit = { type: 'asset', id: rec.id }; Object.assign(w.params, autoAlign(w.face, w.faceSrc, w.suit)); }
        toast('Uploaded — original stored unchanged'); render();
      } catch (e) { toast(e.message, true); }
    }
  });
  // drag to position, wheel to scale
  const stage = box.querySelector('[data-stage]');
  let drag = null;
  stage.addEventListener('pointerdown', ev => { if (!w.face) return; const fr = stage.querySelector('.comp-frame'); if (!fr) return; drag = { x: ev.clientX, y: ev.clientY, fx: w.params.fx, fy: w.params.fy, W: fr.offsetWidth, H: fr.offsetHeight }; stage.setPointerCapture(ev.pointerId); });
  stage.addEventListener('pointermove', ev => {
    if (!drag) return;
    w.params.fx = +(drag.fx + (ev.clientX - drag.x) / drag.W * 100).toFixed(1);
    w.params.fy = +(drag.fy + (ev.clientY - drag.y) / drag.H * 100).toFixed(2);
    repaint();
  });
  const end = () => { if (!drag) return; drag = null; ['fx', 'fy'].forEach(k => { const i = box.querySelector(`[data-p="${k}"]`); if (i) { i.value = w.params[k]; i.nextElementSibling.textContent = w.params[k]; } }); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', ev => {
    if (!w.face) return; ev.preventDefault();
    w.params.fs = Math.max(.1, Math.min(2, +(w.params.fs * (ev.deltaY < 0 ? 1.03 : 0.97)).toFixed(3)));
    const i = box.querySelector('[data-p="fs"]'); if (i) { i.value = w.params.fs; i.nextElementSibling.textContent = w.params.fs; }
    repaint();
  }, { passive: false });

  box.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const c = D();
    if (b.hasAttribute('data-reset-params')) { w.params = Object.assign(defaultParams(w.faceSrc), autoAlign(w.face, w.faceSrc, w.suit)); render(); }
    if (b.hasAttribute('data-auto-align')) {
      const a = autoAlign(w.face, w.faceSrc, w.suit);
      if (!Object.keys(a).length) return toast('Auto-align needs a library portrait for the face and the suit; position uploads with the sliders or by dragging.', true);
      Object.assign(w.params, a); render();
    }
    if (b.hasAttribute('data-approve')) {
      const now = new Date().toISOString();
      const all = c.composites.filter(x => x.driverId === d.id && x.teamId === t.id);
      const rec = { id: newId('composites'), driverId: d.id, teamId: t.id, version: all.reduce((m, x) => Math.max(m, x.version), 0) + 1,
        face: clone(w.face), faceSrc: w.faceSrc, suit: clone(w.suit), params: clone(w.params), status: 'approved', createdAt: now, approvedAt: now };
      all.filter(x => x.status === 'approved').forEach(x => { x.status = 'superseded'; x.supersededAt = now; x.supersededBy = rec.id; });
      c.composites.push(rec); studio.key = ''; Store.save();
      toast(`Approved v${rec.version}: now used everywhere ${d.lastName} appears in ${t.name}`);
    }
    if (b.dataset.restore) { const x = byId(c.composites, b.dataset.restore); studio.work = Object.assign(clone(x), { params: Object.assign(defaultParams(x.faceSrc), clone(x.params)) }); studio.from = 'v' + x.version; render(); }
    if (b.dataset.delVersion) { if (confirm('Delete this old version? Its source images are kept.')) { c.composites = c.composites.filter(x => x.id !== b.dataset.delVersion); studio.key = ''; Store.save(); } }
    if (b.dataset.unapprove) { const x = byId(c.composites, b.dataset.unapprove); x.status = 'superseded'; x.supersededAt = new Date().toISOString(); studio.key = ''; Store.save(); toast('Withdrawn: the automatic draft or a real portrait is shown again'); }
  });
}

/* ---- Images (uploaded originals) ------------------------------------------ */
function editAssets() {
  const c = D();
  const used = id => c.composites.filter(x => [x.face, x.suit].some(r => r && r.type === 'asset' && r.id === id));
  const rows = c.assets.filter(a => a.kind !== 'derived').sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))).map(a => {
    const u = AssetStore.url(a.id), us = used(a.id), d = driverOf(a.driverId), t = teamOf(a.teamId);
    return `<tr><td>${u ? `<img class="asset-thumb" src="${u}" alt="">` : '<span class="muted">file missing</span>'}</td><td><b>${esc(a.name)}</b><br><small class="muted">${esc(a.id)}</small></td>
      <td>${esc(a.kind)}${a.fit ? '<br><small class="ok-small">neck-fit ✓</small>' : '<br><small class="muted">simple mode</small>'}</td><td>${d ? esc(nameOf(d)) : ''}${t ? esc(t.name) : ''}</td><td>${a.w}×${a.h}<br><small class="muted">${(a.bytes / 1024).toFixed(0)} KB</small></td>
      <td>${us.length ? us.map(x => `<a href="#/edit/studio?driver=${x.driverId}&team=${x.teamId}">v${x.version} ${esc((driverOf(x.driverId) || {}).lastName || '')}/${esc((teamOf(x.teamId) || {}).name || '')}</a> <small class="muted">${x.status}</small>`).join('<br>') : '<span class="muted">unused</span>'}</td>
      <td class="actions">${us.length ? '' : `<button class="chip chip-danger" type="button" data-del-asset="${a.id}">Delete</button>`}</td></tr>`;
  });
  const comps = [...c.composites].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(x => `<tr><td>${esc(nameOf(driverOf(x.driverId)))}</td><td>${teamLink(teamOf(x.teamId))}</td><td>v${x.version} ${tag(x.status, x.status === 'approved' ? 'red' : 'dark')}</td><td>${esc(sourceLabel(x.face))}</td><td>${esc(sourceLabel(x.suit))}</td><td>${esc(fmtDate(x.approvedAt || x.createdAt))}</td></tr>`);
  const dOpts = [...c.drivers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(x => `<option value="${x.id}">${esc(x.lastName)}, ${esc(x.firstName)}</option>`).join('');
  const tOpts = c.teams.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
  return `<form class="edit-form panel" data-asset-upload>
      <h2 class="h-card">Upload an original</h2>
      <p class="muted">Files are stored unchanged in this browser (IndexedDB). Use <b>Import / Export → include images</b> to back them up.${AssetStore.ok ? '' : ' <b>⚠ Image storage is unavailable in this browser.</b>'}</p>
      <div class="form-grid">
        <div class="field"><label>Kind</label><select name="kind"><option value="headshot">Driver headshot / face</option><option value="suit">Team suit template</option><option value="portrait">Driver portrait (already in a team suit)</option></select></div>
        <div class="field"><label>File</label><input type="file" name="file" accept="image/*" required></div>
        <div class="field"><label>Driver (headshots and portraits)</label><select name="driverId"><option value="">—</option>${dOpts}</select></div>
        <div class="field"><label>Team (suits; for portraits, the suit they wear)</label><select name="teamId"><option value="">—</option>${tOpts}</select></div>
      </div>
      <div class="form-actions"><button class="btn btn-red" type="submit">Upload</button></div>
    </form>
    <h2 class="h-sub spaced">Uploaded originals</h2>
    ${dataTable([{ label: '' }, { label: 'File' }, { label: 'Kind' }, { label: 'Tag' }, { label: 'Size' }, { label: 'Used by' }, { label: '' }], rows, 'table-compact')}
    <h2 class="h-sub spaced">Composite versions and their sources</h2>
    ${dataTable([{ label: 'Driver' }, { label: 'Team suit' }, { label: 'Version' }, { label: 'Face source' }, { label: 'Suit source' }, { label: 'Approved' }], comps, 'table-compact')}`;
}

function bindAssets(root) {
  const f = root.querySelector('[data-asset-upload]');
  if (f) f.addEventListener('submit', async ev => {
    ev.preventDefault(); const fd = new FormData(f); const file = fd.get('file');
    if (!file || !file.size) return toast('Choose a file first.', true);
    const kind = fd.get('kind');
    if (kind !== 'suit' && !fd.get('driverId')) return toast('Pick the driver this image belongs to.', true);
    if (kind === 'suit' && !fd.get('teamId')) return toast('Pick the team for this suit template.', true);
    try {
      const rec = await AssetStore.upload(file, kind, { driverId: fd.get('driverId') || null, teamId: fd.get('teamId') || null });
      D().assets.push(rec); const fit = await deriveFit(rec); Store.save();
      toast('Uploaded — original stored unchanged' + (fit ? ' · neck & collar analysed' : ' · not a cut-out, simple mode will be used'));
    } catch (e) { toast(e.message, true); }
  });
  root.querySelectorAll('[data-del-asset]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this original image? This cannot be undone.')) return;
    try {
      const id = b.dataset.delAsset; const derived = D().assets.filter(a => a.derivedFrom === id).map(a => a.id);
      Store.remove('assets', id); D().assets = D().assets.filter(a => !derived.includes(a.id)); Store.save();
      await AssetStore.del(id); for (const x of derived) await AssetStore.del(x); render();
    } catch (e) { toast(e.message, true); }
  }));
}

/* Run the neck/collar analysis on a freshly uploaded original and store the derived masks
   (separate assets, linked with derivedFrom; the original stays byte-for-byte unchanged). */
async function deriveFit(rec) {
  try {
    const img = await loadImage(AssetStore.url(rec.id));
    let f = analyzeFit(img);
    if (!f.ok && rec.kind === 'suit') f = analyzeSuitTemplate(img);
    if (!f.ok) return null;
    const save = async (canvas, role, type) => {
      const blob = await new Promise(r => canvas.toBlob(r, type, .92));
      const d = { id: newId('assets'), kind: 'derived', role, derivedFrom: rec.id, name: `${rec.name} · ${role}`, mime: type, bytes: blob.size, w: canvas.width, h: canvas.height,
        driverId: rec.driverId, teamId: rec.teamId, uploadedAt: new Date().toISOString() };
      await AssetStore.put(d.id, blob); D().assets.push(d); return d.id;
    };
    const fit = Object.assign({}, f, { masks: undefined });
    fit.bodyMask = await save(f.masks.body, 'body mask', 'image/png');
    if (f.masks.head) fit.headMask = await save(f.masks.head, 'head mask', 'image/png');
    if (f.masks.faceExt) fit.faceExt = await save(f.masks.faceExt, 'face + extended neck', 'image/webp');
    rec.fit = fit;
    return fit;
  } catch (e) { console.warn('analysis failed', e); return null; }
}
