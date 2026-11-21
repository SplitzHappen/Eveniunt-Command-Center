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

  // The invisible tap circle of each node, in chart units. Wanted: 44 CSS px across at a 360 px screen (the chart is then about 320 px
  // wide, so a radius of about span / 14, a little more because the drawing is a little larger than its box; wider screens give more pixels for the same radius). Where two sectors are closer than that, a
  // circle is as large as it can be without overlapping a neighbour's circle: first half the distance to the nearest sector, then,
  // where the neighbour's circle is smaller, the rest of the distance up to the wanted radius. Never more than wanted.
  C.TAP_FRACTION = 1 / 13.5;
  C.hitRadii = function (view) {
    var b = view.box, span = Math.max(b.w, b.h), want = span * C.TAP_FRACTION, out = {}, ns = view.nodes, d = {};
    ns.forEach(function (n) {
      var near = Infinity; d[n.id] = {};
      ns.forEach(function (m) { if (m !== n) { var l = Math.hypot(m.x - n.x, m.y - n.y); d[n.id][m.id] = l; near = Math.min(near, l); } });
      out[n.id] = Math.min(want, near / 2);
    });
    for (var pass = 0; pass < 4; pass++) ns.forEach(function (n) {
      var r = want;
      ns.forEach(function (m) { if (m !== n) r = Math.min(r, d[n.id][m.id] - out[m.id]); });
      if (r > out[n.id]) out[n.id] = r;
    });
    return out;
  };

  // Where each secondary label (slot / opens) goes: the first of below, above, right, left whose estimated box touches no
  // other marker, letter, Start, reveal line, earlier label or the edge of the drawing. Position data is not changed.
  // S2: the optional fourth argument adds obstacles: extra.letters (id -> the letter's text box as drawn), extra.boxes (more boxes: the selected node's bracket, the "+" marks, the cross); without it nothing changes
  function placeTags(view, r, fs, extra) {
    var b = view.box, ext = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }, fsT = fs * 0.8, cw = 0.55, boxes = [], res = {}, lines = view.lines;
    function textBox(x, y, str, size, anchor) { var w = str.length * cw * size, x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2; return { x0: x0, x1: x0 + w, y0: y - size, y1: y + size * 0.25 }; }
    function hit(a, c) { return a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1; }
    view.nodes.forEach(function (n) {
      boxes.push({ x0: n.x - r * 1.5, x1: n.x + r * 1.5, y0: n.y - r * 1.5, y1: n.y + r * 1.5 });
      if (extra && extra.letters && extra.letters[n.id]) { var lt = extra.letters[n.id]; boxes.push(textBox(n.x + lt.x, n.y + lt.y, lt.str, fs, lt.anchor)); }
      else boxes.push(textBox(n.x, n.y - r * 2.2 - fs * 0.3, n.letter + ' 5', fs, 'middle'));
    });
    if (extra) (extra.boxes || []).forEach(function (bx) { boxes.push(bx); });
    var st = view.start;
    boxes.push({ x0: st.x - r * 1.5, x1: st.x + r * 1.5, y0: st.y - r * 1.5, y1: st.y + r * 1.5 });
    function inside(t) { return t.x0 >= b.x && t.x1 <= b.x + b.w && t.y0 >= b.y && t.y1 <= b.y + b.h; }
    function onSeg(list, t, pad) { return list.some(function (l) { for (var i = 0; i <= 24; i++) { var px = l.x1 + (l.x2 - l.x1) * i / 24, py = l.y1 + (l.y2 - l.y1) * i / 24; if (px > t.x0 - pad && px < t.x1 + pad && py > t.y0 - pad && py < t.y1 + pad) return true; } return false; }); }
    // E4: the "Start" label goes by the same rule as the other labels: the first of below, above, right, left (then hanging to a side) whose box is inside the drawing
    // and touches no node with its rings, no letter, mark, reveal line or planned-route line. Where none is free the old place (below) stays.
    var sDef = { x: st.x, y: st.y + r * 1.5 + fs * 1.1, anchor: 'middle' }, sPick = sDef, rr = r + 13;
    (function () {
      var cs = [sDef, { x: st.x, y: st.y - r * 1.5 - fs * 0.4, anchor: 'middle' }, { x: st.x + r * 2.2, y: st.y + fs * 0.35, anchor: 'start' }, { x: st.x - r * 2.2, y: st.y + fs * 0.35, anchor: 'end' },
        { x: st.x - r, y: sDef.y, anchor: 'end' }, { x: st.x + r, y: sDef.y, anchor: 'start' }, { x: st.x - r, y: st.y - r * 1.5 - fs * 0.4, anchor: 'end' }, { x: st.x + r, y: st.y - r * 1.5 - fs * 0.4, anchor: 'start' }];
      var segs = (extra && extra.segs) || [];
      for (var i = 0; i < cs.length; i++) {
        var t = textBox(cs[i].x, cs[i].y, 'Start', fs, cs[i].anchor);
        if (!inside(t)) continue;
        if (view.nodes.some(function (n) { return n.x + rr > t.x0 && n.x - rr < t.x1 && n.y + rr > t.y0 && n.y - rr < t.y1; })) continue;
        if (boxes.some(function (o, k) { return k >= view.nodes.length * 2 && hit(t, o); })) continue; // letters are in boxes after the node boxes (pairs); the marks follow
        if (boxes.slice(0, view.nodes.length * 2).some(function (o, k) { return k % 2 === 1 && hit(t, o); })) continue;
        if (onSeg(lines, t, 2) || onSeg(segs, t, 2)) continue;
        sPick = cs[i]; break;
      }
    })();
    boxes.push(textBox(sPick.x, sPick.y, 'Start', fs, sPick.anchor));
    var MK = r * 1.42, PADU = (Math.max(b.w, b.h) / 320) * 6.5; // F5: a marker is at most 1.42 r from its centre (the diamond); a label keeps 6.5 px (at a phone's chart width) from the marker of every other sector
    function free(t) {
      if (boxes.some(function (o) { return hit(t, o); })) return false;
      return !lines.some(function (l) { for (var i = 0; i <= 24; i++) { var px = l.x1 + (l.x2 - l.x1) * i / 24, py = l.y1 + (l.y2 - l.y1) * i / 24; if (px > t.x0 && px < t.x1 && py > t.y0 && py < t.y1) return true; } return false; });
    }
    function grow(t) { return { x0: t.x0 - fsT * 0.3, x1: t.x1 + fsT * 0.3, y0: t.y0 - fsT * 0.3, y1: t.y1 + fsT * 0.3 }; } // the drawing box grows by this around a label, so a label is moved only where it does not
    function clearOfMarkers(t, own) { return !view.nodes.some(function (m) { return m !== own && m.x + MK + PADU > t.x0 && m.x - MK - PADU < t.x1 && m.y + MK + PADU > t.y0 && m.y - MK - PADU < t.y1; }); }
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
      // F5: a label that is inside the drawing but too near another sector's marker moves to the first inside place that keeps 6.5 px from every other marker; the drawing box never changes by this
      if (pick) {
        var t0 = textBox(n.x + pick.x, n.y + pick.y, str, fsT, pick.anchor);
        if (inside(grow(t0)) && !clearOfMarkers(t0, n)) for (var j = 0; j < cand.length; j++) { var tj = textBox(n.x + cand[j].x, n.y + cand[j].y, str, fsT, cand[j].anchor); if (free(tj) && inside(grow(tj)) && clearOfMarkers(tj, n)) { pick = cand[j]; break; } }
      }
      pick = pick || loose || cand[0];
      var pb = textBox(n.x + pick.x, n.y + pick.y, str, fsT, pick.anchor);
      boxes.push(pb);
      res[n.id] = pick;
      ext = { x0: Math.min(ext.x0, pb.x0 - fsT * 0.3), y0: Math.min(ext.y0, pb.y0 - fsT * 0.3), x1: Math.max(ext.x1, pb.x1 + fsT * 0.3), y1: Math.max(ext.y1, pb.y1 + fsT * 0.3) };
    });
    res.extent = ext; res.start = sPick;
    return res;
  }

  // The SVG text. route: sector ids (optional), drawn as a numbered line from Start. opts.selected: the sector id drawn with brackets.
  // Everything but the sector nodes, Start and its label is decoration (aria-hidden); no position is changed (spec D7).
  // S2 geometry, in chart units: every ring is at least 6 beyond the node (R0, the route ring R1), the selection bracket stands outside all rings (BK), the "+" and cross marks stand outside the bracket
  C.marks = function (r) { var BK = r + 17; return { R0: r + 6, R1: r + 11, BK: BK, RF: BK + 5, po: BK + 8, pa: Math.max(4, r * 0.55), ca: Math.max(4, r * 1.2) }; }; // M17: the keyboard-focus ring (RF) hugs the bracket and the "+" and cross marks start beyond it, on the diagonal, so a mark never sits on a ring
  C.svg = function (view, route, opts) {
    var b = view.box, span = Math.max(b.w, b.h), fs = span / 30, r = span / 70, sel = opts && opts.selected != null ? String(opts.selected) : null;
    var at = {}; view.nodes.forEach(function (n) { at[n.id] = n; });
    var hits = C.hitRadii(view), st = view.start, g = view.grid, M = C.marks(r);
    var rt = (route || []).filter(function (id) { return at[id]; }), segs = [], pathPts = [st].concat(rt.map(function (id) { return at[id]; }));
    for (var si = 1; si < pathPts.length; si++) segs.push({ x1: pathPts[si - 1].x, y1: pathPts[si - 1].y, x2: pathPts[si].x, y2: pathPts[si].y });
    function segHit(t) { return onLines(t, bright, 4) || segs.some(function (l) { for (var i = 0; i <= 24; i++) { var px = l.x1 + (l.x2 - l.x1) * i / 24, py = l.y1 + (l.y2 - l.y1) * i / 24; if (px > t.x0 - 4 && px < t.x1 + 4 && py > t.y0 - 4 && py < t.y1 + 4) return true; } return false; }); }
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
    // V4: the reveal lines are obstacles too. The bright ones (the way to the next slot or sea, and the amber "can be revealed now" arrows) must not be crossed by a "+" mark, a cross or a label; the others are avoided when a place is free of them
    var bright = [], allLines = [];
    view.lines.forEach(function (l) { var seg = { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }; allLines.push(seg); if (/lead|goal/.test(lcls(l))) bright.push(seg); });
    function onLines(t, list, pad) { return list.some(function (l) { for (var i = 0; i <= 48; i++) { var px = l.x1 + (l.x2 - l.x1) * i / 48, py = l.y1 + (l.y2 - l.y1) * i / 48; if (px > t.x0 - pad && px < t.x1 + pad && py > t.y0 - pad && py < t.y1 + pad) return true; } return false; }); }
    function onNode(t, n) { return view.nodes.some(function (m) { return m !== n && m.x + r * 1.5 > t.x0 && m.x - r * 1.5 < t.x1 && m.y + r * 1.5 > t.y0 && m.y - r * 1.5 < t.y1; }); }
    // the corner of a node where its "+" and cross stand: the upper right as before, else the first of lower right, upper left, lower left whose marks touch no line and no other node; when every corner touches a line, the first free of the bright lines
    var cornerOf = {}, CORN = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
    function markBoxes(n, q) {
      var out = [], cp = M.po + M.pa, hasX = !!(opts && opts.cannot && opts.cannot[n.id]) && n.state === 'found' && !n.rankOk, cx = M.po + M.ca + (n.slot ? 2 * M.pa + M.ca + 4 : 0);
      if (n.slot) out.push({ x0: n.x + q[0] * cp - M.pa - 2, x1: n.x + q[0] * cp + M.pa + 2, y0: n.y + q[1] * cp - M.pa - 2, y1: n.y + q[1] * cp + M.pa + 2 });
      if (hasX) out.push({ x0: n.x + q[0] * cx - M.ca - 2, x1: n.x + q[0] * cx + M.ca + 2, y0: n.y + q[1] * cx - M.ca - 2, y1: n.y + q[1] * cx + M.ca + 2 });
      return out;
    }
    view.nodes.forEach(function (n) {
      cornerOf[n.id] = CORN[0];
      var bx = markBoxes(n, CORN[0]); if (!bx.length) return;
      var ok = function (q, strict) { var b = markBoxes(n, q); return !b.some(function (t) { return onLines(t, bright, 3) || onNode(t, n) || (strict && onLines(t, allLines, 1)); }); }, pick = null;
      for (var k = 0; k < CORN.length && !pick; k++) if (ok(CORN[k], true)) pick = CORN[k];
      for (k = 0; k < CORN.length && !pick; k++) if (ok(CORN[k], false)) pick = CORN[k];
      cornerOf[n.id] = pick || CORN[0];
    });
    // where each letter goes: above its node (clear of every ring and of the bracket); with a route drawn, the first of above, below, right, left whose text box touches no route segment (so a step label never sits on the line)
    var letterAt = {}, boxesX = [];
    view.nodes.forEach(function (n) {
      var ri = (route || []).indexOf(n.id), isS = sel === String(n.id), mk = !!(opts && opts.cannot && opts.cannot[n.id]) && n.state === 'found' && !n.rankOk;
      var top = isS ? M.RF + 2 : ri >= 0 ? M.R1 + 2 : (n.opens || mk) ? M.R0 + 2 : 0, D = Math.max(r * 2.2 + fs * 0.3, top + 3), str = n.letter + (ri >= 0 ? ' ' + (ri + 1) : ''), w = str.length * 0.55 * fs;
      var cand = [{ x: 0, y: -D, anchor: 'middle' }, { x: 0, y: D + fs * 0.75, anchor: 'middle' }, { x: D, y: fs * 0.35, anchor: 'start' }, { x: -D, y: fs * 0.35, anchor: 'end' }], pick = cand[0];
      if (segs.length || bright.length || (sel && !isS)) for (var i = 0; i < cand.length; i++) { var c = cand[i], x0 = n.x + c.x - (c.anchor === 'start' ? 0 : c.anchor === 'end' ? w : w / 2), tb = { x0: x0, x1: x0 + w, y0: n.y + c.y - fs, y1: n.y + c.y + fs * 0.25 }; if (!segHit(tb) && !(sel && !isS && at[sel] && tb.x0 < at[sel].x + M.RF + 4 && at[sel].x - M.RF - 4 < tb.x1 && tb.y0 < at[sel].y + M.RF + 4 && at[sel].y - M.RF - 4 < tb.y1)) { pick = c; break; } }
      letterAt[n.id] = { x: pick.x, y: pick.y, anchor: pick.anchor, str: str };
      if (isS) boxesX.push({ x0: n.x - M.RF - 2, x1: n.x + M.RF + 2, y0: n.y - M.RF - 2, y1: n.y + M.RF + 2 });
      markBoxes(n, cornerOf[n.id]).forEach(function (bx) { boxesX.push(bx); }); // V4: the boxes of the "+" and the cross, at the corner chosen for them
    });
    var tagAt = placeTags(view, r, fs, { letters: letterAt, boxes: boxesX, segs: segs });
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
    o += '<g class="chart-lines" aria-hidden="true">' + view.lines.map(function (l) { return '<line class="' + lcls(l) + '" x1="' + num(l.x1) + '" y1="' + num(l.y1) + '" x2="' + num(l.x2) + '" y2="' + num(l.y2) + '"/>'; }).join('') + '</g>';
    o += '<g class="chart-chevs" aria-hidden="true">' + view.lines.map(function (l) { return chev(l.x1, l.y1, l.x2, l.y2, r * 0.7, 'chart-chev ' + lcls(l)); }).join('') + '</g>';
    var path = [st].concat((route || []).filter(function (id) { return at[id]; }).map(function (id) { return at[id]; }));
    if (path.length > 1) {
      var pts = path.map(function (p) { return num(p.x) + ',' + num(p.y); }).join(' ');
      o += '<path class="chart-route-glow" aria-hidden="true" d="M' + path.map(function (p) { return num(p.x) + ' ' + num(p.y); }).join('L') + '"/>';
      o += '<polyline class="chart-route" aria-hidden="true" points="' + pts + '"/>';
      for (var i = 1; i < path.length; i++) o += chev(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, r * 0.8, 'chart-route-dir');
    }
    o += '<g class="chart-start" role="img" aria-label="Start: the sea\'s starting point"><circle class="chart-start-ping" aria-hidden="true" cx="' + num(st.x) + '" cy="' + num(st.y) + '" r="' + num(r * 1.5) + '"/><circle class="chart-start-ring" aria-hidden="true" cx="' + num(st.x) + '" cy="' + num(st.y) + '" r="' + num(r * 1.5) + '"/><rect x="' + num(st.x - r) + '" y="' + num(st.y - r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45 ' + num(st.x) + ' ' + num(st.y) + ')"/><text x="' + num(tagAt.start.x) + '" y="' + num(tagAt.start.y) + '" text-anchor="' + tagAt.start.anchor + '" font-size="' + num(fs) + '">Start</text></g>';
    view.nodes.forEach(function (n) {
      var tags = [n.slot ? 'slot ' + n.slot : '', n.opens ? 'opens ' + n.opens : ''].filter(Boolean);
      var no = opts && opts.cannot && opts.cannot[n.id]; // G2: why this sector cannot be added to the route being planned (words from the planner)
      var mark = !!no && n.state === 'found' && !n.rankOk; // the ring and cross: only a FOUND sector above the submarine's rank; every other reason is in words (label, line, details)
      var label = n.name + ', rank ' + n.rank + ', ' + STATE[n.state] + (tags.length ? ', ' + tags.join(', ') : '') + (n.rankOk ? '' : ', above this submarine\'s rank') + (no ? ', ' + no : '');
      var da = n.rankOk ? '' : ' stroke-dasharray="4 3"'; // S3: above the submarine's rank = the node's own shape, outline dashed (a presentation attribute: the one dash rule in the stylesheet is the route's), no fill
      var shape = n.state === 'found' ? '<circle r="' + num(r) + '"' + da + '/>'
        : n.state === 'next' ? '<rect x="' + num(-r) + '" y="' + num(-r) + '" width="' + num(2 * r) + '" height="' + num(2 * r) + '" transform="rotate(45)"' + da + '/>'
        : '<rect x="' + num(-r * 0.7) + '" y="' + num(-r * 0.7) + '" width="' + num(1.4 * r) + '" height="' + num(1.4 * r) + '"' + da + '/>';
      var idx = (route || []).indexOf(n.id), onRoute = idx >= 0, isSel = sel === String(n.id), la = letterAt[n.id];
      var cd = M.po + M.ca + (n.slot ? 2 * M.pa + M.ca + 4 : 0), xa = M.ca, cq = cornerOf[n.id], ccx = cq[0] * cd, ccy = cq[1] * cd; // the cross: outside the node at its upper right unless a line is there (V4: then another corner), further out when a "+" is there too
      var xd = 'M' + num(ccx - xa) + ' ' + num(ccy - xa) + 'L' + num(ccx + xa) + ' ' + num(ccy + xa) + 'M' + num(ccx + xa) + ' ' + num(ccy - xa) + 'L' + num(ccx - xa) + ' ' + num(ccy + xa);
      var extra = '<circle class="chart-focus" aria-hidden="true" r="' + num(M.RF) + '"/>' + (n.state === 'next' ? '<circle class="chart-halo" aria-hidden="true" r="' + num(r * 1.1) + '"/>' : '') +
        (onRoute ? '<circle class="chart-routering" aria-hidden="true" r="' + num(M.R1) + '"/>' : '') +
        (mark ? '<circle class="chart-cannot-ring" aria-hidden="true" r="' + num(M.R0) + '"/>' : '') +
        (n.opens ? '<circle class="chart-ring2" aria-hidden="true" r="' + num(M.R0) + '"/>' : '') +
        (isSel ? '<path class="chart-lock" aria-hidden="true" d="' + [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (q) { var lk = Math.max(6, r * 0.7); return 'M' + num(q[0] * M.BK) + ' ' + num(q[1] * (M.BK - lk)) + 'L' + num(q[0] * M.BK) + ' ' + num(q[1] * M.BK) + 'L' + num(q[0] * (M.BK - lk)) + ' ' + num(q[1] * M.BK); }).join('') + '"/>' : '') +
        (n.slot ? (function () { var pc = M.po + M.pa, px = cq[0] * pc, py = cq[1] * pc, pd = 'M' + num(px - M.pa) + ' ' + num(py) + 'h' + num(2 * M.pa) + 'M' + num(px) + ' ' + num(py - M.pa) + 'v' + num(2 * M.pa); return '<path class="chart-plus-halo" aria-hidden="true" d="' + pd + '"/><path class="chart-plus" aria-hidden="true" d="' + pd + '"/>'; })() : '');
      o += '<g class="chart-node ' + n.state + (n.rankOk ? '' : ' over-rank') + (mark ? ' cannot' : '') + (onRoute ? ' on-route' : '') + (isSel ? ' selected' : '') + (n.slot ? ' has-slot' : '') + (n.opens ? ' opens-sea' : '') + '" data-sector="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(label) + '" transform="translate(' + num(n.x) + ' ' + num(n.y) + ')">' +
        '<circle class="hit" r="' + num(hits[n.id]) + '"/>' + extra + shape +
        (mark ? '<path class="chart-cannot-halo" aria-hidden="true" d="' + xd + '"/><path class="chart-cannot-x" aria-hidden="true" d="' + xd + '"/>' : '') +
        '<text class="chart-letter" y="' + num(la.y) + '" text-anchor="' + la.anchor + '" font-size="' + num(fs) + '"' + (la.x ? ' x="' + num(la.x) + '"' : '') + '>' + esc(n.letter) + (idx >= 0 ? ' ' + (idx + 1) : '') + '</text>' +
        (tags.length ? '<text class="chart-tag" x="' + num(tagAt[n.id].x) + '" y="' + num(tagAt[n.id].y) + '" text-anchor="' + tagAt[n.id].anchor + '" font-size="' + num(fs * 0.8) + '">' + esc(tags.join(' · ')) + '</text>' : '') + '</g>';
    });
    return o + '</svg>';
  };
})();
