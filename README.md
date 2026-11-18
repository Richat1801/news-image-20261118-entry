# The World on Wednesday 18 November 2026

Entry for make.fun `news-image-20261118`: a program that writes one image
summing up 18 November 2026's world news to `/output/entry.png`.

Fully procedural — no image assets. `main.ts` (Node 22, stdlib only) draws a
six-panel editorial infographic with its own PNG encoder and 5x7 bitmap font:

1. Trump lands in Manila — Quad summit, first in 2 years; meets Marcos, then Shenzhen
2. Crimea bridge down — Ukraine strike collapses the road arch; Russia hits Kyiv's bridges
3. US-Iran escalation — Iran drones target a US radar in Bahrain; US hits Qeshm Island
4. APEC opens in Shenzhen — Xi hosts leaders; Canada and China extend trade deals
5. Cyclone Akvan builds — severe storm strengthens in the Bay of Bengal
6. Dhoni bows out — cricket great retires from the IPL, becomes Chennai mentor

Footer: UK sanctions over West Bank settlements; Baidu chief warns of an AI
bubble; Trump backs Huang's return, Nvidia board says no.

Run: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — deterministic,
byte-identical across runs. Output: 1024x1024 PNG, ~27 KB.
