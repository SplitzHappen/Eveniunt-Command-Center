#!/usr/bin/env node
'use strict';
// Key-stability check, run before publishing new data. Ticks are stored by "<list>:<entry id>", so a rebuild must
// never drop an entry or give an existing id to a different entry (that would move people's ticks onto the wrong
// thing, silently). Compares the new data with an older copy:
//   node tools/check-keys.js [old.json] [new.json]        or        node tools/check-keys.js --against <git commit>
// Default old copy: data/tracker-data.json at origin/main (the last merged data) when it is there, else at HEAD; the
// commit compared is printed, and a comparison of the file with itself is reported (it proves nothing).
// Exit 1 when an entry disappeared or any name changed that is not listed, with its new name, in
// tools/key-renames.json (reviewed wording changes: { "<list>:<id>": "<new name>" }), or when data/links.json was
// built for other data.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const T = path.join(__dirname, '..');
const rel = path.relative(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: T }).toString().trim(), path.join(T, 'data', 'tracker-data.json'));
const argv = process.argv.slice(2), ai = argv.indexOf('--against');
const against = ai >= 0 ? argv.splice(ai, 2)[1] : null;
const gitShow = (rev) => execFileSync('git', ['show', rev + ':' + rel], { cwd: T, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
let oldText, oldFrom;
if (argv[0]) { oldText = fs.readFileSync(argv[0], 'utf8'); oldFrom = argv[0]; }
else {
  for (const rev of against ? [against] : ['origin/main', 'HEAD']) {
    try { oldText = gitShow(rev); oldFrom = rev + ' (' + execFileSync('git', ['rev-parse', '--short', rev], { cwd: T }).toString().trim() + ')'; break; } catch (e) { /* next */ }
  }
  if (!oldText) { console.log('KEY CHECK FAILED: no older copy of the data to compare with (pass --against <commit> or a file)'); process.exit(1); }
}
const newText = fs.readFileSync(argv[1] || path.join(T, 'data', 'tracker-data.json'), 'utf8');
console.log('comparing with ' + oldFrom + (oldText === newText ? ' (identical to the data: this run proves nothing; compare with the last published data)' : ''));
const OK_RENAMES = (() => { try { return JSON.parse(fs.readFileSync(path.join(T, 'tools', 'key-renames.json'), 'utf8')); } catch (e) { return {}; } })();
const names = (d) => { const m = new Map(); for (const s of d.sections) for (const g of s.g) for (const e of g.e) m.set(s.id + ':' + e.i, e.n); return m; };
// ids merged into another entry (e.al) are not lost: the tracker moves their ticks to the kept entry on load
const aliases = (d) => {
  const m = new Map();
  for (const s of d.sections) for (const g of s.g) for (const e of g.e) {
    for (const a of e.al || []) m.set(s.id + ':' + a, s.id + ':' + e.i);
    if (e.mv) { m.set(e.mv + ':' + e.i, s.id + ':' + e.i); for (const a of e.al || []) m.set(e.mv + ':' + a, s.id + ':' + e.i); } // moved to a new list
    for (const pv of e.pv || []) m.set(pv + ':' + e.i, s.id + ':' + e.i);
  }
  return m;
};
const A = names(JSON.parse(oldText)), newDoc = JSON.parse(newText), B = names(newDoc), AL = aliases(newDoc);
let merged = 0;
const removed = [], renamed = new Map(), size = new Map();
for (const [k, n] of A) {
  const sid = k.slice(0, k.lastIndexOf(':'));
  size.set(sid, (size.get(sid) || 0) + 1);
  if (!B.has(k) && AL.has(k)) merged++;
  else if (!B.has(k)) removed.push(k + ' (' + n + ')');
  else if (B.get(k) !== n && OK_RENAMES[k] !== B.get(k)) (renamed.get(sid) || renamed.set(sid, []).get(sid)).push(k + ': "' + n + '" -> "' + B.get(k) + '"');
}
let added = 0; for (const k of B.keys()) if (!A.has(k)) added++;
let fail = removed.length > 0;
console.log(`entries: ${A.size} before, ${B.size} after, ${added} added, ${removed.length} removed, ${merged} merged into another entry (ticks move over on load)`);
if (removed.length) console.log('REMOVED (their ticks would no longer show):\n  ' + removed.slice(0, 50).join('\n  '));
// any other name change could be an id given to a different entry (ticks would show on the wrong thing): it fails
// until reviewed and listed in tools/key-renames.json
for (const [sid, list] of renamed) {
  fail = true;
  console.log(`RENAMED in ${sid}: ${list.length} of ${size.get(sid)} (review each; list genuine wording changes in tools/key-renames.json)\n  ` + list.slice(0, 20).join('\n  '));
}
// data/links.json names entries by position: it must have been rebuilt for exactly this data (tools/links.py, then
// tools/merge-desktop-links.js), or the tracker would refuse it (no links at all) or, worse, apply it to the wrong rows
try {
  require(path.join(T, 'src', 'core', 'model.js')); require(path.join(T, 'src', 'core', 'links.js'));
  const links = JSON.parse(fs.readFileSync(path.join(T, 'data', 'links.json'), 'utf8'));
  const keys = []; for (const s of newDoc.sections) for (const g of s.g) for (const e of g.e) keys.push(s.id + ':' + e.i);
  const hash = globalThis.ET.keysHash(keys);
  if (links.entries !== keys.length) { fail = true; console.log(`LINKS STALE: data/links.json was built for ${links.entries} entries, the data has ${keys.length}: rerun tools/links.py and tools/merge-desktop-links.js`); }
  else if (links.keys_hash !== hash) { fail = true; console.log(`LINKS STALE: data/links.json was built for other entries or another order (hash ${links.keys_hash}, data ${hash}): rerun tools/links.py and tools/merge-desktop-links.js`); }
  else console.log('links: built for this data (hash ' + hash + ')');
} catch (e) { fail = true; console.log('LINKS CHECK FAILED: ' + e.message); }
console.log(fail ? 'KEY CHECK FAILED' : 'key check passed');
process.exit(fail ? 1 : 0);
