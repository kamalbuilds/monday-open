# MONDAY OPEN

A sealed weekend batch auction on Solana that gives tokenized stocks (xStocks) one fair Monday-open price.

- Live demo: https://monday-open.pages.dev (Solana devnet, no wallet needed)
- Program (devnet): [`BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA`](https://explorer.solana.com/address/BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA?cluster=devnet)
- UI design: [kaverimeshram/monday](https://github.com/kaverimeshram/monday), wired to the program by us

## The problem

US stocks close on Friday afternoon. Their tokens keep trading all weekend on thin books with nothing real to anchor the price. On Monday morning the real market reopens, and whoever is fastest, usually a bot, trades against everyone whose weekend limit was sitting in plain view.

How big is the weekend move? Our pre-hackathon research notes put it at about ±385 bps from Friday close to Monday open (`sol/docs/TOP3.md`). The raw dataset behind that figure is not in this repo, so treat it as a team estimate, not a reproducible measurement.

Demand signals: [Solana Foundation, "build something new with equities on Solana"](https://x.com/SolanaFndn/status/2098845926961852523) and [Julian Ma on batch auctions for tokenized equities](https://x.com/_julianma/status/2089357641759773112).

## The solution

1. **Seal (all weekend).** A trader commits `sha256(side, price, qty, salt, trader)` plus an escrow deposit. Nobody can see the limit.
2. **Reveal (before the open).** Each trader opens their seal. The program rejects a reveal that doesn't match the hash, or a buy that isn't fully escrowed.
3. **Clear (the open).** The program picks one price: the one that crosses the most shares, then the smallest imbalance, then the one nearest Friday's close. It refuses to clear if any revealed order is missing from the call.
4. **Settle.** Every fill pays the same clearing price. The heavier side is filled pro rata. Everything else is refunded from the vault.

## What works today (verified Oct 11, 2026)

| Feature | Evidence |
|---|---|
| Anchor program on devnet | `solana program show BK1x...CusA -u devnet` |
| Clearing rule unit tests | `cargo test`: 3 passed |
| End-to-end integration test | `anchor test --skip-build`: 1 passing (create, seal, bad reveal rejected, reveal, clear at one price, settle with exact payouts, double settle rejected) |
| One-click demo on the live site | Headless run against monday-open.pages.dev: first on-chain write visible in 2.2 s, settled in 19.4 s, "Monday open printed $380.80: 2 shares crossed at one price, -44 bps vs Friday close. Your order: filled 1." |
| Burner wallet and faucet | The page creates a burner in local storage. `ui/functions/api/faucet.ts` signs a 0.012 devnet SOL drip, and the browser submits it. |
| Seeded rolling market | `scripts/seed.mjs` with 4 desk wallets. Oct 11 rounds printed $383.80 x 2 and $387.00 x 2. |
| Live chart | The chart plots the real cleared seeded rounds against the Friday close (dashed line) once 2 or more exist. Until then it shows an illustrative shape and says so. |
| Explorer links | The ticket note opens your latest transaction. "Your weekend book" opens the demo auction account. |

## Honest limits

- **Devnet only.** Settlement uses native devnet SOL: 1 price tick ($0.10 in the UI) per share is 1000 lamports. A real deployment would settle the xStock SPL token against USDC.
- **Compressed weekend.** The demo's weekend lasts about 15 seconds. Your burner also signs the 3 seeded counter-orders, so it shows the mechanism, not privacy between different people.
- **Rent is not reclaimed.** Order and auction accounts are not closed after settlement, so each demo run costs about 0.012 SOL in rent and fees. A `close_order` instruction is the next program change.
- **Stranded deposits.** An order that is sealed but never revealed keeps its deposit in the vault. There is no reclaim path yet, and two seeder rounds lost deposits this way when the process died mid-round.
- **Clear capacity.** The clear call passes every order as remaining accounts, max 24 per auction.
- **The seeder is not always on.** It needs devnet SOL. When it is stopped, the status panel says "Seeder paused".
- **The faucet has no rate limit.** Its devnet balance is small, and anyone can drain it.
- **Business model is a plan.** The basis-point fee described on the page is not in the program.

## How we differ from Afterhours

Afterhours (Crypto World's Fair) is "risk infrastructure for markets that never sleep". It forecasts reopening downside for 24/7 tokenized equities, maps that to lending exposure, and gives curators a hold or reduce decision. Its wedge is Robinhood Stock Tokens: it reports 32 of 35 feeds going silent over weekends across 8 weeks. Afterhours hedges the risk of the gap. MONDAY OPEN works on the price itself: one fair sealed clearing price at the open. The two fit together, because a fair open price is a better input for any risk engine.

## Business model (planned)

A small basis-point fee on the notional of every share that clears at the open. Venues, wallets and xStocks distributors integrate the auction so their users get a fair Monday price, and they share the fee.

## Repo map

- `programs/monday-open/src/lib.rs`: the Anchor program and clearing-rule unit tests
- `tests/monday-open.ts`: validator integration test
- `ui/`: the live frontend (React + Vite, design by kaverimeshram). `ui/src/chain.js` holds all chain logic: burner, faucet, one-click weekend, seeded book, open prints for the chart.
- `ui/functions/api/faucet.ts`: Cloudflare Pages function that signs a devnet drip
- `scripts/seed.mjs`: rolling seeded market. It resumes an interrupted round from `.seed-current.json` and refuses to run off devnet or localnet.
- `app/`: our first frontend. It has been replaced and is not deployed.
- `docs/pitch/`: the pitch script

## Run it

```
anchor build -- --tools-version v1.52
anchor idl build -o target/idl/monday_open.json -t target/types/monday_open.ts
cargo test --manifest-path programs/monday-open/Cargo.toml
anchor test --skip-build
node scripts/seed.mjs --rounds 3 --commit 45 --reveal 90 --desks 4 --maxqty 1 --topmin 0.0065 --topup 0.004
cd ui && npm install && npm run dev
# deploy: npx vite build && npx wrangler pages deploy dist --project-name monday-open --branch main
```

The seeder pays from `~/.config/solana/id.json` (devnet `GhyXbXu7y3DVptMiSPBri12rGMxJBKtex4hWSa6bfg9j`). The faucet function needs the `FAUCET_KEY` Pages secret (the faucet keypair as a JSON array).

## Built before vs built during

Built before the hackathon window:
- Research notes in `sol/research` and `sol/docs`: signals, rival scan, the weekend-drift estimate and the two evidence posts
- Shared tooling: Anchor 0.32, the Solana CLI, the cwf-pro-ui skill and `cwf-ui-gate.sh`, Playwright

Built during the hackathon (Oct 10 to 11, 2026):
- The Anchor program, its unit and integration tests, and the devnet deploy
- The live UI's visual design is by kaverimeshram ([github.com/kaverimeshram/monday](https://github.com/kaverimeshram/monday)), kept as designed. We wired it to the program: order ticket, phase timeline, weekend book, open print, seeded book status, faucet button, and the live chart.
- The faucet function, the seed script, the e2e script, our earlier `app/` frontend, the design references and critique, this README and the pitch
