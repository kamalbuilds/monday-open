# Components (ui/, v3 terminal)

All components are hand-built in `src/main.jsx` and `src/styles.css` against the tokens in `docs/design/DESIGN.md` (Carbon g100 structure from `~/.config/design-md/designs/ibm.md`). Icons: lucide-react.

| Component | Where | Notes |
|---|---|---|
| Ticker cell | `Ticker` | label, mono value, delta chip; hairline-separated grid |
| Tile (`.tile.card`) | every pane | surface, hairline shadow, header row with status chip |
| Chip | `Chip` | bid / ask / amber / cyan / mute, always with words |
| Order entry | `OrderEntry` | bid/ask toggle, limit with bps-vs-Friday suffix, ±bp nudges, qty stepper, escrow summary, the single primary button |
| Open-print plot | `Chart` | stem plot of real seeded clearing prices vs a dashed Friday-close line; no simulated data |
| Auction clock | `Clock` | 4-segment phase track plus the clearing-price hero |
| Tape | `Tape` | your run's transactions (explorer links) above the seeded print history |
| Blotter | `Blotter` | styled table with status chips, hidden limits until reveal |
| Method tiles | `Method` | mechanism, judge path, revenue model (marked Model), weekend rationale |

FALLBACK: no 21st.dev or shadcn components were pulled because the terminal needs a dense, square, Carbon-style grid that those card-first kits don't provide. Every piece is small and built directly on the tokens.
