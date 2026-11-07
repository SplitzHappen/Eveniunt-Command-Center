# Notices

**Eveniunt Atelier** embeds the following third-party work. Their licences apply to those parts.

- **Raphael** — https://github.com/KonaeAkira/raphael-rs, commit `723b17ea7d1a719bba212944ebd357fe36b4ac08`, Apache License 2.0, © KonaeAkira and contributors. The crates `raphael-sim`, `raphael-solver` and `raphael-data` are compiled unchanged into the embedded WebAssembly module. `bridge/src/lib.rs` follows `raphael-gui/src/macros.rs` for macro text. The interface reuses strings from `raphael-translations/translations.toml`. No changes were made to Raphael's code.
- **Game data** (recipe, item and action names and values, crafting-log page order) — © SQUARE ENIX CO., LTD., via Raphael's data and `xivapi/ffxiv-datamining`.
- **Action icons** — the in-game crafting action icons for each of the eight jobs, © SQUARE ENIX CO., LTD., taken unchanged from Raphael's `assets/action-icons` folder (the same images raphael-xiv.com shows); identical images are stored once.
- **Fonts** — Fraunces, Atkinson Hyperlegible, IBM Plex Mono, Big Shoulders Display and Cinzel, embedded as WOFF2 from the @fontsource packages, under the SIL Open Font License 1.1.
- **Live guide engine** — `../src/engine/` (Eveniunt), the same engine as the Cosmic Exploration solver.

The full Apache 2.0 licence text is available at https://www.apache.org/licenses/LICENSE-2.0.
