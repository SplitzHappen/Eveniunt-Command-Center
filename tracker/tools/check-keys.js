#!/usr/bin/env node
'use strict';
// Key-stability check, run before publishing new data. Ticks are stored by "<list>:<entry id>", so a rebuild must
// never drop an entry or give an existing id to a different entry (that would move people's ticks onto the wrong
// thing, silently). Compares the new data with an older copy:
//   node tools/check-keys.js [old.json] [new.json]
// Defaults: old = the last committed data/tracker-data.json (git HEAD), new = data/tracker-data.json.
// Exit 1 when an entry disappeared or more than 2% of a list's names changed (small wording fixes are listed only).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const T = path.join(__dirname, '..');
const rel = path.relative(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: T }).toString().trim(), path.join(T, 'data', 'tracker-data.json'));
const oldText = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : execFileSync('git', ['show', 'HEAD:' + rel], { cwd: T, maxBuffer: 1 << 28 }).toString();
const newText = fs.readFileSync(process.argv[3] || path.join(T, 'data', 'tracker-data.json'), 'utf8');
const names = (d) => { const m = new Map(); for (const s of d.sections) for (const g of s.g) for (const e of g.e) m.set(s.id + ':' + e.i, e.n); return m; };
// ids merged into another entry (e.al) are not lost: the tracker moves their ticks to the kept entry on load
const aliases = (d) => { const m = new Map(); for (const s of d.sections) for (const g of s.g) for (const e of g.e) for (const a of e.al || []) m.set(s.id + ':' + a, s.id + ':' + e.i); return m; };
const A = names(JSON.parse(oldText)), newDoc = JSON.parse(newText), B = names(newDoc), AL = aliases(newDoc);
let merged = 0;
const removed = [], renamed = new Map(), size = new Map();
for (const [k, n] of A) {
  const sid = k.slice(0, k.lastIndexOf(':'));
  size.set(sid, (size.get(sid) || 0) + 1);
  if (!B.has(k) && AL.has(k)) merged++;
  else if (!B.has(k)) removed.push(k + ' (' + n + ')');
  else if (B.get(k) !== n) (renamed.get(sid) || renamed.set(sid, []).get(sid)).push(k + ': "' + n + '" -> "' + B.get(k) + '"');
}
let added = 0; for (const k of B.keys()) if (!A.has(k)) added++;
let fail = removed.length > 0;
console.log(`entries: ${A.size} before, ${B.size} after, ${added} added, ${removed.length} removed, ${merged} merged into another entry (ticks move over on load)`);
if (removed.length) console.log('REMOVED (their ticks would no longer show):\n  ' + removed.slice(0, 50).join('\n  '));
for (const [sid, list] of renamed) {
  const share = list.length / size.get(sid);
  const bad = share > 0.02;
  if (bad) fail = true;
  console.log(`${bad ? 'RENAMED (too many: ids may have shifted)' : 'renamed'} in ${sid}: ${list.length} of ${size.get(sid)}\n  ` + list.slice(0, 10).join('\n  '));
}
console.log(fail ? 'KEY CHECK FAILED' : 'key check passed');
process.exit(fail ? 1 : 0);
