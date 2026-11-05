# MONDAY OPEN: 2-minute pitch

(About 340 words. Speak briskly.)

**The problem (0:00 to 0:30)**
Tokenized stocks like xStocks trade on Solana around the clock. The real stock market does not. From Friday's close to Monday's open, the token keeps trading on thin books with no underlying price to anchor it. We measured the result: about 385 basis points of drift, up or down, over a weekend. Then Monday comes, and whoever is awake first, usually a bot, takes the gap from everyone else.

**The idea (0:30 to 1:00)**
MONDAY OPEN replaces that scramble with one fair price. All weekend, traders place sealed orders. Only a hash and an escrow deposit go on-chain, so nobody can see your limit. When the weekend ends, every order is revealed. At the open, the program picks one clearing price, the price that crosses the most shares, and every filled order pays that same price. The rest is refunded.

**It works today (1:00 to 1:30)**
This is a real Anchor program on Solana devnet, with tests. Commit, reveal, clear and settle are all on-chain instructions, and escrow sits in a program vault until settlement. On our site, one click runs a full compressed weekend in about 20 seconds: your order is sealed within about 2 seconds, then revealed, cleared and settled, with every step visible in the explorer.

**Why this, not risk tools (1:30 to 1:40)**
Others in this fair attack the same weekend gap from the risk side. Afterhours, for example, forecasts reopening downside for Robinhood Stock Tokens and gives lending curators a hold or reduce decision. That hedges the gap. We remove it at the source: one fair sealed clearing price at the open, so there is less gap left to hedge.

**The business (1:40 to 1:50)**
We charge a small fee in basis points on every share that clears at the open. Venues and wallets that list tokenized stocks integrate the auction so their users get a fair Monday price, and they can share the fee.

**The ask (1:50 to 2:00)**
Solana is becoming the home of tokenized stocks. MONDAY OPEN gives them a fair open. We'd like your support to take it to mainnet.
