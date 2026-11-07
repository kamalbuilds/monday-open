# MONDAY OPEN

A sealed weekend batch auction on Solana that gives tokenized stocks (xStocks) one fair Monday-open price. Buyers escrow SOL, sellers escrow the stock token, and settlement delivers tokens to buyers and SOL to sellers at a single clearing price.

- Live demo: https://monday-open.pages.dev (Solana devnet, no wallet needed)
- Program (devnet): [`BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA`](https://explorer.solana.com/address/BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA?cluster=devnet)
- TSLAx devnet test mint: [`AGZEh6XxRYEmN5HZDYMVciYUFRCiSEhGkVsdDVXkM61T`](https://explorer.solana.com/address/AGZEh6XxRYEmN5HZDYMVciYUFRCiSEhGkVsdDVXkM61T?cluster=devnet) (6 decimals, 10^6 base units per share)
- Treasury: [`8y5bYbA6DWRhV5uvLPqEEhoiCQbVbNptiyaW3UPRy7LE`](https://explorer.solana.com/address/8y5bYbA6DWRhV5uvLPqEEhoiCQbVbNptiyaW3UPRy7LE?cluster=devnet)
- UI design: [kaverimeshram/monday](https://github.com/kaverimeshram/monday), wired to the program by us

## The problem

US stocks close on Friday afternoon. Their tokens keep trading all weekend on thin books with nothing real to anchor the price. On Monday morning the real market reopens, and whoever is fastest, usually a bot, trades against everyone whose weekend limit was sitting in plain view.

How big is the weekend move? Across the 136 weekends from Oct 2023 to Oct 2026, TSLA opened Monday a median 135 bps from Friday's close, with a mean of 178 bps and 377 bps at the 90th percentile (largest 1,196 bps). `node scripts/weekend-gap.mjs` recomputes it from Yahoo Finance daily bars (Friday close to the next Monday open, holiday weekends excluded) and writes the per-weekend rows to [`scripts/data/tsla-weekend-gap.csv`](scripts/data/tsla-weekend-gap.csv) with the summary in [`scripts/data/tsla-weekend-gap.summary.json`](scripts/data/tsla-weekend-gap.summary.json).

Demand signals: [Solana Foundation, "build something new with equities on Solana"](https://x.com/SolanaFndn/status/2098845926961852523) and [Julian Ma on batch auctions for tokenized equities](https://x.com/_julianma/status/2089357641759773112).

## The solution

1. **Seal (all weekend).** A trader commits `sha256(side, price, qty, salt, trader)` plus a SOL deposit. Nobody can see the limit or the side.
2. **Reveal (before the open).** Each trader opens their seal. The program rejects a reveal that doesn't match the hash, a buy that isn't fully escrowed in SOL, and a sell whose shares aren't in the seller's token account: a sell moves `qty` TSLAx into the auction's token vault in the reveal transaction.
3. **Clear (the open).** The program picks one price: the one that crosses the most shares, then the smallest imbalance, then the one nearest Friday's close. It refuses to clear if any revealed order is missing from the call. The heavier side is split by size with largest-remainder rounding and each order's exact fill is written on chain, so the heavy side's fills sum to the shares crossed.
4. **Settle.** Every fill trades at the clearing price. Buyers receive TSLAx and a SOL refund of the unspent escrow. Sellers receive SOL minus the fee and a TSLAx refund for the unfilled part. An order that never revealed gets its deposit back. Both vaults end at zero.

## Fee

`fee_bps` (10) and a treasury are set once in the `config` PDA by the program's upgrade authority and copied into each auction at creation. `settle` takes `fee_bps` of each seller's SOL proceeds, rounded down, and pays it to that treasury.

## What works today (verified Oct 12, 2026)

| Feature | Evidence |
|---|---|
| Anchor program on devnet | `solana program show BK1x...CusA -u devnet` |
| Clearing and rounding unit tests | `cargo test`: 7 passed, including `heavy_side_fills_sum_to_matched` (buys 5/5/5 against a sell of 10 fill 10 shares, floor-only rounding fills 9) |
| End-to-end integration tests | `anchor test --skip-build`: 3 passing (clear at one price with token delivery, seller proceeds minus fee and unfilled-leg refunds, the 5/5/5 rounding case ending with both vaults at zero, and an unbacked sell that cannot reveal) |
| Devnet proof | `node scripts/devnet-proof.mjs`: three buys of 2 against one escrowed sell of 4 clear at $383.00 x 4; buyers receive 2/1/1 TSLAx, the treasury receives the 10 bps fee (15,320 lamports) and the vault and token vault read zero |
| One-click demo on the live site | The page creates a burner in local storage, mints it TSLAx test tokens through the faucet function, then seals, reveals, clears and settles an order next to three seeded counter-orders |
| Burner wallet and faucet | `ui/functions/api/faucet.ts` signs a 0.024 devnet SOL drip or a 10 TSLAx mint and reads the faucet balance first, answering with a clear message when it is empty |
| Seeded rolling market | `scripts/seed.mjs` with 4 desk wallets; sell desks escrow TSLAx on every round |
| Live chart | The chart plots the real cleared seeded rounds against the Friday close (dashed line) once 2 or more exist |
| Explorer links | The ticket note opens your latest transaction. "Your weekend book" opens the demo auction account. |

## How it is built

- Settlement pairs native devnet SOL with the TSLAx devnet test mint. 1 price tick ($0.10 in the UI) per share is 1000 lamports, and 1 share is 10^6 token base units.
- The demo weekend lasts about 15 seconds, and the burner signs the 3 seeded counter-orders, so the page shows the mechanism end to end.
- A demo run costs about 0.012 SOL in account rent and fees, covered by the faucet drip.
- The clear call passes every revealed order as a writable remaining account, up to 24 per auction.
- The TSLAx mint authority is the faucet key, so the faucet function mints test tokens on request.

## How we differ from Afterhours

Afterhours (Crypto World's Fair) is "risk infrastructure for markets that never sleep". It forecasts reopening downside for 24/7 tokenized equities, maps that to lending exposure, and gives curators a hold or reduce decision. Its wedge is Robinhood Stock Tokens: it reports 32 of 35 feeds going silent over weekends across 8 weeks. Afterhours hedges the risk of the gap. MONDAY OPEN works on the price itself: one fair sealed clearing price at the open. The two fit together, because a fair open price is a better input for any risk engine.

## Go-to-market and distribution

We start with the weekend gap for one tokenized stock, then add more. The first users are holders and traders of xStocks on Solana who already trade over the weekend and lose to the Monday-morning race. The product is a contract, not a destination. Any Solana venue, wallet or xStocks distributor can call the program and show "seal your order for the Monday open" next to its normal order form, so reach comes from the places those traders already use. Market makers are the other side of the book. A sealed auction with one clearing price lets them quote without being picked off. Revenue is the 10 bps fee on seller proceeds that the program collects at settlement. Demand signals are public: the Solana Foundation asking builders for new equities products, and Julian Ma's post on batch auctions for tokenized equities.

## Repo map

- `programs/monday-open/src/lib.rs`: the Anchor program (config, create, commit, reveal, clear, settle) and the clearing, rounding and fee unit tests
- `tests/monday-open.ts`: validator integration tests
- `ui/`: the live frontend (React + Vite, design by kaverimeshram). `ui/src/chain.js` holds all chain logic: burner, faucet, token mint, one-click weekend, seeded book, open prints for the chart.
- `ui/functions/api/faucet.ts`: Cloudflare Pages function that signs a devnet SOL drip or a TSLAx mint
- `scripts/seed.mjs`: rolling seeded market. It resumes an interrupted round from `.seed-current.json` and runs only on devnet or localnet.
- `scripts/setup-devnet.mjs`: creates the TSLAx devnet test mint, the fee config and the funded treasury, and writes `scripts/devnet.json`
- `scripts/devnet-proof.mjs`: one crafted auction on devnet with read-backs of token balances, SOL deltas and the treasury fee
- `scripts/weekend-gap.mjs`: Friday close vs Monday open for a ticker from Yahoo Finance, with the CSV in `scripts/data/`
- `app/`: the first-generation frontend, superseded by `ui/`
- `docs/pitch/`: the pitch script

## Run it

```
cargo build-sbf --tools-version v1.52 --manifest-path programs/monday-open/Cargo.toml
anchor idl build -o target/idl/monday_open.json -t target/types/monday_open.ts
cargo test --manifest-path programs/monday-open/Cargo.toml
anchor test --skip-build
solana program deploy target/deploy/monday_open.so --program-id target/deploy/monday_open-keypair.json -u devnet
node scripts/setup-devnet.mjs
node scripts/devnet-proof.mjs
node scripts/seed.mjs --rounds 3 --commit 45 --reveal 90 --desks 4 --maxqty 2 --topmin 0.012 --topup 0.012
node scripts/weekend-gap.mjs
cd ui && npm install && npm run dev
# deploy: npx vite build && npx wrangler pages deploy dist --project-name monday-open --branch main
```

The seeder pays from `~/.config/solana/id.json` (devnet `GhyXbXu7y3DVptMiSPBri12rGMxJBKtex4hWSa6bfg9j`). The faucet function needs the `FAUCET_KEY` Pages secret (the faucet keypair as a JSON array), and that key is the TSLAx mint authority.

## Built before vs built during

Built before the hackathon window:
- Research notes in `sol/research` and `sol/docs`: signals, rival scan and the two evidence posts
- Shared tooling: Anchor 0.32, the Solana CLI, the cwf-pro-ui skill and `cwf-ui-gate.sh`, Playwright

Built during the hackathon (Oct 10 to 12, 2026):
- The Anchor program with its token escrow, exact fill allocation and fee, its unit and integration tests, and the devnet deploy
- The live UI's visual design is by kaverimeshram ([github.com/kaverimeshram/monday](https://github.com/kaverimeshram/monday)), kept as designed. We wired it to the program: order ticket, phase timeline, weekend book, open print, seeded book status, faucet button, and the live chart.
- The faucet function, the seed, setup, proof and weekend-gap scripts, our earlier `app/` frontend, the design references and critique, this README and the pitch
