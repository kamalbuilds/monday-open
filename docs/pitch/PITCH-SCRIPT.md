# MONDAY OPEN: pitch script (Colosseum brief, max 2 minutes)

Brief: "Tell us what you're building, and tell us why you're the people to build it."
Spoken by Kamal, first person. About 255 spoken words, roughly 1 minute 50 seconds at a calm pace.
No personal claims; every fact in "Why us" is footnoted to a file in the repo.

---

Hi, I'm Kamal. I'm building MONDAY OPEN.

Here's the problem. Tokenized stocks like xStocks trade on Solana all weekend, but the real stock market is shut. So from Friday's close to Monday's open, those tokens trade on thin books with nothing to anchor them. Our research notes put the typical weekend move at around 385 basis points. Whoever is fastest, or whoever can see the book, gets the good price. Everyone else gets picked off.

MONDAY OPEN fixes the price itself. Over the weekend you place a sealed order. The chain only stores a hash and your escrow, so nobody can see your limit or trade against it. At the open, everyone reveals, and our Anchor program picks one clearing price, the price that matches the most shares. Every buyer and every seller fills at that same price. No race, no front running, and you never pay worse than your own limit.

It works today on devnet. You can open the site, press one button, and watch a sealed order go through seal, reveal, clear and settle in about 20 seconds, with every transaction on the explorer.

Why us? Two things you can check. First, we tested the idea before building it: in our offline replay of real weekend trading across five tokenized stocks, a sealed batch auction landed 73.2 basis points from the Monday open, against 123.3 for the fills traders actually got on the DEX.[^1] Second, it already runs: the Anchor program is live on devnet, its end-to-end test passes, and the site seals a real order on chain with one press.[^2]

Thanks for listening.

---
[^1]: `ethereum/projects/sunday-clear/DEPLOYMENT.md` line 10 and `README.md` line 44: "Harness offline replay (5 stocks, $3.75M): auction 73.2 vs DEX 123.3 bps." Caveat from the same file: a hindsight DEX VWAP scored 54.3 bps, but no trader could actually get that price.
[^2]: `sol/projects/monday-open/README.md` line 30 (`anchor test --skip-build`: 1 passing: create, seal, bad reveal rejected, reveal, clear at one price, settle with exact payouts, double settle rejected). Devnet program `BK1x...CusA` linked in the site footer.
