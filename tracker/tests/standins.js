'use strict';
// Stand-ins for the three outside services cloud sync talks to (gate 1E), for the browser tests and the Command Center
// checks: Microsoft's sign-in page and token endpoint, the sync helper (the REAL helper/worker.js, run in this process
// with an in-memory device store and the stand-in token endpoint), and OneDrive's file service (one file in the app
// folder, eTags, "write only if unchanged"). Everything is served on the same origin as the Tracker, under:
//   /login/authorize (GET)  the sign-in page: answers at once with a code, or with access_denied when told to
//   /helper/*        (POST) the helper
//   /graph/*               OneDrive
//   /standin/*       (POST) test controls: forget-all (the helper loses every device), revoke (long-lived sign-ins
//                          stop working), reset
// and the Tracker's set-up file, <wherever>/tracker/sync-config.json, pointing at these addresses.
const { handle } = require('../helper/worker.js');

function create(origin) {
  const kv = new Map();
  const state = { deny: false, revoked: false, codes: new Map(), refreshes: new Map(), tokens: 0, files: {}, etag: {}, clock: 0, log: [] };
  const env = {
    MS_CLIENT_ID: 'test-client', MS_CLIENT_SECRET: 'test-secret', ALLOWED_ORIGINS: origin, AUTHORITY: origin + '/login',
    DEVICES: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } },
    // the stand-in token endpoint, reached by the helper in-process
    fetchImpl: async (url, opts) => {
      const p = new URLSearchParams(opts.body);
      state.log.push(p.get('grant_type'));
      const bad = (error) => new Response(JSON.stringify({ error, error_description: error }), { status: 400 });
      if (p.get('client_id') !== 'test-client' || p.get('client_secret') !== 'test-secret') return bad('invalid_client');
      if (p.get('grant_type') === 'authorization_code') {
        const c = state.codes.get(p.get('code'));
        if (!c || c.used) return bad('invalid_grant');
        c.used = true;
        const rt = 'rt' + (++state.tokens); state.refreshes.set(rt, true);
        return new Response(JSON.stringify({ access_token: 'at' + state.tokens, refresh_token: rt, expires_in: 3600 }), { status: 200 });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (state.revoked || !state.refreshes.get(p.get('refresh_token'))) return bad('invalid_grant');
        state.refreshes.delete(p.get('refresh_token'));
        const rt = 'rt' + (++state.tokens); state.refreshes.set(rt, true);
        return new Response(JSON.stringify({ access_token: 'at' + state.tokens, refresh_token: rt, expires_in: 3600 }), { status: 200 });
      }
      return bad('unsupported_grant_type');
    }
  };
  const body = (req) => new Promise((ok) => { const b = []; req.on('data', (c) => b.push(c)); req.on('end', () => ok(Buffer.concat(b))); });
  const send = (res, status, obj, headers) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {})); res.end(obj == null ? '' : JSON.stringify(obj)); };

  // Returns true when it answered the request.
  async function handleHttp(req, res) {
    const u = new URL(req.url, origin);
    const p = u.pathname;
    if (p.endsWith('/sync-config.json')) { send(res, 200, { clientId: 'test-client', helper: origin + '/helper', authority: origin + '/login', graph: origin + '/graph' }); return true; }
    if (p === '/login/authorize') {
      const ru = u.searchParams.get('redirect_uri'), st = u.searchParams.get('state');
      const back = new URL(ru);
      if (state.deny) { back.searchParams.set('error', 'access_denied'); back.searchParams.set('state', st); }
      else { const code = 'code' + (++state.tokens); state.codes.set(code, { used: false, challenge: u.searchParams.get('code_challenge') }); back.searchParams.set('code', code); back.searchParams.set('state', st); }
      res.writeHead(302, { Location: back.href }); res.end(); return true;
    }
    if (p.startsWith('/helper/') || p === '/helper') {
      const b = await body(req);
      const request = new Request(origin + p.replace(/^\/helper/, '') || '/', { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : b });
      const r = await handle(request, env);
      const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer())); return true;
    }
    if (p.startsWith('/graph/')) {
      const auth = req.headers.authorization || '';
      if (!p.startsWith('/graph/dl/') && !/^Bearer at\d+$/.test(auth)) { send(res, 401, { error: { code: 'InvalidAuthenticationToken' } }); return true; }
      if (p.startsWith('/graph/dl/')) { send(res, 200, state.files.f1); return true; }
      if (req.method === 'GET' && p.includes('/me/drive/special/approot:/')) {
        if (!state.files.f1) { send(res, 404, { error: { code: 'itemNotFound' } }); return true; }
        send(res, 200, { id: 'f1', eTag: state.etag.f1, size: 1, '@microsoft.graph.downloadUrl': origin + '/graph/dl/f1' }); return true;
      }
      if (req.method === 'PUT' && p.includes(':/content')) {
        const b = await body(req);
        const match = req.headers['if-match'];
        if (match && match !== state.etag.f1) { send(res, 412, { error: { code: 'resourceModified' } }); return true; }
        state.files.f1 = JSON.parse(b.toString('utf8')); state.etag.f1 = 'e' + (++state.clock);
        send(res, match ? 200 : 201, { id: 'f1', eTag: state.etag.f1 }); return true;
      }
      send(res, 400, { error: { code: 'badRequest' } }); return true;
    }
    if (p.startsWith('/standin/')) {
      if (p === '/standin/forget-all') kv.clear();
      else if (p === '/standin/revoke') state.revoked = true;
      else if (p === '/standin/deny') state.deny = true;
      else if (p === '/standin/reset') { kv.clear(); state.deny = false; state.revoked = false; state.files = {}; state.etag = {}; }
      send(res, 200, { ok: true, devices: kv.size, file: !!state.files.f1, grants: state.log.slice() }); return true;
    }
    return false;
  }
  return { handle: handleHttp, state, kv, env };
}
module.exports = { create };
