# Eveniunt Network Command Center

A growing collection of free, offline tools for **Final Fantasy XIV**, built for the Eveniunt Academy.

**Website:** https://splitzhappen.github.io/Eveniunt-Command-Center/

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

### Cosmic Exploration solver
Step-by-step guides for Cosmic Exploration missions: Sinus Ardorum, Phaenna, Oizys and Auxesia. Open them from the website, or read `crafting/docs/USER_README.md`.

## Layout

| Path | Contents |
| --- | --- |
| `web/` | The Command Center front page |
| `crafting/atelier/` | Eveniunt Atelier: source (`src/`, `bridge/`, `tools/`, `tests/`, `data/`), the built offline file (`dist/`) and the installable app (`site/`) |
| `crafting/src`, `crafting/tools`, `crafting/tests`, `crafting/docs` | The Cosmic Exploration solver and the shared step-by-step engine (`crafting/src/engine/`) |
| `.github/workflows/pages.yml` | Publishes the website to GitHub Pages |

Build and test steps: `crafting/atelier/README.md` and `crafting/README.md`.

## Licence and credits

This project's own code is licensed under the **Apache License 2.0** (`LICENSE`). Third-party notices, including Raphael's, are in `NOTICE`.

FINAL FANTASY XIV materials are © SQUARE ENIX CO., LTD. This is a free, non-commercial fan project, not affiliated with Square Enix.
