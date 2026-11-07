# MONDAY OPEN: design contract (v3, original)

Written before any v3 code, Oct 11, 2026. The UI is fully original. It reuses no layout, components, colors or wording from the earlier kaverimeshram design.

## Contract

1. **Direction:** an exchange terminal for the weekend gap. The system is `ibm` from `~/.config/design-md` (Carbon) in its inverse Gray-100 theme: flat square-ish tiles with thin hairlines, one assertive blue accent, and dense data. It reads as a pro desk, not a landing page.
2. **Fonts:** IBM Plex Sans 400/500/600 for UI and body. IBM Plex Sans Condensed 600 for display and tile headers, so labels stay compact like a terminal. IBM Plex Mono 400/500 for every price, quantity, address, hash and countdown, with tabular figures. No serif anywhere. Link: `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap`
3. **Palette (CSS variables):** graphite canvas `#0d0f12`, tiles `#15181d` and `#1c2027`, hairline `#2a2f38`. One accent, Carbon blue `#4589ff`, used only for the primary action, focus and the live price line. Semantic colors: bid green `#42be65`, ask red `#fa4d56`, amber `#f1c21b` for windows that are counting down, cyan `#33b1ff` for sealed.
4. **Spacing:** 4px base. Scale 4/8/12/16/24/32/48. Tiles have 16px padding and a 1px gap between tiles (hairline grid).
5. **Layout:** a 3-pane terminal. A top bar with a ticker strip of live metrics. A left pane for order entry, holding the one primary action. A center pane with the price chart tile and the auction clock tile. A right pane with the event tape (every transaction, with an explorer link). Below: the fill blotter table, then three explainer tiles. On mobile the order is ticker, then order entry, chart, clock, blotter, tape, explainers.

## Token block

```css
:root {
  --canvas: #0d0f12; --tile: #15181d; --tile-2: #1c2027; --tile-3: #242a33;
  --hair: #2a2f38; --hair-strong: #3d4450;
  --ink: #f4f4f4; --ink-2: #c6c6c6; --ink-3: #8d8d8d;
  --accent: #4589ff; --accent-hover: #5c98ff; --accent-press: #2f6fe0; --on-accent: #ffffff;
  --bid: #42be65; --bid-bg: rgba(66,190,101,.14);
  --ask: #fa4d56; --ask-bg: rgba(250,77,86,.14);
  --amber: #f1c21b; --amber-bg: rgba(241,194,27,.14);
  --cyan: #33b1ff; --cyan-bg: rgba(51,177,255,.14);
  --r-1: 2px; --r-2: 4px; --r-pill: 999px;
  --shadow-tile: 0 0 0 1px var(--hair), 0 12px 32px rgba(0,0,0,.35);
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --t-12: 12px; --t-14: 14px; --t-16: 16px; --t-20: 20px; --t-28: 28px; --t-40: 40px;
}
```

Type scale: 12 labels, chips and tape · 14 body · 16 inputs · 20 tile titles · 28 ticker values · 40 the clearing price hero.

## Components

- **Ticker cell:** an uppercase 12px label, a 20 to 28px mono value and a delta chip. Cells are separated by hairlines.
- **Tile:** `--tile` background, a 1px hairline via `--shadow-tile`, `--r-2` radius, and a header row (condensed title plus a status chip).
- **Chip:** `--r-pill`, 12px, a tinted background plus a text label, always words: Bid, Ask, Sealed, Revealed, Filled, Refunded, Sealing window, Reveal window, Printed, Idle, Live, Model, Devnet.
- **Buttons:** primary (solid blue, full width in order entry, the only one), secondary (hairline outline), ghost (text). Bid/Ask is a toggle, green or red when selected.
- **Blotter:** a styled table with 12px uppercase headers, 14px mono cells aligned right, row hover `--tile-2`, status chips and truncated addresses that link to the explorer.
- **Tape:** a reverse-chronological list of transaction events with a time, a label and a hash link.

## Product rules from kamal (Oct 11, 23:03 IST)
Primary job: place a sealed weekend order and see the fair Monday clearing price. References: Uniswap-simple order entry, Hyperliquid-style zoned price view (structure only, nothing copied).
1. Lead with the clearing price and one primary action: the last uniform print is the 40px hero cell of the ticker; "Seal and run to the open" is the only accent-filled button.
2. Every number shows its consequence: order entry states "If Monday clears at or below $X you buy up to N shares at the single price; your limit is Z bps vs Friday close". Prints carry bps vs Friday; the clear shows shares crossed and your fill.
3. Semantic colour only: green = bid/filled, red = ask/below Friday, amber = live countdown. One accent (blue #4589ff, primary action + clearing price) and one deliberate secondary (teal #3ddbd9, phase timing and annotations; was #33b1ff, too close to the accent).
4. Plain-language confirm before sealing (inline panel: limit is hidden and final, escrow amount, refund rule). Distinct states: Waiting for your seal (mute), Live/pending (amber), Revealed (limits shown in blotter), Settled (green).
5. Trust: program, seeder, faucet and every auction/tx linked to Solana Explorer; timestamps on every print; Devnet badge in the top bar.
6. Charts: y-axis labels, Friday-close annotation, per-point date labels and hover titles; the cross chart marks the crossing quantity and price.
7. Type scale 12/14/16/20/28/40; measured on tile-2 #1c2027: ink 14.9:1, ink-2 9.6:1, ink-3 4.9:1; primary button text is #0d0f12 on #4589ff at 5.8:1 (white was 3.35:1 and failed).
