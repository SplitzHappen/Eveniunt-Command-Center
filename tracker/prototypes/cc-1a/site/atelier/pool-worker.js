// Gate 1A prototype: one thread of the Atelier's pool (a module worker loaded from a file, as the real
// 'mt/solver-worker.js'). Slot 0 of the shared memory is the counter, slot 1 the barrier.
self.onmessage = async (e) => {
  const { module, memory, id, n, iterations, work } = e.data;
  try {
    const inst = await WebAssembly.instantiate(module, { env: { mem: memory } });
    const i32 = new Int32Array(memory.buffer);
    // barrier: no thread starts until all n have arrived, so they provably run at the same time
    Atomics.add(i32, 1, 1);
    Atomics.notify(i32, 1);
    const deadline = Date.now() + 10000;
    for (;;) {
      const seen = Atomics.load(i32, 1);
      if (seen >= n) break;
      if (Date.now() > deadline) throw new Error('barrier timeout: ' + seen + ' of ' + n + ' threads arrived');
      Atomics.wait(i32, 1, seen, 50);
    }
    const t0 = performance.timeOrigin + performance.now();
    const add = inst.exports.add;
    for (let i = 0; i < iterations; i++) add(0, 1);
    let x = 0;
    for (let j = 0; j < work; j++) x += Math.sqrt(j);
    const t1 = performance.timeOrigin + performance.now();
    self.postMessage({ type: 'done', id, t0, t1, x });
  } catch (err) {
    self.postMessage({ type: 'error', id, error: String(err && err.message || err) });
  }
};
