// Eveniunt Command Center, Submersibles: the vivid palette (docs/submersibles-look-spec.md, "W22b decisions").
// One plain script, loaded by the page and by the unit tests (no second model). PALETTE.compute(theme) is pure: from the
// theme's own colours it returns every palette token as a hex string. PALETTE.apply() reads those colours from the root
// element's computed style and sets the tokens as inline custom properties on the module's page element; it runs again
// whenever the look changes (look.js sets the root's style and data-theme on every applyLook(), so those two attributes are
// observed). Nothing is stored. subs.css keeps plain fallback tokens that apply until this script has run (or if it cannot).
// Revision 4 (spec Rev4.5): the four voices (rank, gil, loot, route) have one fixed hue each in every theme (P.ROLE_HUE); the theme reaches them through
// lightness and chroma only. The tones, their contrast rules and the lists in docs/submersibles-colour-roles.md are produced from this one model.
// Colour arithmetic: OKLab with the matrices CSS Color 4 uses. Deterministic: bisection only, no random numbers, no time.
(function () {
  'use strict';
  var P = (globalThis.PALETTE = globalThis.PALETTE || {});

  // ---- the named constants of the decisions ----
  P.CAP = 0.21;             // decision 1: the most chroma any palette colour gets
  P.EDGE = 0.94;            // decision 1: the share of the largest chroma inside sRGB at that hue and lightness
  P.FIELD_L = 0.70;         // decision 2: lightness of a field (-m) in a light theme
  P.FIELD_L_DARK = 0.74;    // decision 2: lightness of a field in a dark theme (against the page it is 7:1 or better, so it glows)
  P.GRAPHIC = 3.1;          // decision 2: -g clears this against the worst of slip, paper, paper-2
  P.STRONG = 4.6;           // decision 2: -s (and a status text tone) clears this
  P.WASH_INK = 7.2;         // decision 2: ink on -w (the test asks 7)
  P.WASH_L = 0.90;          // lightness a wash aims for under dark ink (it is lowered, never raised, until ink reaches WASH_INK)
  P.WASH_L_DARK = 0.30;     // the same under light ink
  P.WASH_CHROMA = 1 / 3;    // a wash is a quiet tint under text, not a field: its chroma is at most this share of its field's (every -w tone)
  P.ON_MID = 4.6;           // decision 2: --on-mid on every field
  // Revision 4 (W33, Rev4.5): the deep-water tokens of an empty state's scope
  P.DEEP_MIN = 0.12; P.DEEP_MAX = 0.22; P.DEEP_CHROMA = 0.05; // --deep: lightness of the darker of ink and paper less 0.04, held between these, chroma at most this
  P.DEEP2_L = 0.34; P.DEEP2_CHROMA = 0.09; P.DEEP_ON = 7;      // --deep-2: this lightness (lowered by 0.01 until --on-deep reaches 7:1), chroma at most this
  // W36: in a dark theme the darker of ink and paper is the page itself, so the formula above put the panel on the page's own navy. There the panel is lit instead: both ends lighter than the page
  P.DEEP_LIT_MIN = 0.31; P.DEEP_LIT_MAX = 0.35; P.DEEP_LIT_STEP = 0.10; P.DEEP2_LIT = 0.44; // --deep: the page's lightness plus the step, held between these; --deep-2: this, lowered 0.01 at a time until --on-deep reaches 7:1
  // Revision 4 (spec Rev4.5, D38 to D40): the four meaning roles that used to follow the theme's accent have one fixed hue each, in every theme.
  P.ROLE_HUE = { rank: 232, gil: 92, loot: 188, route: 340 }; // azure, gold, teal, pink
  // W31 gold correction (spec Rev4.5): gold is a yellow at high lightness. The gil field has its own, higher lightness at hue 92 (light, dark); its two darker
  // tones (-g, -s) move to the bronze-gold hue 84 so that they do not turn olive; the wash keeps the field's hue.
  P.GIL_FIELD_L = [0.80, 0.84];
  P.GIL_TONE_HUE = [84, 92]; // light, dark: in a dark theme Idle sits at hue 78, so a tone at 84 would be 6 degrees from it (floor 12): there the tones keep the field's hue 92
  P.SEA_HUES = [250, 50, 165, 0, 315, 282, 215]; // sea 1 to 7 (blue, ember, jade, rose, lilac, indigo, ice), as in spec R3.4
  P.VOICES = ['rank', 'gil', 'loot', 'route'];
  P.STATUS = ['back', 'out', 'idle', 'bad'];

  // ---- colour arithmetic ----
  function hexRgb(h) {
    h = String(h).trim();
    var m = /^#([0-9a-f]{3})$/i.exec(h);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    m = /^#([0-9a-f]{6})$/i.exec(h);
    if (m) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(h);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function asRgb(v) { return Array.isArray(v) ? v : hexRgb(v); }
  function rnd(r) { return r.map(function (x) { return Math.max(0, Math.min(255, Math.round(x))); }); }
  function toHex(r) { return '#' + rnd(r).map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function lum(r) {
    var c = r.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // a contrast is measured on the painted bytes
  function ratio(a, b) { var x = lum(rnd(a)), y = lum(rnd(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function toLin(v) { v /= 255; var s = v < 0 ? -1 : 1; v = Math.abs(v); return s * (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); }
  function fromLin(v) { var s = v < 0 ? -1 : 1; v = Math.abs(v); return 255 * s * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }
  function rgbToLab(rgb) {
    var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function linOf(L, a, b) {
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function labToRgb(L, a, b) { return linOf(L, a, b).map(fromLin); }
  function rgbToLch(rgb) { var k = rgbToLab(rgb), h = Math.atan2(k[2], k[1]) * 180 / Math.PI; if (h < 0) h += 360; return [k[0], Math.hypot(k[1], k[2]), h]; }
  function lchToRgb(L, C, H) { return labToRgb(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)); }
  function hueGap(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function inGamut(L, C, H) {
    var a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180), v = linOf(L, a, b);
    return v[0] >= -0.0005 && v[0] <= 1.0005 && v[1] >= -0.0005 && v[1] <= 1.0005 && v[2] >= -0.0005 && v[2] <= 1.0005;
  }
  // the largest chroma inside sRGB at this lightness and hue (bisection)
  function maxChroma(L, H) {
    if (L <= 0.001 || L >= 0.999) return 0;
    var lo = 0, hi = 0.4, i;
    for (i = 0; i < 18; i++) { var mid = (lo + hi) / 2; if (inGamut(L, mid, H)) lo = mid; else hi = mid; }
    return lo;
  }
  // decision 1
  function chromaAt(L, H) { return Math.min(P.CAP, P.EDGE * maxChroma(L, H)); }
  function colourAt(L, H, C) { return lchToRgb(L, C == null ? chromaAt(L, H) : Math.min(C, maxChroma(L, H) * 0.999), H); }

  // The lightness at which a colour of this hue "just clears" a ratio against every background in bgs: the lightest one that
  // does against light backgrounds, the darkest one against dark ones. Chroma follows the gamut at each step (or stays at c0).
  function fit(H, bgs, target, c0) {
    var mean = bgs.reduce(function (s, b) { return s + lum(b); }, 0) / bgs.length, lightBg = mean > 0.18;
    function ok(L) { var c = rnd(colourAt(L, H, c0)); return bgs.every(function (b) { return ratio(c, b) >= target; }); }
    var lo = 0.01, hi = 0.99, i, L;
    for (i = 0; i < 20; i++) { var mid = (lo + hi) / 2; if (ok(mid)) { if (lightBg) lo = mid; else hi = mid; } else if (lightBg) hi = mid; else lo = mid; }
    // lightBg: ok is true below the threshold, so lo is the largest L that clears. Dark: ok is true above it, so hi is the smallest.
    L = lightBg ? lo : hi;
    for (i = 0; i < 120 && !ok(L); i++) L += lightBg ? -0.002 : 0.002;
    return L;
  }

  // theme: { paper, paper2, slip, ink, ink2, seal, ochre, back, out, idle, bad } as [r,g,b] or '#hex'. Returns { tokens, info }.
  P.compute = function (theme) {
    var T = {}, k;
    for (k in theme) T[k] = asRgb(theme[k]);
    var pages = [T.slip, T.paper, T.paper2], tokens = {}, info = {};
    var dark = lum(T.paper) < lum(T.ink);
    var fieldL = dark ? P.FIELD_L_DARK : P.FIELD_L;
    var inkIsDark = lum(T.ink) <= 0.18;
    info.dark = dark; info.fieldL = fieldL;

    // hues: the four voices keep their fixed hue; the theme reaches them through lightness and chroma only (the accent and the progress colour are ignored)
    var hues = P.VOICES.map(function (v) { return P.ROLE_HUE[v]; }), sh = P.STATUS.map(function (s) { return rgbToLch(T[s])[2]; }), i, j;
    info.statusHues = sh; info.hues = hues;
    var ms = 360; hues.forEach(function (h) { sh.forEach(function (s) { ms = Math.min(ms, hueGap(h, s)); }); });
    info.minStatus = ms;
    var mg = 360; for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) mg = Math.min(mg, hueGap(hues[i], hues[j]));
    info.minVoiceGap = mg;
    var mn = 360; for (i = 0; i < 7; i++) for (j = i + 1; j < 7; j++) mn = Math.min(mn, hueGap(P.SEA_HUES[i], P.SEA_HUES[j]));
    info.minSea = mn;

    var mids = [];
    function family(name, H, fL, TH) {
      fL = fL || fieldL; TH = TH == null ? H : TH; // fL: the field's lightness; TH: the hue of the darker tones (graphic, text)
      var m = colourAt(fL, H);
      mids.push(m);
      tokens[name.m] = toHex(m);
      tokens[name.g] = toHex(colourAt(fit(TH, pages, P.GRAPHIC), TH));
      tokens[name.s] = toHex(colourAt(fit(TH, pages, P.STRONG), TH));
      var wc = P.WASH_CHROMA * chromaAt(fL, H), wl = fit(H, [T.ink], P.WASH_INK, wc);
      tokens[name.w] = toHex(colourAt(inkIsDark ? Math.max(P.WASH_L, wl) : Math.min(P.WASH_L_DARK, wl), H, wc));
    }
    P.VOICES.forEach(function (v, i) { family({ m: '--' + v + '-m', g: '--' + v + '-g', s: '--' + v + '-s', w: '--' + v + '-w' }, hues[i], v === 'gil' ? P.GIL_FIELD_L[dark ? 1 : 0] : null, v === 'gil' ? P.GIL_TONE_HUE[dark ? 1 : 0] : null); });
    P.SEA_HUES.forEach(function (h, i) { var n = i + 1; family({ m: '--sea-' + n, g: '--sea-' + n + '-g', s: '--sea-' + n + '-s', w: '--sea-' + n + '-w' }, h); });

    // the text on a field: the theme's ink, its page colour, black or white; the first that reaches ON_MID on every field
    var cands = [T.ink, T.paper, [0, 0, 0], [255, 255, 255]], on = null;
    for (i = 0; i < cands.length && !on; i++) if (mids.every(function (m) { return ratio(cands[i], m) >= P.ON_MID; })) on = cands[i];
    tokens['--on-mid'] = toHex(on || [0, 0, 0]);
    info.onMid = on ? (i - 1 === 0 ? 'ink' : i - 1 === 1 ? 'paper' : i - 1 === 2 ? 'black' : 'white') : 'none';

    // decision 5: a text tone for each status colour, the status colour itself when it already clears
    P.STATUS.forEach(function (s) {
      var c = T[s], ok = pages.every(function (b) { return ratio(c, b) >= P.STRONG; });
      if (ok) tokens['--' + s + '-s'] = toHex(c);
      else { var l = rgbToLch(c); tokens['--' + s + '-s'] = toHex(colourAt(fit(l[2], pages, P.STRONG, l[1]), l[2], l[1])); }
    });
    // Revision 4 (W33, spec Rev4.5): deep water, the dark panel of an empty state. D is the darker of ink and paper, h its hue (the accent's when D is nearly neutral).
    // (W36: in a dark theme D is the page, so the panel is lit: --deep is the page's lightness plus 0.10 held between 0.31 and 0.35 and --deep-2 starts at 0.44, so both ends stand clear of the page)
    // --deep: D's lightness less 0.04, held between 0.12 and 0.22, chroma at most 0.05; --deep-2: lightness 0.34, chroma at most 0.09, lowered 0.01 at a time until
    // --on-deep (the lighter of ink and paper) reaches 7:1 on it; --deep-line: --on-deep 45% into --deep-2, in OKLab.
    var darkC = lum(T.ink) <= lum(T.paper) ? T.ink : T.paper, lightC = darkC === T.ink ? T.paper : T.ink, dl = rgbToLch(darkC), dh = dl[1] < 0.02 ? rgbToLch(T.seal)[2] : dl[2];
    var lit = darkC === T.paper, deepL = lit ? Math.max(P.DEEP_LIT_MIN, Math.min(P.DEEP_LIT_MAX, dl[0] + P.DEEP_LIT_STEP)) : Math.max(P.DEEP_MIN, Math.min(P.DEEP_MAX, dl[0] - 0.04)), d2L = lit ? P.DEEP2_LIT : P.DEEP2_L, d2;
    var deep = colourAt(deepL, dh, P.DEEP_CHROMA);
    for (i = 0; i < 40; i++) { d2 = colourAt(d2L, dh, P.DEEP2_CHROMA); if (ratio(lightC, d2) >= P.DEEP_ON || d2L <= 0.05) break; d2L -= 0.01; }
    var la = rgbToLab(rnd(lightC)), lb = rgbToLab(rnd(d2)), ln = [0, 1, 2].map(function (q) { return la[q] * 0.45 + lb[q] * 0.55; });
    tokens['--deep'] = toHex(deep); tokens['--deep-2'] = toHex(d2); tokens['--on-deep'] = toHex(lightC); tokens['--deep-line'] = toHex(labToRgb(ln[0], ln[1], ln[2]));
    return { tokens: tokens, info: info };
  };

  // ---- the page: read the theme from the root's computed style, set the tokens, follow the look ----
  var NAMES = { paper: '--paper', paper2: '--paper-2', slip: '--slip', ink: '--ink', ink2: '--ink-2', seal: '--seal', ochre: '--ochre', back: '--back', out: '--out', idle: '--idle', bad: '--bad' };
  var lastSig = '', lastTokens = [];
  P.read = function () {
    var cs = getComputedStyle(document.documentElement), t = {};
    for (var k in NAMES) { var v = hexRgb(cs.getPropertyValue(NAMES[k])); if (!v) return null; t[k] = v; }
    return t;
  };
  P.apply = function () {
    var t = P.read(); if (!t) return false;
    var sig = JSON.stringify(t); if (sig === lastSig) return false;
    var t0 = Date.now(), el = document.querySelector('.subs-page') || document.body, r = P.compute(t), n;
    for (n in r.tokens) el.style.setProperty(n, r.tokens[n]);
    lastSig = sig; P.lastInfo = r.info; P.lastMs = Date.now() - t0;
    return true;
  };
  if (typeof document !== 'undefined' && document.documentElement) {
    var go = function () { try { P.apply(); } catch (e) { /* the fallback tokens in subs.css stay */ } };
    go();
    if (typeof MutationObserver !== 'undefined') new MutationObserver(go).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  }
  P.math = { hexRgb: hexRgb, rnd: rnd, toHex: toHex, lum: lum, ratio: ratio, rgbToLch: rgbToLch, lchToRgb: lchToRgb, hueGap: hueGap, maxChroma: maxChroma, toLin: toLin, inGamut: inGamut };
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();
