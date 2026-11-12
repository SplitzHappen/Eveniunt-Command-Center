#!/usr/bin/env node
'use strict';
// Makes the signing key for phone notifications (Submersibles step S7). Run once, on your own computer:
//   node make-push-key.js
// It prints one line: paste it when `wrangler secret put VAPID_JWK` asks for the value. The key is made on your computer,
// printed once, and stored only as the helper's encrypted secret; it is never written to a file or sent anywhere else.
(async () => {
  const { subtle } = globalThis.crypto || require('crypto').webcrypto;
  const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', k.privateKey);
  console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }));
})();
