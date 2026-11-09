// Eveniunt Command Center sync helper (gate 1E, owner decision 2026-11-09: cloud sync through OneDrive with a small
// hosted helper). A Cloudflare Worker on the free plan. It does exactly three things, all for the Tracker page at the
// allowed origin:
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
  return json(404, { message: 'not found' }, c.headers);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { handle };
// Cloudflare's module syntax; ignored by Node (the line is a plain assignment there)
globalThis.__eveniuntHelper = { fetch: (request, env) => handle(request, env) };
