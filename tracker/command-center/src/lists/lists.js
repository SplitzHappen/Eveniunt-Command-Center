// Eveniunt Command Center, Lists module page (work items W6 and W7 of docs/lists-spec.md): loads the one save and the data, shows "Your lists",
// makes and removes lists, and on a list's Wanted tab adds items, changes amounts and flags, finishes and removes them, takes the typed stock
// ("I have", minus, plus), "Bought it", and shows Undo. Every change goes through LISTS.store (the edit functions), and the page writes one save
// at a time, as the Submersibles page does. Nothing is read from the game: the player types what they have.
(function () {
  'use strict';
  var CC = window.CC, S = window.LISTS.store, E = window.LISTS;
  var main = document.getElementById('view');
  // SH: the page's working state. sec: the saved section as last read or written (null when none is stored); rev and base: what the next write is
  // measured against (as in subs.js). queue: edits waiting for the write in flight. undo: the last 20 changes of this visit, newest first.
  var SH = { problem: null, chars: [], sec: null, rev: null, base: null, queue: [], busy: null, reloadLater: false, undo: [], note: '', rest: null,
    view: { list: null, form: false, confirm: null, bought: null, search: '' } };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // data/lists.json plus `log` and `noHandOver`, built in by build.js (packed when that is smaller)
  var DATA = null, RECIPES_OF = null, NAMES = null;
  function loadData() {
    var p = window.LISTS_DATA ? Promise.resolve(window.LISTS_DATA) : CC.unpack(window.LISTS_DATA_PACKED).then(JSON.parse);
    return p.then(function (d) { DATA = d; });
  }
  function loadSave() {
    return CC.read().then(function (r) {
      SH.problem = null;
      var doc = CC.emptyDoc();
      if (r.raw != null) { try { doc = CC.checkDoc(r.raw); } catch (e) { SH.problem = e.message; return; } } // unreadable or newer: never written over
      SH.chars = doc.chars; SH.sec = doc.modules.lists || null; SH.rev = r.rev; SH.base = SH.sec ? clone(SH.sec) : null;
    }).catch(function (e) { SH.problem = e.message; });
  }

  // ------------------------------------------------------------------------------------------------ writing: one save at a time
  // An edit is a function of the section as it is when its turn comes: { section, entry } | { error } from LISTS.store (or LISTS.store.undo).
  // opts.undoOf: the undo entry this edit applies; opts.after(result): called once the change is saved.
  function act(f, opts) { SH.queue.push({ f: f, o: opts || {} }); return pump(); }
  function pump() {
    if (SH.busy) return SH.busy;
    if (!SH.queue.length || SH.problem) return Promise.resolve();
    var job = SH.queue.shift();
    SH.busy = Promise.resolve().then(function () { return doJob(job); }).catch(function () { /* settled in doJob */ }).then(function () {
      SH.busy = null;
      if (SH.queue.length) return pump();
      if (SH.reloadLater) { SH.reloadLater = false; return reload(); }
    });
    return SH.busy;
  }
  function dropEntry(entry) { SH.undo = SH.undo.filter(function (e) { return e !== entry; }); }
  function doJob(job) {
    var res = job.f(SH.sec || S.emptySection()), isUndo = !!job.o.undoOf;
    if (res.error) {
      SH.note = res.error; SH.rest = null;
      if (isUndo) dropEntry(job.o.undoOf);
      render(); return null;
    }
    if (!res.entry && !res.expect) { render(); return null; } // nothing changed (a cleared amount keeps the old one)
    return CC.writeSection('lists', res.section, { rev: SH.rev, base: SH.base, expect: res.expect }).then(function (r) {
      SH.rev = r.rev; SH.base = clone(r.section); SH.sec = r.section; SH.chars = r.doc.chars;
      SH.note = ''; SH.rest = null;
      if (isUndo) dropEntry(job.o.undoOf);
      else if (res.entry) { SH.undo.unshift(res.entry); if (SH.undo.length > 20) SH.undo.length = 20; }
      if (job.o.after) job.o.after(res);
      render();
    }, function (e) {
      // A refused write: show the saved copy again and say so; edits waiting behind it were made on the old copy and are dropped.
      SH.queue.length = 0;
      var elsewhere = !!(e && /on another device or in another tab/.test(e.message)); // the store's refusals (LI1 to LI5) all say so
      return CC.read().then(function (r) {
        var doc = r.raw == null ? CC.emptyDoc() : CC.checkDoc(r.raw);
        SH.rev = r.rev; SH.chars = doc.chars; SH.sec = doc.modules.lists || null; SH.base = SH.sec ? clone(SH.sec) : null;
        if (isUndo && elsewhere) { dropEntry(job.o.undoOf); SH.note = S.lines.undo; } else SH.note = 'Not saved on this device: ' + e.message + ' The page now shows what is saved; re-enter any unsaved edits if you still need them.';
        SH.rest = null; render();
      }).catch(function () {
        SH.problem = 'The saved data could not be reloaded after a refused save; reload the page to continue.';
        SH.note = 'Not saved on this device: ' + (e && e.message) + ' ' + SH.problem; render();
      });
    });
  }
  function labeled(res, label) { if (res && res.entry) res.entry.label = label; return res; }

  // ------------------------------------------------------------------------------------------------ reading
  // List order is fixed (spec section 4): by `order`, then `made`, then the id as plain text.
  function sortedIds(lists) {
    return Object.keys(lists).sort(function (a, b) {
      var x = lists[a], y = lists[b];
      return (x.order || 0) - (y.order || 0) || (x.made || 0) - (y.made || 0) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  function count(o) { return o ? Object.keys(o).length : 0; }
  function sec() { return SH.sec || S.emptySection(); }
  function nameOfChar(c) { if (!c) return 'No character'; var f = SH.chars.filter(function (x) { return x.id === c; })[0]; return f ? f.name : 'Character ' + c; }
  function itemName(id) { var it = DATA && DATA.items && DATA.items[id]; return it ? it[0] : 'item ' + id; }
  function recipesOf(item) {
    if (!RECIPES_OF) {
      RECIPES_OF = {};
      Object.keys(DATA.recipes || {}).forEach(function (id) { var r = DATA.recipes[id]; (RECIPES_OF[r[0]] = RECIPES_OF[r[0]] || []).push(+id); });
      Object.keys(RECIPES_OF).forEach(function (k) { RECIPES_OF[k].sort(function (a, b) { return DATA.recipes[a][3] - DATA.recipes[b][3] || a - b; }); });
    }
    return RECIPES_OF[item] || [];
  }
  function itemFlags(item) { var it = DATA.items[item]; return it ? it[1] | 0 : 0; }
  function canHq(item) { return (itemFlags(item) & 2) !== 0; }
  function canColl(item) { return (itemFlags(item) & 4) !== 0 || recipesOf(item).some(function (r) { return (DATA.recipes[r][6] & 8) !== 0; }); }
  function search(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    if (!NAMES) NAMES = Object.keys(DATA.items).filter(function (id) { return +id !== 1; }).map(function (id) { return [+id, DATA.items[id][0], DATA.items[id][0].toLowerCase()]; });
    var hits = NAMES.filter(function (n) { return n[2].indexOf(q) >= 0; });
    hits.sort(function (a, b) { return (a[2].indexOf(q) !== 0) - (b[2].indexOf(q) !== 0) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || a[0] - b[0]; });
    return hits.slice(0, 25);
  }
  function targetsOf(sc, listId) {
    var p = listId + '.';
    return Object.keys(sc.targets).filter(function (k) { return k.slice(0, p.length) === p; }).sort(function (a, b) {
      return (sc.targets[a].at || 0) - (sc.targets[b].at || 0) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  // The plan of one owner: every list of that owner together, in list order (spec section 5: a list is never planned alone).
  function planOf(sc, owner) {
    var st = S.stateOf(sc, owner), ids = sortedIds(sc.lists).filter(function (id) { return S.ownerOf(sc.lists[id]) === owner; });
    var lists = ids.map(function (id) {
      return { id: id, steps: sc.lists[id].steps || {}, targets: targetsOf(sc, id).map(function (k) { var t = clone(sc.targets[k]); t.id = k.slice(id.length + 1); return t; }) };
    });
    var order = sc.owners[owner] && sc.owners[owner].order;
    return E.plan(DATA, { order: order || '', ways: st.ways, have: st.have, lists: lists, prices: null });
  }
  // the plan line a wanted item counts in (the engine's own rule: make, then collectable, then high quality, then ordinary)
  function lineFor(plan, t) {
    var keys = plan.items[t.item] || [], want = t.make ? 'make' : t.coll ? 'coll' : t.hq ? 'hq' : 'normal', found = null, fb = null;
    keys.forEach(function (k) { var ln = plan.lines[k]; if (ln.part === want && !found) found = ln; if (ln.part === 'normal' && !fb) fb = ln; });
    return found || fb || (keys.length ? plan.lines[keys[0]] : null);
  }
  function qualityOf(t, ln) { return ln && ln.quality ? ln.quality : t.coll ? 'coll' : t.hq ? 'hq' : 'nq'; }
  function qWord(q) { return q === 'hq' ? 'high quality' : q === 'coll' ? 'collectable' : 'ordinary'; }

  // ------------------------------------------------------------------------------------------------ screens
  function btn(label, act, extra, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
  function topButtons() {
    return btn('New list', 'new') + ' <button type="button" class="btn" data-act="from-log" disabled title="Available in a coming step">From the crafting log</button>';
  }
  function statusHtml() {
    var h = '';
    if (SH.note) h += '<p class="lists-note-line">' + esc(SH.note) + '</p>';
    if (SH.rest) {
      h += '<p class="lists-rest">' + SH.rest.ways.map(function (w) { return btn('Buy the rest too: ' + (w === 'vendor' ? 'from a merchant' : 'on the market'), 'rest', ' data-by="' + w + '"'); }).join(' ') + '</p>';
    }
    if (SH.undo.length) {
      h += '<p class="lists-undo">' + btn('Undo: ' + SH.undo[0].label, 'undo', ' data-i="0"');
      if (SH.undo.length > 1) {
        h += '</p><details class="lists-earlier"><summary>Earlier changes (' + (SH.undo.length - 1) + ')</summary><ul>' + SH.undo.slice(1).map(function (e, i) {
          return '<li><span>' + esc(e.label) + '</span> ' + btn('Undo', 'undo', ' data-i="' + (i + 1) + '"') + '</li>';
        }).join('') + '</ul></details>';
      } else h += '</p>';
    }
    return '<div class="lists-status" role="status" aria-live="polite">' + h + '</div>';
  }
  function newForm() {
    var chars = SH.chars || [];
    return '<form class="lists-form" data-form="new" onsubmit="return false"><label>List name <input type="text" data-f="newname" maxlength="60" autocomplete="off"></label>' +
      '<label>Character <select data-f="newchar">' + chars.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '<option value="">No character</option></select></label>' +
      '<span class="row">' + btn('Create', 'create') + ' ' + btn('Cancel', 'cancel-new') + '</span></form>';
  }
  function renderHome() {
    var sc = sec(), lists = sc.lists, ids = sortedIds(lists), head = statusHtml();
    if (!ids.length) {
      main.innerHTML = head + '<div class="lists-empty"><p>No lists yet. Start one, or build one from the crafting-log pages you have not finished.</p><div class="row">' + topButtons() + '</div>' + (SH.view.form ? newForm() : '') + '</div>';
      return;
    }
    var wanted = {};
    Object.keys(sc.targets || {}).forEach(function (k) { var l = k.split('.')[0]; wanted[l] = (wanted[l] || 0) + 1; });
    var groups = {}, order = [];
    ids.forEach(function (id) { var c = lists[id].charId || ''; if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(id); });
    order.sort(function (a, b) { return (a === '') - (b === '') || (a < b ? -1 : a > b ? 1 : 0); });
    main.innerHTML = head + '<div class="lists-bar">' + topButtons() + '</div>' + (SH.view.form ? newForm() : '') + order.map(function (c) {
      return '<section class="lists-group" aria-label="' + esc(nameOfChar(c)) + '"><h2>' + esc(nameOfChar(c)) + '</h2><div class="lists-cards">' + groups[c].map(function (id) {
        var l = lists[id], steps = Math.max(1, count(l.steps)), n = wanted[id] || 0, asking = SH.view.confirm === 'list:' + id;
        return '<article class="list-card" data-list="' + esc(id) + '"><h3>' + esc(l.name || 'Untitled list') + '</h3><p>' + n + ' wanted item' + (n === 1 ? '' : 's') + ' · ' + steps + ' step' + (steps === 1 ? '' : 's') + '</p><p class="row">' +
          btn('Open', 'open') + ' ' + (asking ? '<span class="ask">Remove this list and its ' + n + ' wanted item' + (n === 1 ? '' : 's') + '?</span> ' + btn('Remove', 'remove-list', '', 'danger') + ' ' + btn('Keep', 'keep')
            : btn('Remove list', 'ask-remove-list')) + '</p></article>';
      }).join('') + '</div></section>';
    }).join('');
  }
  function flagBox(key, flag, label, on) { return '<label class="chk"><input type="checkbox" data-f="flag" data-flag="' + flag + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>'; }
  function renderRow(sc, listId, h, key, plan) {
    var t = sc.targets[key], owner = S.ownerOf(h), ln = t.done ? null : lineFor(plan, t), q = qualityOf(t, ln), tid = key.slice(listId.length + 1);
    var have = sc.have[owner + '.' + t.item], typed = (have && have[q]) || 0, name = itemName(t.item), recs = recipesOf(t.item);
    var need = ln ? (ln.part === 'make' ? ln.need : ln.short) : 0, steps = h.steps || {}, stepIds = Object.keys(steps).sort(function (a, b) { return (steps[a].n || 0) - (steps[b].n || 0) || (a < b ? -1 : a > b ? 1 : 0); });
    var h2 = '<li class="wanted-row' + (t.done ? ' done' : '') + '" data-key="' + esc(key) + '" data-item="' + t.item + '" data-q="' + q + '"><div class="w-head"><b class="w-name">' + esc(name) + '</b> <span class="w-count">' +
      (t.done ? 'Finished' : 'need ' + (ln ? ln.need : t.qty) + ', have ' + typed) + ' <span class="w-q">(' + qWord(q) + ')</span></span>' +
      (t.make ? ' <span class="tag">Must be crafted by me: ' + (t.crafted || 0) + ' of ' + t.qty + ' crafted</span>' : '') + '</div>';
    h2 += '<div class="w-edit"><label>Amount <input type="number" inputmode="numeric" min="1" max="99999" data-f="qty" value="' + t.qty + '"></label>';
    if (canHq(t.item) || t.hq) h2 += flagBox(key, 'hq', 'High quality', t.hq);
    if (canColl(t.item) || t.coll) h2 += flagBox(key, 'coll', 'Collectable', t.coll);
    if (recs.length || t.make) h2 += flagBox(key, 'make', 'Must be crafted by me', t.make);
    if (stepIds.length) h2 += '<label>Step <select data-f="step"><option value="">' + esc(steps[stepIds[0]].name) + ' (first)</option>' + stepIds.slice(1).map(function (s) {
      return '<option value="' + esc(s) + '"' + (t.step === s ? ' selected' : '') + '>' + esc(steps[s].name) + '</option>'; }).join('') + '</select></label>';
    h2 += '</div><div class="w-stock"><label>I have <input type="number" inputmode="numeric" min="0" max="999999" data-f="have" data-q="' + q + '" value="' + typed + '"></label> ' +
      btn('−', 'minus', ' aria-label="One less ' + esc(name) + '"') + ' ' + btn('+', 'plus', ' aria-label="One more ' + esc(name) + '"') + ' ' + (t.done ? '' : btn('Bought it', 'ask-bought')) + '</div>';
    if (SH.view.bought === key && !t.done) {
      h2 += '<div class="w-bought"><label>How many did you buy? <input type="number" inputmode="numeric" min="1" max="999999" data-f="boughtn" value="' + Math.max(1, need) + '"></label> <span>in ' + qWord(q) + ' quality</span> ' +
        btn('Add to my stock', 'bought') + ' ' + btn('Cancel', 'cancel-bought') + '</div>';
    }
    h2 += '<div class="w-act">' + btn(t.done ? 'Not finished' : 'Finished', 'done') + ' ' +
      (SH.view.confirm === key ? '<span class="ask">Remove this wanted item?</span> ' + btn('Remove', 'remove', '', 'danger') + ' ' + btn('Keep', 'keep') : btn('Remove', 'ask-remove')) + '</div></li>';
    return h2;
  }
  function hitsHtml() {
    var res = search(SH.view.search);
    if (SH.view.search.trim().length < 2) return '';
    return '<ul class="hits">' + (res.length ? res.map(function (n) { return '<li><span>' + esc(n[1]) + '</span> ' + btn('Add', 'add', ' data-item="' + n[0] + '" aria-label="Add ' + esc(n[1]) + '"') + '</li>'; }).join('') : '<li class="muted">No item matches.</li>') + '</ul>';
  }
  function renderList() {
    var sc = sec(), id = SH.view.list, h = sc.lists[id];
    if (!h) { SH.view.list = null; return renderHome(); }
    var owner = S.ownerOf(h), plan = planOf(sc, owner), keys = targetsOf(sc, id), steps = h.steps || {};
    var stepIds = Object.keys(steps).sort(function (a, b) { return (steps[a].n || 0) - (steps[b].n || 0) || (a < b ? -1 : a > b ? 1 : 0); });
    var out = statusHtml() + '<div class="lists-bar">' + btn('Your lists', 'back') + '</div>' +
      '<section class="lists-panel"><label class="list-title">List name <input type="text" data-f="listname" maxlength="60" value="' + esc(h.name || '') + '"></label>' +
      '<p class="muted">' + esc(nameOfChar(h.charId || '')) + ' · ' + (stepIds.length ? stepIds.length + ' step' + (stepIds.length === 1 ? '' : 's') + ': ' + stepIds.map(function (s) { return esc(steps[s].name); }).join(', ') : 'one step') + '</p>' +
      '<p class="row"><label>New step <input type="text" data-f="stepname" maxlength="60"></label> ' + btn('Add a step', 'addstep') + '</p></section>' +
      '<section class="lists-panel"><h2>Wanted</h2><div class="add-bar"><label>Add items <input type="search" data-f="search" autocomplete="off" value="' + esc(SH.view.search) + '" placeholder="Type part of an item name"></label> ' +
      '<label>Amount <input type="number" inputmode="numeric" min="1" max="99999" data-f="addqty" value="1"></label></div>' +
      '<div class="hits-box">' + hitsHtml() + '</div>' +
      (keys.length ? '<ul class="wanted">' + keys.map(function (k) { return renderRow(sc, id, h, k, plan); }).join('') + '</ul>' : '<p class="muted empty-line">Add the first item.</p>') +
      '<p class="muted">You type what you have. This app never reads the game. Clearing an amount keeps the old amount; only Remove removes.</p></section>';
    main.innerHTML = out;
  }
  function render() {
    if (SH.problem) { main.innerHTML = '<div class="lists-note"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.' + (SH.note ? ' ' + esc(SH.note) : '') + '</div>'; return; }
    if (SH.view.list) renderList(); else renderHome();
  }

  // ------------------------------------------------------------------------------------------------ events
  var CTX = function () { return { now: Date.now() }; };
  function rowOf(el) { var li = el.closest('[data-key]'); if (!li) return null; var key = li.getAttribute('data-key'), i = key.indexOf('.'); return { key: key, list: key.slice(0, i), tid: key.slice(i + 1), item: +li.getAttribute('data-item'), q: li.getAttribute('data-q'), el: li }; }
  function ownerOfList(listId) { var h = sec().lists[listId]; return S.ownerOf(h); }
  function vendorQualities(item, q) { var tr = (DATA.trades && DATA.trades[item]) || []; return tr.some(function (o) { return o[1].length === 1 && o[1][0][0] === 1 && (o[2] ? 'hq' : 'nq') === (q === 'hq' ? 'hq' : 'nq'); }); }
  main.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-act'), r = rowOf(b), listId = SH.view.list, card = b.closest('[data-list]');
    switch (a) {
      case 'new': SH.view.form = true; render(); var nm = main.querySelector('[data-f=newname]'); if (nm) nm.focus(); break;
      case 'cancel-new': SH.view.form = false; render(); break;
      case 'create': {
        var form = b.closest('[data-form]'), name = form.querySelector('[data-f=newname]').value, ch = form.querySelector('[data-f=newchar]').value || null;
        act(function (s) { var x = S.newList(s, { name: name, charId: ch, stamp: DATA.stamp }, CTX()); return x; }, { after: function (x) { SH.view.form = false; if (x.id) SH.view.list = x.id; } });
        break;
      }
      case 'open': SH.view.list = card.getAttribute('data-list'); SH.view.search = ''; SH.view.confirm = null; SH.view.bought = null; SH.note = ''; render(); break;
      case 'back': SH.view.list = null; SH.view.confirm = null; SH.view.bought = null; render(); break;
      case 'ask-remove-list': SH.view.confirm = 'list:' + card.getAttribute('data-list'); render(); break;
      case 'keep': SH.view.confirm = null; render(); break;
      case 'remove-list': { var lid = card.getAttribute('data-list'); SH.view.confirm = null; act(function (s) { return S.removeList(s, lid); }); break; }
      case 'add': {
        var qty = main.querySelector('[data-f=addqty]').value, item = +b.getAttribute('data-item'), rid = recipesOf(item)[0] || 0;
        act(function (s) { return labeled(S.addTarget(s, listId, { item: item, recipe: rid, qty: qty }, CTX()), 'Added ' + itemName(item)); });
        break;
      }
      case 'addstep': { var sn = main.querySelector('[data-f=stepname]').value; act(function (s) { return S.addStep(s, listId, sn, CTX()); }); break; }
      case 'done': { var t = sec().targets[r.key]; act(function (s) { return labeled(S.setDone(s, r.list, r.tid, !(t && t.done)), (t && t.done ? 'Marked not finished: ' : 'Finished: ') + itemName(r.item)); }); break; }
      case 'ask-remove': SH.view.confirm = r.key; render(); break;
      case 'remove': SH.view.confirm = null; act(function (s) { return labeled(S.removeTarget(s, r.list, r.tid), 'Removed ' + itemName(r.item)); }); break;
      case 'minus': case 'plus': act(function (s) { return labeled(S.adjustHave(s, ownerOfList(r.list), r.item, r.q, a === 'plus' ? 1 : -1), 'Changed what you have of ' + itemName(r.item)); }); break;
      case 'ask-bought': SH.view.bought = r.key; render(); var bn = main.querySelector('[data-f=boughtn]'); if (bn) { bn.focus(); bn.select(); } break;
      case 'cancel-bought': SH.view.bought = null; render(); break;
      case 'bought': {
        var units = r.el.querySelector('[data-f=boughtn]').value, owner = ownerOfList(r.list), t2 = sec().targets[r.key], mk = t2 && t2.make ? [r.key] : [];
        SH.view.bought = null;
        act(function (s) { return labeled(S.bought(s, { owner: owner, item: r.item, quality: r.q, units: units, makeKeys: mk }), 'Bought ' + Math.floor(Number(units)) + ' ' + itemName(r.item)); }, { after: function () {
          var ways = []; if (vendorQualities(r.item, r.q)) ways.push('vendor'); if (itemFlags(r.item) & 1) ways.push('market');
          SH.rest = ways.length ? { owner: owner, item: r.item, ways: ways } : null;
        } });
        break;
      }
      case 'rest': { var rest = SH.rest, by = b.getAttribute('data-by'); if (rest) act(function (s) { return labeled(S.setWay(s, rest.owner, rest.item, { by: by }), 'Chose how to get ' + itemName(rest.item)); }); break; }
      case 'undo': { var entry = SH.undo[+b.getAttribute('data-i')]; if (entry) act(function (s) { return S.undo(s, entry); }, { undoOf: entry }); break; }
    }
  });
  main.addEventListener('input', function (ev) { if (ev.target.getAttribute && ev.target.getAttribute('data-f') === 'search') { SH.view.search = ev.target.value; var box = main.querySelector('.hits-box'); if (box) box.innerHTML = hitsHtml(); } });
  main.addEventListener('change', function (ev) {
    var el = ev.target, f = el.getAttribute && el.getAttribute('data-f'); if (!f) return;
    var r = rowOf(el), listId = SH.view.list;
    if (f === 'qty') act(function (s) { return labeled(S.setQty(s, r.list, r.tid, el.value), 'Changed an amount of ' + itemName(r.item)); });
    else if (f === 'have') act(function (s) { return labeled(S.setHave(s, ownerOfList(r.list), r.item, el.getAttribute('data-q'), el.value), 'Changed what you have of ' + itemName(r.item)); });
    else if (f === 'flag') act(function (s) { return labeled(S.setFlag(s, r.list, r.tid, el.getAttribute('data-flag'), el.checked), 'Changed a setting of ' + itemName(r.item)); });
    else if (f === 'step') act(function (s) { return labeled(S.setStep(s, r.list, r.tid, el.value), 'Moved ' + itemName(r.item) + ' to another step'); });
    else if (f === 'listname') act(function (s) { return S.renameList(s, listId, el.value); });
  });

  // another page saved (the Tracker after a cloud sync, another tab): show its change, once nothing of ours is waiting
  function reload() {
    if (SH.hold) return Promise.resolve(); // a test holds this page's copy to make it stale (__lists.hold)
    if (SH.busy || SH.queue.length) { SH.reloadLater = true; return Promise.resolve(); }
    return loadSave().then(function () { if (SH.view.list && !sec().lists[SH.view.list]) SH.view.list = null; render(); });
  }
  window.__lists = { reload: reload, state: SH, data: function () { return DATA; }, section: function () { return SH.sec; }, hold: function (on) { SH.hold = !!on; }, combined: function () { return S.combined(sec()); } };
  if (CC) CC.onChange(reload);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reload(); });
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function (reg) {
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* works without offline support */ });
  }
  Promise.all([loadData(), loadSave()]).then(function () { render(); document.documentElement.dataset.ready = '1'; })
    .catch(function (e) { main.innerHTML = '<div class="lists-note"><b>The game data could not be opened.</b> ' + esc(e && e.message) + '</div>'; });
})();
