# MONDAY OPEN

A sealed weekend batch auction on Solana that gives tokenized stocks (xStocks) one fair Monday-open price.

Stocks close Friday; their tokens keep trading all weekend on thin books, and drift about ±385 bps (our measurement, Friday close to Monday open) before the real market reopens. MONDAY OPEN collects sealed orders over the weekend and clears all of them at one uniform price at the open, so nobody can trade against a visible limit or race the Monday gap.

- Live demo: https://monday-open.pages.dev (Solana devnet, one click, first on-chain write in about 1-2 s, full seal-to-settle about 20 s)
- Program (devnet): `BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA`
- Evidence: [Solana Foundation on xStocks](https://x.com/SolanaFndn/status/2098845926961852523), [Julian Ma on weekend pricing](https://x.com/_julianma/status/2089357641759773112)

## How it works

| Step | Instruction | What is public |
|---|---|---|
| Seal (weekend) | `commit_order(commitment, deposit)` | sha256(side, price, qty, salt, trader) and an escrow deposit in a program vault PDA |
| Reveal (before the open) | `reveal_order(side, price, qty, salt)` | the order; rejected if the hash doesn't match or a buy is under-escrowed |
| Clear (the open) | `clear()` with every order as remaining accounts | one price: max matched volume, then min imbalance, then nearest Friday close; refuses if any revealed order is left out |
| Settle | `settle()` per order | fills paid at the clearing price, heavy side pro rata, everything else refunded |

Settlement is native devnet SOL: 1 price tick per share = 1000 lamports. The app quotes 1 tick = $0.10 to keep devnet escrow small. Real deployment would settle the xStock SPL token against USDC.

## Repo

- `programs/monday-open/src/lib.rs`: Anchor program (+ Rust unit tests of the clearing rule)
- `tests/monday-open.ts`: validator integration test (create, seal 4, early/bad reveal rejected, partial clear rejected, clears at $103 x 10, exact payouts, double settle rejected)
- `ui/`: the live frontend. React + Vite UI designed by [kaverimeshram](https://github.com/kaverimeshram/monday), wired to the devnet program in `ui/src/chain.js` (burner wallet, faucet, one-click compressed weekend, seeded rolling book). Deployed to Cloudflare Pages project `monday-open`. `ui/functions/api/faucet.ts` signs a small devnet drip (the public devnet RPC blocks Cloudflare egress, so the browser submits it)
- `app/`: our first frontend (superseded; kept for reference, not deployed)
- `scripts/seed.mjs`: rolling seeded market. 4 desk wallets run back-to-back weekend auctions (seal, reveal, clear, settle), resume an interrupted round from `.seed-current.json`, and refuse to run off devnet/localnet

## Run it

```
anchor build -- --tools-version v1.52        # indexmap needs edition2024; default platform-tools cargo is 1.84
anchor idl build -o target/idl/monday_open.json -t target/types/monday_open.ts
cargo test --manifest-path programs/monday-open/Cargo.toml   # 3 unit tests
anchor test --skip-build                                     # validator integration test
node scripts/seed.mjs --commit 1500 --reveal 300 --desks 4   # rolling market on devnet
cd ui && npm install && npm run dev                          # deploy: npx vite build && npx wrangler pages deploy dist --project-name monday-open --branch main
```

## Built before vs built during

Built before the hackathon window (not part of this submission's work):
- Research notes in `sol/research` and `sol/docs` (signals, rival scan, the weekend-drift measurement and the two evidence posts), and the decision to build this idea.
- Shared tooling: Anchor 0.32 / Solana CLI, the cwf-pro-ui design skill and `cwf-ui-gate.sh`, Playwright on the dev machine.

Built during the hackathon (all on Oct 10, 2026):
- The Anchor program (commit-reveal, uniform clearing price, pro-rata settlement, vault escrow), its unit and integration tests, and the devnet deploy.
- The live UI's visual design is by kaverimeshram ([github.com/kaverimeshram/monday](https://github.com/kaverimeshram/monday)), cloned into `ui/` and kept as designed. We wired its screens to the devnet program: order ticket runs seal, reveal, clear and settle; the phase timeline and phase card follow the chain; "Your weekend book" and "Your open print" show the real run; the asset panel and auction status show the seeded rolling book; "Get devnet SOL" calls the faucet. Its price chart is still illustrative.
- An earlier frontend of ours (`app/`), the devnet faucet function, and the Cloudflare Pages deploy.
- The seed script, the headless e2e timing script, the design references/critique rounds, and this README.

## Limits (honest)

- Devnet only. Never deployed to mainnet.
- Order and auction accounts are not closed after settlement, so each run leaves about 0.002 SOL of rent per account; a `close_order` instruction is the next program change.
- The clearing crank takes all orders as remaining accounts (max 24 per auction).
- Demo runs and the seeder depend on scarce devnet SOL (public airdrops are rate-limited); the faucet function has no rate limit, so anyone can drain its small devnet balance (about 0.03 SOL, 2 drips, left on Oct 10 night). The seeded rolling book is paused: its desk wallets were swept into the faucet to keep the one-click demo alive.
