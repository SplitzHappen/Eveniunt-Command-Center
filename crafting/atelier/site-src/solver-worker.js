// Eveniunt Atelier — multi-core solver worker (hosted app only).
// Loads Raphael's multi-threaded WebAssembly build (same flags as raphael-xiv.com) and starts its thread pool.
// Message protocol matches the single-core worker in atelier.js: {type:'init', threads} then {id, req}.
import init, * as bridge from './atelier_bridge.js';
let ready = null;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'init') {
    ready = (async () => {
      await init({ module_or_path: new URL('./atelier_bridge_bg.wasm', import.meta.url) });
      await bridge.initThreadPool(d.threads);
    })();
    try { await ready; self.postMessage({ type: 'ready', threads: d.threads }); }
    catch (err) { self.postMessage({ type: 'init-failed', error: String(err) }); }
    return;
  }
  await ready;
  let last = 0;
  try {
    const out = bridge.solve(d.req,
      (n) => { const now = Date.now(); if (now - last > 120) { last = now; self.postMessage({ type: 'progress', id: d.id, nodes: n }); } },
      (acts) => { self.postMessage({ type: 'partial', id: d.id, actions: Array.from(acts) }); });
    self.postMessage({ type: 'done', id: d.id, out });
  } catch (err) {
    self.postMessage({ type: 'done', id: d.id, out: JSON.stringify({ error: String(err) }) });
  }
};
