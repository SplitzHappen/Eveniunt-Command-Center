// Free cloud sync through the user's own Google Drive (hidden app-data folder; the app sees only
// its own file). Needs a Google OAuth client id (free) set up by the site owner.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE = 'eveniunt-tracker.json';
  const DRIVE = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const GIS_URL = 'https://accounts.google.com/gsi/client';

  ET.GDRIVE_CLIENT_ID = '372967195530-a0m3l5vodp27djh3pgt92hlo310dfvt7.apps.googleusercontent.com'; // public OAuth client id (not a secret); allowed origin: https://splitzhappen.github.io

  let gisPromise = null;
  function loadGis() {
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      if (globalThis.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = GIS_URL; // Google's sign-in library, loaded only when the user asks to sync
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('Could not reach Google. Check the internet connection.')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  // Opens Google's own sign-in window; resolves with a short-lived access token.
  ET.driveSignIn = async function (clientId, prompt) {
    if (!clientId) throw new Error('Cloud sync is not set up on this site yet.');
    await loadGis();
    return new Promise((resolve, reject) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (r) => (r && r.access_token ? resolve(r.access_token) : reject(new Error((r && r.error) || 'Sign-in was cancelled.'))),
        error_callback: (e) => reject(new Error((e && e.message) || 'Sign-in was cancelled.')),
      });
      tc.requestAccessToken({ prompt: prompt == null ? '' : prompt });
    });
  };

  async function call(fetchImpl, token, url, opts) {
    const r = await fetchImpl(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, (opts || {}).headers) }));
    if (r.status === 401) throw Object.assign(new Error('Google sign-in expired. Sign in again.'), { code: 401 });
    if (!r.ok) throw new Error('Google Drive answered ' + r.status);
    return r;
  }

  async function findFile(f, token) {
    const q = encodeURIComponent("name='" + FILE + "'");
    // oldest first: if two devices ever created the file at the same moment, every device keeps using the same one
    const r = await call(f, token, DRIVE + '?spaces=appDataFolder&orderBy=createdTime&fields=files(id,modifiedTime)&q=' + q);
    const j = await r.json();
    return (j.files && j.files[0]) || null;
  }

  // Returns { id, modifiedTime } of the written file. Google accepts at most 5 MB in one such request: a larger copy
  // is refused here with a plain message instead of Google's bare error (backup files and transfer codes still work).
  // The limit is counted in bytes as sent (UTF-8), not in characters, so names in non-Latin letters count fully.
  ET.DRIVE_MAX_BYTES = 5 * 1024 * 1024 - 64 * 1024;
  async function upload(f, token, fileId, doc) {
    const body = JSON.stringify(doc);
    if (globalThis.CC.byteLength(body) > ET.DRIVE_MAX_BYTES) throw Object.assign(new Error('The cloud copy has grown past the 5 MB that cloud sync can send in one go, even compressed, so nothing was sent. Use backup files or a transfer code until the app is updated.'), { code: 'too-large' });
    if (fileId) {
      const r = await call(f, token, UPLOAD + '/' + fileId + '?uploadType=media&fields=id,modifiedTime', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      let j = null; try { j = await r.json(); } catch (e) { j = null; }
      return { id: fileId, modifiedTime: (j && j.modifiedTime) || null };
    }
    const boundary = 'evt' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
    const multipart = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + boundary + '--';
    const r = await call(f, token, UPLOAD + '?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart });
    const j = await r.json();
    return { id: j.id, modifiedTime: j.modifiedTime || null };
  }

  // The cloud copy (gate 1C, finding F2): the shareable part of the one save, every module's section, compressed.
  // A full 8-character save is 8.4 MB as plain text, past the 5 MB limit; compressed it is about 1.4 MB.
  // It keeps the app tag and file name and carries version 2, so a tracker from before gate 1C, which knows only
  // version 1, refuses it with "saved by a newer version" instead of misreading it (or calling it damaged).
  // A plain version 1 copy, written by a device not yet updated, is still read.
  const TAG = 'eveniunt-completionist-tracker', FORMAT = 'deflate-raw+base64';
  ET.CLOUD_VERSION = 2;
  const cloudDoc = async (st) => {
    const save = ET.saveDoc(st);
    return { app: TAG, v: ET.CLOUD_VERSION, format: FORMAT, data: await globalThis.CC.pack(JSON.stringify({ app: globalThis.CC.APP, v: globalThis.CC.VERSION, chars: save.chars, modules: save.modules })) };
  };
  ET.cloudDoc = cloudDoc;
  // The cloud copy as read, in the portable form the merge uses (null when it cannot be read).
  ET.readCloud = async function (doc) {
    if (doc && typeof doc.v === 'number' && doc.v > ET.CLOUD_VERSION) throw new Error('The cloud copy was saved by a newer version of the app. Reload this page to update, then sync again.');
    if (!doc || doc.app !== TAG || doc.v !== 2) return doc;
    if (doc.format !== FORMAT || typeof doc.data !== 'string') return null;
    let inner;
    try { inner = JSON.parse(await globalThis.CC.unpack(doc.data, 64 * 1024 * 1024)); } catch (e) { return null; }
    if (!inner || inner.app !== globalThis.CC.APP || !Number.isInteger(inner.v)) return null;
    if (inner.v > globalThis.CC.VERSION) throw new Error('The cloud copy was saved by a newer version of the app. Reload this page to update, then sync again.');
    return Object.assign({ app: TAG, v: 1 }, ET.fromSaveDoc(inner));
  };
  const looksValid = (doc) => {
    if (!doc || doc.app !== 'eveniunt-completionist-tracker' || !Number.isInteger(doc.v) || doc.v < 1 || doc.v > ET.STATE_VERSION || !Array.isArray(doc.chars) || !doc.chars.length || doc.chars.length > ET.MAX_CHARS || !doc.ticks || typeof doc.ticks !== 'object' || Array.isArray(doc.ticks)) return false;
    const ids = new Set();
    return doc.chars.every((c) => c && typeof c.id === 'string' && ET.CHAR_ID.test(c.id) && !ids.has(c.id) && ids.add(c.id) && Object.prototype.hasOwnProperty.call(doc.ticks, c.id) && doc.ticks[c.id] && typeof doc.ticks[c.id] === 'object' && !Array.isArray(doc.ticks[c.id]));
  };
  const tickCount = (p) => Object.values((p && p.ticks) || {}).reduce((a, t) => a + Object.keys(t || {}).length, 0);
  // How many of this device's ticks the merge would remove without asking (changes made on the other device).
  ET.mergeLoss = function (local, result) {
    let n = 0;
    for (const [c, t] of Object.entries(local.ticks || {})) for (const k of Object.keys(t)) if (!result.merged.has('t|' + c + '|' + k) && !result.conflicts.some((x) => x.id === 't|' + c + '|' + k)) n++;
    return n;
  };

  // Step 1: read the cloud copy and merge. Returns { done: true } when nothing needs the owner, or { done: false,
  // conflicts, loss, result, fileId, modifiedTime } when the owner must choose (conflicts) or confirm (a large loss).
  ET.driveSync = async function (st, token, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    const file = await findFile(f, token);
    const local = ET.portable(st);
    if (!file) {
      const w = await upload(f, token, null, await cloudDoc(st));
      st.sync.drive = { fileId: w.id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(local)) };
      return { done: true, created: true };
    }
    const r = await call(f, token, DRIVE + '/' + file.id + '?alt=media');
    let remote = null;
    try { remote = await r.json(); } catch (e) { remote = null; }
    remote = await ET.readCloud(remote);
    if (!looksValid(remote)) throw Object.assign(new Error('The cloud copy is damaged or not a tracker copy, so nothing was merged and this device kept its data.'), { code: 'damaged', fileId: file.id });
    const base = st.sync.drive && st.sync.drive.fileId === file.id ? st.sync.drive.base : null;
    const result = ET.threeWay(base, local, remote);
    const loss = ET.mergeLoss(local, result);
    const pending = { result, fileId: file.id, modifiedTime: file.modifiedTime, remote };
    // every tick the other device's copy would remove here is confirmed first, however few (a damaged or stale copy
    // must never remove ticks silently; unticking is rare in a completion tracker, so the question is rare too)
    const big = loss > 0;
    if (result.conflicts.length || big) return Object.assign({ done: false, conflicts: result.conflicts, loss: big ? loss : 0 }, pending);
    await ET.driveFinish(st, token, pending, {}, f);
    return { done: true };
  };

  // Step 2: apply the owner's choices, write the merged copy back, and remember it as the new base.
  //  - If the cloud copy changed since step 1 (another device synced meanwhile), nothing is written ('changed': the
  //    caller syncs again).
  //  - The merge is built on a copy and applied here only once the upload has worked; ticks made on this device during
  //    the upload are kept.
  //  - Google Drive has no "write only if unchanged", so a device writing in the instant between the check and the
  //    upload could still be overwritten. After writing, the file is checked again a moment later: if another device
  //    wrote after this one, the base is set back to the copy this device merged from, so the next sync (started at
  //    once: 'changed') combines both copies instead of reading the other device's ticks as removals. Each device does
  //    the same check, so whichever wrote first also sees the later write and combines.
  ET.DRIVE_SETTLE_MS = 2500;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  ET.driveFinish = async function (st, token, pending, choices, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    if (pending.modifiedTime) {
      const now = await findFile(f, token);
      if (now && now.modifiedTime && now.modifiedTime !== pending.modifiedTime) throw Object.assign(new Error('Another device synced at the same time. Sync again to include its changes.'), { code: 'changed' });
    }
    const before = JSON.parse(JSON.stringify(ET.portable(st)));
    const candidate = ET.applyMerge(JSON.parse(JSON.stringify(st)), pending.result, choices);
    const doc = JSON.parse(JSON.stringify(ET.portable(candidate)));
    const w = await upload(f, token, pending.fileId, await cloudDoc(candidate));
    // apply the merged copy here; anything changed on this device since step 1 is kept on top of it
    ET.applyMerge(st, ET.threeWay(before, ET.portable(st), doc), {});
    st.sync.drive = { fileId: w.id, at: new Date().toISOString(), base: doc };
    if (!w.modifiedTime) return;
    if (ET.DRIVE_SETTLE_MS) await wait(ET.DRIVE_SETTLE_MS);
    const after = await findFile(f, token);
    if (after && after.id === w.id && after.modifiedTime && after.modifiedTime !== w.modifiedTime) {
      st.sync.drive.base = pending.remote ? JSON.parse(JSON.stringify(pending.remote)) : null;
      throw Object.assign(new Error('Another device synced at the same moment. Syncing again to combine both.'), { code: 'changed' });
    }
  };

  // Replace the cloud copy with this device's data (used only when the owner chooses it, e.g. after a damaged copy).
  ET.driveOverwrite = async function (st, token, fileId, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    const w = await upload(f, token, fileId || null, await cloudDoc(st));
    st.sync.drive = { fileId: w.id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(ET.portable(st))) };
  };
})();
