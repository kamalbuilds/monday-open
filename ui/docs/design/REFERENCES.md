# MONDAY OPEN (ui/, v3 terminal) references

References captured on 2026-10-10 with Playwright (load, network idle, fonts.ready; junk pages rejected). v3 is an original design; these show where it sits in its domain and what it deliberately does differently.

## Jupiter TSLAx token page (product screen)
- Files: ref-jup-xstocks-1440.png, ref-jup-xstocks-390.png, ref-jup-xstocks-tokens.json
- Live TSLAx trading on Solana: chart in the centre, swap ticket on the right rail, trade tape below. Slate `rgb(9,13,16)`, Inter, lime CTA.
- v3 takes the trader's grammar (entry, chart, tape), but puts entry on the left as the first thing you act on. It plots discrete uniform prints rather than a continuous line, because an auction has no continuous price.

## Kraken xStocks landing
- Files: ref-kraken-xstocks-1440.png, ref-kraken-xstocks-390.png, ref-kraken-xstocks-tokens.json
- Marketing hero, Kraken-Brand 48px/700 on aubergine, centred, purple pill CTA.
- v3 has no marketing hero at all. The first viewport is the working terminal with a ticker strip, because judges should act within seconds.

## xStocks.fi
- Files: ref-xstocks-1440.png, ref-xstocks-390.png, ref-xstocks-tokens.json
- Geist 64px/700, teal-green brand on charcoal `rgb(24,26,29)`, stat strip.
- v3 keeps the idea of a stat strip (the ticker), but uses graphite with one Carbon blue accent. Green and red are reserved for bid/ask direction, as on a real exchange.

## Flighty (outside domain)
- Files: ref-flighty-1440.png, ref-flighty-390.png, ref-flighty-tokens.json
- A status that resolves at a known time, shown as phases.
- v3's auction clock is a 4-segment track (Seal, Reveal, Clear, Settle) that fills as the chain confirms each step.
