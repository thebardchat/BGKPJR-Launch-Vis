# BGKPJR Launch Visualization

> **Try Claude free for 2 weeks** — the AI behind this entire ecosystem. [Start your free trial →](https://claude.ai/referral/4fAMYN9Ing)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue)](https://thebardchat.github.io/BGKPJR-Launch-Vis)
[![Core Simulations](https://img.shields.io/badge/Core%20Simulations-BGKPJR-green)](https://github.com/thebardchat/BGKPJR-Core-Simulations)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-ff5d01)](https://astro.build)

NASA-ready interactive 3D visualization of the **BGKPJR electromagnetic launch architecture** — full mission sequence from maglev rail through Gryphon atmospheric ascent to Kepler solar sail deployment, plus the complete Manna cargo pod comparison.

---

## What You'll See

| Section | What It Shows |
|---------|---------------|
| **3D Launch Visualizer** | Real-time animated mission sequence — scrub through all 4 stages, adjust playback speed |
| **Stage 1 — Maglev Rail** | 28.7 km evacuated superconducting tube, 3.9G sustained, Mach 3.5 exit in 23 seconds |
| **Stage 2 — Gryphon Ascent** | Wing deploy animation, Mach 3.5 → Mach 8 atmospheric climb, hybrid propulsion burn |
| **Stage 3 — Orbital Insertion** | Sub-orbital arc, circularization, 310 km operational altitude |
| **Stage 3 — Kepler Solar Sail** | 1,200 m² CP1 Polyimide sail unfurls, zero-propellant solar pressure propulsion |
| **Manna Pod Comparison** | Interactive Manna-H / Manna-I / Manna-B comparison + 4 WIP concept variants |
| **Cost Analysis** | Log-scale cost comparison vs. Falcon 9, SpaceX Dragon, CLPS |
| **Physics** | Tsiolkovsky, rail acceleration, solar sail equations with real BGKPJR numbers |

---

## Stack

| Tool | Purpose |
|------|---------|
| [Astro](https://astro.build) | Static site framework + islands architecture |
| [Svelte 5](https://svelte.dev) | Interactive island components |
| [Three.js](https://threejs.org) | WebGL 3D launch visualization |
| TypeScript | Type-safe physics data layer |
| GitHub Pages | Zero-cost static hosting |

---

## Run Locally

```bash
git clone https://github.com/thebardchat/BGKPJR-Launch-Vis.git
cd BGKPJR-Launch-Vis
npm install
npm run dev      # http://localhost:4322
npm run build    # static output to ./dist
```

---

## Related Repos

| Repo | Purpose |
|------|---------|
| [BGKPJR-Core-Simulations](https://github.com/thebardchat/BGKPJR-Core-Simulations) | Physics engine, GNC, trajectory math |
| [manna](https://github.com/thebardchat/manna) | Manna cargo pod design research |
| [manna-pods](https://github.com/thebardchat/manna-pods) | Extended pod concepts — Manna-F, M, X, T |
| [tug](https://github.com/thebardchat/tug) | Orbital tug concept |
| [tug-pro](https://github.com/thebardchat/tug-pro) | Tug pre-Phase A deep-dive site |

---

*Built by Shane Brazelton + Claude (Anthropic). Pre-Phase A concept — all physics values are calculated estimates, not peer-reviewed engineering data. Apache 2.0.*
