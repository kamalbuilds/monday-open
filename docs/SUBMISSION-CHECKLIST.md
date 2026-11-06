# MONDAY OPEN: Colosseum Crypto World's Fair submission checklist

**Deadline: Tue Oct 13, 2026, 12:29 PM IST** (2026-10-12 23:59 PT, per `cwf/docs/PORTAL-CHECKLIST.md`).

Portal fields come from FAQ h-faq-11 (`cwf/docs/official/colosseum-faqs-2026-10-03.json`). Each draft below is ready to paste. Placeholders in [brackets] need Kamal's input.

## Steps for Kamal

- [ ] Grant read access to the private repo https://github.com/kamalbuilds/monday-open to **hackathon@colosseum.com** (required for private repos; not done by the agent)
- [ ] Fill the teammate and location placeholders below
- [ ] Upload the logo from `docs/brand/`
- [ ] Record and upload the 2 to 3 minute presentation video and the demo video (scripts in `docs/pitch/`), then paste the links
- [ ] Fund the faucet so new visitors can run the demo (`6jnznfgZ6CeJeq8WxdyrZXeL1ENuAihcDU5sFjtcyB11`, devnet)
- [ ] Submit before the deadline

## Portal field drafts

### Product name
MONDAY OPEN

### Brief description
A sealed weekend batch auction on Solana that gives tokenized stocks one fair Monday-open price. Traders seal orders all weekend, every order is revealed before the open, and the program clears them all at one uniform price, so nobody can trade against a visible limit or race the Monday gap. Live on devnet with a one-click demo.

### Blockchains and tools integrated
Solana (devnet). Anchor 0.32 program (commit, reveal, clear, settle with a program vault for escrow). @solana/web3.js and @coral-xyz/anchor in a React + Vite frontend. Cloudflare Pages for hosting plus a Pages Function that signs a small devnet faucet drip. Playwright for end-to-end checks.

### Teammates, background and previous experience
[Name, role, background, previous projects for each teammate]
UI design credit: kaverimeshram (https://github.com/kaverimeshram/monday).

### Where the team is located
[City, country]

### Product logo or graphic
`docs/brand/monday-open-logo-1024.png` (also 512 px PNG and SVG in `docs/brand/`). This is the UI header wordmark exported as is.

### GitHub repo link
https://github.com/kamalbuilds/monday-open (private; hackathon@colosseum.com needs read access)

### Live demo
https://monday-open.pages.dev

### Presentation video (2 to 3 minutes)
[link]. Script: `docs/pitch/pitch-2min.md`

### Product demo video (3 minutes or less)
[link]. Script: `docs/pitch/demo-3min.md`

### Go-to-market, demand validation and distribution
We will start with the weekend gap for one tokenized stock, then add more. The first users we are aiming at are holders and traders of xStocks on Solana who already trade over the weekend and lose to the Monday-morning race. The product is a contract, not a destination. Any Solana venue, wallet or xStocks distributor can call the program and show "seal your order for the Monday open" next to its normal order form, so our reach comes from the places those traders already use. We have not signed or announced any partner. Our first step is to put the open-source program and live devnet demo in front of those teams and ask them to try it with one ticker. Market makers are the other side of the book. A sealed auction with one clearing price lets them quote without being picked off, and that is our pitch to them. Revenue is planned as a small basis-point fee on shares that clear at the open, shared with the integrating venue. Demand signals so far are public posts: the Solana Foundation asking builders for new equities products, and Julian Ma's post on batch auctions for tokenized equities. We have no user traction yet beyond the devnet demo.

### Pre-existing work disclosure (paste if the portal asks)
Built before the hackathon: research notes (signals, rival scan, the weekend-drift estimate, the two evidence posts) and shared tooling (Anchor, the Solana CLI, the design gate script, Playwright). Built during the hackathon (Oct 10 to 11, 2026): the Anchor program and tests, the devnet deploy, the faucet function, the seed script, the wiring of kaverimeshram's UI design to the program, the live chart, the README and the pitch.

### Competition (paste if the portal asks)
Afterhours, also in the fair, forecasts reopening downside for 24/7 tokenized equities and gives lending curators a hold or reduce decision. It hedges the risk of the weekend gap. MONDAY OPEN fixes the price itself with one fair sealed clearing price at the open. The two fit together, because a fair open price is a better input for any risk tool.

## Final checks before submitting

- [ ] A fresh browser completes one demo run on the live site (first write under 15 s)
- [ ] `cargo test` and `anchor test --skip-build` are green, and the program id BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA is in the README
- [ ] hackathon@colosseum.com has repo access
- [ ] Both video links are pasted
