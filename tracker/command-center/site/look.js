// Built by command-center/build.js: the Tracker's appearance (the Atelier's module, as tools/build.js uses it), read
// from the Tracker's saved choice ('eveniunt-tracker-ui') so every page of the Command Center has the same theme.
(function () {
  'use strict';
  var PREF_KEY = 'eveniunt-tracker-ui';
  function load() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch (e) { return null; } }
  var S = { theme: (load() || {}).theme || 'system', look: null };
  function persist() { /* only the Tracker's Settings change the look */ }
  function esc(s) { return String(s); }
  // ── appearance (laid out like ChatGPT's Appearance settings) ──
  // Mode: System / Light / Dark. Theme: the 20 FFXIV themes. Accent, Background and Foreground can be overridden (HEX or RGB).
  // Advanced: UI and code font size, reduce motion, separate light and dark modes, contrast.
  // The 20 FFXIV-inspired themes (owner choice, 2026-11-06). Each: light and dark [background, foreground, accent, progress].
  var THEMES = [
    ['crystarium-dawnglass', "Crystarium Dawnglass", ['#d9e8f5', '#0d2133', '#b5476b', '#2f6fae'], ['#0f2234', '#e0eefb', '#ffadc4', '#9ad4ff']],
    ['ishgard-hoarfrost', "Ishgard Hoarfrost", ['#dbe2e9', '#1b2128', '#3d6c96', '#8a6a1f'], ['#1e2836', '#e6edf3', '#a9d3f5', '#e4c27a']],
    ['limsa-brineward', "Limsa Brineward", ['#d8e0ec', '#0f1b2b', '#c8202c', '#9a6c12'], ['#0f1b2b', '#e3ebf5', '#ff4b4b', '#e3b04b']],
    ['uldah-sultanate-gilt', "Ul'dah Sultanate Gilt", ['#efe0b0', '#2a1f07', '#8f2236', '#7a5a00'], ['#271c06', '#f7ecd2', '#ff6b82', '#ffc53d']],
    ['twelveswood-verdure', "Twelveswood Verdure", ['#dfeacd', '#16220f', '#3f7d18', '#8a5a00'], ['#16220f', '#e4efd8', '#a6d65a', '#e8b84a']],
    ['allagan-circuitry', "Allagan Circuitry", ['#dde3e2', '#121818', '#a35f00', '#0f7f8c'], ['#132020', '#dfe9e7', '#ffad2e', '#46d9ea']],
    ['magitek-steel', "Magitek Steel", ['#dcdfe2', '#16191c', '#0a7cc2', '#7a1f1f'], ['#14171a', '#e6e9ec', '#3fc6ff', '#ff6b5b']],
    ['umbral-astral', "Umbral Ice, Astral Fire", ['#e4dcf0', '#170d26', '#c2410c', '#1f6fb2'], ['#170d26', '#efe8fa', '#ff6a3d', '#7fd4ff']],
    ['lily-of-thaliak', "Lily of the Healer", ['#ece2e4', '#231a1c', '#2a7f50', '#c8283c'], ['#221a1d', '#f3eaec', '#9fe3b8', '#ff8a9a']],
    ['azure-dragoon', "Azure Dragoon", ['#cfdcf7', '#0a1840', '#1846c8', '#56657f'], ['#0e2257', '#e4ecfb', '#6ea2ff', '#d0dbee']],
    ['abyssal-oath', "Abyssal Oath", ['#efd8de', '#2a0b14', '#a8102c', '#5b3db0'], ['#1f0a10', '#f2e0e5', '#ff3452', '#a98bff']],
    ['moonfire-faire', "Moonfire Faire", ['#f3d6ef', '#2a0d2a', '#b8128f', '#0b8a80'], ['#2a0d2a', '#fbe6f8', '#ff4fd8', '#3cf0d0']],
    ['starlight-celebration', "Starlight Celebration", ['#e3eef0', '#0c2116', '#c21f35', '#1d7a43'], ['#0c2116', '#e8f5ee', '#ffd166', '#ff4d5e']],
    ['aetheryte-glow', "Aetheryte Glow", ['#d2eff0', '#06292c', '#007c8a', '#9a6b00'], ['#052628', '#d6f7f5', '#2ff0e0', '#ffd166']],
    ['first-world-twilight', "First World Twilight", ['#e3ddf6', '#1d1838', '#5a45c4', '#a07a00'], ['#251b48', '#ece7ff', '#ffe08a', '#b9a8ff']],
    ['ascian-crimson', "Ascian Crimson", ['#e2dfdf', '#111111', '#c0080f', '#4d4d4d'], ['#1a1213', '#efebeb', '#ff2424', '#bdbdbd']],
    ['sharlayan-lore', "Sharlayan Lore", ['#dfe1ea', '#181a26', '#7f5d0a', '#2d4f9e'], ['#181a26', '#e6e8f2', '#e2bd52', '#86b8ea']],
    ['radz-at-han-jewel', "Radz-at-Han Jewel", ['#f6dcd6', '#2d0f1f', '#0a7a76', '#8f5600'], ['#3a1624', '#fbe7f0', '#3fe0d6', '#ffc23d']],
    ['doman-sakura', "Doman Sakura", ['#f8dbe8', '#2b1424', '#c02d6c', '#3a4aa8'], ['#2b1626', '#f8e6ef', '#ff9cc6', '#8ea2ff']],
    ['ultima-thule', "Ultima Thule", ['#dcdcef', '#0b0a1f', '#5a35d6', '#007f99'], ['#100c26', '#e9e8ff', '#b07cff', '#4fe3ff']],
    ['electrope-skyline', "Electrope Skyline", ['#e3ebf7', '#0a1230', '#0a6c94', '#c2187a'], ['#070a20', '#e6f4ff', '#38dcff', '#ff4fb8']]
  ];
  var ACCENTS = [['default', 'Default'], ['blue', 'Blue', '#0a6cff', '#4aa3ff'], ['green', 'Green', '#13864d', '#43c97f'], ['yellow', 'Yellow', '#a77b00', '#f2c94c'],
    ['pink', 'Pink', '#c8286f', '#ff6fae'], ['orange', 'Orange', '#c9531a', '#ff8a4c'], ['purple', 'Purple', '#7b4bd6', '#b18cff'], ['neutral', 'Black / White', '#111417', '#f0f0f0'], ['custom', 'Custom']];
  function blankSide() { return { theme: 'crystarium-dawnglass', accent: 'default', accentHex: null, bg: null, fg: null }; }
  function defaultLook() { return { separate: false, shared: blankSide(), light: blankSide(), dark: blankSide(), uiFont: 15, codeFont: 12.5, motion: 'system', contrast: 50 }; }
  S.look = (function (d) { var l = defaultLook(); if (d && d.look) { Object.assign(l, d.look); ['shared', 'light', 'dark'].forEach(function (k) { l[k] = Object.assign(blankSide(), d.look[k] || {}); if (!THEMES.some(function (x) { return x[0] === l[k].theme; })) l[k].theme = 'crystarium-dawnglass'; }); } return l; })(load());
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { return S.theme === 'dark' || (S.theme !== 'light' && darkMq.matches); }
  function hexRgb(h) { h = String(h || '').trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return !/^[0-9a-f]{6}$/i.test(h) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(r) { return '#' + r.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
  function lum(r) { var c = r.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function mix(a, b, t) { return rgbHex(a.map(function (x, i) { return x + (b[i] - x) * t; })); }
  function sideFor(mode) { return S.look.separate ? S.look[mode] : S.look.shared; }
  function themeOf(id) { return THEMES.find(function (x) { return x[0] === id; }) || THEMES[0]; }
  // The colours a side resolves to in a mode: [bg, fg, accent, progress].
  function resolved(side, mode) {
    var th = themeOf(side.theme)[mode === 'dark' ? 3 : 2];
    var acc = side.accent === 'custom' ? (side.accentHex || th[2]) : side.accent === 'default' ? th[2] : (ACCENTS.find(function (a) { return a[0] === side.accent; }) || [])[mode === 'dark' ? 3 : 2] || th[2];
    return [side.bg || th[0], side.fg || th[1], acc, th[3]];
  }
  function applyLook() {
    var mode = isDark() ? 'dark' : 'light', root = document.documentElement, st = root.style, L = S.look;
    var c = resolved(sideFor(mode), mode), bg = hexRgb(c[0]), fg = hexRgb(c[1]), ac = hexRgb(c[2]), pg = hexRgb(c[3]);
    var k = 0.55 + (L.contrast / 100) * 0.9; // contrast 0..100 -> 0.55..1.45 (50 = designed)
    var dk = lum(bg) < lum(fg);
    root.setAttribute('data-theme', dk ? 'dark' : 'light');
    var set = function (n, v) { st.setProperty(n, v); };
    set('--paper', rgbHex(bg)); set('--paper-2', mix(bg, fg, 0.05 * k)); set('--paper-3', mix(bg, fg, 0.1 * k)); set('--slip', mix(bg, dk ? fg : [255, 255, 255], dk ? 0.07 : 0.6));
    set('--ink', rgbHex(fg)); set('--ink-2', mix(fg, bg, Math.max(0.08, 0.32 / k))); set('--ink-3', mix(fg, bg, Math.max(0.2, 0.5 / Math.sqrt(k)))); set('--rule', mix(bg, fg, Math.min(0.5, 0.18 * k)));
    set('--grid', 'rgba(' + fg.join(',') + ',' + (0.055 * k).toFixed(3) + ')');
    set('--seal', rgbHex(ac)); set('--on-seal', lum(ac) > 0.42 ? '#111111' : '#ffffff'); set('--hi', 'rgba(' + ac.join(',') + ',.16)');
    set('--ochre', rgbHex(pg)); set('color-scheme', dk ? 'dark' : 'light');
    // Limit Break wordmark: a molten ramp from a bright tint of the accent, through the accent, into the progress colour
    set('--lb-a', dk ? mix(ac, [255, 255, 255], 0.55) : mix(ac, fg, 0.25)); set('--lb-b', rgbHex(ac)); set('--lb-c', rgbHex(pg));
    set('--lb-glow', 'rgba(' + ac.join(',') + ',' + (dk ? '.5' : '.28') + ')');
    set('--code-size', L.codeFont + 'px');
    document.body.style.zoom = L.uiFont === 15 ? '' : String(L.uiFont / 15);
    if (L.motion === 'system') root.removeAttribute('data-motion'); else root.setAttribute('data-motion', L.motion);
  }
  function applyColors() { applyLook(); }
  if (darkMq.addEventListener) darkMq.addEventListener('change', applyLook);
  function chip(th, mode) { var c = th[mode === 'dark' ? 3 : 2]; return '<span class="aa" style="background:' + c[0] + ';color:' + c[2] + ';box-shadow:inset 0 0 0 1px ' + c[1] + '33">Aa</span>'; }
  function swatchDot(hex) { return '<span class="dot" style="background:' + hex + '"></span>'; }
  function themeBlock(sideKey, mode) {
    var side = S.look[sideKey], c = resolved(side, mode), th = themeOf(side.theme), open = lookUi.open;
    var id = function (x) { return sideKey + ':' + x; };
    var h = '<div class="look-card">' + (S.look.separate ? '<div class="look-sub">' + (mode === 'dark' ? 'Dark mode' : 'Light mode') + '</div>' : '');
    h += '<div class="look-row"><b>Theme</b><span class="look-ctl"><button type="button" class="icon-btn" data-look="export" data-side="' + sideKey + '" title="Download theme" aria-label="Download theme">⤓</button>' +
      '<button type="button" class="icon-btn" data-look="copy" data-side="' + sideKey + '" title="Copy theme" aria-label="Copy theme">⧉</button>' +
      '<button type="button" class="icon-btn" data-look="import" data-side="' + sideKey + '" title="Paste a theme" aria-label="Paste a theme">⇩</button>' +
      '<button type="button" class="pill" data-look="toggle" data-v="' + id('theme') + '" aria-expanded="' + (open === id('theme')) + '">' + chip(th, mode) + esc(th[1]) + ' <span class="chev">⌄</span></button></span></div>';
    if (open === id('theme')) {
      h += '<div class="menu" role="listbox">' + '<div class="menu-h" style="border-top:0;margin-top:0">FFXIV themes</div>' + THEMES.slice().sort(function (x, y) { return x[1].localeCompare(y[1], 'en', { sensitivity: 'base' }); }).map(function (x) { return themeOpt(x, side, mode, sideKey); }).join('') + '</div>';
    }
    if (open === id('import')) h += '<div class="look-edit"><textarea class="inp" rows="4" data-import="' + sideKey + '" placeholder="Paste a theme copied from the Atelier"></textarea><button type="button" class="btn sm" data-look="import-go" data-side="' + sideKey + '">Load theme</button></div>';
    var acName = (ACCENTS.find(function (a) { return a[0] === side.accent; }) || ACCENTS[0])[1];
    h += '<div class="look-row"><b>Accent</b><span class="look-ctl"><button type="button" class="pill" data-look="toggle" data-v="' + id('accent') + '">' + swatchDot(c[2]) + esc(acName) + ' <span class="chev">⌄</span></button></span></div>';
    if (open === id('accent')) {
      h += '<div class="menu">' + ACCENTS.map(function (a) {
        var hex = a[0] === 'default' ? themeOf(side.theme)[mode === 'dark' ? 3 : 2][2] : a[0] === 'custom' ? (side.accentHex || c[2]) : a[mode === 'dark' ? 3 : 2];
        return '<button type="button" class="opt' + (side.accent === a[0] ? ' on' : '') + '" data-look="accent" data-side="' + sideKey + '" data-v="' + a[0] + '">' + swatchDot(hex) + esc(a[1]) + (side.accent === a[0] ? '<span class="tick">✓</span>' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (side.accent === 'custom' || open === id('accent-edit')) h += picker(sideKey, 'accentHex', c[2]);
    ['bg', 'fg'].forEach(function (key, i) {
      h += '<div class="look-row"><b>' + (key === 'bg' ? 'Background' : 'Foreground') + '</b><span class="look-ctl">' + (side[key] ? '<button type="button" class="btn sm ghost" data-look="clear" data-side="' + sideKey + '" data-v="' + key + '">Theme default</button>' : '') +
        '<button type="button" class="pill mono-pill" data-look="toggle" data-v="' + id(key) + '">' + swatchDot(c[i]) + c[i].toUpperCase() + '</button></span></div>';
      if (open === id(key)) h += picker(sideKey, key, c[i]);
    });
    return h + '</div>';
  }
  function themeOpt(x, side, mode, sideKey) {
    return '<button type="button" class="opt' + (side.theme === x[0] ? ' on' : '') + '" role="option" data-look="theme" data-side="' + sideKey + '" data-v="' + x[0] + '">' + chip(x, mode) + esc(x[1]) + (side.theme === x[0] ? '<span class="tick">✓</span>' : '') + '</button>';
  }
  function picker(sideKey, key, hex) {
    var r = hexRgb(hex) || [0, 0, 0];
    return '<div class="picker" data-side="' + sideKey + '" data-pick="' + key + '"><input type="color" value="' + hex + '" aria-label="' + key + ' colour">' +
      '<span class="codes"><span>HEX</span><input class="inp hx" value="' + hex.toUpperCase() + '" maxlength="7" aria-label="HEX"><span>R</span><input class="inp c" type="number" min="0" max="255" data-ch="0" value="' + r[0] + '">' +
      '<span>G</span><input class="inp c" type="number" min="0" max="255" data-ch="1" value="' + r[1] + '"><span>B</span><input class="inp c" type="number" min="0" max="255" data-ch="2" value="' + r[2] + '"></span></div>';
  }
  var lookUi = { open: null };
  function appearanceHtml() {
    var L = S.look, cur = isDark() ? 'dark' : 'light';
    var tile = function (v, label) {
      var sides = v === 'system' ? ['light', 'dark'] : [v];
      return '<button type="button" class="mode-tile' + (S.theme === v ? ' on' : '') + '" data-look="mode" data-v="' + v + '" aria-pressed="' + (S.theme === v) + '" aria-label="' + label + '"><span class="prev">' + sides.map(function (m) {
        var c = resolved(sideFor(m), m);
        return '<span class="half" style="background:' + c[0] + '"><i style="background:' + c[1] + '"></i><i style="background:' + c[1] + ';width:46%"></i><i style="background:' + c[2] + ';width:62%;margin-left:auto"></i><i style="background:' + c[2] + ';width:40%;margin-left:auto"></i></span>';
      }).join('') + '</span><span class="cap">' + label + '</span></button>';
    };
    var h = '<h4 class="look-h">Visual style</h4><div class="look-card"><div class="look-row"><b>Mode</b><span class="look-ctl tiles">' + tile('system', 'System') + tile('light', 'Light') + tile('dark', 'Dark') + '</span></div></div>';
    h += L.separate ? themeBlock('light', 'light') + themeBlock('dark', 'dark') : themeBlock('shared', cur);
    var seg = function (key, opts) { return '<span class="seg2">' + opts.map(function (o) { return '<button type="button" class="' + (String(L[key]) === String(o[0]) ? 'on' : '') + '" data-look="set" data-k="' + key + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</span>'; };
    h += '<details class="look-adv"' + (lookUi.adv ? ' open' : '') + '><summary>Advanced</summary>' +
      '<div class="look-card"><div class="look-row"><span><b>UI font size</b><small>Adjust the base size used for the Atelier</small></span><span class="look-ctl"><input class="inp num" type="number" min="11" max="22" step="0.5" data-lookn="uiFont" value="' + L.uiFont + '"> px</span></div>' +
      '<div class="look-row"><span><b>Code font size</b><small>Adjust the size used for macro text</small></span><span class="look-ctl"><input class="inp num" type="number" min="9" max="20" step="0.5" data-lookn="codeFont" value="' + L.codeFont + '"> px</span></div></div>' +
      '<div class="look-card"><div class="look-row"><span><b>Reduce motion</b><small>Reduce animations or match your system</small></span><span class="look-ctl">' + seg('motion', [['system', 'System'], ['on', 'On'], ['off', 'Off']]) + '</span></div>' +
      '<div class="look-row"><span><b>Separate light and dark modes</b><small>Choose a theme and colors for each</small></span><span class="look-ctl"><label class="switch"><input type="checkbox" data-look="separate"' + (L.separate ? ' checked' : '') + '><i></i></label></span></div></div>' +
      '<div class="look-card"><div class="look-row"><b>Contrast</b><span class="look-ctl"><input type="range" min="0" max="100" data-lookn="contrast" value="' + L.contrast + '"><span class="cv">' + L.contrast + '</span></span></div></div>' +
      '<div class="row"><button type="button" class="btn sm ghost" data-look="reset">Reset appearance</button></div></details>';
    return h;
  }
  function bindAppearance(d) {
    var box = $('#s-appearance', d);
    var redraw = function () { box.innerHTML = appearanceHtml(); };
    var commit = function () { applyLook(); persist(); redraw(); };
    box.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('look-adv')) lookUi.adv = e.target.open; }, true);
    box.onclick = function (e) {
      var b = e.target.closest('[data-look]'); if (!b || b.tagName === 'INPUT') return;
      var a = b.dataset.look, side = b.dataset.side && S.look[b.dataset.side];
      if (a === 'mode') { S.theme = b.dataset.v; commit(); }
      else if (a === 'toggle') { lookUi.open = lookUi.open === b.dataset.v ? null : b.dataset.v; redraw(); }
      else if (a === 'theme') { side.theme = b.dataset.v; side.bg = side.fg = null; if (side.accent === 'custom') side.accentHex = null; lookUi.open = null; commit(); }
      else if (a === 'accent') { side.accent = b.dataset.v; lookUi.open = b.dataset.v === 'custom' ? null : null; commit(); }
      else if (a === 'clear') { side[b.dataset.v] = null; commit(); }
      else if (a === 'set') { S.look[b.dataset.k] = b.dataset.v; commit(); }
      else if (a === 'reset') { S.look = defaultLook(); S.theme = 'system'; lookUi.open = null; commit(); }
      else if (a === 'export' || a === 'copy') {
        var mode = b.dataset.side === 'dark' || (b.dataset.side === 'shared' && isDark()) ? 'dark' : 'light';
        var c = resolved(side, mode), json = JSON.stringify({ atelierTheme: 1, base: side.theme, accent: c[2], background: c[0], foreground: c[1] }, null, 2);
        if (a === 'copy') copyText(json, null);
        else { var u = URL.createObjectURL(new Blob([json], { type: 'application/json' })), el = document.createElement('a'); el.href = u; el.download = 'atelier-theme-' + side.theme + '.json'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); toast('Theme downloaded'); }
      }
      else if (a === 'import') { lookUi.open = lookUi.open === b.dataset.side + ':import' ? null : b.dataset.side + ':import'; redraw(); }
      else if (a === 'import-go') {
        try {
          var o = JSON.parse($('[data-import="' + b.dataset.side + '"]', d).value);
          if (o.base && themeOf(o.base)[0] === o.base) side.theme = o.base;
          if (hexRgb(o.background)) side.bg = rgbHex(hexRgb(o.background)); if (hexRgb(o.foreground)) side.fg = rgbHex(hexRgb(o.foreground));
          if (hexRgb(o.accent)) { side.accent = 'custom'; side.accentHex = rgbHex(hexRgb(o.accent)); }
          lookUi.open = null; commit(); toast('Theme loaded');
        } catch (err) { toast('That is not an Atelier theme'); }
      }
    };
    box.onchange = function (e) {
      if (e.target.dataset.look === 'separate') {
        S.look.separate = e.target.checked;
        if (S.look.separate) { S.look.light = Object.assign({}, S.look.shared); S.look.dark = Object.assign({}, S.look.shared); }
        lookUi.adv = true; commit();
      } else if (e.target.dataset.lookn) {
        var n = e.target.dataset.lookn, lim = { uiFont: [11, 22, 15], codeFont: [9, 20, 12.5], contrast: [0, 100, 50] }[n];
        var v = +e.target.value; S.look[n] = isNaN(v) ? lim[2] : Math.max(lim[0], Math.min(lim[1], v)); lookUi.adv = true; commit();
      }
    };
    box.oninput = function (e) {
      if (e.target.dataset.lookn === 'contrast') { S.look.contrast = +e.target.value; var cv = e.target.parentNode.querySelector('.cv'); if (cv) cv.textContent = e.target.value; applyLook(); return; }
      var pk = e.target.closest('[data-pick]'); if (!pk) return;
      var side = S.look[pk.dataset.side], key = pk.dataset.pick, v = null, curHex = pk.querySelector('.hx').value;
      if (e.target.type === 'color') v = e.target.value;
      else if (e.target.classList.contains('hx')) { var r = hexRgb(e.target.value); if (r) v = rgbHex(r); }
      else if (e.target.dataset.ch != null) { var cur = hexRgb(curHex) || [0, 0, 0]; cur[+e.target.dataset.ch] = clampInt(e.target.value, 0, 255, 0); v = rgbHex(cur); }
      if (!v) return;
      side[key] = v; if (key === 'accentHex') side.accent = 'custom';
      applyLook(); persist();
      var rgb = hexRgb(v);
      pk.querySelectorAll('input').forEach(function (inp) {
        if (inp === e.target) return;
        if (inp.type === 'color') inp.value = v; else if (inp.classList.contains('hx')) inp.value = v.toUpperCase(); else if (inp.dataset.ch != null) inp.value = rgb[+inp.dataset.ch];
      });
      var pill = box.querySelector('[data-v="' + pk.dataset.side + ':' + (key === 'accentHex' ? 'accent' : key) + '"]');
      if (pill) { var dot = pill.querySelector('.dot'); if (dot) dot.style.background = v; if (key !== 'accentHex') pill.lastChild.textContent = v.toUpperCase(); }
    };
  }

  applyLook();
  window.addEventListener('storage', function (e) { if (e.key === PREF_KEY) { var d = load() || {}; S.theme = d.theme || 'system'; if (d.look) S.look = Object.assign(S.look, d.look); applyLook(); } });
  window.EVENIUNT_LOOK = { apply: function () { var d = load() || {}; S.theme = d.theme || 'system'; applyLook(); } };
})();
