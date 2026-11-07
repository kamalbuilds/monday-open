# MONDAY OPEN: demo script (3 minutes or less, shot by shot)

Matches the terminal UI at https://monday-open.pages.dev (Solana devnet). Screen recording at 1440 wide.
Before recording: open the page once so the burner wallet exists, and check the "Burner wallet" panel shows at least 0.015 SOL (press "Pre-fund now" if not). One run spends about 0.012 SOL plus a refundable escrow.

| # | Time | On screen | Action | Voiceover |
|---|------|-----------|--------|-----------|
| 1 | 0:00-0:15 | Full page, top strip | Hold still | "This is MONDAY OPEN, a sealed weekend auction for tokenized stocks on Solana devnet. The big number is the last uniform clearing price, shown against Friday's close." |
| 2 | 0:15-0:35 | "Where bids met asks" chart | Hover the crossing dot | "This is a real seeded auction from devnet. Green is cumulative bids, red is asks. The program clears where they cross: one price for everyone." |
| 3 | 0:35-0:50 | Fill blotter, last seeded auction | Click one trader link, show Explorer tab, come back | "Every order, limit and fill is on chain. Every address links to the explorer." |
| 4 | 0:50-1:10 | Order entry | Keep Bid. Click +10bp, set quantity 2 | "I'm bidding a little above Friday's close. The line under the form tells me the consequence: I buy up to two shares at the single clearing price, never above my limit." |
| 5 | 1:10-1:20 | Seal button, confirm panel | Click "Seal and run to the open" | "Before anything is signed, it tells me in plain words: my limit is hidden and final, this much escrow is locked, and anything unfilled is refunded." |
| 6 | 1:20-1:30 | Confirm panel | Click "Confirm and seal" | "Confirm. A throwaway devnet wallet signs; no extension needed." |
| 7 | 1:30-1:55 | "Your auction" steps + Tape | Let it run; point at Seal turning amber | "My order and three seeded orders are sealed as hashes. The tape on the right streams each real transaction with a timestamp." |
| 8 | 1:55-2:15 | Steps reach Reveal and Clear | Point at the blotter as limits appear | "The weekend ends. Everyone reveals, and only now do the limits show up in the blotter. The program picks the price that crosses the most shares." |
| 9 | 2:15-2:35 | Clearing price hero, status "Settled" | Hold on the price and my fill | "Settled. This is my clearing price, how many shares crossed, and how far it is from Friday's close. Buyers and sellers all got this same price." |
| 10 | 2:35-2:50 | Tape, click a settle tx | Show Explorer, back | "Here's the settle transaction on the explorer: fills paid, the rest refunded from the vault." |
| 11 | 2:50-3:00 | Scroll to "How the auction works" | Hold | "Seal, reveal, clear, settle. One fair price at the Monday open. That's MONDAY OPEN." |

Fallback: if devnet is slow and the run stalls past 40 seconds, cut after shot 6 and narrate shots 2 and 3 (the seeded auction shows the same steps already settled).
