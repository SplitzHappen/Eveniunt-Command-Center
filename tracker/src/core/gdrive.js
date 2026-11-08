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
  ET.driveSync = async function (st, token, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    const file = await findFile(f, token);
    const local = ET.portable(st);
    if (!file) {
      const id = await upload(f, token, null, local);
      st.sync.drive = { fileId: id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(local)) };
      return { done: true, created: true };
    }
    const r = await call(f, token, DRIVE + '/' + file.id + '?alt=media');
    const remote = await r.json();
    const base = st.sync.drive && st.sync.drive.fileId === file.id ? st.sync.drive.base : null;
    const result = ET.threeWay(base, local, remote);
    if (result.conflicts.length) return { done: false, conflicts: result.conflicts, result, fileId: file.id };
    await ET.driveFinish(st, token, { result, fileId: file.id }, {}, f);
    return { done: true };
  };

  // Step 2: apply the owner's choices, write the merged copy back, and remember it as the new base.
  ET.driveFinish = async function (st, token, pending, choices, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    ET.applyMerge(st, pending.result, choices);
    const doc = ET.portable(st);
    const id = await upload(f, token, pending.fileId, doc);
    st.sync.drive = { fileId: id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(doc)) };
  };
})();
