// Three-way merge used by cloud sync: base = what both sides agreed on at the last sync.
// A change made on only one side is taken automatically; a key changed differently on both sides
// becomes a conflict that the owner resolves (keep this device's value, or the other one).
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});

  // Only well-formed parts of a copy take part (the cloud copy is outside data: a damaged or foreign file must not
  // inject odd character ids or keys); the merged state is validated again at the end of applyMerge.
  const SETTINGS = ['countLimited', 'countGone', 'countUnknown', 'links', 'gold'];
  function flat(p) {
    const m = new Map();
    if (!p || typeof p !== 'object') return m;
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const okC = (c) => ET.CHAR_ID.test(c), okK = (k) => ET.ENTRY_KEY.test(k);
    for (const [c, t] of Object.entries(obj(p.ticks))) if (okC(c)) for (const k of Object.keys(obj(t))) if (okK(k)) m.set('t|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(obj(p.excl))) if (okC(c)) for (const k of Object.keys(obj(t))) if (okK(k)) m.set('e|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(obj(p.vals))) if (okC(c)) for (const [k, v] of Object.entries(obj(t))) if (okK(k) && Number.isFinite(Number(v))) m.set('v|' + c + '|' + k, String(Number(v)));
    for (const [k, v] of Object.entries(obj(p.avail))) if (okK(k) && (v === 'x' || v === 'ok')) m.set('a|' + k, v);
    for (const c of Array.isArray(p.chars) ? p.chars : []) {
      if (!c || typeof c.id !== 'string' || !okC(c.id)) continue;
      m.set('n|' + c.id, String(c.name || ''));
      if (c.lodestone) m.set('l|' + c.id, String(c.lodestone));
      if (c.cls || c.city) m.set('k|' + c.id, c.cls || 'city:' + c.city);
      if (c.gc) m.set('g|' + c.id, String(c.gc));
    }
    for (const [k, v] of Object.entries(obj(p.settings))) if (SETTINGS.includes(k)) m.set('s|' + k, String(v === true));
    // the other modules' sections of the one save (gate 1C): one key per unit, 'm|' + its path
    if (globalThis.CC && p.modules) globalThis.CC.flatModules(p.modules, m);
    return m;
  }

  ET.isPlaceholderName = (n) => /^Character \d+$/.test(String(n || ''));

  ET.threeWay = function (base, local, remote) {
    // A copy that does not carry the other modules' sections (an old cloud copy written before gate 1C) cannot have
    // changed them: it is read as agreeing with the last sync (or with the other side), never as deleting them.
    const fill = (x, from) => (x && typeof x === 'object' && x.modules === undefined && from && from.modules !== undefined ? Object.assign({}, x, { modules: from.modules }) : x);
    local = fill(local, base || remote);
    remote = fill(remote, base || local);
    const B = flat(base), L = flat(local), R = flat(remote);
    // Lists (docs/lists-spec.md section 4): units are 'm|' + the JSON path ['lists', group, key]. Helpers for LY0, LY1 and LY6.
    const HDR = 'm|["lists","lists",', TGT = 'm|["lists","targets",';
    const anyLists = [B, L, R].some((map) => { for (const k of map.keys()) if (k.startsWith('m|["lists",')) return true; return false; });
    const listKey = (group, id) => 'm|' + JSON.stringify(['lists', group, id]);
    const listId = (k, pre) => { if (!k.startsWith(pre)) return null; try { const p = JSON.parse(k.slice(2)); return Array.isArray(p) && p.length === 3 && typeof p[2] === 'string' ? p[2] : null; } catch (e) { return null; } };
    if (anyLists) {
      // LY6 The same id made on two devices: a list header or wanted item that is not in base, is on both sides and has a different
      // creation time on each is two records. The later one (higher time) is stored under a new id computed from its old id and its time
      // (so both devices compute the same one); a list's wanted items move with it. No question. Equal times: one record, ordinary rules.
      const hash36 = (text) => { let h1 = 0x811c9dc5, h2 = 5381; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2, 33) ^ c) >>> 0; } return h1.toString(36).padStart(7, '0') + h2.toString(36).padStart(7, '0'); };
      const newId = (old, time) => hash36(old + '|' + time).slice(0, 12);
      const timeOf = (text, field) => { try { const o = JSON.parse(text); const n = o ? Number(o[field]) : NaN; return Number.isFinite(n) ? n : 0; } catch (e) { return 0; } };
      for (const k of [...L.keys()]) {
        const id = listId(k, HDR);
        if (id === null || B.has(k) || !R.has(k)) continue;
        const lt = timeOf(L.get(k), 'made'), rt = timeOf(R.get(k), 'made');
        if (lt === rt) continue;
        const later = lt > rt ? L : R, nid = newId(id, Math.max(lt, rt));
        later.set(listKey('lists', nid), later.get(k)); later.delete(k);
        for (const tk of [...later.keys()]) {
          const tid = listId(tk, TGT);
          if (tid !== null && tid.startsWith(id + '.')) { later.set(listKey('targets', nid + tid.slice(id.length)), later.get(tk)); later.delete(tk); }
        }
      }
      for (const k of [...L.keys()]) {
        const id = listId(k, TGT);
        if (id === null || B.has(k) || !R.has(k) || !L.has(k)) continue;
        const lt = timeOf(L.get(k), 'at'), rt = timeOf(R.get(k), 'at');
        if (lt === rt) continue;
        const later = lt > rt ? L : R, dot = id.indexOf('.');
        later.set(listKey('targets', id.slice(0, dot + 1) + newId(id.slice(dot + 1), Math.max(lt, rt))), later.get(k)); later.delete(k);
      }
    }
    const keys = new Set([...B.keys(), ...L.keys(), ...R.keys()]);
    const merged = new Map();
    const conflicts = [];
    for (const k of keys) {
      const b = B.get(k), l = L.get(k), r = R.get(k);
      if (l === r) { if (l !== undefined) merged.set(k, l); continue; }
      // a placeholder name ("Character 3", what a new device starts with) never replaces a real one, and is never
      // put to the owner as a clash: two devices meeting for the first time used to wipe typed names (2026-11-10)
      if (k.startsWith('n|')) {
        const lr = l !== undefined && !ET.isPlaceholderName(l), rr = r !== undefined && !ET.isPlaceholderName(r);
        if (lr !== rr) { merged.set(k, lr ? l : r); continue; }
      }
      if (l === b) { if (r !== undefined) merged.set(k, r); continue; }
      if (r === b) { if (l !== undefined) merged.set(k, l); continue; }
      // a free company changed on both devices: merged field by field; only a name, world or character changed
      // differently on both is asked, and both texts already carry the combined discoveries, slots and position
      if (k.startsWith('m|') && l !== undefined && r !== undefined && globalThis.CC && typeof globalThis.CC.mergeUnit === 'function') {
        const u = globalThis.CC.mergeUnit(k, b, l, r);
        if (u) {
          merged.set(k, u.local);
          if (u.local !== u.remote) conflicts.push({ id: k, local: u.local, remote: u.remote });
          continue;
        }
      }
      conflicts.push({ id: k, local: l === undefined ? null : l, remote: r === undefined ? null : r });
      if (l !== undefined) merged.set(k, l); // provisional: this device, until the owner decides
    }
    // Module units are merged independently. That is normally useful, but it can separate a submarine from its free
    // company (one device has a newer submarine, the other removed the free company) or put two submarines in one slot
    // (each device set up the same slot). Neither is guessed: each becomes an explicit choice, and until the owner makes
    // it the provisional copy keeps every record (a merge applied without the owner's choice never deletes for these).
    const unitKey = (path) => 'm|' + JSON.stringify(path);
    const parseUnit = (v) => { if (v === undefined || v === null) return undefined; try { return JSON.parse(v); } catch (e) { return undefined; } };
    const subsPath = (k) => { if (!k.startsWith('m|')) return null; let p; try { p = JSON.parse(k.slice(2)); } catch (e) { return null; } return Array.isArray(p) && p.length === 3 && p[0] === 'submersibles' ? p : null; };
    const hasConflict = (k) => conflicts.some((c) => c.id === k);
    const subLabel = (s) => (s && s.name) || (s && s.slot ? 'Sub ' + s.slot : 'a submarine');
    const fcName = (fcId) => { for (const map of [merged, L, R]) { const f = parseUnit(map.get(unitKey(['submersibles', 'fcs', fcId]))); if (f && f.name) return f.name; } return ''; };
    // 1. A free company and the submarines that point at it, on either device or in the provisional merge, are one choice.
    const deps = new Map(); // fcId -> Map(subId -> label)
    for (const map of [L, R, merged]) {
      for (const [k, v] of map) {
        const p = subsPath(k); if (!p || p[1] !== 'subs') continue;
        const sub = parseUnit(v); if (!sub || typeof sub.fcId !== 'string') continue;
        if (!deps.has(sub.fcId)) deps.set(sub.fcId, new Map());
        if (!deps.get(sub.fcId).has(p[2])) deps.get(sub.fcId).set(p[2], subLabel(sub));
      }
    }
    for (const [fcId, subs] of deps) {
      const key = unitKey(['submersibles', 'fcs', fcId]);
      const l = L.get(key), r = R.get(key);
      if (l === undefined && r === undefined) continue; // neither device has it: nothing to choose
      // what each device holds of this free company's fleet (its submarines and their logged voyages), so that keeping
      // one device's free company also keeps the submarines that went with it there
      const fleetOf = (map) => {
        const units = [], ids = new Set();
        for (const [k, v] of map) { const p = subsPath(k); const sub = p && p[1] === 'subs' ? parseUnit(v) : null; if (sub && sub.fcId === fcId) { units.push([k, v]); ids.add(p[2]); } }
        for (const [k, v] of map) { const p = subsPath(k); const trip = p && p[1] === 'trips' ? parseUnit(v) : null; if (trip && ids.has(trip.s)) units.push([k, v]); }
        return units;
      };
      const integrity = { kind: 'owner', fcId, linked: [...subs.keys()], names: [...subs.values()], fleet: { local: fleetOf(L), remote: fleetOf(R) } };
      const existing = conflicts.find((c) => c.id === key);
      if (existing) {
        // changed on one device and removed on the other: removing it also removes its submarines (named in the prompt),
        // whatever their own rows say, so no choice can leave a submarine pointing at a removed free company
        if (existing.local === null || existing.remote === null) existing.integrity = integrity;
        continue;
      }
      // the merge dropped it (removed on one device, unchanged there) while a kept submarine still points at it
      // a submarine kept by the merge, or one whose own row asks and could be kept by the owner's answer, needs it
      const live = [...subs.keys()].some((id) => {
        const k = unitKey(['submersibles', 'subs', id]);
        const vals = hasConflict(k) ? [merged.get(k), L.get(k), R.get(k)] : [merged.get(k)];
        return vals.some((v) => { const sub = parseUnit(v); return !!sub && sub.fcId === fcId; });
      });
      if (merged.has(key) || !live) continue;
      conflicts.push({ id: key, local: l === undefined ? null : l, remote: r === undefined ? null : r, integrity });
      merged.set(key, l === undefined ? r : l);
    }
    // 2. Two submarines in one slot of one free company after the merge, one only on this device and one from the other
    //    device: one choice. Compared by id, so two records that look identical (default name and rank) still count.
    //    A slot whose records are already on both devices has nothing new to decide here and is left as it is.
    //    A submarine whose own row asks counts with either answer (its value on this device and on the other device), so
    //    an answer that brings it back cannot put two submarines in one slot; when both rows exist, the slot row decides.
    const bySlot = new Map();
    const index = (k, v, p) => {
      const sub = parseUnit(v); if (!sub || typeof sub.fcId !== 'string' || !sub.slot) return;
      const slot = sub.fcId + '|' + sub.slot;
      if (!bySlot.has(slot)) bySlot.set(slot, new Map());
      if (!bySlot.get(slot).has(p[2])) bySlot.get(slot).set(p[2], { id: p[2], key: k, sub });
    };
    for (const [k, v] of merged) { const p = subsPath(k); if (p && p[1] === 'subs') index(k, v, p); }
    for (const c of conflicts) { const p = subsPath(c.id); if (p && p[1] === 'subs') { index(c.id, c.local === null ? undefined : c.local, p); index(c.id, c.remote === null ? undefined : c.remote, p); } }
    const inSlot = (map, key, slot) => { const sub = parseUnit(map.get(key)); return !!sub && sub.fcId + '|' + sub.slot === slot; };
    for (const [slot, ids] of bySlot) {
      const list = [...ids.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
      if (list.length < 2) continue; // one is normal
      // only here, only there, and on both devices (in this slot on both). A slot whose records are all on both devices, or
      // all on one device, has nothing new to decide here: the Submersibles Board shows it.
      // A submarine both devices hold but in this slot on one of them only ("moved") is on neither side of the question: no
      // answer removes it. It is named as staying; a duplicate left over is settled on the Board.
      const on = (map, x) => map.get(x.key) !== undefined;
      const here = list.filter((x) => inSlot(L, x.key, slot) && !on(R, x));
      const there = list.filter((x) => inSlot(R, x.key, slot) && !on(L, x));
      const both = list.filter((x) => inSlot(L, x.key, slot) && inSlot(R, x.key, slot));
      const moved = list.filter((x) => on(L, x) && on(R, x) && inSlot(L, x.key, slot) !== inSlot(R, x.key, slot));
      if (!here.length && !there.length) continue;
      const locals = here.length ? here : both, remotes = there.length ? there : both;
      if (!locals.length || !remotes.length) continue;
      const [fcId, slotNo] = slot.split('|');
      const mine = (x) => Object.assign({}, x, { value: L.get(x.key), sub: parseUnit(L.get(x.key)) });
      const theirs = (x) => Object.assign({}, x, { value: R.get(x.key), sub: parseUnit(R.get(x.key)) });
      const ls = locals.map(mine), rs = remotes.map(theirs), a = ls[0], b = rs[0];
      const pick = (x) => ({ key: x.key, value: x.value, name: subLabel(x.sub), rank: x.sub.rank || null });
      conflicts.push({
        id: 'i|submersibles-slot|' + encodeURIComponent(slot), local: ls.map((x) => subLabel(x.sub)).join(', '), remote: rs.map((x) => subLabel(x.sub)).join(', '),
        integrity: {
          kind: 'slot', fcId, fcName: fcName(fcId), slot: Number(slotNo), localKey: a.key, remoteKey: b.key, localValue: a.value, remoteValue: b.value, localRank: a.sub.rank || null, remoteRank: b.sub.rank || null,
          locals: ls.map(pick), remotes: rs.map(pick), stays: (here.length && there.length ? both : []).concat(moved).map((x) => subLabel(mine(x).sub))
        }
      });
    }
    if (anyLists) {
      // Lists, LY1: for a list whose header is in base and is missing on one side only (X lacks it, Y holds it): when X removed the
      // header and every wanted item and Y holds exactly what base held, the removal is taken (the generic rule already did it);
      // otherwise one question for the whole list. Both sides lacking it, or both holding it, ask nothing about the list.
      const index = (map) => { const o = new Map(); for (const k of map.keys()) { const id = listId(k, TGT); if (id === null) continue; const P = id.split('.')[0]; if (!o.has(P)) o.set(P, []); o.get(P).push(k); } return o; };
      const BT = index(B), LTi = index(L), RTi = index(R);
      const listName = (P) => { for (const map of [merged, L, R, B]) { const o = parseUnit(map.get(listKey('lists', P))); if (o && typeof o.name === 'string' && o.name) return o.name; } return ''; };
      const folded = new Set();
      for (const [k, bv] of B) {
        const P = listId(k, HDR); if (P === null) continue;
        const lh = L.get(k), rh = R.get(k);
        if ((lh === undefined) === (rh === undefined)) continue;
        const xLocal = lh === undefined, Y = xLocal ? R : L, yh = xLocal ? rh : lh;
        const xT = (xLocal ? LTi : RTi).get(P) || [], yT = (xLocal ? RTi : LTi).get(P) || [], bT = BT.get(P) || [];
        if (!xT.length && yh === bv && yT.length === bT.length && yT.every((t) => B.get(t) === Y.get(t))) continue; // case 1
        // Keep stays the default: Y's header and every wanted item either side holds. Removals of items inside the list are not asked on their own.
        let items = 0;
        for (const t of new Set([...bT, ...xT, ...yT])) {
          const lv = L.get(t), rv = R.get(t);
          if (lv === undefined && rv === undefined) continue;
          items++;
          if (lv === undefined || rv === undefined) { merged.set(t, lv === undefined ? rv : lv); folded.add(t); }
        }
        merged.set(k, yh);
        const integrity = { kind: 'list', keep: true, listId: P, listName: listName(P), items };
        const existing = conflicts.find((c) => c.id === k);
        if (existing) existing.integrity = integrity;
        else conflicts.push({ id: k, local: lh === undefined ? null : lh, remote: rh === undefined ? null : rh, integrity });
      }
      if (folded.size) conflicts.splice(0, conflicts.length, ...conflicts.filter((c) => !folded.has(c.id)));
      // LY0: a unit removed on one side and changed on the other stays until the removing side is answered; and the clash of a list or a
      // wanted item carries the list's name (Settings cannot see the Lists data).
      for (const c of conflicts) {
        if (c.integrity) continue;
        const gid = listId(c.id, HDR), tid = gid === null ? listId(c.id, TGT) : null;
        const one = (c.local === null) !== (c.remote === null);
        if (!one && gid === null && tid === null) continue;
        if (!c.id.startsWith('m|["lists",')) continue;
        const integrity = { kind: 'lists' };
        if (one) { integrity.keep = true; merged.set(c.id, c.local !== null ? c.local : c.remote); }
        if (gid !== null || tid !== null) integrity.listName = listName(gid !== null ? gid : tid.split('.')[0]);
        c.integrity = integrity;
      }
    }
    return { merged, conflicts };
  };

  // choices: { conflictId: 'local' | 'remote' }; missing choices keep this device's value. Exception: a free-company or
  // slot choice (integrity) with no explicit choice deletes nothing: every record stays until the owner decides (the
  // merges applied without asking, after an upload and at the end of a sync from Settings, pass no choices).
  ET.applyMerge = function (st, result, choices) {
    const m = new Map(result.merged);
    const chosen = (c) => { const v = (choices || {})[c.id]; return v === 'local' || v === 'remote' ? v : null; };
    const dropSub = (subId) => {
      m.delete('m|' + JSON.stringify(['submersibles', 'subs', subId]));
      for (const [k, v] of m) {
        if (!k.startsWith('m|')) continue;
        let p, trip; try { p = JSON.parse(k.slice(2)); trip = JSON.parse(v); } catch (e) { continue; }
        if (p.length === 3 && p[0] === 'submersibles' && p[1] === 'trips' && trip && trip.s === subId) m.delete(k);
      }
    };
    const owners = [], listQs = [];
    for (const c of result.conflicts) {
      if (c.integrity && c.integrity.kind === 'slot') {
        const v = chosen(c);
        if (!v) continue; // both submarines stay; the next sync that can ask, asks
        const g = c.integrity;
        const side = (list, key, value) => (Array.isArray(list) && list.length ? list : [{ key, value }]);
        const keep = v === 'remote' ? side(g.remotes, g.remoteKey, g.remoteValue) : side(g.locals, g.localKey, g.localValue);
        const drop = v === 'remote' ? side(g.locals, g.localKey, g.localValue) : side(g.remotes, g.remoteKey, g.remoteValue);
        keep.forEach((x) => m.set(x.key, x.value));
        drop.forEach((x) => dropSub(JSON.parse(x.key.slice(2))[2]));
        continue;
      }
      if (c.integrity && c.integrity.kind === 'owner') { owners.push(c); continue; }
      // Lists: a whole-list question is applied after the other units; a unit removed on one side and changed on the other stays
      // unless the removing side is answered (a merge applied without asking removes nothing of the lists)
      if (c.integrity && c.integrity.kind === 'list') { listQs.push(c); continue; }
      if (c.integrity && c.integrity.kind === 'lists' && c.integrity.keep) {
        const v = chosen(c), pick = v === 'remote' ? c.remote : v === 'local' ? c.local : c.local !== null ? c.local : c.remote;
        if (pick === null) m.delete(c.id); else m.set(c.id, pick);
        continue;
      }
      const pick = (choices || {})[c.id] === 'remote' ? c.remote : c.local;
      if (pick === null) m.delete(c.id);
      else m.set(c.id, pick);
    }
    // A whole-list question: the answer of the side that holds the header keeps the list with every wanted item of it; the answer of the
    // side that lacks it removes the header and every wanted item of the list on both sides. No answer keeps (nothing is deleted).
    for (const c of listQs) {
      const v = chosen(c), pick = v === 'remote' ? c.remote : v === 'local' ? c.local : c.local !== null ? c.local : c.remote;
      if (pick === null) {
        m.delete(c.id);
        for (const k of [...m.keys()]) {
          if (!k.startsWith('m|["lists","targets",')) continue;
          let p; try { p = JSON.parse(k.slice(2)); } catch (e) { continue; }
          if (typeof p[2] === 'string' && p[2].startsWith(c.integrity.listId + '.')) m.delete(k);
        }
      } else m.set(c.id, pick);
    }
    // A free company is decided after its submarines' own rows: choosing its removal removes those submarines and their
    // logged voyages (the prompt names them), so mixed choices cannot leave a submarine without its free company.
    const subsOf = (fcId) => [...m].filter(([k, v]) => { const p = (() => { try { return JSON.parse(k.slice(2)); } catch (e) { return null; } })(); if (!k.startsWith('m|') || !p || p.length !== 3 || p[0] !== 'submersibles' || p[1] !== 'subs') return false; try { return JSON.parse(v).fcId === fcId; } catch (e) { return false; } }).map(([k]) => JSON.parse(k.slice(2))[2]);
    for (const c of owners) {
      const v = chosen(c), fcId = c.integrity.fcId;
      let pick = v === 'remote' ? c.remote : c.local;
      // without the owner's answer: this device's value, as for any row, unless a kept submarine needs the free company
      if (!v && pick === null && subsOf(fcId).length) pick = c.remote;
      if (pick === null) {
        m.delete(c.id);
        // its submarines go with it (named in the prompt); one that now belongs to another free company stays
        c.integrity.linked.filter((id) => subsOf(fcId).includes(id)).forEach(dropSub);
      } else {
        m.set(c.id, pick);
        // Keeping it keeps the submarines (and their logged voyages) that went with it on the kept device: on the owner's
        // answer, or when this device's side is kept. Without an answer, a free company kept only because another
        // device's submarine needs it brings back nothing this device removed. A submarine whose own row was answered
        // is not brought back, and a logged voyage comes back only with its submarine.
        if (v || pick === c.local) {
          const fleet = (c.integrity.fleet || {})[pick === c.local ? 'local' : 'remote'] || [];
          const isKind = (k, kind) => { try { const p = JSON.parse(k.slice(2)); return p.length === 3 && p[0] === 'submersibles' && p[1] === kind; } catch (e) { return false; } };
          for (const [k, val] of fleet) if (isKind(k, 'subs') && !m.has(k) && !result.conflicts.some((x) => x.id === k)) m.set(k, val);
          for (const [k, val] of fleet) {
            if (!isKind(k, 'trips') || m.has(k) || result.conflicts.some((x) => x.id === k)) continue;
            let trip; try { trip = JSON.parse(val); } catch (e) { continue; }
            if (trip && m.has('m|' + JSON.stringify(['submersibles', 'subs', trip.s]))) m.set(k, val);
          }
        }
      }
    }
    // Safety net: a kept submarine whose free company is missing gets it back from either device's copy, if one exists.
    const fcCopies = new Map();
    for (const c of result.conflicts) { let p; try { p = JSON.parse(c.id.slice(2)); } catch (e) { continue; } if (c.id.startsWith('m|') && p.length === 3 && p[0] === 'submersibles' && p[1] === 'fcs') fcCopies.set(p[2], c.local !== null ? c.local : c.remote); }
    for (const [fcId, copy] of fcCopies) if (copy !== null && !m.has('m|' + JSON.stringify(['submersibles', 'fcs', fcId])) && subsOf(fcId).length) m.set('m|' + JSON.stringify(['submersibles', 'fcs', fcId]), copy);
    const chars = new Map(st.chars.map((c) => [c.id, c]));
    const ticks = {};
    const excl = {};
    const vals = {};
    const avail = {};
    const settings = Object.assign({}, st.settings);
    const units = new Map();
    for (const [k, v] of m) {
      if (k.startsWith('m|')) { units.set(k, v); continue; }
      const [kind, a, ...rest] = k.split('|');
      if (kind === 't') {
        if (!chars.has(a)) chars.set(a, { id: a, name: a, lodestone: null });
        (ticks[a] = ticks[a] || {})[rest.join('|')] = 1;
      } else if (kind === 'v') {
        (vals[a] = vals[a] || {})[rest.join('|')] = Number(v);
      } else if (kind === 'e') {
        (excl[a] = excl[a] || {})[rest.join('|')] = 1;
      } else if (kind === 'a') avail[a] = v;
      else if (kind === 'n') { if (!chars.has(a)) chars.set(a, { id: a, name: v, lodestone: null }); else chars.get(a).name = v; }
      else if (kind === 'l') { if (chars.has(a)) chars.get(a).lodestone = v; }
      else if (kind === 'k') { if (chars.has(a)) { const ch = chars.get(a); if (v.startsWith('city:')) { ch.city = v.slice(5); ch.cls = null; } else { ch.cls = v; ch.city = null; } } }
      else if (kind === 'g') { if (chars.has(a)) chars.get(a).gc = Number(v); }
      else if (kind === 's') settings[a] = v === 'true' ? true : v === 'false' ? false : v;
    }
    const ordered = [...chars.values()].sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1))).slice(0, ET.MAX_CHARS);
    for (const c of ordered) { if (!m.has('l|' + c.id)) c.lodestone = null; if (!m.has('k|' + c.id)) { c.cls = null; c.city = null; } if (!m.has('g|' + c.id)) c.gc = null; }
    st.chars = ordered;
    st.ticks = {};
    st.excl = {}; st.vals = {};
    for (const c of ordered) { st.ticks[c.id] = ticks[c.id] || {}; st.excl[c.id] = excl[c.id] || {}; st.vals[c.id] = vals[c.id] || {}; }
    st.avail = avail;
    st.settings = settings;
    if (globalThis.CC && (units.size || st.modules !== undefined)) st.modules = globalThis.CC.unflatModules(units);
    st.updated = Date.now();
    return ET.validateState(st);
  };

  // Plain-language description of a conflict, for the "which one is right?" prompt.
  ET.describeConflict = function (c, idx, st) {
    if (c.integrity && c.integrity.kind === 'slot') {
      const g = c.integrity, rank = (x) => (x ? ', rank ' + x : ''), fc = g.fcName ? '“' + g.fcName + '”' : 'a free company';
      const ls = Array.isArray(g.locals) ? g.locals : null, rs = Array.isArray(g.remotes) ? g.remotes : null, stays = Array.isArray(g.stays) ? g.stays : [];
      if (!ls || !rs || (ls.length === 1 && rs.length === 1 && !stays.length)) {
        return {
          who: '', what: 'Submersibles: slot ' + g.slot + ' of ' + fc + ' holds a different submarine on each device; the one you keep stays, the other and its logged voyages are removed',
          local: 'keep this device’s “' + c.local + '”' + rank(g.localRank), remote: 'keep the other device’s “' + c.remote + '”' + rank(g.remoteRank)
        };
      }
      const list = (xs) => { const t = xs.map((x) => '“' + x.name + '”' + rank(x.rank)); return t.length > 1 ? t.slice(0, -1).join(', ') + ' and ' + t[t.length - 1] : t[0]; };
      const total = ls.length + rs.length + stays.length;
      return {
        who: '', what: 'Submersibles: slot ' + g.slot + ' of ' + fc + ' holds ' + total + ' submarines across your devices, and a slot holds one; the side you keep stays, the other side and its logged voyages are removed'
          + (stays.length ? '; ' + stays.map((n) => '“' + n + '”').join(', ') + ', already on both devices, ' + (stays.length > 1 ? 'stay' : 'stays') + ' either way' : '')
          + '; if more than one stays, the Submersibles Board asks which one to keep',
        local: 'keep this device’s ' + list(ls), remote: 'keep the other device’s ' + list(rs)
      };
    }
    const who = (id) => (st.chars.find((x) => x.id === id) || { name: id }).name;
    if (c.integrity && c.integrity.kind === 'list' && globalThis.CC) {
      // the whole-list question: the side that lacks the list says it is removed (and what that removes), the other says it is kept
      const g = c.integrity, n = g.items || 0, what = n === 1 ? 'its 1 wanted item' : n ? 'its ' + n + ' wanted items' : 'nothing else';
      const side = (v) => (v === null ? 'the list is removed: choosing this removes it and ' + what + ' on both devices' : 'the list is kept: choosing this keeps it and ' + what);
      return { who: '', what: globalThis.CC.describeUnit(c.id, c.local, c.remote, who, g).what, local: side(c.local), remote: side(c.remote) };
    }
    if (c.id.startsWith('m|') && globalThis.CC) return globalThis.CC.describeUnit(c.id, c.local, c.remote, who, c.integrity);
    const [kind, a, ...rest] = c.id.split('|');
    const what = (k) => { const h = idx && idx.byKey.get(k); return h ? h.e.n + ' (' + h.s.t + ')' : k; };
    if (kind === 't') return { who: who(a), what: what(rest.join('|')), local: c.local ? 'ticked' : 'not ticked', remote: c.remote ? 'ticked' : 'not ticked' };
    if (kind === 'v') return { who: who(a), what: what(rest.join('|')), local: c.local == null ? '(none)' : 'level ' + c.local, remote: c.remote == null ? '(none)' : 'level ' + c.remote };
    if (kind === 'e') return { who: who(a), what: what(rest.join('|')), local: c.local ? 'does not apply' : 'applies', remote: c.remote ? 'does not apply' : 'applies' };
    if (kind === 'a') {
      const lab = (v) => (v === 'x' ? 'marked unobtainable' : v === 'ok' ? 'marked obtainable' : 'automatic');
      return { who: '', what: what(a), local: lab(c.local), remote: lab(c.remote) };
    }
    if (kind === 'n') return { who: '', what: 'Name of ' + a, local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'l') return { who: who(a), what: 'Lodestone character number', local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'k') return { who: who(a), what: 'Starting class', local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'g') return { who: who(a), what: 'Grand Company', local: ET.GCS[c.local] || '(none)', remote: ET.GCS[c.remote] || '(none)' };
    return { who: '', what: 'Setting: ' + a, local: String(c.local), remote: String(c.remote) };
  };
})();
