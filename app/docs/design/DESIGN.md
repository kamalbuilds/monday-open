# MONDAY OPEN design system

Art direction: a trading-floor order desk at the opening bell. Baize green felt, brass for the one thing that matters (the open print and the primary action), and an order ticket on paper stock; it should feel like filling a ticket and handing it to the pit, not like a crypto swap.

Distinct from SEALED CALL and the last 8 design-log entries: macrostructure "ticket desk" (ticket left, phase tape + book right, house-rules ledger), theme felt green / brass / ticket paper, display Newsreader, accent #D4A24C.

## Type (two families + mono for numbers)
- Display: Newsreader 700, 44px desktop / 32px mobile, tracking -0.02em. Reason: a newsprint serif reads as "market open headline"; not Fraunces/Instrument (banned defaults).
- Body/UI: IBM Plex Sans 15px/1.55. Reason: financial-terminal heritage, not Inter.
- Numbers, labels, tables: IBM Plex Mono, tabular-nums everywhere a number can change.
- Small caps labels: 11-12px mono, uppercase, tracking .1em.

## Colour (70/20/10)
- 70 surface: felt #10261F, felt-2 #163329, lines #2A4A3E / #1F3A30
- 20 content: paper #F3ECDC (text + ticket stock), soft #C9D3CC, muted #8FA79C, ink #1D1A14 on paper
- 10 accent: brass #D4A24C. One job: marks what you act on or what printed (CTA text, current step, open line on the curve, your own row). Up #5FBF8A / down #E0775B only on buy/sell numbers and curves.

## Space, radius, motion
- 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 80 (CSS vars --space-3xs … --space-4xl).
- Radius 4px only.
- Motion: background-color 150ms on button only; steps light on chain confirmation (state change, not animation). prefers-reduced-motion disables all transitions.

## Components
- Order ticket (paper card, segmented Buy/Sell, mono inputs, felt button)
- Phase tape (4 numbered steps, top rule turns brass then green)
- Open print (serif price, mono meta, supply/demand step curve in SVG)
- Book table (mono, tabular, your row in brass)
- Live rolling book strip (left rule, label/value pairs)
- House rules ledger (dl, 2 columns)

## Refusals
No purple, no gradients, no glass/blur, no glow, no pills, no 3 equal cards, no stat strip, no centred hero, no em dashes in copy, no emoji icons, no Inter/Roboto/Fraunces.
