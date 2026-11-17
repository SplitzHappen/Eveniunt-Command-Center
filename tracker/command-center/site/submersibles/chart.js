// Eveniunt Command Center, Submersibles: the sea chart (step S4-1).
// A chart DRAWN BY THIS APP from the position numbers (x, y) in data/submarines.json; it is not the game's map picture.
// Depth (z) is not drawn. Which sector reveals which is community data (unlocks). Nothing here reads or writes the save.
// Plain script: attaches to globalThis.CHART, so the geometry and the SVG text are tested in Node.
(function () {
  'use strict';
  var C = (globalThis.CHART = globalThis.CHART || {});
  var D = null, SECTOR = {}, SEA = {};
  // Orientation: true draws a larger y lower on the screen. Unverified against the game's map (the owner compares the
  // Deep-sea Site chart with the game); flipping the chart is this one constant.
  C.Y_DOWN = true;
  C.init = function (data) {
    D = data; SECTOR = {}; SEA = {};
    data.sectors.forEach(function (s) { SECTOR[s.id] = s; });
    data.seas.forEach(function (s) { SEA[s.id] = s; });
    return C;
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return String(Math.round(n * 10) / 10); }

  // The chart of one sea: drawing box, Start, nodes and reveal lines.
  // discovered: sector ids found by the free company; rank: the chosen sub's rank, or null (sets node.rankOk).
  C.view = function (seaId, discovered, rank) {
    var sea = SEA[seaId]; if (!sea) return null;
    var found = {}; (discovered || []).forEach(function (id) { found[id] = true; });
    var secs = D.sectors.filter(function (s) { return s.sea === seaId; });
    var xs = secs.map(function (s) { return s.x; }).concat([sea.x]), ys = secs.map(function (s) { return s.y; }).concat([sea.y]);
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var py = function (y) { return C.Y_DOWN ? y : minY + maxY - y; };
    var padX = Math.max(30, 0.08 * (maxX - minX)), padY = Math.max(30, 0.08 * (maxY - minY));
    var box = { x: minX - padX, y: minY - padY, w: maxX - minX + 2 * padX, h: maxY - minY + 2 * padY };
    var slotOf = {}; D.subSlots.forEach(function (u) { slotOf[u.sector] = u.slot; });
    var nodes = secs.map(function (s) {
      var u = D.unlocks[s.id] || {};
      var state = found[s.id] ? 'found' : (u.start || (u.by != null && found[u.by])) ? 'next' : 'far'; // a start sector is open from the start
      return {
        id: s.id, letter: s.letter, name: s.name, x: s.x, y: py(s.y), rank: s.rank, state: state,
        slot: slotOf[s.id] || null, opens: u.opensSea && SEA[u.opensSea] ? SEA[u.opensSea].name : null,
        rankOk: rank == null || s.rank <= rank
      };
    });
    var at = {}; nodes.forEach(function (n) { at[n.id] = n; });
    var lines = [];
    secs.forEach(function (s) {
      var u = D.unlocks[s.id] || {};
      if (u.by != null && at[u.by]) lines.push({ from: u.by, to: s.id, x1: at[u.by].x, y1: at[u.by].y, x2: at[s.id].x, y2: at[s.id].y });
    });
    return { sea: seaId, name: sea.name, box: box, start: { x: sea.x, y: py(sea.y) }, nodes: nodes, lines: lines };
  };

  var STATE = { found: 'found', next: 'can be revealed next', far: 'further away' };
  C.stateText = function (st) { return STATE[st]; };

  // The SVG text. route: sector ids (optional), drawn as a numbered line from Start.
  C.svg = function (view, route) {
    var b = view.box, span = Math.max(b.w, b.h), fs = span / 30, r = span / 70;
    var at = {}; view.nodes.forEach(function (n) { at[n.id] = n; });
    var o = '<svg class="chart-svg" viewBox="' + [b.x, b.y, b.w, b.h].map(num).join(' ') + '" role="group" aria-label="Chart of ' + esc(view.name) + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';
    o += '<g class="chart-lines" aria-hidden="true">' + view.lines.map(function (l) { return '<line x1="' + num(l.x1) + '" y1="' + num(l.y1) + '" x2="' + num(l.x2) + '" y2="' + num(l.y2) + '"/>'; }).join('') + '</g>';
    var path = [view.start].concat((route || []).filter(function (id) { return at[id]; }).map(function (id) { return at[id]; }));
    if (path.length > 1) o += '<polyline class="chart-route" aria-hidden="true" points="' + path.map(function (p) { return num(p.x) + ',' + num(p.y); }).join(' ') + '"/>';
    o += '<g class="chart-start" role="img" aria-label="Start: the sea\'s starting point"><rect x="' + num(view.start.x - r) + '" y="' + num(view.start.y - r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45 ' + num(view.start.x) + ' ' + num(view.start.y) + ')"/><text x="' + num(view.start.x) + '" y="' + num(view.start.y + r * 1.5 + fs * 1.1) + '" text-anchor="middle" font-size="' + num(fs) + '">Start</text></g>';
    view.nodes.forEach(function (n) {
      var tags = [n.slot ? 'slot ' + n.slot : '', n.opens ? 'opens ' + n.opens : ''].filter(Boolean);
      var label = n.name + ', rank ' + n.rank + ', ' + STATE[n.state] + (tags.length ? ', ' + tags.join(', ') : '');
      var shape = n.state === 'found' ? '<circle r="' + num(r) + '"/>'
        : n.state === 'next' ? '<rect x="' + num(-r) + '" y="' + num(-r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45)"/>'
        : '<rect x="' + num(-r * 0.7) + '" y="' + num(-r * 0.7) + '" width="' + num(1.4 * r) + '" height="' + num(1.4 * r) + '"/>';
      var idx = (route || []).indexOf(n.id);
      o += '<g class="chart-node ' + n.state + (n.rankOk ? '' : ' over-rank') + '" data-sector="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(label) + '" transform="translate(' + num(n.x) + ' ' + num(n.y) + ')">' +
        '<circle class="hit" r="' + num(r * 2.2) + '"/>' + shape +
        '<text class="chart-letter" y="' + num(-r * 2.2 - fs * 0.3) + '" text-anchor="middle" font-size="' + num(fs) + '">' + esc(n.letter) + (idx >= 0 ? ' ' + (idx + 1) : '') + '</text>' +
        (tags.length ? '<text class="chart-tag" y="' + num(r * 2.2 + fs * 0.85) + '" text-anchor="middle" font-size="' + num(fs * 0.8) + '">' + esc(tags.join(' · ')) + '</text>' : '') + '</g>';
    });
    return o + '</svg>';
  };
})();
