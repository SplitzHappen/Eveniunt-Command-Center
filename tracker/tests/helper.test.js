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

// ── phone notifications (Submersibles step S7): the push key, subscriptions, the schedule and the minute timer, with a
//    stand-in push service that decrypts every message the way a browser does (RFC 8291) and checks the VAPID signature
const { runCron } = require('../helper/worker.js');
const nodeCrypto = require('crypto');
const { subtle } = nodeCrypto.webcrypto;
const u64 = (b) => Buffer.from(b).toString('base64url');
async function pushEnv() {
  const { env: e, state, kv } = env();
  const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', k.privateKey);
  e.VAPID_JWK = JSON.stringify({ kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y });
  e.VAPID_SUBJECT = 'https://site.test/';
  // a "browser": its own key pair and auth secret, and a push service that records and decrypts what it receives
  const ua = nodeCrypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = nodeCrypto.randomBytes(16);
  const got = [];
  let answer = 201;
  const pushFetch = async (url, init) => {
    if (!url.startsWith('https://push.test/')) return e.__msFetch(url, init);
    const body = Buffer.from(init.body);
    const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), cipher = body.subarray(21 + idlen);
    const shared = ua.computeSecret(asPub);
    const hk = (ikm, s, info, n) => Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, s, info, n));
    const ikm = hk(shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub]), 32);
    const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
    const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(cipher.subarray(cipher.length - 16));
    const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
    const [, jwt, kk] = /^vapid t=([^,]+), k=(.+)$/.exec(init.headers.Authorization);
    const [h, c, sig] = jwt.split('.');
    const pub = await subtle.importKey('raw', Buffer.from(kk, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const okSig = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(sig, 'base64url'), Buffer.from(h + '.' + c));
    got.push({ url, payload: JSON.parse(plain.subarray(0, plain.length - 1).toString()), delimiter: plain[plain.length - 1], okSig, claims: JSON.parse(Buffer.from(c, 'base64url')), encoding: init.headers['Content-Encoding'] });
    return new Response(null, { status: answer });
  };
  e.__msFetch = e.fetchImpl; e.fetchImpl = pushFetch;
  const subscription = { endpoint: 'https://push.test/send/abc', keys: { p256dh: u64(ua.getPublicKey()), auth: u64(auth) } };
  return { e, state, kv, got, subscription, setAnswer: (n) => { answer = n; } };
}

test('push: not set up answers 503; the key is public; only signed-in devices may subscribe or schedule', async () => {
  const { env: plainEnv } = env();
  assert.equal((await post(plainEnv, '/push/key', {})).status, 503);
  const { e, state, subscription } = await pushEnv();
  const key = await (await post(e, '/push/key', {})).json();
  assert.equal(Buffer.from(key.key, 'base64url').length, 65);
  assert.equal((await post(e, '/push/subscribe', { device: 'c'.repeat(64), subscription })).status, 401, 'unknown device');
  const { device } = await (await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).json();
  assert.equal((await post(e, '/push/subscribe', { device, subscription: { endpoint: 'http://insecure.test', keys: {} } })).status, 400);
  assert.equal((await post(e, '/push/subscribe', { device, subscription })).status, 200);
  assert.equal((await post(e, '/push/subscribe', { device, subscription }, 'https://evil.test')).status, 403);
});

test('push: the timer sends due alerts encrypted and signed, merges alerts of the same minute, deletes what it sent; an older save never replaces a newer schedule', async () => {
  const { e, state, kv, got, subscription, setAnswer } = await pushEnv();
  const { device } = await (await post(e, '/connect', { code: issue(state), verifier, redirect_uri: ORIGIN + '/tracker/oauth.html' })).json();
  await post(e, '/push/subscribe', { device, subscription });
  const now = Date.now();
  const alerts = [{ id: 'a', at: now + 60000, title: 'Alpha Company · Sub One is back', body: '' }, { id: 'b', at: now + 60000, title: 'Alpha Company · Sub Two is back', body: '' }, { id: 'c', at: now + 3600000, title: 'Bravo Company: 4 subs back', body: 'Sub B1, Sub B2, Sub B3, Sub B4' }];
  const r = await (await post(e, '/push/schedule', { device, stamp: 100, alerts })).json();
  assert.deepEqual([r.count, r.next], [3, now + 60000]);
  // an older save (a device that has not synced yet) does not replace it
  const old = await (await post(e, '/push/schedule', { device, stamp: 50, alerts: [] })).json();
  assert.equal(old.kept, true); assert.equal(JSON.parse(kv.get('push:sched')).alerts.length, 3);
  assert.deepEqual(await runCron(e, now), { sent: 0, due: 0 }, 'nothing due yet');
  const one = await runCron(e, now + 61000);
  assert.equal(one.sent, 1); assert.equal(one.due, 2);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.title, '2 submarine alerts', 'two alerts in the same minute go as one notification');
  assert.match(got[0].payload.body, /Sub One is back\nAlpha Company · Sub Two is back/);
  assert.equal(got[0].delimiter, 2); assert.equal(got[0].okSig, true); assert.equal(got[0].encoding, 'aes128gcm');
  assert.equal(got[0].claims.aud, 'https://push.test'); assert.equal(got[0].claims.sub, 'https://site.test/');
  assert.deepEqual(JSON.parse(kv.get('push:sched')).alerts.map((a) => a.id), ['c'], 'sent alerts are deleted');
  // the test notification, and a push address that has expired is forgotten
  assert.equal((await post(e, '/push/test', { device })).status, 200);
  assert.equal(got[1].payload.body, 'Test: phone notifications work on this device.');
  setAnswer(410);
  await runCron(e, now + 3600000 + 1000);
  assert.deepEqual(JSON.parse(kv.get('push:subs')), {}, 'an expired address is removed');
  const st = await (await post(e, '/push/status', { device })).json();
  assert.deepEqual([st.on, st.count], [false, 0]);
});
