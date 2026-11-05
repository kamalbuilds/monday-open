# MONDAY OPEN: design audit (r1)

Design Score: B
AI Slop Score: B

Evidence: r1-1440.png, r1-390.png, full-r1-1440.png, full-r1-390.png (first visit). Live URL https://monday-open.pages.dev returned HTTP 200, and its deployed JS contains the footer string "illustrative" and literal "385" fixture values. Not exercised: hover, focus, click-through of Seal, motion, measured contrast, any state after an order is sealed. Judged as delivered, per brief.

## Design Score: B

Weighted 3.2 of 4.0 across eight assessable categories. Motion and Performance Feel are not assessed (stills only, no timing capture), so their 10% weight is removed rather than counted as passing. Letter bands used: A at 3.5+, B at 2.5+, C at 1.5+, D at 0.5+, F below. The skill names the letters but not the cut-offs, so these bands are my mapping.

The system holds together. The hero thesis is specific, the order ticket is the clear focal point, and the palette (deep green, gold, cream ticket, mint chart) reads as one system. It sits at B because the chart contradicts the price beside it, several figures read as live with no stated source, and the 390 hero leaves orphaned words.

Category grades (A=4, B=3, C=2, D=1; from A, each High finding drops one letter and each Medium drops half a letter):

| Category | Weight | Grade | Driver |
|---|---|---|---|
| Visual Hierarchy | 15 | A- | two heading treatments in the right column |
| Typography | 15 | B | mono in five slots; roughly 10px labels at 390 |
| Spacing & Layout | 15 | A- | right column about 150px longer than left at 1440 |
| Color & Contrast | 10 | A- | cohesive palette; footer and 10px mono labels look borderline, not measured |
| Interaction States | 10 | A- | accordion chevron and body disagree |
| Responsive | 10 | B | orphaned words in 390 hero; small stepper text |
| Content Quality | 10 | C | chart axis vs price (High); unsourced figures; empty dashes; run-on steps |
| AI Slop | 5 | B | see below |
| Motion | 5 | not assessed | stills only |
| Performance Feel | 5 | not assessed | no timing capture |

Weighted: 285 / 90 = 3.2.

## AI Slop Score: B

Not generated-looking in the way the banned list describes. No gradient text, no three-card feature grid, no emoji icons, no centred hero, no italic headings, one icon set, and the copy is specific to the product. It does read as a competent fintech-premium template: dark green with gold serif, a mono eyebrow over a serif headline, a "How it works" numbered stepper, a "Why Monday Open?" accordion, a "For judges" block, a "Business model" block. Each is a familiar stack. Grade is B, not A, because the stacked section template is the pattern a judge has most likely seen before, and the mono label register is spread across many small slots.

## Top findings (ranked)

1. **High, Content: chart contradicts the price.** At 1440 the TSLAx card shows Fri Close $382.50 and "weekend drift ±385 bps" beside a chart whose y-axis reads 240, 250, 260. The only disclaimer ("price chart is illustrative") is in the page footer. Fix: scale the axis to the quoted price band or remove numeric axis labels, and put the illustrative note on the card.

2. **Medium, Content: figures read as live with no source.** "4 sealed orders", "4 weekends run", "$372.80 last open print" and "±385 bps" appear with no origin and no demo tag on the card. The deployed bundle has "385" as literal values. A grep for the "$382.50" literal returned nothing, so the origin of the price figure is unresolved. Fix: either read these from devnet and show the read, or tag the card as a demo fixture.

3. **Medium, Interaction: accordion state disagrees with its content.** At 1440, "Why one price" and "What's on-chain" have down-chevrons (collapsed) with body text visible. "Why sealed" has an up-chevron and body. At 390 the same two items show collapsed with no body. One of these states is wrong. Fix: drive chevron and panel from one state value and check both widths.

4. **Medium, Content: the judges' steps are one run-on paragraph.** "For judges" puts steps 1, 2 and 3 inline in a single block. This is the demo instruction and the hardest part of the page to scan. Fix: an ordered list of three short lines.

5. **Medium, Responsive: orphaned words in the 390 hero.** Lines break as "Tokens trade all / weekend." and "Monday gets one fair / price.", leaving single words alone. Fix: `text-wrap: balance` on the h1, then re-check at 375 and 390.

6. **Medium, Content: empty stat row reads as broken.** "Your open print" shows four bare dashes with small labels above the fold, before any action. Fix: one line of state copy in that block saying what fills it and when.

7. **Medium, Typography: small text on mobile.** The 390 stepper descriptions and stat labels look about 10 to 11px (estimated from the capture, not measured). Fix: a 12px floor for body-scale text, or stack the stepper vertically under about 480px.

8. **Medium, Brand risk: the red "T" tile.** The red square with an italic T beside "TSLAx" is close to Tesla's mark treatment. Before a public demo, confirm rights or use a neutral ticker monogram. This is a flag for a legal check, not a legal opinion.

9. **Low, Hierarchy: two heading systems in the right column.** "How it works", "Your weekend book" and "Your open print" are cream; "Why Monday Open?", "For judges" and "Business model" are gold. Make the split a visible rule or drop it.

10. **Low, Restraint: DEVNET pill three times.** The header selector, the phase card and "For judges" each carry it. Drop the pills in the phase card and in "For judges".

11. **Low, Typography: mono register in five slots.** Eyebrow, ORDER TICKET label, FRI CLOSE, and both footer lines. Hallmark gate 38 caps an outlier face at two slots. Fix: keep mono on the eyebrow and footer only.

12. **Low, Spacing: uneven columns.** At 1440 the left column ends under the ticket about 150px above the right column's last card.

## What to keep

- Hero thesis: "Stocks close Friday. Tokens trade all weekend. Monday gets one fair price." Specific, and the gold third line carries the claim.
- Order ticket: strongest contrast on the page, one full-width CTA, burner wallet pre-funded. The demo path starts here and it reads.
- One icon set (shield, bar chart, link, wallet, chevrons), no emoji.
- Footer discloses the illustrative chart and devnet status.

## Hallmark slop-test (summary)

- Pass: 2 (no gradient text), 3 (no three-card grid), 6 (left-aligned hero), 7 (no pure black or white bases seen), 30 (one icon library, no emoji), 38a (no italic headings), 42 and 43 (nav and footer not default), 45 (no decorative ornament), 47 (no redrawn chrome), 49 (CTAs one line at both widths).
- Flags: 38 (mono in five slots, finding 11); 46 (figures without origin on the page, finding 2).
- Not evaluated from stills: 10 to 18 (microinteractions), 26 and 27 (focus states, reduced motion), 39 (input states), 40 and 41 (measured contrast), 50 to 57 (grid and sticky behaviour).

## Blind spots

Still captures of one state. Hover, focus, motion, measured contrast and the post-Seal state were not exercised. The figures in finding 2 are unresolved against devnet state.

## Scores

Hierarchy: 8
Specificity: 7
Craft/Execution: 6
Restraint: 6
Mobile: 6
Clarity of the demo path: 7
AVERAGE: 6.7 MIN: 6
