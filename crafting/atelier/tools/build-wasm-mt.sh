#!/usr/bin/env bash
# Multi-core build of the Raphael bridge for the hosted app (GitHub Pages).
# Same flags as Raphael's own web build (.cargo/config_wasm.toml): atomics + shared memory + build-std on the
# toolchain Raphael pins (nightly-2026-05-10). Output: atelier/build-mt/ (ES-module glue for module workers).
# The page must be cross-origin isolated (COOP/COEP); the app's service worker adds those headers.
set -euo pipefail
cd "$(dirname "$0")/../bridge"
export RUSTFLAGS="-Ctarget-feature=+atomics,+bulk-memory,+simd128 -Clink-arg=--max-memory=4294967296 -Clink-arg=--shared-memory -Clink-arg=--import-memory -Clink-arg=--export=__wasm_init_tls -Clink-arg=--export=__tls_size -Clink-arg=--export=__tls_align -Clink-arg=--export=__tls_base -Clink-arg=--export=__heap_base"
cargo +nightly-2026-05-10 build --release --target wasm32-unknown-unknown --features threads -Z build-std=panic_abort,std --target-dir target-mt
OUT=../build-mt; rm -rf "$OUT"; mkdir -p "$OUT"
wasm-bindgen --target web --no-typescript --out-dir "$OUT" target-mt/wasm32-unknown-unknown/release/atelier_bridge.wasm
WASM_OPT=${WASM_OPT:-wasm-opt}
"$WASM_OPT" -O3 --enable-threads --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext --enable-mutable-globals \
  "$OUT/atelier_bridge_bg.wasm" -o "$OUT/atelier_bridge_bg.wasm"
ls -la "$OUT" "$OUT/snippets"/* 2>/dev/null | head
