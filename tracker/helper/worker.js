// Eveniunt Command Center sync helper (gate 1E, owner decision 2026-11-09: cloud sync through OneDrive with a small
// hosted helper). A Cloudflare Worker on the free plan. For the Tracker page at the allowed origin it does three things
// (and, since Submersibles step S7, phone notifications: see the push section below):
//   POST /connect  { code, verifier, redirect_uri }  -> trades Microsoft's one-time sign-in code (with the client
//                  secret only this helper holds) for the device's long-lived sign-in, stores it under a fresh random
//                  device handle, and returns { device, token, expires_in } (the handle and the first hour's key);
//   POST /token    { device }                         -> a fresh hour's key for a known device: { token, expires_in };
//   POST /forget   { device }                         -> forgets the device (sign out on that device).
// The helper never sees the cloud copy (the page talks to OneDrive directly) and never logs tokens. A device handle is
// 32 random bytes; whoever holds it can get hour keys to the Tracker's own OneDrive folder, so it lives only in that
// device's browser storage, never in backups, transfer codes or the cloud copy.
// Bindings (wrangler.toml): KV namespace DEVICES; secrets MS_CLIENT_SECRET; vars MS_CLIENT_ID, ALLOWED_ORIGINS
// (comma-separated), optional AUTHORITY (default: personal Microsoft accounts).
'use strict';
const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const SCOPES = 'openid offline_access Files.ReadWrite.AppFolder';

function cors(env, origin) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return { ok, headers: ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' } : {} };
}
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}) });
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const newDevice = () => hex(crypto.getRandomValues(new Uint8Array(32)));

async function microsoft(env, f, params) {
  const authority = (env.AUTHORITY || DEFAULT_AUTHORITY).replace(/\/$/, '');
  const body = new URLSearchParams(Object.assign({ client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, scope: SCOPES }, params));
  let r;
  try { r = await f(authority + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); }
  catch (e) { return { status: 502, error: 'microsoft_unreachable' }; }
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  if (!r.ok || !j || !j.access_token) return { status: r.status, error: (j && j.error) || 'microsoft_error', description: j && j.error_description };
  return { status: 200, access: j.access_token, refresh: j.refresh_token || null, expires: Number(j.expires_in) || 3600 };
}

// handle(request, env, fetchImpl): the whole helper, usable from Cloudflare (default export) and from Node tests.
async function handle(request, env, fetchImpl) {
  const f = fetchImpl || env.fetchImpl || globalThis.fetch;
  const origin = request.headers.get('Origin');
  const c = cors(env, origin);
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
  if (request.method === 'GET' && url.pathname === '/') return new Response('Eveniunt Command Center sync helper. Nothing to see here: the Tracker talks to this address on its own.', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (request.method !== 'POST') return json(405, { message: 'method not allowed' }, c.headers);
  if (!c.ok) return json(403, { message: 'origin not allowed' }, {});
  let body = null; try { body = await request.json(); } catch (e) { body = null; }
  if (!body || typeof body !== 'object') return json(400, { message: 'bad request' }, c.headers);
  const device = typeof body.device === 'string' && /^[0-9a-f]{64}$/.test(body.device) ? body.device : null;

  if (url.pathname === '/connect') {
    if (typeof body.code !== 'string' || typeof body.verifier !== 'string' || typeof body.redirect_uri !== 'string' || !body.code || body.verifier.length < 43) return json(400, { message: 'bad request' }, c.headers);
    // the return address must be on an allowed origin: the sign-in can only have come from the Tracker
    let ru; try { ru = new URL(body.redirect_uri); } catch (e) { return json(400, { message: 'bad request' }, c.headers); }
    if (ru.origin !== origin) return json(400, { message: 'the return address does not belong to this site' }, c.headers);
    const m = await microsoft(env, f, { grant_type: 'authorization_code', code: body.code, code_verifier: body.verifier, redirect_uri: body.redirect_uri });
    if (m.status !== 200) return json(m.status === 502 ? 502 : 400, { message: 'Microsoft refused the sign-in' + (m.description ? ': ' + m.description.split('\n')[0].slice(0, 200) : ''), error: m.error }, c.headers);
    if (!m.refresh) return json(502, { message: 'Microsoft gave no long-lived sign-in; check that the app asks for offline access', error: 'no_refresh_token' }, c.headers);
    const id = newDevice();
    await env.DEVICES.put(id, JSON.stringify({ rt: m.refresh, at: Date.now(), used: Date.now() }));
    return json(200, { device: id, token: m.access, expires_in: m.expires }, c.headers);
  }
  if (url.pathname === '/token') {
    if (!device) return json(400, { message: 'bad request' }, c.headers);
    const raw = await env.DEVICES.get(device);
    let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch (e) { rec = null; }
    if (!rec || !rec.rt) return json(401, { message: 'This device is not signed in any more. Sign in again.' }, c.headers);
    const m = await microsoft(env, f, { grant_type: 'refresh_token', refresh_token: rec.rt });
    if (m.status === 502) return json(502, { message: 'Microsoft could not be reached' }, c.headers);
    if (m.status !== 200) {
      // the long-lived sign-in was revoked or has expired: forget the device so the Tracker asks for one tap
      if (m.error === 'invalid_grant' || m.error === 'interaction_required') { await env.DEVICES.delete(device); return json(401, { message: 'This device’s sign-in has ended. Sign in again.', error: m.error }, c.headers); }
      return json(502, { message: 'Microsoft answered with an error', error: m.error }, c.headers);
    }
    await env.DEVICES.put(device, JSON.stringify({ rt: m.refresh || rec.rt, at: rec.at, used: Date.now() }));
    return json(200, { token: m.access, expires_in: m.expires }, c.headers);
  }
  if (url.pathname === '/forget') {
    if (device) await env.DEVICES.delete(device);
    return json(200, { ok: true }, c.headers);
  }
  if (url.pathname.startsWith('/push/')) return pushRoute(url.pathname, body, device, env, f, c.headers);
  return json(404, { message: 'not found' }, c.headers);
}

// ---------------------------------------------------------------------------------------------- phone notifications
// Submersibles step S7 (design section 6). Each device that turned notifications on gives the helper its standard web
// push address; the Command Center page gives the helper the alert times and short labels it worked out from the save
// ("Alpha Company · Sub One is back"). A timer once a minute sends the alerts that are due to every such device and
// then deletes them. The helper never sees the save, loot or ranks. Only devices signed in for cloud sync (a device
// handle this helper issued) may turn notifications on or change the schedule.
// Stored in the DEVICES namespace under two keys, so the minute timer costs one read a minute and one write per minute
// that sends something (Cloudflare's free plan: 100,000 reads and 1,000 writes a day):
//   push:subs   { <device>: { endpoint, keys: { p256dh, auth } } }
//   push:sched  { stamp, alerts: [ { id, at, title, body } ] }   (stamp: the save's time when the page worked it out;
//                                                                 an older save never replaces a newer schedule)
// Set-up (helper/README.md): secret VAPID_JWK (the push signing key, made by helper/make-push-key.js), var
// VAPID_SUBJECT (the site's address), and the minute timer (wrangler.toml [triggers] crons = ["* * * * *"]).
const b64u = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const t = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; };
const cat = (...parts) => { const n = parts.reduce((t, p) => t + p.length, 0), out = new Uint8Array(n); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };
const enc = (s) => new TextEncoder().encode(s);
function vapidJwk(env) { try { const j = JSON.parse(env.VAPID_JWK || ''); return j && j.kty === 'EC' && j.crv === 'P-256' && j.d && j.x && j.y ? j : null; } catch (e) { return null; } }
const publicRaw = (jwk) => cat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y));
async function kvJson(env, key, dflt) { const raw = await env.DEVICES.get(key); try { return raw ? JSON.parse(raw) : dflt; } catch (e) { return dflt; } }
async function hkdf(ikm, salt, info, bits) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bits));
}
// RFC 8291 (message encryption for web push, aes128gcm) and RFC 8292 (VAPID): the standard every browser's push
// service accepts. Returns the request to send to the device's push address.
async function pushRequest(sub, payload, env) {
  const jwk = vapidJwk(env);
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(shared, auth, cat(enc('WebPush: info\0'), ua, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, enc('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(ikm, salt, enc('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc(JSON.stringify(payload)), new Uint8Array([2]))));
  const body = cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, cipher);
  const aud = new URL(sub.endpoint).origin;
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), claims = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:owner@example.invalid' })));
  const signKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, enc(head + '.' + claims));
  return { url: sub.endpoint, init: { method: 'POST', body, headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high', Authorization: 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + b64u(publicRaw(jwk)) } } };
}
// Send one notification to one device; true if the push service took it, 'gone' if the address no longer exists.
async function sendPush(sub, payload, env, f) {
  try {
    const r = await pushRequest(sub, payload, env);
    const res = await f(r.url, r.init);
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.status >= 200 && res.status < 300;
  } catch (e) { return false; }
}
const okSub = (s) => s && typeof s === 'object' && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;
const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
async function pushRoute(path, body, device, env, f, headers) {
  const jwk = vapidJwk(env);
  if (!jwk) return json(503, { message: 'Phone notifications are not set up on the helper yet (helper/README.md, section 4).', error: 'push_not_set_up' }, headers);
  if (path === '/push/key') return json(200, { key: b64u(publicRaw(jwk)) }, headers);
  if (!device) return json(400, { message: 'bad request' }, headers);
  if (!(await env.DEVICES.get(device))) return json(401, { message: 'This device is not signed in for cloud sync. Sign in once in the Tracker (Settings, Cloud sync), then turn notifications on.' }, headers);
  if (path === '/push/subscribe') {
    if (!okSub(body.subscription)) return json(400, { message: 'bad request' }, headers);
    const subs = await kvJson(env, 'push:subs', {});
    subs[device] = { endpoint: body.subscription.endpoint, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth } };
    await env.DEVICES.put('push:subs', JSON.stringify(subs));
    return json(200, { ok: true, devices: Object.keys(subs).length }, headers);
  }
  if (path === '/push/unsubscribe') {
    const subs = await kvJson(env, 'push:subs', {});
    if (subs[device]) { delete subs[device]; await env.DEVICES.put('push:subs', JSON.stringify(subs)); }
    return json(200, { ok: true }, headers);
  }
  if (path === '/push/schedule') {
    const now = Date.now(), stamp = Number(body.stamp) || 0;
    const cur = await kvJson(env, 'push:sched', { stamp: 0, alerts: [] });
    if (stamp < cur.stamp) return json(200, { kept: true, count: cur.alerts.length, next: cur.alerts.length ? Math.min(...cur.alerts.map((a) => a.at)) : null }, headers);
    const alerts = (Array.isArray(body.alerts) ? body.alerts : []).filter((a) => a && Number.isFinite(a.at) && a.at > now - 60000).slice(0, 300)
      .map((a) => ({ id: text(a.id, 80), at: Math.round(a.at), title: text(a.title, 120), body: text(a.body, 300) }));
    if (JSON.stringify(alerts) !== JSON.stringify(cur.alerts) || stamp !== cur.stamp) await env.DEVICES.put('push:sched', JSON.stringify({ stamp, alerts }));
    return json(200, { count: alerts.length, next: alerts.length ? Math.min(...alerts.map((a) => a.at)) : null }, headers);
  }
  if (path === '/push/status') {
    const subs = await kvJson(env, 'push:subs', {}), sched = await kvJson(env, 'push:sched', { stamp: 0, alerts: [] });
    return json(200, { on: !!subs[device], devices: Object.keys(subs).length, count: sched.alerts.length, next: sched.alerts.length ? Math.min(...sched.alerts.map((a) => a.at)) : null }, headers);
  }
  if (path === '/push/test') {
    const subs = await kvJson(env, 'push:subs', {});
    if (!subs[device]) return json(400, { message: 'Notifications are not on for this device.' }, headers);
    const r = await sendPush(subs[device], { title: 'Eveniunt Command Center', body: 'Test: phone notifications work on this device.', tag: 'test' }, env, f);
    if (r === 'gone') { delete subs[device]; await env.DEVICES.put('push:subs', JSON.stringify(subs)); return json(410, { message: 'This device\'s notification address has expired. Turn notifications on again.' }, headers); }
    return r ? json(200, { ok: true }, headers) : json(502, { message: 'The push service did not take the test notification.' }, headers);
  }
  return json(404, { message: 'not found' }, headers);
}
// The minute timer: send what is due to every device, then delete it. Alerts due in the same minute go as one
// notification. Returns what it did (for the tests).
async function runCron(env, nowMs, fetchImpl) {
  const f = fetchImpl || env.fetchImpl || globalThis.fetch;
  if (!vapidJwk(env)) return { sent: 0, due: 0 };
  const now = nowMs || Date.now();
  const sched = await kvJson(env, 'push:sched', null);
  if (!sched || !sched.alerts || !sched.alerts.length) return { sent: 0, due: 0 };
  const due = sched.alerts.filter((a) => a.at <= now).sort((a, b) => a.at - b.at);
  if (!due.length) return { sent: 0, due: 0 };
  const subs = await kvJson(env, 'push:subs', {});
  const payload = due.length === 1 ? { title: due[0].title, body: due[0].body, tag: due[0].id }
    : { title: due.length + ' submarine alerts', body: due.map((a) => a.title).join('\n').slice(0, 900), tag: 'subs-' + now };
  let sent = 0, gone = false;
  for (const [dev, sub] of Object.entries(subs)) {
    const r = await sendPush(sub, payload, env, f);
    if (r === 'gone') { delete subs[dev]; gone = true; } else if (r) sent++;
  }
  await env.DEVICES.put('push:sched', JSON.stringify({ stamp: sched.stamp, alerts: sched.alerts.filter((a) => a.at > now) }));
  if (gone) await env.DEVICES.put('push:subs', JSON.stringify(subs));
  return { sent, due: due.length, payload };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { handle, runCron, pushRequest };
// Cloudflare's module syntax; ignored by Node (the line is a plain assignment there)
globalThis.__eveniuntHelper = { fetch: (request, env) => handle(request, env), scheduled: (event, env, ctx) => ctx.waitUntil(runCron(env)) };
