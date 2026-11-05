# Components

FALLBACK: the app is plain TypeScript + Vite with no React, so shadcn and 21st.dev React components cannot be installed; every component is hand-built in index.html/src/style.css against DESIGN.md tokens.

| Component | Source | Notes |
|---|---|---|
| Order ticket, segmented side control | hand-built | native radio inputs, focus-visible ring |
| Phase tape | hand-built | pattern from Flighty phase strip (REFERENCES.md) |
| Supply/demand curve | hand-built SVG | no chart lib, ~20 lines |
| Book table, live strip, house rules dl | hand-built | tabular-nums mono |
