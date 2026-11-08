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
    const r = await call(f, token, DRIVE + '?spaces=appDataFolder&fields=files(id,modifiedTime)&q=' + q);
    const j = await r.json();
    return (j.files && j.files[0]) || null;
  }

  async function upload(f, token, fileId, doc) {
    const body = JSON.stringify(doc);
    if (fileId) {
      await call(f, token, UPLOAD + '/' + fileId + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      return fileId;
    }
    const boundary = 'evt' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
    const multipart = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + boundary + '--';
    const r = await call(f, token, UPLOAD + '?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart });
    return (await r.json()).id;
  }

  // Step 1: read the cloud copy and merge. Returns { done: true } when nothing needs the owner,
  // or { conflicts, result, fileId } for the "which one is right?" prompt.
  // The cloud copy carries the app tag and state version, so a copy written by a newer version is never merged by an
  // older one (it would read the unknown parts as deletions).
  const cloudDoc = (st) => Object.assign({ app: 'eveniunt-completionist-tracker', v: ET.STATE_VERSION }, ET.portable(st));
  const looksValid = (doc) => !!(doc && typeof doc === 'object' && Array.isArray(doc.chars) && doc.chars.some((c) => c && ET.CHAR_ID.test(c.id)) && doc.ticks && typeof doc.ticks === 'object');
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
      const id = await upload(f, token, null, cloudDoc(st));
      st.sync.drive = { fileId: id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(local)) };
      return { done: true, created: true };
    }
    const r = await call(f, token, DRIVE + '/' + file.id + '?alt=media');
    let remote = null;
    try { remote = await r.json(); } catch (e) { remote = null; }
    if (remote && typeof remote.v === 'number' && remote.v > ET.STATE_VERSION) throw new Error('The cloud copy was saved by a newer version of the tracker. Reload this page to update, then sync again.');
    if (!looksValid(remote)) throw Object.assign(new Error('The cloud copy is damaged or not a tracker copy, so nothing was merged and this device kept its data.'), { code: 'damaged', fileId: file.id });
    const base = st.sync.drive && st.sync.drive.fileId === file.id ? st.sync.drive.base : null;
    const result = ET.threeWay(base, local, remote);
    const loss = ET.mergeLoss(local, result);
    const pending = { result, fileId: file.id, modifiedTime: file.modifiedTime };
    const big = loss > 50 && loss > tickCount(local) / 10;
    if (result.conflicts.length || big) return Object.assign({ done: false, conflicts: result.conflicts, loss: big ? loss : 0 }, pending);
    await ET.driveFinish(st, token, pending, {}, f);
    return { done: true };
  };

  // Step 2: apply the owner's choices, write the merged copy back, and remember it as the new base. If the cloud copy
  // changed since step 1 (another device synced meanwhile), nothing is written and the caller syncs again.
  ET.driveFinish = async function (st, token, pending, choices, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    if (pending.modifiedTime) {
      const now = await findFile(f, token);
      if (now && now.modifiedTime && now.modifiedTime !== pending.modifiedTime) throw Object.assign(new Error('Another device synced at the same time. Sync again to include its changes.'), { code: 'changed' });
    }
    ET.applyMerge(st, pending.result, choices);
    const doc = ET.portable(st);
    const id = await upload(f, token, pending.fileId, cloudDoc(st));
    st.sync.drive = { fileId: id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(doc)) };
  };

  // Replace the cloud copy with this device's data (used only when the owner chooses it, e.g. after a damaged copy).
  ET.driveOverwrite = async function (st, token, fileId, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    const id = await upload(f, token, fileId || null, cloudDoc(st));
    st.sync.drive = { fileId: id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(ET.portable(st))) };
  };
})();
