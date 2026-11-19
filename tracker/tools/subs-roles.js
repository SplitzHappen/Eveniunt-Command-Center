#!/usr/bin/env node
'use strict';
// The colour roles of the Submersibles module (docs/submersibles-look-spec.md, Revision 4, Rev4.4 to Rev4.6).
// Holds the role list (ROLES), the pointers (ALIASES), the zone map (ZONES) and the lint lists, and writes
// docs/submersibles-colour-roles.md from them and from the one palette model (src/submersibles/palette.js, through
// tests/subs-palette.js). The output has no date and no machine text, so it is the same on every run.
//   node tracker/tools/subs-roles.js            writes the document
//   node tracker/tools/subs-roles.js --check    writes nothing; exits 1 when the committed document differs
const fs = require('fs');
const path = require('path');
const P = require('../tests/subs-palette.js');

const DOC = path.join(__dirname, '..', '..', 'docs', 'submersibles-colour-roles.md');
const { PALETTE, THEMES, RULES, hexRgb, toHex, rgbToLch, hueGap, colour } = P;

// ---- the roles: [id, name, kind, what it stands for, [[token, tone], ...]] (Rev4.4) ----
const R = (id, name, kind, stands, tokens) => ({ id, name, kind, stands, tokens });
const ROLES = [
  R('page', 'page', 'theme', 'the ground of the screen', [['--paper', 'field'], ['--paper-2', 'field'], ['--paper-3', 'field']]),
  R('panel', 'panel', 'theme', 'a raised surface', [['--slip', 'field']]),
  R('ink', 'ink', 'theme', 'reading text, edges', [['--ink', 'text'], ['--ink-2', 'text'], ['--ink-3', 'text']]),
  R('line', 'line', 'theme', 'hairlines and texture', [['--rule', 'graphic'], ['--grid', 'graphic']]),
  R('slab', 'slab', 'theme', 'structure with no kind of its own', [['--slab', 'field'], ['--on-slab', 'on'], ['--on-slab-2', 'on']]),
  R('accent', 'accent', 'theme', 'an action, the chosen thing, the best, focus', [['--seal', 'field'], ['--on-seal', 'on'], ['--hi', 'wash'], ['--hi-slip', 'wash']]),
  R('molten', 'molten', 'theme', 'the family\'s gradient', [['--molten', 'band'], ['--glow', 'glow']]),
  R('overlay', 'overlay', 'theme', 'shade over anything', [['--shadow', 'shade'], ['--sweep', 'shade'], ['--scrim', 'shade']]),
  R('deep', 'deep water', 'theme', 'the dark panel of an empty state', [['--deep', 'field'], ['--deep-2', 'field'], ['--on-deep', 'on'], ['--deep-line', 'graphic']]),
  R('rank', 'rank', 'meaning', 'a submarine\'s rank and levelling', [['--rank-m', 'field'], ['--rank-g', 'graphic'], ['--rank-s', 'text'], ['--rank-w', 'wash']]),
  R('gil', 'gil', 'meaning', 'gil and value', [['--gil-m', 'field'], ['--gil-g', 'graphic'], ['--gil-s', 'text'], ['--gil-w', 'wash']]),
  R('loot', 'loot', 'meaning', 'items brought back', [['--loot-m', 'field'], ['--loot-g', 'graphic'], ['--loot-s', 'text'], ['--loot-w', 'wash']]),
  R('route', 'route', 'meaning', 'routes, sector letters, unlocking', [['--route-m', 'field'], ['--route-g', 'graphic'], ['--route-s', 'text'], ['--route-w', 'wash'], ['--chart-hot', 'graphic'], ['--chart-hot-text', 'text'], ['--chart-glow', 'glow']]),
  R('back', 'back', 'meaning', 'Back: needs the player; found', [['--back', 'field'], ['--on-back', 'on'], ['--back-s', 'text'], ['--back-bg', 'wash'], ['--chart-found', 'graphic'], ['--chart-done', 'graphic']]),
  R('out', 'out', 'meaning', 'Out: at sea', [['--out', 'field'], ['--on-out', 'on'], ['--out-s', 'text'], ['--out-bg', 'wash']]),
  R('idle', 'idle', 'meaning', 'Idle: not sent; can be revealed next; not logged', [['--idle', 'field'], ['--on-idle', 'on'], ['--idle-s', 'text'], ['--idle-bg', 'wash'], ['--chart-next', 'graphic']]),
  R('locked', 'locked', 'meaning', 'Locked; further away', [['--locked', 'graphic'], ['--chart-far', 'graphic']]),
  R('error', 'error', 'meaning', 'something is wrong; cannot be added', [['--bad', 'graphic'], ['--bad-s', 'text'], ['--chart-no', 'graphic']]),
].concat([1, 2, 3, 4, 5, 6, 7].map((n) => R('sea' + n, 'sea ' + n, 'meaning', 'that sea and nothing else', [['--sea-' + n, 'field'], ['--sea-' + n + '-g', 'graphic'], ['--sea-' + n + '-s', 'text'], ['--sea-' + n + '-w', 'wash']])), [
  R('water', 'water', 'meaning', 'the chart\'s ground, one per sea', [['--chart-bg', 'field'], ['--chart-bg-2', 'field'], ['--chart-bg-hi', 'field'], ['--chart-back', 'graphic']]),
  R('chartink', 'chart ink', 'meaning', 'neutral marks on the water', [['--chart-ink', 'text'], ['--chart-ink-2', 'text'], ['--chart-ink-step', 'text'], ['--chart-link', 'graphic'], ['--chart-sel', 'graphic']])
]);
// the text on any field of the roles rank, gil, loot, route and the seven seas
const SHARED = R('shared', 'shared', 'meaning', 'the text on any field of roles rank, gil, loot, route and sea 1 to 7', [['--on-mid', 'on']]);
const TONE_WORDS = { field: 'a solid ground that carries text', on: 'the text on that field', graphic: 'bands, bars, borders and marks (3:1 on the page colours)', text: 'coloured text (4.5:1 on the page colours)', wash: 'a tint under ink text (7:1)', band: 'a gradient band', glow: 'a glow', shade: 'a shade over anything' };

// tokens that are pointers, not colours of their own (not counted). Each lists the roles it can point at.
const ALIASES = {
  '--st': ['back', 'out', 'idle', 'locked'], '--on-st': ['back', 'out', 'idle', 'locked', 'ink'], '--st-bg': ['back', 'out', 'idle', 'page', 'panel'],
  '--sea': ['sea'], '--sea-g': ['sea'], '--sea-s': ['sea'], '--sea-w': ['sea'],
  '--scr': ['route', 'loot', 'gil', 'rank', 'sea'], '--scr-g': ['route', 'loot', 'gil', 'rank', 'sea'],
  '--lv-m': ['rank', 'gil', 'loot', 'route'], '--lv-g': ['rank', 'gil', 'loot', 'route'],
  '--ico': ['route', 'loot', 'sea', 'gil', 'rank'], '--band': ['back', 'out', 'idle', 'locked'], '--hz': ['ink', 'line', 'idle', 'rank', 'gil', 'loot', 'route', 'sea'],
  // the gradient's stops, set by the theme (look.js) and the progress colour
  '--lb-a': ['accent', 'molten'], '--lb-b': ['accent', 'molten'], '--lb-c': ['accent', 'molten'], '--lb-glow': ['accent', 'molten'], '--ochre': ['accent', 'molten']
};
// tokens Revision 3 built that W33 retired (the ring tokens and --ringc); none remains, the map stays so that a returning one is noticed by the tests
const RETIRING = {};
// custom properties that are sizes, fonts or patterns, not colours
const NON_COLOUR = new Set(['--f-disp', '--f-body', '--f-data', '--f-serif', '--f-kick', '--edge', '--pad-x', '--p', '--field', '--row-pad', '--row-gap', '--r', '--cut', '--cols', '--strip-fig', '--state-fs', '--name-fs', '--fig-fs', '--head-fs', '--quick-h', '--hazard', '--ax-l', '--ax-r', '--x', '--nfs', '--sfs', '--th', '--bar', '--ret', '--i', '--pitch', '--d']);
// role tokens no rule of subs.css uses yet, each with its reason (the test fails when one is used, or when an unused one is missing here)
const UNUSED = {
  '--out-s': 'Out is not used as text on any screen yet; the tone exists so that a later rule has one',
  '--chart-bg-hi': 'the lightest ground under a marker; read by the contrast test, painted by no rule'
};
// colour literals that may stay outside a token rule until the item named finishes (Rev4.6); must be empty after W36
const LINT_PENDING = [];

// tokens the model cannot compute: printed as their formula, never as a typed value
const FORMULA = {
  '--rule': 'set by the theme (look.js)', '--grid': 'set by the theme (look.js)', '--hi': 'set by the theme: the accent at 16% opacity', '--molten': 'set by the theme: the accent and progress gradient',
  '--glow': 'set by the theme: the accent glow (dark themes)', '--shadow': 'set by the theme (look.js)', '--sweep': 'formula: black at 22% (light) or white at 28% (dark), fixed in subs.css', '--scrim': 'formula: black at 60%, fixed in subs.css',
  '--chart-glow': 'formula: the planned route\'s pink at 55% opacity'
};

// ---- the zones (Rev4.4 table, kept in step with subs.css). frags: pieces of a selector; the longest one found in a rule wins; a leading = means the whole selector. roles: the roles a rule in the zone may use ('*' for all) ----
const Z = (screen, zone, use, frags, roles) => ({ screen, zone, use, frags, roles });
const ALLROLES = '*';
const ZONES = [
  Z('Token rules', 'the token definitions (`:root`, `.subs-page`, the sea and chart token rules)', 'where every colour is declared', ['=:root', '=:root:not([data-theme="light"])', '=:root[data-theme="dark"]', '=.subs-page', '.subs-page:has(.tabs [data-tab=', '.in-sea-', '=.map-panel', '=:root:not([data-theme="light"]) .map-panel', '=:root[data-theme="dark"] .map-panel', '.map-panel:has(.chart-svg[data-sea='], [ALLROLES]),
  // ---- Board ----
  Z('Board', 'ground, graph paper (`.subs-main`)', 'page field; line', ['=.subs-main'], ['page', 'line']),
  Z('Board', 'next-back block (`.strip-next`, `.strip-more`)', 'slab field, on, on-2; ink-2', ['.strip-next', '.strip-more'], ['slab', 'ink', 'accent']),
  Z('Board', 'tallies (`.strip-back`, `.strip-tally`)', 'status field and on when the count is above 0, else panel and ink-2; locked: panel, locked hatch, ink', ['.strip-back', '.strip-tally'], ['back', 'out', 'idle', 'locked', 'panel', 'ink', 'overlay']),
  Z('Board', 'tools (`.strip-tools`, `.seg`)', 'panel, ink; pressed: slab', ['.seg', '.strip-tools'], ['panel', 'page', 'ink', 'slab']),
  Z('Board', 'axis (`.tl-axis`)', 'ink (rule, return notches); ink-2 (tick labels); slab (the count on a cluster)', ['.tl-axis'], ['ink', 'slab']),
  Z('Board', 'group head (`.fc-head`)', 'slab field, on, on-2; molten band; status fields and ink-3 in the slot strip', ['.fc-head', '.fc-list'], ['slab', 'molten', 'page', 'back', 'out', 'idle', 'locked', 'ink']),
  Z('Board', 'lane ground (`.sub`)', 'status wash, else panel; ink edge; Back: a 2 px back field inset', ['=.fc-subs:not(.list) .sub', '.sub:focus-visible', '=.sub', '.sub[data-status="back"]', '.sub[data-status="out"]', '.sub[data-status="idle"]', '.sub[data-sub]:hover', '=.sub::before', '.sub[data-status="back"]::before'], ['back', 'out', 'idle', 'page', 'panel', 'ink', 'accent', 'overlay']),
  Z('Board', 'status field and word (`.sub::before`, `.chip`)', 'status field and on; locked: locked hatch, ink on page', ['.chip', '.sub[data-status] .chip', '.sub[data-status="locked"] .chip', '.sub[data-status="locked"]::before'], ['back', 'out', 'idle', 'locked', 'ink', 'page', 'route']),
  Z('Board', 'name, parts code, route caption', 'ink; ink-2; ink', ['.sub-fc', '.sub-meta', '.sub-when', '.sub-name', '.sub-top'], ['ink']),
  Z('Board', 'rank plate', 'rank field, on-mid', ['.sub[data-sub] .sub-meta > span:first-child'], ['rank', 'slab', 'shared']),
  Z('Board', 'countdown, clock (`.when`)', 'ink (Back: back text); ink-2', ['=.when', '.when'], ['ink', 'back']),
  Z('Board', 'discs (`.disc`)', 'sea field, on-mid; outlined: panel, sea graphic, ink; the gap ring is panel', ['.disc'], ['sea', 'shared', 'panel', 'ink']),
  Z('Board', 'trough, bar, marker (`.tl`, `.tl-bar`, `.tl-end`)', 'page field 3; out field (Back: back field); ink', ['.tl', '.tl-bar', '.tl-end'], ['page', 'out', 'back', 'ink', 'locked', 'line']),
  Z('Board', 'voyage gauge (`.vgauge`)', 'out field on its own 12% track', ['.vgauge'], ['out']),
  Z('Board', 'action (`.quick`)', 'accent field, on; band: molten, or the choosing role\'s field over a 2 px accent-on line', ['.quick', '.btn.primary, .quick', '.sub-when .quick'], ['accent', 'molten', 'rank', 'gil', 'loot', 'route']),
  Z('Board', 'locked lane', 'locked hatch on page field 3; one outlined disc; ink; tag ink-2', ['.sub[data-status="locked"]', '.sub[data-status="locked"] .sub-meta', '.sub[data-status="locked"] .tag'], ['locked', 'route', 'sea', 'ink', 'page', 'panel', 'line']),
  Z('Board', 'empty slot (`.sub.empty`)', 'idle graphic (dashed edge, hatch); ink-2; link accent', ['.sub.empty'], ['idle']),
  Z('Board', 'notes (`.hint`, `.foot-note`, `.tl-key`)', 'ink-2; link accent', ['.foot-note'], ['ink']),
  // ---- Send window ----
  Z('Send window', 'scrim; sheet', 'overlay; panel, ink edge, molten band', ['.sheet::backdrop', '=.sheet', '.sheet-actions'], ['overlay', 'panel', 'ink']),
  Z('Send window', 'title (`.sheet h2`)', 'slab; a 12 px status field edge', ['.sheet h2'], ['slab', 'back', 'out', 'idle']),
  Z('Send window', 'suggestion (`.advice`)', 'accent wash and field edge; ink; the reason\'s edge: the choosing role\'s graphic', ['.advice', '.advice-step', '.lead-'], ['accent', 'ink', 'rank', 'gil', 'loot', 'route']),
  Z('Send window', 'actions', 'accent field, on, molten; other buttons ink edge on panel', ['.btn.primary:hover', '.btn.primary[disabled]:hover'], ['accent', 'molten']),
  Z('Map', 'community routes (`.cr-list`)', 'page field, ink-2 text and reason line, line hatch band on a route that cannot be used yet', ['.cr-list', '.cr-why'], ['page', 'ink', 'line']),
  Z('Send window', 'outline button (`.btn.outline`)', 'no fill, accent edge, ink text; hover accent wash', ['.btn.outline'], ['accent', 'ink', 'page', 'wash']),
  Z('Send window', 'sector buttons (`.sector`)', 'page field, ink; sea graphic edge; letter route text; chosen: accent field, on, molten; order badge slab; disabled: line hatch', ['.sector'], ['page', 'ink', 'sea', 'route', 'accent', 'molten', 'slab', 'line']),
  Z('Send window', 'routes compared (`.cmp`, `.cmp-lane`, `.alts .tl`)', 'one axis: the suggestion and the other routes as lanes: page field 3 trough with a 2 px ink-2 edge, ink-2 bar and outlined marker, the suggestion accent bar and solid ink marker; panel plates, ink edge, accent edge on the chosen one; discs sea', ['.cmp', '.cmp-lane'], ['panel', 'page', 'ink', 'accent', 'line', 'sea', 'shared']),
  Z('Send window', 'route line (`.route-line`)', 'route graphic edge, route text; discs sea; ink rules', ['.route-line', '.route-pick .route-line', '.planner .route-line b', '.alts', '.route-row'], ['route', 'ink', 'sea', 'line']),
  Z('Send window', 'what came back (`.loot-h`, `.loot-row`, `.qbtn`, `.rate-item b`)', 'loot field, on-mid, loot graphic hatch; line; page field, ink; loot text', ['.loot-h', '.loot-row', '.qbtn', '.rate-item', '.rates-tier', '.loot-name'], ['loot', 'shared', 'ink', 'line', 'page', 'accent']),
  Z('Send window', 'rank box, rank-up plan', 'rank graphic edge, rank text', ['.rankbox', '.rank-plan', '.facts dt'], ['rank', 'ink']),
  Z('Send window', 'questions after a voyage (`fieldset`, `legend`)', 'ink edge; slab', ['=fieldset', '=legend'], ['ink', 'slab']),
  Z('Send window', 'send-all rows (`.pick .chip`, `.pick-fc`)', 'status field and on; ink', ['.pick'], ['back', 'out', 'idle', 'ink']),
  // ---- Log ----
  Z('Log', 'head', 'loot field, on-mid, ink band', ['.log-list'], ['ink']),
  Z('Log', 'day rule (`.log-day`)', 'slab field, on, on-2', ['.log-day'], ['slab']),
  Z('Log', 'row (`.log-row`)', 'page field; hover page field 2; line', ['=.log-row', '.log-row:hover', '.log-row:focus-visible', '.log-row:hover .muted'], ['page', 'ink', 'line', 'accent']),
  Z('Log', 'who, route text, discs', 'ink; ink-2; sea', ['.log-row .disc', '.log-who'], ['ink', 'sea', 'shared', 'panel']),
  Z('Log', 'time cell (`.log-when`)', 'sea field, on-mid (no route: slab); hover accent field, on', ['.log-when', '.log-row:hover .log-when', '.log-row[class*="in-sea-"] .log-when', '.log-row[class*="in-sea-"]:hover .log-when'], ['sea', 'shared', 'slab', 'accent']),
  Z('Log', 'grade (`.log-grade`)', 'rank wash, rank graphic, ink; S and SS: rank field, on-mid', ['.log-grade'], ['rank', 'ink', 'shared']),
  Z('Log', 'gil and heat line (`.log-what`)', 'gil text; gil graphic', ['.log-what', '.log-row.logged .log-what'], ['gil', 'idle']),
  Z('Log', 'logged or not (row edge)', 'loot graphic; idle graphic (dashed) and idle text', ['.log-row.logged', '.log-row.unlogged'], ['loot', 'idle']),
  // ---- Map ----
  Z('Map', 'head', 'slab with the sea\'s graphic band', ['.map-panel > h2:first-child'], ['sea']),
  Z('Map', 'sea chain (`[data-map-sea]`)', 'page field, ink; sea field edge; bar sea graphic on line; chosen: sea field, on-mid; closed: line hatch, ink-2; the link between two seas: ink rule and arrow, the opening sector as a disc in its sea', ['.map-seas', '.sea-link'], ['page', 'ink', 'sea', 'line', 'shared', 'slab', 'accent']),
  Z('Map', 'planner (`.planner`)', 'page field, ink edge, sea graphic edge; route text; discs; error text; action accent', ['.map-grid > .planner', '.map-panel .field.inline'], ['page', 'ink', 'sea']),
  Z('Map', 'chart head (`.chart-head`)', 'sea field, on-mid, ink band', ['.chart-head', '.chart-sea', '.chart-count'], ['sea', 'shared', 'ink']),
  Z('Map', 'chart (`.chart-svg`)', 'water; chart ink; back, idle, locked, route and error chart tones', ['.chart-'], ['water', 'chartink', 'back', 'idle', 'locked', 'route', 'error', 'line', 'ink', 'molten']),
  Z('Map', 'legend (`.chart-key`)', 'water field, chart ink; swatches back, idle, locked chart tones', ['.chart-key'], ['water', 'chartink', 'back', 'idle', 'locked', 'ink', 'error']),
  Z('Map', 'sector details (`.chart-details`)', 'panel; head sea field, on-mid; state line back text, idle text or ink-2 with its edge; labels ink-2; rank text; route text; tier number loot field, on-mid; open tier accent wash; rate loot text', ['.chart-details', '.chart-facts'], ['panel', 'page', 'sea', 'shared', 'back', 'idle', 'ink', 'rank', 'route', 'loot', 'slab', 'molten', 'accent']),
  // ---- Earnings ----
  Z('Earnings', 'head', 'gil field, on-mid', ['.earn-card:first-child'], ['gil', 'ink', 'slab', 'shared']),
  Z('Earnings', 'tallies (`.earn-card`)', 'first (Today): solid gil field, on-mid, gil band; others: deep-water block (lighter than the page in a dark theme, darker in a light one, so it stands off the panel in every theme), 10 px gil field band above and 4 px below, on-deep figure and label', ['.earn-card', '.earn-card:not(:first-child)', '.earn-card b'], ['gil', 'ink', 'page', 'deep']),
  Z('Earnings', 'scale line (`.earn-scale`)', 'ink-2: the printed scale of a table of bars', ['.earn-scale'], ['ink']),
  Z('Earnings', 'section labels', 'ink; hatch and underline gil graphic', ['.earn-t th', '.earn-t th, .earn-t td'], ['line', 'ink']),
  Z('Earnings', 'position block', '1: accent field, on; 2 and 3: slab; others ink-2', ['.earn-ranked tr[data-pos] > td:first-child', '.earn-ranked tr[data-pos="1"] > td:first-child', '.earn-ranked tr[data-pos="2"] > td:first-child'], ['ink', 'accent', 'slab']),
  Z('Earnings', 'route cell', 'route text, sea graphic edge, discs sea', ['.earn-ranked tr[data-pos] > td:nth-child(2)'], ['route', 'sea']),
  Z('Earnings', 'bars', 'gil wash, gil graphic tip, quarter lines line, figures ink; other gil figures gil text', ['.earn-ranked tr[style]', '.earn-ranked tr[data-pos] > td:nth-child(4)', '.earn-t td b', '.earn-ranked tr[data-pos]', '.earn-t:has(thead):not(.earn-ranked):not(.earn-thin) td:nth-child(3)'], ['gil', 'ink', 'line']),
  Z('Earnings', 'thin rows; top items', 'idle graphic hatch; loot text, loot graphic edge, gil text', ['.earn-thin', '.earn-t:has(thead):not(.earn-ranked):not(.earn-thin) td:first-child', '.earn-t .earn-note td'], ['idle', 'loot', 'ink', 'route', 'sea']),
  // ---- Setup ----
  Z('Setup', 'panel heads', 'rank field, on-mid (recommendations: the same head, with a 6 px stripe of the four role fields under it); head state on', ['.panel.recs:not(.welcome):not(.empty-state):not(.map-panel) > h2:first-child', '.head-state'], ['route', 'rank', 'gil', 'loot', 'slab', 'ink', 'shared']),
  Z('Setup', 'notifications, free companies, ticks', 'ink, ink-2, slab legend; page field, ink edge; link accent', ['.tick b', '.wiz-foot'], ['route', 'ink']),
  Z('Setup', 'ranking (`.rec-rank`)', 'each rung: its role\'s wash, ink, its role\'s field and on-mid for the number; first rung accent field edge', ['.rec-rank', '.rec-name', '.recs .btn:focus-visible', '.recs select:focus-visible', '.rec-note', '.rec-give', '[data-recs-body]'], ['accent', 'ink', 'slab', 'route', 'rank', 'gil', 'loot', 'shared', 'page']),
  Z('Setup', 'fuel; loot pickers', 'accent thumb, page field 3, ink; loot text, loot graphic edge, off: ink-3', ['.rec-picker', '.rec-pick-row'], ['loot', 'ink', 'page']),
  Z('Setup', 'accuracy (`.acc`)', 'ink-2 heads; agrees back text; differs error text', ['.acc'], ['ink', 'line', 'back', 'error']),
  Z('Setup', 'guided setup (`.wiz`)', 'head rank field; steps: accent field (now), slab-on (done), outline; fields page and ink; note accent wash; a closed sea: sea wash and graphic edge; an open sea: sea field, on-mid; letters route text; error text', ['.wiz-head', '.dot', '.sea', '.sea[open]', '.sea[class*="in-sea-"]'], ['slab', 'molten', 'route', 'loot', 'gil', 'rank', 'accent', 'sea', 'shared', 'ink', 'page']),
  // ---- Empty states ----
  Z('Empty', 'full empty state (`.empty-state`)', 'page field, ink edge; kicker slab; headline ink; sentence ink-2; step: panel, ink edge, number in a role field with on-mid; action accent with the route band', ['.empty-state', '.es-kick', '.es-main', '.es-text', '.es-step', '.es-act', '.es-aside', '.es-note'], ['page', 'panel', 'slab', 'ink', 'shared', 'accent', 'route', 'loot', 'gil', 'rank']),
  Z('Empty', 'scope (`.es-scope`)', 'deep fields (in a dark theme lighter than the page, in a light theme darker); rings route, loot, gil, rank fields and deep graphic; sweep route field; labels deep on, in a strip under the drawing parted by a deep graphic rule', ['.es-scope'], ['deep', 'route', 'loot', 'gil', 'rank']),
  Z('Empty', 'empty line (`.empty-line`)', 'page field, ink-2 dashed edge, ink; glyph: the screen\'s role, graphic', ['.empty-line'], ['page', 'ink', 'route', 'loot', 'gil', 'rank', 'sea']),
  // ---- Notices, errors ----
  Z('Notices', 'notice (`.note`)', 'accent wash and field edge, ink', ['=.note'], ['accent', 'ink']),
  Z('Errors', 'block (`.note.bad`); text (`.hint.bad`, `.wiz-err`, `.cannot-line`, `.cannot-why`)', 'error graphic hatch on the accent wash; error text', ['.note.bad', '.hint.bad', '.cannot-line', '.cannot-why'], ['error', 'accent']),
  // ---- shared chrome (every screen; not in the Rev4.4 table, listed so that the coverage rule has no gaps) ----
  Z('All screens', 'tab rail (`.tabs`)', 'ink on the page field 2; the current tab: the screen\'s role as a slab; icons in their screen\'s role', ['.tabs'], ['ink', 'page', 'slab', 'molten', 'accent', 'route', 'loot', 'sea', 'gil', 'rank', 'shared']),
  Z('All screens', 'panel and card surface (`.panel`, `.fc`, `.strip`)', 'panel, ink edge, shadow; molten band', ['.panel, .fc, .earn-card, .sheet, .strip', '.panel h4', '.recs h3', '.wide-panel > h3'], ['panel', 'ink', 'overlay', 'molten', 'route', 'loot', 'gil', 'rank', 'sea']),
  Z('All screens', 'panel heads (`.panel > h2`)', 'slab field, on, molten band; on a screen: the screen\'s role field, on-mid', ['.panel > h2', '.panel:not(.welcome)', ':is(.panel > h2:first-child, .fc-head'], ['slab', 'molten', 'route', 'loot', 'gil', 'rank', 'sea', 'shared', 'ink']),
  Z('All screens', 'buttons, links, fields (`.btn`, `.link`, `.inp`)', 'ink edge on panel; link accent; focus accent; radio buttons and checkboxes: a 2 px ink edge on the page field, the accent when checked with its text colour for the mark, the accent as the focus ring, ink-3 and page field 2 when disabled', ['=.btn', '=.link', '.inp', 'select', '.qinp', 'input[type=', '.sea-bulk', '=.muted', '=.hint', '=.tag', '=.field', '.hint', '.field'], ['ink', 'page', 'accent', 'slab']),
  Z('All screens', 'hint and tag lines', 'ink-2', ['.muted', '.tag'], ['ink'])
];

// ---- the model ----
const modes = ['light', 'dark'];
const onSealFn = (() => { const t = P.lookSrc, f = (n) => { const i = t.indexOf('function ' + n + '('); return t.slice(i, t.indexOf('\n', i)); }; return new Function(f('lum') + '\n' + f('onSeal') + '\nreturn onSeal;')(); })();
function envOf(row, mode) {
  const T = PALETTE.compute(P.themeInput(row, mode)).tokens, env = P.env(row, mode);
  const ac = hexRgb((mode === 'dark' ? row[3] : row[2])[2]);
  Object.assign(env, T, { '--on-seal': onSealFn(ac) });
  return { env, T, dk: mode === 'dark' };
}
// one token's value for one theme and mode: a hex string, or a formula text
function valueOf(token, ctx, sea) {
  if (FORMULA[token]) return FORMULA[token];
  if (token.startsWith('--chart-')) { // the chart tokens depend on the sea in scope (sea 1 unless told)
    const e = Object.assign({}, ctx.env, ctx.dk ? RULES.chartDark : RULES.chartLight, { '--sea': ctx.T['--sea-' + (sea || 1)] });
    return toHex(colour('var(' + token + ')', e));
  }
  return toHex(colour('var(' + token + ')', ctx.env));
}
const hueOfHex = (h) => rgbToLch(hexRgb(h))[2];

// ---- helpers for the document and for the tests ----
function counts() {
  const roles = ROLES.length, tones = ROLES.reduce((n, r) => n + r.tokens.length, 0) + SHARED.tokens.length;
  const theme = ROLES.filter((r) => r.kind === 'theme'), meaning = ROLES.filter((r) => r.kind === 'meaning');
  return { roles, tones, themeRoles: theme.length, themeTones: theme.reduce((n, r) => n + r.tokens.length, 0), meaningRoles: meaning.length, meaningTones: meaning.reduce((n, r) => n + r.tokens.length, 0) + SHARED.tokens.length };
}
const roleOf = {}; // token -> role id (sea 1 to 7 are the ids sea1 to sea7)
ROLES.concat([SHARED]).forEach((r) => r.tokens.forEach(([t]) => { roleOf[t] = r.id; }));
const kind = (id) => (/^sea\d$/.test(id) ? 'sea' : id);
// the roles a token may stand for: its own role, or any role an alias can point at
function rolesOf(token) {
  if (roleOf[token]) return [kind(roleOf[token])];
  if (ALIASES[token]) return ALIASES[token].map(kind);
  if (RETIRING[token]) return RETIRING[token].map(kind);
  return null;
}
function zoneOf(selector) {
  let best = null, bestLen = -1;
  ZONES.forEach((z, zi) => z.frags.forEach((f) => {
    const exact = f.startsWith('='), frag = exact ? f.slice(1) : f;
    const hit = exact ? selector === frag : selector.includes(frag);
    const len = frag.length + (exact ? 1000 : 0);
    if (hit && len > bestLen) { best = zi; bestLen = len; }
  }));
  return best == null ? null : ZONES[best];
}
// the rules of subs.css: { sel, body } (comments removed; @media, @supports, @container and @layer blocks entered). The zone tests leave @keyframes
// and the other at-rules out; the lint (all = true) takes them in too: a keyframe step is a rule of its own, a rule such as @font-face is one body.
function cssRules(src, all) {
  const text = (src || P.css).replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  (function parse(s, within) {
    let i = 0;
    while (i < s.length) {
      const o = s.indexOf('{', i); if (o < 0) break;
      let sel = s.slice(i, o).trim(); let d = 1, j = o + 1;
      while (/^@[\w-]+[^{;]*;/.test(sel)) sel = sel.replace(/^@[\w-]+[^{;]*;\s*/, ''); // a statement such as "@layer a, b;" is no rule
      while (j < s.length && d > 0) { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; }
      const body = s.slice(o + 1, j - 1);
      if (/^@(media|supports|container|layer|scope)/.test(sel)) parse(body, within);
      else if (/^@(-\w+-)?keyframes/.test(sel)) { if (all) parse(body, sel); }
      else if (sel.startsWith('@')) { if (all) out.push({ sel, body }); }
      else out.push({ sel: within ? within + ' > ' + sel : sel, body });
      i = j;
    }
  })(text, '');
  return out;
}
const usedTokens = (body) => [...new Set([...body.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))];

// ---- the document ----
function build() {
  const L = [], c = counts();
  const out = (s) => L.push(s);
  const ctxs = [];
  for (const row of THEMES) for (const mode of modes) ctxs.push({ row, mode, where: row[1] + ' ' + mode, ctx: envOf(row, mode) });
  out('# Submersibles: colour roles');
  out('');
  out('Generated by tracker/tools/subs-roles.js. Do not edit.');
  out('');
  out('Source: docs/submersibles-look-spec.md, Revision 4 (Rev4.4 to Rev4.6). The palette model is `tracker/command-center/src/submersibles/palette.js`; the tool reads it, the theme rows of `look.js` and the token rules of `subs.css`. Hex values are the colours the model computes at the default contrast, for each of the 21 themes in light and dark. A tone the model cannot compute is printed as its formula or as "set by the theme".');
  out('');
  out('## 1. The roles');
  out('');
  out('Tones: ' + Object.entries(TONE_WORDS).map(([k, v]) => '`' + k + '` ' + v).join('; ') + '.');
  out('');
  out('**' + c.roles + ' roles, ' + c.tones + ' tones** (' + c.themeRoles + ' theme roles with ' + c.themeTones + ' tones; ' + c.meaningRoles + ' meaning roles with ' + c.meaningTones + ' tones, counting the shared `--on-mid`). A theme role comes from the theme. A meaning role has one hue family in every theme (rank ' + PALETTE.ROLE_HUE.rank + ' degrees, gil ' + PALETTE.ROLE_HUE.gil + ', loot ' + PALETTE.ROLE_HUE.loot + ', route ' + PALETTE.ROLE_HUE.route + '; the statuses, error, the seven seas and the chart keep the hues they always had) and reaches the theme through lightness and chroma only.');
  out('');
  out('| # | Role | Kind | Stands for | Tokens (tone) |');
  out('| --- | --- | --- | --- | --- |');
  ROLES.forEach((r, i) => out('| ' + (i + 1) + ' | ' + r.name + ' | ' + r.kind + ' | ' + r.stands + ' | ' + r.tokens.map(([t, tone]) => '`' + t + '` (' + tone + ')').join(', ') + ' |'));
  out('| | ' + SHARED.name + ' | ' + SHARED.kind + ' | ' + SHARED.stands + ' | `--on-mid` (on) |');
  out('');
  out('Aliases (pointers with no colour of their own, not counted): ' + Object.keys(ALIASES).map((t) => '`' + t + '`').join(', ') + '.');
  out('');
  if (Object.keys(RETIRING).length) { out('Tokens Revision 3 built that W33 retires (still used by rules, in no role): ' + Object.keys(RETIRING).map((t) => '`' + t + '`').join(', ') + '.'); out(''); }
  out('## 2. Every tone, per theme and mode');
  out('');
  out('One table per role: 21 themes in light and dark, a hex value per token, and the hue (OKLCH degrees) of the first field or graphic tone. The water of the chart is shown for sea 1; every sea has its own.');
  out('');
  ROLES.concat([SHARED]).forEach((r, i) => {
    out('### ' + (r.id === 'shared' ? 'Shared' : (i + 1) + '. ' + r.name) + ': ' + r.stands);
    out('');
    out('| Theme | Mode | ' + r.tokens.map(([t, tone]) => '`' + t + '` (' + tone + ')').join(' | ') + ' | Hue |');
    out('| --- | --- | ' + r.tokens.map(() => '---').join(' | ') + ' | --- |');
    ctxs.forEach(({ row, mode, ctx }) => {
      const vals = r.tokens.map(([t]) => valueOf(t, ctx)), first = vals.find((v, k) => /^#/.test(v) && ['field', 'graphic'].includes(r.tokens[k][1]));
      out('| ' + row[1] + ' | ' + mode + ' | ' + vals.join(' | ') + ' | ' + (first ? Math.round(hueOfHex(first)) + '°' : '-') + ' |');
    });
    out('');
  });
  // ---- hue gaps ----
  out('## 3. Hue gaps, as measured');
  out('');
  const st = {}, g = hueGap, f1 = (x) => x.toFixed(1);
  for (const m of modes) { const t = P.themeInput(THEMES[0], m); st[m] = {}; for (const k of PALETTE.STATUS) st[m][k] = rgbToLch(t[k])[2]; }
  const chartHue = { 'chart found': hueOfHex(RULES.chartLight['--chart-found']), 'chart next': hueOfHex(RULES.chartLight['--chart-next']), 'chart planned route': hueOfHex(RULES.chartLight['--chart-hot']), 'chart cannot-add': hueOfHex(RULES.chartLight['--chart-no']) };
  const seaNames = ['blue', 'ember', 'jade', 'rose', 'lilac', 'indigo', 'ice'];
  out('The statuses, the error colour and the chart marks are the same in all themes; their hues (degrees): ' + modes.map((m) => m + ': ' + PALETTE.STATUS.map((k) => k + ' ' + f1(st[m][k])).join(', ')).join('; ') + '. Seas: ' + PALETTE.SEA_HUES.map((h, i) => (i + 1) + ' ' + seaNames[i] + ' ' + h).join(', ') + '. Chart: ' + Object.entries(chartHue).map(([k, v]) => k + ' ' + f1(v)).join(', ') + '.');
  out('');
  out('| Role | Hue | Nearest status | Nearest sea | Nearest other role |');
  out('| --- | --- | --- | --- | --- |');
  PALETTE.VOICES.forEach((v) => {
    const h = PALETTE.ROLE_HUE[v];
    const ns = modes.map((m) => { const k = PALETTE.STATUS.reduce((a, b) => (g(h, st[m][b]) < g(h, st[m][a]) ? b : a)); return k + ' ' + Math.round(g(h, st[m][k])) + '° (' + m + ')'; }).join(', ');
    const sea = PALETTE.SEA_HUES.map((x, i) => [g(h, x), seaNames[i]]).sort((a, b) => a[0] - b[0]).slice(0, 2).map((x) => x[1] + ' ' + Math.round(x[0]) + '°').join(', ');
    const oth = PALETTE.VOICES.filter((x) => x !== v).map((x) => [g(h, PALETTE.ROLE_HUE[x]), x]).sort((a, b) => a[0] - b[0])[0];
    out('| ' + v + ' | ' + h + '° | ' + ns + ' | ' + sea + ' | ' + oth[1] + ' ' + Math.round(oth[0]) + '° |');
  });
  out('');
  // every gap under 25 degrees, named
  const items = [];
  PALETTE.VOICES.forEach((v) => items.push(['role ' + v, PALETTE.ROLE_HUE[v]]));
  modes.forEach((m) => PALETTE.STATUS.forEach((k) => items.push(['status ' + k + ' (' + m + ')', st[m][k]])));
  PALETTE.SEA_HUES.forEach((h, i) => items.push(['sea ' + (i + 1) + ' ' + seaNames[i], h]));
  Object.entries(chartHue).forEach(([k, v]) => items.push([k, v]));
  const close = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const d = g(items[i][1], items[j][1]);
    if (d < 25 && items[i][0].replace(/ \(.*/, '') !== items[j][0].replace(/ \(.*/, '')) close.push([d, items[i][0] + ' and ' + items[j][0]]);
  }
  close.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
  out('Every gap under 25 degrees between two different things (' + close.length + '):');
  out('');
  close.forEach(([d, n]) => out('- ' + f1(d) + '°: ' + n));
  out('');
  out('The floors the test asserts in all 42 pairs of theme and mode: a role to any status 20 degrees; a role to a role 40; a role to a sea 15; a status to a status 35; a sea to a sea 30. A sea to a status is printed, not asserted. Where hue cannot keep two things apart, form does: a sea is a round lettered disc, a tab, a time cell or an edge beside its name; a status is a slanted field with its word.');
  out('');
  // ---- zones ----
  out('## 4. The zone map');
  out('');
  out('For each screen, each zone, the role and tone it uses (Rev4.4), and the rule fragments the test matches against `subs.css`. A rule that uses a colour token must match a zone here whose roles include that token\'s role.');
  out('');
  const screens = [...new Set(ZONES.map((z) => z.screen))];
  screens.forEach((s) => {
    out('### ' + s);
    out('');
    out('| Zone | Role and tone | Rule fragments | Roles allowed |');
    out('| --- | --- | --- | --- |');
    ZONES.filter((z) => z.screen === s).forEach((z) => out('| ' + z.zone + ' | ' + z.use + ' | ' + z.frags.map((f) => '`' + f.replace(/\|/g, '\\|') + '`').join(', ') + ' | ' + (z.roles[0] === '*' ? 'all' : z.roles.join(', ')) + ' |'));
    out('');
  });
  return L.join('\n').replace(/\n+$/, '') + '\n';
}

module.exports = { ROLES, SHARED, ALIASES, RETIRING, NON_COLOUR, UNUSED, LINT_PENDING, FORMULA, ZONES, DOC, counts, roleOf, rolesOf, zoneOf, cssRules, usedTokens, build, envOf, valueOf, kind };

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : null;
    if (have !== text) { console.error('docs/submersibles-colour-roles.md differs from the tool output; run: node tracker/tools/subs-roles.js'); process.exit(1); }
    console.log('docs/submersibles-colour-roles.md is up to date');
  } else {
    fs.writeFileSync(DOC, text);
    console.log('wrote docs/submersibles-colour-roles.md (' + text.split('\n').length + ' lines)');
  }
}
