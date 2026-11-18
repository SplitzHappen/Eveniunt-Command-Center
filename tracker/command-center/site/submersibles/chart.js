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
    // Graticule (decoration): a line at every multiple of 100 in data x and data y, over the box and one box-width beyond; y goes through py like the nodes.
    var step = 100, gx0 = box.x - box.w, gx1 = box.x + 2 * box.w, gy0 = box.y - box.h, gy1 = box.y + 2 * box.h;
    var dlo = C.Y_DOWN ? gy0 : minY + maxY - gy1, dhi = C.Y_DOWN ? gy1 : minY + maxY - gy0, gxs = [], gyd = [];
    for (var gx = Math.ceil(gx0 / step) * step; gx <= gx1; gx += step) gxs.push(gx);
    for (var gy = Math.ceil(dlo / step) * step; gy <= dhi; gy += step) gyd.push(gy);
    var grid = { step: step, xs: gxs, ys: gyd.map(py), yd: gyd, x0: gx0, x1: gx1, y0: gy0, y1: gy1 };
    return { sea: seaId, name: sea.name, box: box, start: { x: sea.x, y: py(sea.y) }, nodes: nodes, lines: lines, grid: grid };
  };

  var STATE = { found: 'found', next: 'can be revealed next', far: 'further away' };
  C.stateText = function (st) { return STATE[st]; };

  // The invisible tap circle of each node, in chart units: about 40 px across at a phone width (the chart is then roughly
  // 340 px wide, so a radius of span / 17), but never more than half the distance to the nearest other sector, so
  // neighbouring tap circles do not swallow each other's taps.
  C.TAP_FRACTION = 1 / 17;
  C.hitRadii = function (view) {
    var b = view.box, span = Math.max(b.w, b.h), want = span * C.TAP_FRACTION, out = {};
    view.nodes.forEach(function (n) {
      var near = Infinity;
      view.nodes.forEach(function (m) { if (m !== n) near = Math.min(near, Math.hypot(m.x - n.x, m.y - n.y)); });
      out[n.id] = Math.min(want, near / 2);
    });
    return out;
  };

  // Where each secondary label (slot / opens) goes: the first of below, above, right, left whose estimated box touches no
  // other marker, letter, Start, reveal line, earlier label or the edge of the drawing. Position data is not changed.
  function placeTags(view, r, fs) {
    var b = view.box, ext = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }, fsT = fs * 0.8, cw = 0.55, boxes = [], res = {}, lines = view.lines;
    function textBox(x, y, str, size, anchor) { var w = str.length * cw * size, x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2; return { x0: x0, x1: x0 + w, y0: y - size, y1: y + size * 0.25 }; }
    function hit(a, c) { return a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1; }
    view.nodes.forEach(function (n) {
      boxes.push({ x0: n.x - r * 1.5, x1: n.x + r * 1.5, y0: n.y - r * 1.5, y1: n.y + r * 1.5 });
      boxes.push(textBox(n.x, n.y - r * 2.2 - fs * 0.3, n.letter + ' 5', fs, 'middle'));
    });
    boxes.push({ x0: view.start.x - r * 1.5, x1: view.start.x + r * 1.5, y0: view.start.y - r * 1.5, y1: view.start.y + r * 1.5 });
    boxes.push(textBox(view.start.x, view.start.y + r * 1.5 + fs * 1.1, 'Start', fs, 'middle'));
    function inside(t) { return t.x0 >= b.x && t.x1 <= b.x + b.w && t.y0 >= b.y && t.y1 <= b.y + b.h; }
    function free(t) {
      if (boxes.some(function (o) { return hit(t, o); })) return false;
      return !lines.some(function (l) { for (var i = 0; i <= 24; i++) { var px = l.x1 + (l.x2 - l.x1) * i / 24, py = l.y1 + (l.y2 - l.y1) * i / 24; if (px > t.x0 && px < t.x1 && py > t.y0 && py < t.y1) return true; } return false; });
    }
    view.nodes.forEach(function (n) {
      var str = [n.slot ? 'slot ' + n.slot : '', n.opens ? 'opens ' + n.opens : ''].filter(Boolean).join(' · ');
      if (!str) return;
      var cand = [
        { x: 0, y: r * 2.2 + fs * 0.85, anchor: 'middle' },
        { x: 0, y: -r * 2.2 - fs * 1.65, anchor: 'middle' },
        { x: r * 1.8, y: fsT * 0.35, anchor: 'start' },
        { x: -r * 1.8, y: fsT * 0.35, anchor: 'end' },
        // a long label that fits none of the four: below or above, hanging to one side
        { x: -r, y: r * 2.2 + fs * 0.85, anchor: 'end' },
        { x: r, y: r * 2.2 + fs * 0.85, anchor: 'start' },
        { x: -r, y: -r * 2.2 - fs * 1.65, anchor: 'end' },
        { x: r, y: -r * 2.2 - fs * 1.65, anchor: 'start' }
      ];
      var pick = null, loose = null;
      for (var i = 0; i < cand.length && !pick; i++) {
        var c = cand[i], t = textBox(n.x + c.x, n.y + c.y, str, fsT, c.anchor);
        if (!free(t)) continue;
        if (inside(t)) pick = c; else if (!loose) loose = c; // a free place outside the drawing box is taken only if none inside (the box then grows)
      }
      pick = pick || loose || cand[0];
      var pb = textBox(n.x + pick.x, n.y + pick.y, str, fsT, pick.anchor);
      boxes.push(pb);
      res[n.id] = pick;
      ext = { x0: Math.min(ext.x0, pb.x0 - fsT * 0.3), y0: Math.min(ext.y0, pb.y0 - fsT * 0.3), x1: Math.max(ext.x1, pb.x1 + fsT * 0.3), y1: Math.max(ext.y1, pb.y1 + fsT * 0.3) };
    });
    res.extent = ext;
    return res;
  }

  // The SVG text. route: sector ids (optional), drawn as a numbered line from Start. opts.selected: the sector id drawn with brackets.
  // Everything but the sector nodes, Start and its label is decoration (aria-hidden); no position is changed (spec D7).
  C.svg = function (view, route, opts) {
    var b = view.box, span = Math.max(b.w, b.h), fs = span / 30, r = span / 70, sel = opts && opts.selected != null ? String(opts.selected) : null;
    var at = {}; view.nodes.forEach(function (n) { at[n.id] = n; });
    var hits = C.hitRadii(view), tagAt = placeTags(view, r, fs), st = view.start, g = view.grid;
    var e = tagAt.extent, o = '<svg class="chart-svg" data-sea="' + esc(view.sea) + '" viewBox="' + [e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0].map(num).join(' ') + '" role="group" aria-label="Chart of ' + esc(view.name) + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';
    function gridPath(cls, keepX, keepY) {
      var d = '';
      g.xs.forEach(function (x) { if (keepX(x)) d += 'M' + num(x) + ' ' + num(g.y0) + 'L' + num(x) + ' ' + num(g.y1); });
      g.ys.forEach(function (y, i) { if (keepY(g.yd[i])) d += 'M' + num(g.x0) + ' ' + num(y) + 'L' + num(g.x1) + ' ' + num(y); });
      return '<path class="' + cls + '" aria-hidden="true" d="' + d + '"/>';
    }
    o += gridPath('chart-grid', function () { return true; }, function () { return true; });
    o += gridPath('chart-grid major', function (x) { return x % 500 === 0; }, function (y) { return y % 500 === 0; });
    // sonar rings: every 200 units out from Start to the farthest corner of the box, 8 at most; every second ring is dashed
    var far = Math.max.apply(null, [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(function (c) { return Math.hypot(c[0] - st.x, c[1] - st.y); }));
    var nr = Math.min(8, Math.floor(far / 200)), R = nr ? nr * 200 : far, rings = '';
    for (var k = 1; k <= nr; k++) rings += '<circle class="' + (k % 2 ? 'solid' : 'dash') + '" cx="' + num(st.x) + '" cy="' + num(st.y) + '" r="' + (k * 200) + '"/>';
    o += '<g class="chart-rings" aria-hidden="true">' + rings + '</g>';
    // the turning sweep: a 40 degree fan with its point on Start, its leading edge clockwise; CSS turns it about Start
    var a1 = -Math.PI / 2, a0 = a1 - 40 * Math.PI / 180, p0 = [st.x + R * Math.cos(a0), st.y + R * Math.sin(a0)], p1 = [st.x + R * Math.cos(a1), st.y + R * Math.sin(a1)];
    o += '<g class="chart-sweep" aria-hidden="true" style="transform-origin:' + num(st.x) + 'px ' + num(st.y) + 'px"><path class="chart-sweep-fan" d="M' + num(st.x) + ' ' + num(st.y) + 'L' + num(p0[0]) + ' ' + num(p0[1]) + 'A' + num(R) + ' ' + num(R) + ' 0 0 1 ' + num(p1[0]) + ' ' + num(p1[1]) + 'Z"/><line class="chart-sweep-edge" x1="' + num(st.x) + '" y1="' + num(st.y) + '" x2="' + num(p1[0]) + '" y2="' + num(p1[1]) + '"/></g>';
    // a chevron on the middle of a segment, pointing from (x1, y1) to (x2, y2)
    function chev(x1, y1, x2, y2, size, cls) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (!len) return '';
      var ux = dx / len, uy = dy / len, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, px = -uy, py2 = ux;
      return '<path class="' + cls + '" aria-hidden="true" d="M' + num(mx - ux * size * 0.6 + px * size * 0.8) + ' ' + num(my - uy * size * 0.6 + py2 * size * 0.8) + 'L' + num(mx + ux * size) + ' ' + num(my + uy * size) + 'L' + num(mx - ux * size * 0.6 - px * size * 0.8) + ' ' + num(my - uy * size * 0.6 - py2 * size * 0.8) + '"/>';
    }
    // The way to an unfound slot or next-sea sector (a class only): from each such sector, back along the reveal links while the sector is not found.
    var byOf = {}; view.lines.forEach(function (l) { byOf[l.to] = l.from; });
    var goal = {};
    view.nodes.forEach(function (n) {
      if (!(n.slot || n.opens) || n.state === 'found') return;
      var id = n.id, i = 0;
      while (id != null && at[id] && at[id].state !== 'found' && i++ < 64) { goal[id] = true; id = byOf[id]; }
    });
    // open or closed as before; done: both ends found; lead: only the from end found; goal: on the way to a slot or sea
    function lcls(l) { return (at[l.from].state === 'found' ? 'open' : 'closed') + (at[l.from].state === 'found' && at[l.to].state === 'found' ? ' done' : '') + (at[l.from].state === 'found' && at[l.to].state !== 'found' ? ' lead' : '') + (goal[l.to] ? ' goal' : ''); }
    o += '<g class="chart-lines" aria-hidden="true">' + view.lines.map(function (l) { return '<line class="' + lcls(l) + '" x1="' + num(l.x1) + '" y1="' + num(l.y1) + '" x2="' + num(l.x2) + '" y2="' + num(l.y2) + '"/>'; }).join('') + '</g>';
    o += '<g class="chart-chevs" aria-hidden="true">' + view.lines.map(function (l) { return chev(l.x1, l.y1, l.x2, l.y2, r * 0.7, 'chart-chev ' + lcls(l)); }).join('') + '</g>';
    var path = [st].concat((route || []).filter(function (id) { return at[id]; }).map(function (id) { return at[id]; }));
    if (path.length > 1) {
      var pts = path.map(function (p) { return num(p.x) + ',' + num(p.y); }).join(' ');
      o += '<path class="chart-route-glow" aria-hidden="true" d="M' + path.map(function (p) { return num(p.x) + ' ' + num(p.y); }).join('L') + '"/>';
      o += '<polyline class="chart-route" aria-hidden="true" points="' + pts + '"/>';
      for (var i = 1; i < path.length; i++) o += chev(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, r * 0.8, 'chart-route-dir');
    }
    o += '<g class="chart-start" role="img" aria-label="Start: the sea\'s starting point"><circle class="chart-start-ping" aria-hidden="true" cx="' + num(st.x) + '" cy="' + num(st.y) + '" r="' + num(r * 1.5) + '"/><circle class="chart-start-ring" aria-hidden="true" cx="' + num(st.x) + '" cy="' + num(st.y) + '" r="' + num(r * 1.5) + '"/><rect x="' + num(st.x - r) + '" y="' + num(st.y - r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45 ' + num(st.x) + ' ' + num(st.y) + ')"/><text x="' + num(st.x) + '" y="' + num(st.y + r * 1.5 + fs * 1.1) + '" text-anchor="middle" font-size="' + num(fs) + '">Start</text></g>';
    view.nodes.forEach(function (n) {
      var tags = [n.slot ? 'slot ' + n.slot : '', n.opens ? 'opens ' + n.opens : ''].filter(Boolean);
      var no = opts && opts.cannot && opts.cannot[n.id]; // G2: why this sector cannot be added to the route being planned (words from the planner)
      var label = n.name + ', rank ' + n.rank + ', ' + STATE[n.state] + (tags.length ? ', ' + tags.join(', ') : '') + (n.rankOk ? '' : ', above this submarine\'s rank') + (no ? ', ' + no : '');
      var shape = n.state === 'found' ? '<circle r="' + num(r) + '"/>'
        : n.state === 'next' ? '<rect x="' + num(-r) + '" y="' + num(-r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45)"/>'
        : '<rect x="' + num(-r * 0.7) + '" y="' + num(-r * 0.7) + '" width="' + num(1.4 * r) + '" height="' + num(1.4 * r) + '"/>';
      var idx = (route || []).indexOf(n.id), onRoute = idx >= 0, isSel = sel === String(n.id), c15 = r * 1.5, c09 = r * 0.9;
      var extra = (n.state === 'next' ? '<circle class="chart-halo" aria-hidden="true" r="' + num(r * 1.1) + '"/>' : '') +
        (n.rankOk ? '' : '<circle class="chart-overring" aria-hidden="true" r="' + num(r * 1.3) + '"/>') +
        (onRoute ? '<circle class="chart-routering" aria-hidden="true" r="' + num(r * 1.4) + '"/>' : '') +
        (no ? '<circle class="chart-cannot-ring" aria-hidden="true" r="' + num(r * 1.25) + '"/>' : '') +
        (n.opens ? '<circle class="chart-ring2" aria-hidden="true" r="' + num(c15) + '"/>' : '') +
        (isSel ? '<path class="chart-lock" aria-hidden="true" d="' + [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (q) { return 'M' + num(q[0] * c15) + ' ' + num(q[1] * c09) + 'L' + num(q[0] * c15) + ' ' + num(q[1] * c15) + 'L' + num(q[0] * c09) + ' ' + num(q[1] * c15); }).join('') + '"/>' : '') +
        (n.slot ? '<path class="chart-plus" aria-hidden="true" d="M' + num(r * 0.6) + ' ' + num(-r) + 'H' + num(r * 1.4) + 'M' + num(r) + ' ' + num(-r * 1.4) + 'V' + num(-r * 0.6) + '"/>' : '');
      o += '<g class="chart-node ' + n.state + (n.rankOk ? '' : ' over-rank') + (no ? ' cannot' : '') + (onRoute ? ' on-route' : '') + (isSel ? ' selected' : '') + (n.slot ? ' has-slot' : '') + (n.opens ? ' opens-sea' : '') + '" data-sector="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(label) + '" transform="translate(' + num(n.x) + ' ' + num(n.y) + ')">' +
        '<circle class="hit" r="' + num(hits[n.id]) + '"/>' + extra + shape +
        (no ? '<path class="chart-cannot-x" aria-hidden="true" d="M' + num(r * 0.7) + ' ' + num(r * 0.7) + 'L' + num(r * 1.7) + ' ' + num(r * 1.7) + 'M' + num(r * 1.7) + ' ' + num(r * 0.7) + 'L' + num(r * 0.7) + ' ' + num(r * 1.7) + '"/>' : '') +
        '<text class="chart-letter" y="' + num(-r * 2.2 - fs * 0.3) + '" text-anchor="middle" font-size="' + num(fs) + '">' + esc(n.letter) + (idx >= 0 ? ' ' + (idx + 1) : '') + '</text>' +
        (tags.length ? '<text class="chart-tag" x="' + num(tagAt[n.id].x) + '" y="' + num(tagAt[n.id].y) + '" text-anchor="' + tagAt[n.id].anchor + '" font-size="' + num(fs * 0.8) + '">' + esc(tags.join(' · ')) + '</text>' : '') + '</g>';
    });
    return o + '</svg>';
  };
})();
