#!/usr/bin/env bash
# Build the Raphael bridge to an optimized WebAssembly module + no-modules JS glue.
# Needs: rustup stable with wasm32-unknown-unknown, wasm-bindgen-cli 0.2.100,
#        binaryen wasm-opt (npm binaryen@123.0.0). Output: atelier/build/
set -euo pipefail
cd "$(dirname "$0")/../bridge"
RUSTFLAGS="-Ctarget-feature=+simd128,+bulk-memory" cargo build --release --target wasm32-unknown-unknown
OUT=../build; mkdir -p "$OUT"
wasm-bindgen --target no-modules --no-typescript --out-dir "$OUT" target/wasm32-unknown-unknown/release/atelier_bridge.wasm
WASM_OPT=${WASM_OPT:-wasm-opt}
"$WASM_OPT" -O3 --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext --enable-mutable-globals \
  "$OUT/atelier_bridge_bg.wasm" -o "$OUT/atelier_bridge_bg.wasm"
ls -la "$OUT"
