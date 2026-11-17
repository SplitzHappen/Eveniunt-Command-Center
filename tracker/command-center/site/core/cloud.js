// Cloud sync through the owner's own OneDrive (gate 1E, owner decision 2026-11-09: "sign-in: B (OneDrive)").
// The cloud copy lives in the app's own folder of the owner's OneDrive (Microsoft Graph "approot": the app sees only
// that folder). Signing in goes through Microsoft's sign-in page once per device; a small helper of the owner's
// (helper/worker.js, a Cloudflare Worker) keeps that device's long-lived sign-in and hands this page a fresh
// one-hour key on request, so after the first sign-in on a device nothing is asked again. The page never sees the
// client secret or the long-lived key; the helper never sees the cloud copy.
// Plain script: attaches to globalThis.ET so the same file runs in the bundled page and in Node tests.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const FILE = 'eveniunt-command-center.json';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'; // personal Microsoft accounts
  const SCOPES = 'openid offline_access Files.ReadWrite.AppFolder';
  const DEVICE_KEY = 'eveniunt-cloud-device'; // localStorage, this device: the helper's handle for this device's sign-in
  const SESSION_KEY = 'eveniunt-cloud-key';   // sessionStorage, this tab: the hour's key
  const PKCE_KEY = 'eveniunt-cloud-pkce';     // sessionStorage, this tab: the sign-in round trip in progress
  const RETURN_KEY = 'eveniunt-cloud-return'; // sessionStorage, this tab: what oauth.html brought back

  // ── set-up read from the site (sync-config.json next to the page; absent on the file opened from disk) ──
  // { clientId, helper, authority?, graph? }: authority and graph are overridden only by the test server.
  let cfgPromise = null;
  ET.cloudConfig = function (fetchImpl) {
    if (cfgPromise) return cfgPromise;
    const f = fetchImpl || globalThis.fetch;
    if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol) || !f) return (cfgPromise = Promise.resolve(null));
    cfgPromise = f(new URL('sync-config.json', ET.CLOUD_BASE || location.href).href, { cache: 'no-cache' }).then(async (r) => {
      if (!r.ok) return null;
      const c = await r.json();
      if (!c || typeof c.clientId !== 'string' || typeof c.helper !== 'string' || !/^https?:\/\//.test(c.helper)) return null;
      return { clientId: c.clientId, helper: c.helper.replace(/\/$/, ''), authority: (c.authority || AUTHORITY).replace(/\/$/, ''), graph: (c.graph || GRAPH).replace(/\/$/, '') };
    }).catch(() => null);
    return cfgPromise;
  };
  ET.cloudResetConfig = function () { cfgPromise = null; };

  const store = (kind) => { try { return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage; } catch (e) { return null; } };
  const readJson = (kind, key) => { try { const s = store(kind); return s ? JSON.parse(s.getItem(key) || 'null') : null; } catch (e) { return null; } };
  const writeJson = (kind, key, v) => { try { const s = store(kind); if (!s) return; if (v == null) s.removeItem(key); else s.setItem(key, JSON.stringify(v)); } catch (e) { /* private window */ } };
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };

  // What this device knows: signed in here before (the helper holds its key), and whether this tab has the hour's key.
  ET.cloudState = function () {
    const d = readJson('local', DEVICE_KEY), k = readJson('session', SESSION_KEY);
    return { device: !!(d && d.device), since: d && d.at ? d.at : null, key: !!(k && k.token && k.exp > Date.now() + 60 * 1000), pending: !!readJson('session', RETURN_KEY) };
  };
  // ET.CLOUD_BASE: the Tracker's folder, set by a page outside it (the Command Center's Settings, 2026-11-12) so the set-up
  // file and Microsoft's registered return address (tracker/oauth.html) are the same from every page
  ET.cloudReturnAddress = function () { return new URL('oauth.html', ET.CLOUD_BASE || location.href).href; };

  // Step 1 of the first sign-in on a device: leave for Microsoft's sign-in page. The page reloads at oauth.html, which
  // records the answer and comes back here; ET.cloudComplete finishes.
  ET.cloudBegin = async function (cfg) {
    const verifier = random(48), state = random(16);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    writeJson('session', PKCE_KEY, { verifier, state, at: Date.now() });
    writeJson('session', 'eveniunt-cloud-back', location.href.split('#')[0] + (ET.CLOUD_BASE ? '#settings' : '')); // oauth.html returns where the sign-in started
    const q = new URLSearchParams({ client_id: cfg.clientId, response_type: 'code', redirect_uri: ET.cloudReturnAddress(), response_mode: 'query', scope: SCOPES,
      state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
    location.assign(cfg.authority + '/authorize?' + q.toString());
  };

  async function helper(cfg, f, path, body) {
    let r;
    try { r = await f(cfg.helper + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { throw Object.assign(new Error('Could not reach the sync helper. Check the internet connection.'), { code: 'offline' }); }
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (r.status === 401 || r.status === 410) throw Object.assign(new Error((j && j.message) || 'This device’s sign-in has ended. Sign in again.'), { code: 'signed-out' });
    if (!r.ok) throw Object.assign(new Error((j && j.message) || ('The sync helper answered ' + r.status)), { code: 'helper', status: r.status });
    return j;
  }
  const keep = (j) => { writeJson('session', SESSION_KEY, { token: j.token, exp: Date.now() + Math.max(60, Number(j.expires_in) || 3600) * 1000 - 30 * 1000 }); return j.token; };

  // Step 2 of the first sign-in: oauth.html brought back Microsoft's answer; trade it, through the helper, for this
  // device's handle and the hour's key. Returns the key, or null when nothing was pending.
  ET.cloudComplete = async function (cfg, fetchImpl) {
    const ret = readJson('session', RETURN_KEY), pk = readJson('session', PKCE_KEY);
    if (!ret) return null;
    writeJson('session', RETURN_KEY, null); writeJson('session', PKCE_KEY, null);
    if (ret.error) throw Object.assign(new Error(ret.error === 'access_denied' ? 'Sign-in was cancelled.' : ('Microsoft sign-in failed: ' + (ret.error_description || ret.error))), { code: 'denied' });
    if (!pk || !ret.code || ret.state !== pk.state) throw Object.assign(new Error('The sign-in answer did not match this tab’s request. Try again.'), { code: 'state' });
    const j = await helper(cfg, fetchImpl || globalThis.fetch, '/connect', { code: ret.code, verifier: pk.verifier, redirect_uri: ET.cloudReturnAddress() });
    if (!j || typeof j.device !== 'string' || typeof j.token !== 'string') throw Object.assign(new Error('The sync helper gave an unexpected answer.'), { code: 'helper' });
    writeJson('local', DEVICE_KEY, { device: j.device, at: Date.now() });
    return keep(j);
  };

  // Every later sitting: the hour's key, from this tab if still fresh, else from the helper with this device's handle.
  // Rejects with code 'not-signed-in' (never signed in here), 'signed-out' (the helper no longer knows this device:
  // the owner signed out, or the sign-in was revoked) or 'offline'.
  ET.cloudToken = async function (cfg, fetchImpl, force) {
    const k = readJson('session', SESSION_KEY);
    if (!force && k && k.token && k.exp > Date.now()) return k.token;
    const d = readJson('local', DEVICE_KEY);
    if (!d || !d.device) throw Object.assign(new Error('not signed in'), { code: 'not-signed-in' });
    try {
      const j = await helper(cfg, fetchImpl || globalThis.fetch, '/token', { device: d.device });
      if (!j || typeof j.token !== 'string') throw Object.assign(new Error('The sync helper gave an unexpected answer.'), { code: 'helper' });
      return keep(j);
    } catch (e) {
      if (e.code === 'signed-out') { writeJson('local', DEVICE_KEY, null); writeJson('session', SESSION_KEY, null); }
      throw e;
    }
  };

  // Sign out on this device: the helper forgets the device's key; nothing in the save changes.
  ET.cloudForget = async function (cfg, fetchImpl) {
    const d = readJson('local', DEVICE_KEY);
    writeJson('local', DEVICE_KEY, null); writeJson('session', SESSION_KEY, null);
    if (d && d.device && cfg) { try { await helper(cfg, fetchImpl || globalThis.fetch, '/forget', { device: d.device }); } catch (e) { /* already forgotten, or offline: the local record is gone either way */ } }
  };

  // ── the cloud copy in OneDrive ──
  const item = (cfg) => (cfg && cfg.graph ? cfg.graph : GRAPH) + '/me/drive/special/approot:/' + FILE;
  async function call(f, token, url, opts) {
    let r;
    try { r = await f(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, (opts || {}).headers) })); } catch (e) { throw Object.assign(new Error('Could not reach OneDrive. Check the internet connection.'), { code: 'offline' }); }
    if (r.status === 401) throw Object.assign(new Error('The OneDrive key expired. Syncing again.'), { code: 401 });
    if (r.status === 412) throw Object.assign(new Error('Another device synced at the same time. Syncing again to include its changes.'), { code: 'changed' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('OneDrive answered ' + r.status);
    return r;
  }
  // { id, eTag, download } of the cloud copy, or null when there is none yet.
  async function findFile(f, token, cfg) {
    const r = await call(f, token, item(cfg) + '?select=id,eTag,size,@microsoft.graph.downloadUrl');
    if (!r) return null;
    const j = await r.json();
    return { id: j.id, eTag: j.eTag || null, download: j['@microsoft.graph.downloadUrl'] || null, size: j.size };
  }
  async function readFile(f, token, cfg, file) {
    // the download address is pre-authorised by OneDrive, so the key is not sent along with it
    let r;
    if (file.download) { try { r = await f(file.download); } catch (e) { throw Object.assign(new Error('Could not reach OneDrive. Check the internet connection.'), { code: 'offline' }); } if (!r.ok) throw new Error('OneDrive answered ' + r.status); }
    else { r = await call(f, token, item(cfg) + ':/content'); if (!r) return null; }
    try { return await r.json(); } catch (e) { return null; }
  }
  // Writes the copy and returns { id, eTag }. OneDrive takes at most 4 MB in one such request: a larger copy is refused
  // here with a plain message (backup files and transfer codes still work). The limit is counted in bytes as sent (UTF-8).
  // With an eTag, OneDrive writes only if the copy is still the one this device read (412 otherwise): "write only if
  // unchanged", which Google Drive lacked.
  ET.CLOUD_MAX_BYTES = 4 * 1024 * 1024 - 64 * 1024;
  async function upload(f, token, cfg, eTag, doc) {
    const body = JSON.stringify(doc);
    if (globalThis.CC.byteLength(body) > ET.CLOUD_MAX_BYTES) throw Object.assign(new Error('The cloud copy has grown past the 4 MB that cloud sync can send in one go, even compressed, so nothing was sent. Use backup files or a transfer code until the app is updated.'), { code: 'too-large' });
    const headers = { 'Content-Type': 'application/json' };
    if (eTag) headers['If-Match'] = eTag;
    const r = await call(f, token, item(cfg) + ':/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', headers, body });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    return { id: (j && j.id) || null, eTag: (j && j.eTag) || null };
  }

  // The cloud copy (gate 1C, finding F2): the shareable part of the one save, every module's section, compressed.
  // Version 2, as in gate 1C: a tracker from before gate 1C refuses it instead of misreading it. A plain version 1
  // copy, written by a device not yet updated, is still read.
  const TAG = 'eveniunt-completionist-tracker', FORMAT = 'deflate-raw+base64';
  ET.CLOUD_VERSION = 2;
  const cloudDoc = async (st) => {
    const save = ET.saveDoc(st);
    return { app: TAG, v: ET.CLOUD_VERSION, format: FORMAT, data: await globalThis.CC.pack(JSON.stringify({ app: globalThis.CC.APP, v: globalThis.CC.VERSION, chars: save.chars, modules: save.modules })) };
  };
  ET.cloudDoc = cloudDoc;
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
  // How many of this device's ticks the merge would remove without asking (changes made on the other device).
  ET.mergeLoss = function (local, result) {
    let n = 0;
    for (const [c, t] of Object.entries(local.ticks || {})) for (const k of Object.keys(t)) if (!result.merged.has('t|' + c + '|' + k) && !result.conflicts.some((x) => x.id === 't|' + c + '|' + k)) n++;
    return n;
  };

  // Step 1: read the cloud copy and merge. Returns { done: true } when nothing needs the owner, or { done: false,
  // conflicts, loss, result, fileId, eTag, remote } when the owner must choose (conflicts) or confirm (a removal).
  // st.sync.drive keeps its gate 1C shape ({ fileId, at, base }): fileId is now the OneDrive item id.
  ET.cloudSync = async function (st, token, fetchImpl, cfg) {
    const f = fetchImpl || globalThis.fetch;
    const file = await findFile(f, token, cfg);
    const local = ET.portable(st);
    if (!file) {
      const w = await upload(f, token, cfg, null, await cloudDoc(st));
      st.sync.drive = { fileId: w.id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(local)) };
      return { done: true, created: true };
    }
    let remote = await readFile(f, token, cfg, file);
    remote = await ET.readCloud(remote);
    if (!looksValid(remote)) throw Object.assign(new Error('The cloud copy is damaged or not a tracker copy, so nothing was merged and this device kept its data.'), { code: 'damaged', fileId: file.id });
    const base = st.sync.drive && st.sync.drive.fileId === file.id ? st.sync.drive.base : null;
    const result = ET.threeWay(base, local, remote);
    const loss = ET.mergeLoss(local, result);
    const pending = { result, fileId: file.id, eTag: file.eTag, remote };
    // every tick the other device's copy would remove here is confirmed first, however few (a damaged or stale copy
    // must never remove ticks silently; unticking is rare in a completion tracker, so the question is rare too)
    if (result.conflicts.length || loss > 0) return Object.assign({ done: false, conflicts: result.conflicts, loss }, pending);
    await ET.cloudFinish(st, token, pending, {}, f, cfg);
    return { done: true };
  };

  // Step 2: apply the owner's choices, write the merged copy back only if the cloud copy is still the one read in
  // step 1 (OneDrive refuses otherwise: 'changed', and the caller syncs again, so the other device's changes are
  // combined instead of overwritten), and remember it as the new base. The merge is built on a copy and applied here
  // only once the upload has worked; ticks made on this device during the upload are kept.
  ET.cloudFinish = async function (st, token, pending, choices, fetchImpl, cfg) {
    const f = fetchImpl || globalThis.fetch;
    const before = JSON.parse(JSON.stringify(ET.portable(st)));
    const candidate = ET.applyMerge(JSON.parse(JSON.stringify(st)), pending.result, choices);
    const doc = JSON.parse(JSON.stringify(ET.portable(candidate)));
    const w = await upload(f, token, cfg, pending.eTag, await cloudDoc(candidate));
    ET.applyMerge(st, ET.threeWay(before, ET.portable(st), doc), {});
    st.sync.drive = { fileId: w.id || pending.fileId, at: new Date().toISOString(), base: doc };
  };

  // Replace the cloud copy with this device's data (used only when the owner chooses it, e.g. after a damaged copy).
  ET.cloudOverwrite = async function (st, token, fetchImpl, cfg) {
    const f = fetchImpl || globalThis.fetch;
    const w = await upload(f, token, cfg, null, await cloudDoc(st));
    st.sync.drive = { fileId: w.id, at: new Date().toISOString(), base: JSON.parse(JSON.stringify(ET.portable(st))) };
  };
})();
