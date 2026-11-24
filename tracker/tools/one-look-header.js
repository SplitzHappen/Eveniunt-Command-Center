'use strict';
// The one header of the Command Center, the Tracker and the Atelier (docs/one-look-foundation-spec.md, section 4).
// Not shipped: the three builds call fill() on their page source. A page marks its header with
//   <!--ol-header word="Lists" here="lists" home="../" href="./" label="Lists" cls="lists-mast" menu="static"--> the page's own tools <!--/ol-header-->
// word: the wordmark's word; here: the current page of the nav (home, tracker, atelier, submersibles, lists, settings or none);
// home: the way to the Command Center's front page from this page ("./" or "../"); href: where the wordmark goes; act: its data-act;
// label: its accessible name; cls: legacy classes kept for the checks that read them; menu: "static" draws the Main menu link and the
// nav in the markup, "runtime" leaves them to the page's hosted-only code (the downloaded single file has neither).
const MODS = [['home', 'Home', ''], ['tracker', 'Tracker', 'tracker/'], ['atelier', 'Atelier', 'atelier/'], ['submersibles', 'Submersibles', 'submersibles/'], ['lists', 'Lists', 'lists/'], ['settings', 'Settings', '#settings']];
// the Main menu icon (stroked, no text symbol): an arrow to a grid of four squares
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 3 12l6 6"/><rect x="12" y="5" width="4" height="4"/><rect x="17" y="5" width="4" height="4"/><rect x="12" y="11" width="4" height="4"/><rect x="17" y="11" width="4" height="4"/></svg>';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function menuLink(home, isHome) {
  return isHome
    ? '<a class="ol-menu" href="' + esc(home) + '" aria-current="page">' + ICON + '<span class="cc-txt">Main menu</span></a>'
    : '<a class="ol-menu cc-back" href="' + esc(home) + '" data-cc-back="1" aria-label="Back to the Command Center main menu">' + ICON + '<span class="cc-txt">Main menu</span></a>';
}
function navHtml(home, here, hidden) {
  const prefix = home === './' ? '' : home;
  return '<nav class="ol-nav switcher" aria-label="Command Center"' + (hidden ? ' hidden' : '') + '>' +
    MODS.map(([id, name, path]) => '<a href="' + (id === 'home' ? esc(home) : esc(prefix + path)) + '" data-module="' + id + '"' + (id === here ? ' aria-current="page"' : '') + '>' + name + '</a>').join('') + '</nav>';
}
function header(a, tools) {
  for (const k of ['word', 'here', 'home', 'href', 'menu']) if (a[k] == null) throw new Error('ol-header: missing ' + k);
  if (a.menu !== 'static' && a.menu !== 'runtime') throw new Error('ol-header: menu must be static or runtime');
  const isStatic = a.menu === 'static', isHome = a.here === 'home' || a.here === 'settings';
  return '<header class="ol-hdr' + (a.cls ? ' ' + esc(a.cls) : '') + '" data-ol-hdr><div class="ol-hdr-in">' +
    (isStatic ? menuLink(a.home, isHome) : '') +
    '<a class="ol-mark" href="' + esc(a.href) + '"' + (a.act ? ' data-act="' + esc(a.act) + '"' : '') + ' aria-label="' + esc(a.label || a.word) + '">' +
    '<span class="ol-mk-top">Eveniunt</span><span class="ol-mk-word">' + esc(a.word) + '</span><span class="ol-mk-gauge" aria-hidden="true"><i></i><i></i><i></i></span></a>' +
    '<div class="ol-tools mast-tools">' + tools.replace(/^\s*\n|\s+$/g, '') + '</div>' +
    navHtml(a.home, a.here, !isStatic) + '</div></header>';
}
function fill(html) {
  let n = 0;
  const out = html.replace(/<!--ol-header\s+([^>]*?)-->([\s\S]*?)<!--\/ol-header-->/g, (m, attrs, tools) => {
    const a = {}; attrs.replace(/(\w+)="([^"]*)"/g, (x, k, v) => { a[k] = v; });
    n++; return header(a, tools);
  });
  if (!n) throw new Error('ol-header: no marker in the page');
  return out;
}
module.exports = { fill, header, ICON, MODS };
