# MONDAY OPEN: Colosseum Crypto World's Fair submission checklist

**Deadline: Tue Oct 13, 2026, 12:29 PM IST** (= 2026-10-12 23:59 PT per `cwf/docs/PORTAL-CHECKLIST.md`).

> **Team leader: you must submit.** Official rules section 6(b): "Each Team member must visit colosseum.com to register for the Contest and the team leader must upload the Project Submission before the end of the Entry Period." FAQ h-faq-3: every team member creates a Colosseum account and the team leader adds them during product submission. Rules section 7: one Project Submission per team, and an entrant may be on only one team. MONDAY OPEN still has no named team leader (see PRODUCTS.md). **Kamal must decide who submits it.**

Sources: `cwf/docs/official/colosseum-faqs-2026-10-03.json` (h-faq-11 "required information in the submission portal", h-faq-3), `cwf/docs/official/rules.txt`, `cwf/docs/PORTAL-CHECKLIST.md`.

## Portal fields (from FAQ h-faq-11)

| Field | Status | Where it is |
|---|---|---|
| Product name and brief description | ready | README.md first paragraph |
| Blockchains and tools integrated | ready | Solana (devnet), Anchor 0.32, Cloudflare Pages; README "Repo" |
| All teammates with background and previous experience | **TODO (team leader)** | not in repo |
| Where the team is located | **TODO (team leader)** | not in repo |
| Product logo or graphic | **TODO**: no MONDAY OPEN logo file exists yet; the UI's gold dot + wordmark could be exported | ui/ header |
| GitHub repo link | ready, private: https://github.com/kamalbuilds/monday-open | **TODO: grant read access to hackathon@colosseum.com** (required for private repos) |
| 2 to 3 minute presentation video | script ready, **video TODO** (record spoken pitch) | docs/pitch/pitch-2min.md |
| Product demo video, 3 minutes or less | **draft recorded**: docs/pitch/demo.mp4 (2:05, screen only, no voiceover). Re-record with voiceover and live chart after SOL lands | docs/pitch/demo-3min.md |
| Go-to-market, demand validation, distribution | partial: business model in UI + pitch; evidence posts in README. **TODO: write GTM/distribution paragraph** | README, docs/pitch |

## Also in our own playbook (not stated as required in the official docs; unverified as portal fields)

- Built-before vs built-during disclosure: README "Built before vs built during" (SEALED CALL's submission used a "Pre-existing work disclosure" section; whether the portal has a field for it is **unverified**).
- Competition paragraph: README "How we differ from Afterhours". **Unverified** whether the portal has a dedicated competition field (`sol/docs/SUBMISSION.md` pastes into "Portal: competition", "whyNow", "traction" from an earlier coordinator pass).
- Live demo URL: https://monday-open.pages.dev (needs devnet SOL in the faucet to work for new visitors).
- Track: Solana. Note `cwf/sol/docs/SUBMISSION.md` is for SEALED CALL; one team can submit only one project, so MONDAY OPEN needs its own team or replaces SEALED CALL. **Kamal to decide.**

## Final checks before submitting

- [ ] Faucet funded; a fresh browser completes one demo run (first write under 15 s)
- [ ] `cargo test` + `anchor test --skip-build` green; program id BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA in README
- [ ] hackathon@colosseum.com has repo access
- [ ] Both videos uploaded and links pasted
- [ ] Team leader clicks submit before Tue Oct 13 12:29 PM IST
