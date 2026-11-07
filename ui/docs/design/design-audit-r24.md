## Design review: MONDAY OPEN, round 24

**Inputs:** `r24-1440.png`, `r24-390.png`, both full-page captures, and `REFERENCES.md`. I scored only what the screenshots show. I did not click anything or check any live state.

### Scores

| Axis | Score | Basis |
|---|---|---|
| Hierarchy | 8 | The $387.00 last print is the loudest element, and the blue CTA is the only filled button. Order entry sits on the left, as the references said it would. The duplicated figures (below) weaken the focus a little. |
| Specificity | 9 | Nothing on the page could belong to another product: a bid/ask step chart crossing at the clearing price, uniform prints plotted as lollipops against the dashed Friday close line, limits in bps, the scaled devnet escrow line, real truncated addresses, and the Seal/Reveal/Clear/Settle track. The numbers check out against each other: 372.80 vs 382.50 is -254 bps, and 387.00 vs 382.50 is +118 bps. |
| Craft/Execution | 7 | The base is clean: Plex Sans and Mono, mono numbers, consistent row rhythm, a well-aligned blotter. But the bottoms of the three columns at 1440 don't line up. Order entry has about 90px of dead space, and Tape has about 150px of empty panel below Faucet. The Seal phase cell uses teal, which is a second accent next to Carbon blue. The depth chart's x-axis ("1", "2") has no unit. "SOL." wraps onto its own line in the escrow note. |
| Restraint | 7 | There are no decorative tricks, but too much repeats. $387.00 appears 5 times above the How-it-works section. "Last seeded auction #3" appears twice and the C6tE...aF95 link three times. The blotter summary repeats the ticker (+118 bps, shares crossed). There are 9 panels for one action. |
| Mobile | 7 | Order entry comes first and the CTA is above the fold at y≈560. The ticker sensibly drops to 3 cells and the blotter drops its Status column. However, Terminal, Blotter and Method vanish from the nav with no menu. Chart axis labels shrink to roughly 9px, and the Friday-close legend wraps awkwardly beside the chart title. |
| Clarity of demo path | 8 | There is one CTA, a "Try it in 20 seconds" block, a phase track with timings, and a "Waiting for your seal" pill. The burner wallet sends mixed signals: it shows 0.000 SOL with "needs about 0.015", plus a "Pre-fund now" button, plus a "Tops up on run" pill. A judge can't tell whether to click Pre-fund first. |

**Design Score: B**
**AI Slop Score: A** (no gradient text, floating pills, ghost numbers, stat-grid filler or marketing hero; the interface follows exchange conventions and is specific to this domain)

### Top 3 issues

1. **On mobile, progress happens off-screen.** At 390px the "Your auction" track sits about 700px below "Seal and run to the open". After a tap, the visible area changes only if the button itself changes. Fix: on mobile, put the 4-segment track directly under the CTA, or scroll to it on submit. At 1440 it is already above the fold.

2. **The same figures repeat until they lose meaning.** The clearing price, the auction link and the "#3" label each appear 3 to 5 times. Fix: keep $387.00 in the ticker and at the depth-chart crossing only. Cut the blotter's side summary down to the two facts that appear nowhere else ("Orders filled / refunded 4 / 0", "Fills at or better than limit 4 of 4"). Keep one auction link per panel group.

3. **The wallet's funding message contradicts itself, and the layout edges are ragged.** Pick one message. If the faucet tops up on run, drop the "Pre-fund now" button or make it secondary, and replace "0.000 / needs 0.015" with "Funded automatically when you seal." Separately, make the three columns end at the same line at 1440: let Tape grow, or let the blotter rise into the gap. Return the Seal phase cell to the Carbon blue accent.

**Blind spot:** I judged static frames only. I could not see hover or focus states, the post-seal animation, or whether the mobile CTA changes state after a tap.

SCORES avg=7.7 min=7
