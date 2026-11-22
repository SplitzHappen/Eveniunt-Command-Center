// Eveniunt Command Center, Lists module page (work item W6 of docs/lists-spec.md): loads the one save and the data and shows
// "Your lists" with its empty state. Editing lists, the plan screens and the buttons' actions come in later work items; the
// buttons are drawn now and switched off. Nothing here writes to the save, and nothing is read from the game.
(function () {
  'use strict';
  var CC = window.CC;
  var main = document.getElementById('view');
  var SH = { problem: null, chars: [], sec: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // data/lists.json plus `log` and `noHandOver`, built in by build.js (packed when that is smaller)
  var DATA = null;
  function loadData() {
    var p = window.LISTS_DATA ? Promise.resolve(window.LISTS_DATA) : CC.unpack(window.LISTS_DATA_PACKED).then(JSON.parse);
    return p.then(function (d) { DATA = d; });
  }
  function loadSave() {
    return CC.read().then(function (r) {
      SH.problem = null;
      var doc = CC.emptyDoc();
      if (r.raw != null) { try { doc = CC.checkDoc(r.raw); } catch (e) { SH.problem = e.message; return; } } // unreadable or newer: never written over
      SH.chars = doc.chars; SH.sec = doc.modules.lists || null;
    }).catch(function (e) { SH.problem = e.message; });
  }

  // List order is fixed (spec section 4): by `order`, then `made`, then the id as plain text.
  function sortedIds(lists) {
    return Object.keys(lists).sort(function (a, b) {
      var x = lists[a], y = lists[b];
      return (x.order || 0) - (y.order || 0) || (x.made || 0) - (y.made || 0) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  function count(o) { return o ? Object.keys(o).length : 0; }
  function buttons() {
    return '<button type="button" class="btn" data-act="new" disabled title="Available in a coming step">New list</button> <button type="button" class="btn" data-act="from-log" disabled title="Available in a coming step">From the crafting log</button>';
  }
  function render() {
    if (SH.problem) { main.innerHTML = '<div class="lists-note"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.</div>'; return; }
    var sec = SH.sec || { lists: {}, targets: {} }, lists = sec.lists || {}, ids = sortedIds(lists);
    if (!ids.length) {
      main.innerHTML = '<div class="lists-empty"><p>No lists yet. Start one, or build one from the crafting-log pages you have not finished.</p><div class="row">' + buttons() + '</div></div>';
      return;
    }
    var wanted = {};
    Object.keys(sec.targets || {}).forEach(function (k) { var l = k.split('.')[0]; wanted[l] = (wanted[l] || 0) + 1; });
    var groups = {}, order = [];
    ids.forEach(function (id) { var c = lists[id].charId || ''; if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(id); });
    var nameOf = function (c) { if (!c) return 'No character'; var f = SH.chars.filter(function (x) { return x.id === c; })[0]; return f ? f.name : 'Character ' + c; };
    order.sort(function (a, b) { return (a === '') - (b === '') || (a < b ? -1 : a > b ? 1 : 0); });
    main.innerHTML = '<div class="lists-bar">' + buttons() + '</div>' + order.map(function (c) {
      return '<section class="lists-group" aria-label="' + esc(nameOf(c)) + '"><h2>' + esc(nameOf(c)) + '</h2><div class="lists-cards">' + groups[c].map(function (id) {
        var l = lists[id], steps = Math.max(1, count(l.steps)), n = wanted[id] || 0;
        return '<article class="list-card" data-list="' + esc(id) + '"><h3>' + esc(l.name || 'Untitled list') + '</h3><p>' + n + ' wanted item' + (n === 1 ? '' : 's') + ' · ' + steps + ' step' + (steps === 1 ? '' : 's') + '</p></article>';
      }).join('') + '</div></section>';
    }).join('');
  }

  function reload() { return loadSave().then(render); }
  window.__lists = { reload: reload, state: SH, data: function () { return DATA; } };
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
