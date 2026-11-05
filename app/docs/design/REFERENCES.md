# MONDAY OPEN references

Captured 2026-10-10 with a refshot-equivalent Playwright script (`/tmp/mo-e2e/cap.mjs`: load, network idle, fonts.ready, 2.5s settle, rejects 404/challenge/blank; bhn deepsurge profile hung so refshot.py itself could not run). Two candidates were rejected as junk: nasdaq.com crosses page (404) and robinhood 24-hour market (404), plus cboe auctions (404).

## Jupiter TSLAx token page (north star, product screen)
- Files: ref-jup-xstocks-1440.png, ref-jup-xstocks-390.png, ref-jup-xstocks-tokens.json
- What it is: the live TSLAx trading screen on Solana. Chart center, swap ticket right rail, trade tape below.
- DNA: near-black slate `rgb(9,13,16)`, Inter 16px/500 for the symbol, 12px/500 chips, pill radius on search, lime CTA. Numbers carry the page: $382.51 headline, mark, UMC, liquidity row in compact mono-ish sans.
- Steal: ticket-on-the-right plus tape-below layout; the trade tape as proof the market is alive; signed green/red only on numbers.
- Don't take: Inter, lime-on-black crypto palette, pill everything, chart dominance. Our product has no continuous chart over the weekend; that's the point.

## Kraken xStocks landing
- Files: ref-kraken-xstocks-1440.png, ref-kraken-xstocks-390.png, ref-kraken-xstocks-tokens.json
- What it is: the issuer-distribution marketing page for xStocks ("Tokenized stocks. Trade 24/5.").
- DNA: h1 Kraken-Brand 48px/700, tracking -1px, near-white `rgb(241,239,255)` on deep aubergine card, 20px lede, centred hero, purple pill CTA, glassy 3D logo tiles.
- Steal: the 48px headline with negative tracking and a single short claim sentence; the "24/5" framing which is exactly the gap we fill (the weekend).
- Don't take: centred hero + purple CTA, glass 3D renders, purple anything (banned).

## xStocks.fi (Backed / Payward)
- Files: ref-xstocks-1440.png, ref-xstocks-390.png, ref-xstocks-tokens.json
- What it is: the xStocks protocol home, behind a legal interstitial.
- DNA: Geist Variable 64px/700 h1, green-teal brand on charcoal `rgb(24,26,29)`, 12px muted `rgb(141,147,155)` small print, stat strip (1165 stocks, $40B+, 24/7, 1:1).
- Steal: a deep green family is already xStocks' own visual territory, so a felt-green surface reads as "this is about xStocks" without copying their teal; the legal-first tone (plain statements of what is on-chain).
- Don't take: the big-metric stat strip template, teal gradient buttons, modal-on-load.

## Flighty (outside domain: a status that resolves at a known time)
- Files: ref-flighty-1440.png, ref-flighty-390.png, ref-flighty-tokens.json
- What it is: flight tracker; the product is a timeline of phases (Preflight, At the airport, After landing) that resolve to one truth.
- DNA: system 65px/700, tracking -1px, white canvas; phase segmented control at the bottom; notification cards with one fact each ("Gate changed", "Landed 22m early").
- Steal: the phase strip. Our run is Seal, Reveal, Clear, Settle; each step lights when the chain confirms it, the same way Flighty steps through a flight.
- Don't take: floating notification card collage, white SaaS canvas.
