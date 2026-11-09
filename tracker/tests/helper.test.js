'use strict';
// The sync helper (helper/worker.js), run in Node against a stand-in Microsoft token endpoint and an in-memory device
// store. Run: node --test tests/helper.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../helper/worker.js');
const { create } = require('./standins.js');
const ORIGIN = 'https://site.test';

function env() { const s = create(ORIGIN); return { env: s.env, state: s.state, kv: s.kv }; }
const post = (e, path, body, origin = ORIGIN) => handle(new Request('https://helper.test' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), e);
const issue = (state) => { const code = 'code' + (++state.tokens); state.codes.set(code, { used: false }); return code; };
const verifier = 'v'.repeat(48);

test('helper: preflight and origin rules', async () => {
  const { env: e } = env();
  const ok = await handle(new Request('https://helper.test/token', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), e);
  assert.equal(ok.status, 204); assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const no = await handle(new Request('https://helper.test/token', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }), e);
  assert.equal(no.status, 403); assert.equal(no.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await post(e, '/token', { device: 'a'.repeat(64) }, 'https://evil.test')).status, 403);
  const home = await handle(new Request('https://helper.test/'), e);
  assert.equal(home.status, 200); assert.match(await home.text(), /sync helper/);
});

test('helper: connect trades the code for a device handle and the first key; the long-lived sign-in stays inside', async () => {
  const { env: e, state, kv } = env();
  const r = await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.match(j.device, /^[0-9a-f]{64}$/); assert.equal(j.token, 'at2'); assert.equal(j.expires_in, 3600);
  assert.equal(kv.size, 1);
  const stored = JSON.parse(kv.get(j.device));
  assert.equal(stored.rt, 'rt2');
  assert.ok(!JSON.stringify(j).includes('rt2') && !JSON.stringify(j).includes('test-secret'), 'the response carries neither the long-lived sign-in nor the secret');
  // a return address on another site is refused before Microsoft is asked
  const bad = await post(e, '/connect', { code: issue(state), verifier, redirect_uri: 'https://evil.test/oauth.html' });
  assert.equal(bad.status, 400);
  // a used or unknown code is refused
  assert.equal((await post(e, '/connect', { code: 'nope', verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).status, 400);
  assert.equal((await post(e, '/connect', { code: 'x', verifier: 'short', redirect_uri: ORIGIN + '/x' })).status, 400);
});

test('helper: token renews the key for a known device and rotates the long-lived sign-in; unknown or ended devices get 401', async () => {
  const { env: e, state, kv } = env();
  const { device } = await (await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).json();
  const t1 = await (await post(e, '/token', { device })).json();
  assert.equal(t1.token, 'at3'); assert.equal(JSON.parse(kv.get(device)).rt, 'rt3', 'rotated');
  const t2 = await (await post(e, '/token', { device })).json();
  assert.equal(t2.token, 'at4');
  assert.equal((await post(e, '/token', { device: 'b'.repeat(64) })).status, 401);
  assert.equal((await post(e, '/token', { device: 'not-a-handle' })).status, 400);
  // the owner revoked the app in the Microsoft account: the device is forgotten and the Tracker asks for one tap
  state.revoked = true;
  const gone = await post(e, '/token', { device });
  assert.equal(gone.status, 401); assert.equal(kv.size, 0);
});

test('helper: forget removes the device; a second forget is harmless', async () => {
  const { env: e, state, kv } = env();
  const { device } = await (await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).json();
  assert.equal(kv.size, 1);
  assert.equal((await post(e, '/forget', { device })).status, 200); assert.equal(kv.size, 0);
  assert.equal((await post(e, '/forget', { device })).status, 200);
  assert.equal((await post(e, '/token', { device })).status, 401);
});

test('helper: Microsoft unreachable answers 502 and forgets nothing', async () => {
  const { env: e, state, kv } = env();
  const { device } = await (await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).json();
  const down = Object.assign({}, e, { fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  assert.equal((await post(down, '/token', { device })).status, 502);
  assert.equal(kv.size, 1);
});
