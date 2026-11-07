# MONDAY OPEN: 2-minute pitch

About 300 words. Speak at an easy pace.

**The problem (0:00 to 0:25)**
Tokenized stocks trade on Solana around the clock. The stock market doesn't. On Friday afternoon the market closes, but the token keeps trading all weekend on thin books with nothing to anchor it. Across 136 weekends TSLA has opened Monday a median 135 basis points from Friday's close, 377 at the 90th percentile. Then Monday morning arrives, and the fastest trader, usually a bot, takes that gap from everyone whose order was sitting in plain sight.

**The idea (0:25 to 0:55)**
MONDAY OPEN swaps that scramble for one fair price. All weekend, you place a sealed order. Only a fingerprint of your order and your deposit go on-chain, so nobody can see your limit. Before the open, everyone reveals. At the open, the program picks the single price that matches the most shares. Every filled order pays that same price, and anything left over is refunded.

**It works today (0:55 to 1:25)**
This is a real program on Solana devnet, with passing tests. Seal, reveal, clear and settle are all on-chain steps, and deposits sit in a program vault until settlement. On our site you press one button. Your order is sealed on-chain in about two seconds, and a full compressed weekend settles in about twenty. A seeded market keeps running, and the chart shows its real opening prints against Friday's close.

**Why this matters (1:25 to 1:40)**
Other teams treat the weekend gap as a risk to hedge. Afterhours, for example, forecasts reopening losses for lenders. We fix the price itself, so there is less gap left to hedge. A fair open price also makes every risk tool better.

**The business (1:40 to 1:50)**
Our plan is a small fee on every share that clears at the open. Venues and wallets that list tokenized stocks plug in the auction and share that fee.

**The ask (1:50 to 2:00)**
Solana is becoming the home of tokenized stocks. MONDAY OPEN gives them a fair Monday. Help us take it to mainnet.
