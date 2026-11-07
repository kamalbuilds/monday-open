# MONDAY OPEN: pitch script (Colosseum brief, max 2 minutes)

Brief: "Tell us what you're building, and tell us why you're the people to build it."
Spoken by Kamal, first person. Spoken part is under 260 words, about 1 minute 50 seconds.
No prize claims. Every fact in "Why us" is footnoted to a source file.

---

Hi, I'm Kamal, and I'm building MONDAY OPEN.

Tokenized stocks like xStocks trade on Solana all weekend, but the real market is shut. From Friday's close to Monday's open, those tokens trade on thin books with nothing to anchor them. Whoever is fastest, or can see the book, gets the good price. Everyone else gets picked off.

MONDAY OPEN fixes the price itself. Over the weekend you place a sealed order. The chain only stores a hash and your escrow, so nobody can see your limit. At the open everyone reveals, and our program picks one clearing price, the one that matches the most shares. Every buyer and seller fills at that same price, never worse than their own limit.

Tools like Afterhours help lenders hedge the weekend gap. We work on the open price itself, and a fair open price makes any risk tool better.

Why us? Two things you can check. First, I tested the idea before building it. In a replay of 13 real weekends of tokenized stock swaps on Ethereum, a batch auction landed 73.2 basis points from the Monday open. Friday's close was 102.7 off, and the DEX fills were 112.4 off.[^1] Second, it already runs. The program is live on Solana devnet, its end to end test passes, and you can seal a real order from the site with one press.[^2]

Thanks for listening.

---
[^1]: `/Users/kamal/Desktop/agentic-tooling-selection/workflows/hackathon-selection/runs/worldsfair/ethereum-l1/replay/analyze.out` line 55 (`auction 73.2  dex 112.4  fri-close 102.7`), summarized in `RECOMMENDATION.md` line 13 of the same folder. Errors are weighted by auction-matched notional; only 40.6% of notional matched. Measured on Ethereum Uniswap v3 data, not Solana.
[^2]: Devnet program `BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA`. Test: `tests/monday-open.ts` ("creates, seals, rejects a bad reveal, reveals, clears at one price, settles"); passing run recorded in `README.md`.
