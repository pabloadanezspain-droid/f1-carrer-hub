/* ==========================================================================
   assetstore.js — uploaded image originals, stored byte-for-byte in IndexedDB.
   Metadata (name, kind, size, tags) lives in career.assets; the blob is keyed by
   the same asset id. Originals are never modified — composites only reference them.
   ========================================================================== */

const AssetStore = {
  db: null,
  urls: {},          // asset id → object URL (filled at boot so rendering stays synchronous)
  ready: false,
  ok: true,

  open() {
    return new Promise(resolve => {
      let req;
      try { req = indexedDB.open('f1ch-assets', 1); } catch (e) { this.ok = false; return resolve(); }
      req.onupgradeneeded = () => req.result.createObjectStore('blobs');
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => { this.ok = false; resolve(); };
    });
  },
  tx(mode) { return this.db.transaction('blobs', mode).objectStore('blobs'); },
  async boot() {
    await this.open();
    if (this.db) {
      await new Promise(resolve => {
        const r = this.tx('readonly').openCursor();
        r.onsuccess = () => {
          const cur = r.result;
          if (!cur) return resolve();
          this.urls[cur.key] = URL.createObjectURL(cur.value);
          cur.continue();
        };
        r.onerror = () => resolve();
      });
    }
    this.ready = true;
  },
  url(id) { return this.urls[id] || ''; },
  put(id, blob) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Browser image storage (IndexedDB) is unavailable.'));
      const r = this.tx('readwrite').put(blob, id);
      r.onsuccess = () => { if (this.urls[id]) URL.revokeObjectURL(this.urls[id]); this.urls[id] = URL.createObjectURL(blob); resolve(); };
      r.onerror = () => reject(r.error);
    });
  },
  get(id) {
    return new Promise(resolve => {
      if (!this.db) return resolve(null);
      const r = this.tx('readonly').get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  },
  del(id) {
    return new Promise(resolve => {
      if (!this.db) return resolve();
      const r = this.tx('readwrite').delete(id);
      r.onsuccess = r.onerror = () => { if (this.urls[id]) URL.revokeObjectURL(this.urls[id]); delete this.urls[id]; resolve(); };
    });
  },

  /* Store an uploaded File as a new original and return its metadata record. */
  async upload(file, kind, tags) {
    if (!/^image\//.test(file.type)) throw new Error('Please choose an image file (PNG, JPG or WebP).');
    if (file.size > 20 * 1024 * 1024) throw new Error('Image is larger than 20 MB.');
    const dims = await new Promise(resolve => {
      const im = new Image(); const u = URL.createObjectURL(file);
      im.onload = () => { resolve([im.naturalWidth, im.naturalHeight]); URL.revokeObjectURL(u); };
      im.onerror = () => { resolve([0, 0]); URL.revokeObjectURL(u); };
      im.src = u;
    });
    const rec = { id: newId('assets'), kind, name: file.name, mime: file.type, bytes: file.size, w: dims[0], h: dims[1],
      driverId: (tags && tags.driverId) || null, teamId: (tags && tags.teamId) || null, uploadedAt: new Date().toISOString(), note: '' };
    await this.put(rec.id, file);
    return rec;
  },

  /* For export: { assetId: dataURL } of every stored original referenced by the career. */
  async exportBlobs(ids) {
    const out = {};
    for (const id of ids) {
      const b = await this.get(id); if (!b) continue;
      out[id] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    }
    return out;
  },
  async importBlobs(map) {
    for (const [id, dataUrl] of Object.entries(map || {})) {
      const blob = await (await fetch(dataUrl)).blob();
      await this.put(id, blob);
    }
  },
};
