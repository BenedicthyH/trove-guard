# Trove Guard: selling narrative and 2-minute pitch script

Mezo Buildathon Wave 2. Track 2, Access and Distribution. Mezo testnet (chain 31611).
Telegram: [@TroveGuardMezoBot](https://t.me/TroveGuardMezoBot)
Draft prepared Nov 3, 2026. Submission closes Nov 13, 2026, 06:30 Lagos time (WAT).

---

## 1. One-line pitch

**Trove Guard repays your MUSD loan before liquidation or redemption, from a reserve that earns BTC in Mezo's Stability Pool while it waits.**

Alternates:

1. A Telegram guard for MUSD loans that acts at 3 AM, using a reserve that backs Mezo while it sits.
2. Park a small MUSD reserve in the Stability Pool, sign one rescue, and a keeper repays your loan when it is at risk.
3. Liquidation and redemption protection for MUSD borrowers: non-custodial, set up in Telegram, funded by a reserve that earns liquidation BTC.

---

## 2. Narrative

### Problem: two ways to lose BTC, and both happen while you sleep

A Mezo borrower locks BTC and mints MUSD. The loan has a collateral ratio (ICR). Two events can take the BTC.

**Liquidation.** Below 110% ICR, anyone can liquidate the loan. The Stability Pool pays off the debt and takes 99.5% of the BTC. The liquidator gets 0.5% plus 200 MUSD. The borrower keeps the MUSD and loses all the collateral. ([Mezo 101: Liquidations and Redemptions](https://mezo.org/blog/mezo-101-liquidations-redemptions/)) Interest is simple and accrues on the full debt, so ICR drifts down even when BTC is flat. (same source)

**Redemption.** Anyone can burn 1 MUSD for $1 of BTC, minus a 0.75% fee. Mezo takes that BTC from the lowest-ratio loan at or above 110% first, then the next. ([MUSD Redemptions, Mezo docs](https://mezo.org/docs/developers/musd/musd-redemptions/)) Mezo's own guide calls this neutral in dollar terms, and it is: debt falls by the same value as the BTC removed. ([Mezo 101](https://mezo.org/blog/mezo-101-liquidations-redemptions/)) But people borrow MUSD so they do not have to sell BTC. A redemption sells some of it for them, at a time they did not choose. A large one can clear the whole loan and leave only surplus collateral to claim. (same source) Mezo's guide says loans between 110% and 130% are first in line. (same source)

Redemption risk is the less visible one. A price alert does not tell you where you sit in the queue. One Wave 1 builder publicly claimed that 49 people held MUSD loans in June and that almost none were left by late October, removed by redemptions rather than repaid. ([post by the KEEL builder, Oct 26, 2026](https://teapawt.org/0xnehemiah)) We have not verified that count on-chain.

**The 3 AM scenario.** You hold a loan at 130% ICR. You are asleep in Lagos. BTC falls 15% before you wake. Your ratio is now 110.5%. You are likely near the front of the redemption queue and one small move from liquidation. An alert bot wakes you if your phone is loud. If not, you lose the BTC. Even if you wake, you need MUSD in your wallet, a working RPC, and a clear head, all inside a few minutes.

Today, the tooling Mezo points borrowers to is monitoring. Mezo's guide recommends a third-party monitor and a ratio of 150% or more. (same source) Monitoring tells you. It does not act.

### Solution

Trove Guard acts for you, within limits you sign.

- You keep a small MUSD reserve in your own Trove Guard vault.
- The vault deposits the reserve in Mezo's Stability Pool. There it backs the system and earns BTC from liquidations.
- You sign one Mezo-native rescue permission (a `RepayMUSD` message). It fixes the amount, the loan, and a deadline.
- A keeper watches your loan 24/7. When it is at risk, the keeper calls the vault. The vault pulls MUSD from the pool and repays part of your debt.
- If the MUSD side of the reserve runs short, the earned BTC can be added as collateral instead (in build, see status table).
- Alerts and setup run in Telegram.

It is non-custodial. Mezo's own contract checks the signature. The vault can only repay your loan. It cannot borrow, withdraw your BTC, or send funds elsewhere. Only you can withdraw the reserve.

### How it works, in 4 steps

1. **Connect in Telegram.** Send `/watch` with your address to @TroveGuardMezoBot. It reads your live ICR, liquidation price, and place in the redemption queue from Mezo's contracts.
2. **Fund the reserve.** Deposit MUSD into your vault. The vault puts it in the Stability Pool. Your reserve now backs the system and earns liquidation BTC.
3. **Sign one rescue.** On the signing page, set a trigger ratio, a repay amount, and a deadline. Sign Mezo's `RepayMUSD` message once. The page caps the amount so the loan stays above Mezo's 1,800 MUSD minimum debt.
4. **The keeper acts.** If your ratio falls below the trigger, or your loan reaches the front of the redemption queue, the keeper calls `rescue()`. The vault repays your debt. The contract reverts if your ratio does not improve. Telegram confirms with a transaction link and asks you to sign the next rescue.

Why re-sign: Mezo uses one sequential nonce per borrower for all signed operations. So one pre-signed rescue is live at a time. If you sign any other Mezo signed operation, the armed rescue goes stale. The keeper checks the nonce and tells you.

Worked example. Collateral worth $13,000, debt 10,000 MUSD, ICR 130%. Trigger set at 120%. BTC falls overnight and ICR reaches 119%. The keeper repays 1,500 MUSD from the reserve. Debt falls to 8,500 MUSD and ICR rises to 140%. The keeper tip at 2% is 30 MUSD, also from the reserve.

### Mezo integration (30% of score)

Every core action uses a Mezo primitive.

| Mezo component | How Trove Guard uses it |
|---|---|
| MUSD | The reserve, the repay asset, and the premium payment |
| Stability Pool (`provideToSP`, `withdrawFromSP`) | Where the reserve sits. The vault is the depositor and receives liquidation BTC |
| BorrowerOperationsSignatures (`repayMUSDWithSignature`) | The rescue. Mezo verifies the borrower's EIP-712 signature and burns MUSD from the vault |
| BorrowerOperationsSignatures (`addCollWithSignature`) | BTC-gain fallback rescue (in build) |
| TroveManager, PriceFeed, SortedTroves, HintHelpers | Live ICR, oracle price, redemption-queue position, insert hints |

Addresses come from Mezo's `mezo-org/musd` repository and were cross-checked against the testnet RPC on Nov 3, 2026.

The design gives MUSD a second job. Idle insurance money becomes Stability Pool depth, which is what absorbs liquidations for every Mezo borrower.

A note on yield. Mezo pays no direct incentive to Stability Pool depositors. The return is BTC from liquidations, and the MUSD deposit shrinks by the debt it absorbs. Interest and fees go elsewhere (protocol treasury and the MUSD Savings Vault). (`mezo-org/musd` docs/README.md, per builder's review) So we say: your reserve backs the system and earns BTC. We do not quote a rate.

### Why now

Facts, with sources. Read Nov 2 to 3, 2026.

- Mezo mainnet and MUSD went live on May 28, 2025. ([CoinDesk](https://www.coindesk.com/business/2025/05/28/bitcoin-platform-mezo-debuts-mainnet-to-build-circular-btc-economy))
- MUSD supply is about $29.5M on Mezo's own Dune dashboard. ([dune.com/mezo/proof-of-hodl](https://dune.com/mezo/proof-of-hodl)) DefiLlama shows $27.97M of stablecoins on Mezo. ([DefiLlama, Mezo chain](https://defillama.com/chain/mezo))
- About $85.7M of BTC is bridged to Mezo. ([DefiLlama, Mezo bridged](https://defillama.com/bridged/mezo))
- DefiLlama's "Mezo Borrow" TVL was $1.29M on Nov 2, 2026, down 60% in 30 days and down from $29.24M on Jan 20, 2026. ([DefiLlama, Mezo Borrow](https://defillama.com/protocol/mezo-borrow)) This figure does not reconcile with the MUSD supply above. We have not resolved the gap and do not lean on it.
- Mezo's Track 2 brief asks for "Telegram or WhatsApp bots for MUSD/MEZO transactions and monitoring." ([AKINDO Buildathon page](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10))
- 119 teams built in Wave 1. ([Mezo via Outposts](https://outposts.io/project/mezo/article/mezo-buildathon-wave-1-closes-with-119-teams-cmvprfdr2000006l6as8gbv87))

What this means. Mezo has a BTC base and a live stablecoin, and the borrowing side looks thin right now. Borrowers who lose BTC to a liquidation or a surprise redemption are unlikely to borrow again. A tool that keeps loans open is a retention tool for Mezo Borrow. And the enabling primitive, signed borrower operations, already ships in Mezo's contracts. Nothing new is needed from Mezo for this to work.

### Competition

Wave 1 had several MUSD loan-protection entries. The table uses public AKINDO pages, GitHub, and the builder brief. "Unknown" means we could not find it.

| | Trove Guard | Vigil | Trove Guardian | KEEL | Lifeline | Bulwark |
|---|---|---|---|---|---|---|
| Approach | Pre-signed repay from a reserve; BTC-gain collateral fallback | Telegram alerts plus pre-signed `RepayMUSD` rescue from a MUSD reserve | Unknown. Team is listed in the Mezo WaveHack; no product page found | Borrow MUSD against BTC or veBTC in a separate market that redemptions cannot reach; savers fund loans from Mezo's savings vault | Standing policy vault: adds BTC and/or repays MUSD to restore a target ratio | Unknown. No Mezo entry found; projects with this name exist on other chains |
| Acts on-chain | Yes (repay; collateral add in build) | Yes. Live testnet rescue: 300 MUSD repaid, 130.94% to 148.77% | Unknown | Not a rescue tool; avoids redemption by design | Yes, repeatable on every dip | Unknown |
| Reserve productive while idle | Yes, in Mezo's Stability Pool | Not in Wave 1. Wave 2 plan: "reserve earns yield in existing Mezo pools" | Unknown | Savers earn interest (different model) | Not stated (BTC/MUSD held in vault) | Unknown |
| Redemption risk | Queue position alerts and repay trigger | Queue position and MUSD ahead of you | Unknown | Core focus | Redemption buffer trigger | Unknown |
| Works with existing trove | Yes (signature-based) | Yes (signature-based) | Unknown | No (new market) | No. Vault opens the trove as borrower of record | Unknown |
| Custody | Non-custodial. Mezo checks signature; vault can only repay the owner's loan | Non-custodial. No owner, no admin | Unknown | Unknown | Non-custodial. Keepers can only move reserve into owner's trove | Unknown |
| Channel | Telegram plus signing page | Telegram plus browser app | Unknown | Unknown | Telegram alert keeper plus dashboard | Unknown |
| Pricing | Free alerts; ~1 MUSD/month premium; tip up to 2% | Planned Q1 2027: small fee on executed rescues | Unknown | 1 MUSD/month (per builder brief, not verified) | Keeper tip up to 2% with absolute cap; no subscription found | Unknown |

Sources: [Vigil on AKINDO](https://app.akindo.io/communities/xKmLoZGWQhNJ0OG7/products/K8zDjV2MvuekAA17); [Lifeline README](https://github.com/XachP/mezo-lifeline); [KEEL builder post](https://teapawt.org/0xnehemiah) and [AKINDO team page](https://app.akindo.io/communities/RDKBXL6PmI6BeWavK); [Trove Guardian member profile](https://app.akindo.io/users/Aman).

Where Trove Guard is different:

- **The reserve does a job.** It sits in the Stability Pool and earns liquidation BTC. Vigil's Wave 1 reserve was idle. Lifeline's reserve sits in the vault.
- **Two rescue assets from one deposit.** MUSD repays debt. The BTC the pool pays out can be added as collateral.
- **No migration.** It protects the loan you already have. Lifeline needs a new trove opened through its vault.
- **Redemption first.** Queue position is in every status message, next to the liquidation price.

Where we are weaker, stated plainly:

- **One rescue per signature.** Mezo's shared nonce means the user re-signs after each rescue. Lifeline's policy repeats without new signatures.
- **Pro-cyclical reserve.** In a crash, the pool converts part of the MUSD reserve to BTC when MUSD is most needed. The BTC fallback is our answer; we show the reserve balance in every alert.
- **Bitcoin-wallet accounts.** Vigil reports that Mezo Passport smart accounts cannot use signature rescues today, because Mezo checks signatures with `ECDSA.recover`. This affects us the same way. Those users get alerts only.
- **Vigil is close.** Its Wave 2 plan includes a productive reserve and a collateral top-up. The gap is execution, not concept.

Per the builder's read of Wave 1 feedback, judges scored alert-only bots lowest and asked for idle reserves to be put to use. We have not seen that feedback ourselves.

### Business model

| Tier | Price | What you get |
|---|---|---|
| Free | 0 | Telegram alerts: ICR bands, liquidation price, redemption-queue position, stale-signature and low-reserve warnings |
| Premium | About 1 MUSD per month, paid on-chain in MUSD to the treasury; the bot checks payment on-chain | Auto-rescue by the keeper |
| Keeper tip | Up to 2% of each rescue, capped in the contract | Paid from the reserve to whoever executes the rescue |
| API (later) | To be priced | Loan risk and rescue status for treasuries, wallets, and apps on Mezo |

Notes:

- Free alerts are the top of the funnel. Premium is priced to sit at the KEEL reference point (1 MUSD/month, per brief).
- The 2% tip cap is enforced in `TroveGuardVault.sol` (`keeperTipBps <= 200`). Example: a 1,500 MUSD rescue pays at most 30 MUSD.
- The keeper is permissionless. While we run the main keeper, tips are revenue. If others run keepers, the tip keeps rescues reliable without us.
- At today's borrower count, subscription revenue is small. The business case rests on two things: Mezo Borrow growing, and the API serving apps that hold MUSD loans at size.

### Roadmap

| Phase | Timing | Scope |
|---|---|---|
| Testnet (now) | Nov 2026, Wave 2 | Vault factory, Stability Pool reserve, signed repay rescue, keeper, Telegram bot, signing page. Outside wallets end to end. Contracts verified on explorer.test.mezo.org |
| Mainnet | After Wave 2, after an external review | Same contracts on Mezo mainnet. Premium billing live. Recovery Mode and min-debt checks surfaced in alerts. Surplus pass-through after full redemption |
| API | After mainnet | Paid read and rescue-status API for treasuries, wallets, and Mezo apps |

### Status at submission (builder to confirm before Nov 12)

| Item | Status Nov 3 | Target |
|---|---|---|
| Vault and factory, unit tests on mocks | Done | |
| Telegram bot: /watch, /status, /list, live ICR and queue position | Live on testnet | |
| Fork test with a real signed `RepayMUSD` | Planned | Nov 4 |
| Factory deployed, first real rescue tx | Planned | Nov 5 |
| BTC-gain `addColl` rescue, nonce staleness check, min-debt cap | Planned | Nov 6 |
| Keeper hosted 24/7, redemption-queue trigger | Planned | Nov 7 |
| Premium check in bot | Planned | Nov 8 |
| Signing page | Planned | Nov 9 |
| Outside wallet end to end, verified contracts | Planned | Nov 10 |

Replace this table with transaction links and wallet addresses before submitting. Judges check on-chain evidence.

### The ask

To the judges:

- Score Trove Guard on what it does on-chain: a signed repay through Mezo's own contract, funded by a reserve that sits in Mezo's Stability Pool.

To the Mezo team:

- Confirm the MUSD Savings Vault address on testnet, so the reserve can split between the Stability Pool and the vault.
- Let us invite testnet borrowers in the Mezo Discord. We want 10 outside wallets with a funded reserve and one signed rescue each.
- A path for Mezo Passport accounts to use signature rescues.
- Feedback on a mainnet launch after review.

---

## 3. Two-minute pitch video script

Target: 2:00. Spoken words: 300. Read at a steady pace, about 150 words per minute.

| Time | Voiceover | On screen |
|---|---|---|
| 0:00 to 0:19 | It's 3 AM in Lagos. You borrowed MUSD against your bitcoin at 130 percent. You're asleep. Bitcoin drops fifteen percent. Your loan is now near the front of the redemption queue, and one move from liquidation. Redemption can take your bitcoin even while the loan is above the line. | Dark phone screen. Clock reads 03:00. BTC price chart falls. ICR counter ticks from 130% to 110.5%. |
| 0:19 to 0:34 | An alert bot would wake you, if your phone is loud. Wave 1 had plenty of those. Alerts tell you. They don't act. And even awake, you need spare MUSD, a working wallet, and a few calm minutes. | Telegram notification stack, unread. Text overlay: "Alert sent. Nobody awake." |
| 0:34 to 0:52 | Trove Guard acts. You keep a small MUSD reserve in your own vault. The vault puts it in Mezo's Stability Pool, where it backs the system and earns BTC from liquidations. It's not a high-yield product. It's insurance that does a job while it waits. | Diagram: user vault, arrow to Stability Pool, BTC gains flowing back. Labels: "MUSD reserve", "liquidation BTC". |
| 0:52 to 1:09 | Setup is in Telegram. Send your address to the bot. It shows your ratio, your liquidation price, and your place in the redemption queue. Then you sign one rescue: Mezo's own repay message, with a fixed amount and a deadline. | Screen recording of @TroveGuardMezoBot: /watch 0x..., then /status reply with ICR, liquidation price, queue position. Cut to signing page, wallet popup showing RepayMUSD fields. |
| 1:09 to 1:25 | Now the 3 AM drop again. Your ratio crosses 120 percent. The keeper calls the vault. The vault repays 1,500 MUSD from the reserve. Your ratio is back at 140. Telegram tells you when you wake up, with the transaction link. | Dashboard: ICR line crosses the trigger. Rescue event card: "Repaid 1,500 MUSD. ICR 119% to 140%. Keeper tip 30 MUSD." Explorer tx page on explorer.test.mezo.org. Telegram message with link. |
| 1:25 to 1:38 | It's non-custodial. Mezo checks your signature. The vault can only repay your loan. It can't touch your bitcoin. Only you can withdraw the reserve. After a rescue, you sign the next one. | Contract snippet: rescue() with ICR check. Overlay: "Only repays your loan. Only you withdraw." Telegram prompt: "Sign your next rescue." |
| 1:38 to 1:52 | Alerts are free, so anyone can see their risk. Auto-rescue is about one MUSD a month. Keepers earn a tip capped at two percent. Next comes mainnet, then an API for treasuries and apps. | Pricing card: Free / Premium / Keeper tip. Roadmap strip: Testnet, Mainnet, API. |
| 1:52 to 2:00 | Trove Guard. Your reserve backs Mezo while it waits, and saves your loan when it counts. Try it on testnet today. | Logo. "t.me/TroveGuardMezoBot". GitHub link. "Mezo testnet. Track 2." |

Shot list summary:

1. Telegram bot demo: `/watch`, `/status` reply with ICR, liquidation price, queue position; rescue confirmation message; "sign your next rescue" prompt.
2. Dashboard: reserve balance in the Stability Pool, BTC gains, ICR line with trigger, redemption-queue position.
3. Rescue event: ICR crossing the trigger, keeper transaction, explorer page, ICR before and after.

Recording notes:

- Use a real testnet rescue transaction. Do not stage the explorer page.
- If the redemption-queue trigger or BTC fallback is not live by Nov 11, drop the matching words from the script rather than showing a mock.
