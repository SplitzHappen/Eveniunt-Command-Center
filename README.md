# Eveniunt Network Command Center

A growing collection of free, offline tools for **Final Fantasy XIV**, built for the Eveniunt Academy.

**Website:** https://splitzhappen.github.io/Eveniunt-Command-Center/

## The app

**Eveniunt Command Center** is one installable app at the website's root: a home screen with the modules below (the Tracker and the Atelier today, more to come), one save shared by every module, and an **Install app** button in its header (on a phone, **Add to Home screen**). Each module opens as its own page at its own address, so the Tracker and the Atelier keep working exactly as before, installed or not, online or offline.

## Tools

### Eveniunt Atelier: crafting solver
An installable app built on [Raphael](https://github.com/KonaeAkira/raphael-rs)'s solver.
- **Everything Raphael does:** recipe and mission search, every solver option, and the in-game macro generator in all seven languages.
- **Expert recipes:** it checks whether a macro is truly reliable by replaying it against 3,000 random-condition crafts. If it isn't, a **live step-by-step guide** takes over and re-plans after every condition you report.
- **Also included:** an automatic food and medicine check, Cosmic Exploration tiers and mission-class badges, the full crafting log in game order, and 20 FFXIV-inspired themes.
- **Open it:** https://splitzhappen.github.io/Eveniunt-Command-Center/atelier/
  - **Install it:** click **Install app** in the page header, or the install icon in Chrome or Edge's address bar. On a phone, use **Add to Home screen**.
  - After the first visit it works fully offline.
  - When it runs as the installed or hosted app, the solver uses several CPU cores.
- **Prefer a single file?** Download `index.html` from the Atelier and open it from your computer. It works offline on one CPU core.

### Eveniunt Tracker: completion tracker
An installable app that tracks everything the game has to offer for **up to eight characters side by side**.
- **About 41,500 entries in 98 lists:** collections, the full quest journal, achievements, every log, duties, FATEs, the Hunt, field operations, Island Sanctuary, travel unlocks and job levels, grouped the way the game groups them.
- **Unobtainable entries** (time-limited only, no longer obtainable, or unknown) carry an ✕ and are left out of totals; one click on any row overrides the mark either way. Entries that do not apply to one character (for example another city's starting quests) can be marked for that character only.
- **Bring your progress:** imports FFXIV Completionist app saves (ticks, "X" marks and job levels; anything that cannot be placed exactly is listed), backup files and transfer codes.
- **Online, optional:** refreshes from public character data on FFXIV Collect and asks you whenever it disagrees with your ticks; syncs through the app's own folder in your OneDrive, signing in once per device (the site owner runs a small free helper that keeps the sign-in alive; `tracker/helper/README.md`).
- **Open it:** https://splitzhappen.github.io/Eveniunt-Command-Center/tracker/ (install it from the page header; works offline after the first visit), or download `index.html` and open it from your computer.

### Cosmic Exploration solver
Step-by-step guides for Cosmic Exploration missions: Sinus Ardorum, Phaenna, Oizys and Auxesia. Open them from the website, or read `crafting/docs/USER_README.md`.

## Layout

| Path | Contents |
| --- | --- |
| `tracker/command-center/site/` | The Eveniunt Command Center app (the website's root): shell, site-wide service worker, manifest and icons; source and checks in `tracker/command-center/` |
| `crafting/atelier/` | Eveniunt Atelier: source (`src/`, `bridge/`, `tools/`, `tests/`, `data/`), the built offline file (`dist/`) and the installable app (`site/`) |
| `tracker/` | Eveniunt Tracker: source (`src/`, `tools/`, `tests/`, `data/`), the built offline file (`dist/`) and the installable app (`site/`); see `tracker/README.md` |
| `crafting/src`, `crafting/tools`, `crafting/tests`, `crafting/docs` | The Cosmic Exploration solver and the shared step-by-step engine (`crafting/src/engine/`) |
| `.github/workflows/pages.yml` | Publishes the website to GitHub Pages on every push and every hour (fresh events list and Lodestone news for the Tracker) |

Build and test steps: `crafting/atelier/README.md` and `crafting/README.md`.

## Licence and credits

This project's own code is licensed under the **Apache License 2.0** (`LICENSE`). Third-party notices, including Raphael's, are in `NOTICE`.

FINAL FANTASY XIV materials are © SQUARE ENIX CO., LTD. This is a free, non-commercial fan project, not affiliated with Square Enix.
