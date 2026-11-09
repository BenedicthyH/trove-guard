# TroveGuard: yield-backed shield for MUSD troves (Mezo Buildathon Wave 2)

Submission closes 2026-11-13 05:30 UTC (06:30 Lagos). Target: submit Nov 12 evening.

## Verified facts (sources)
All from github.com/mezo-org/musd (main), cross-checked against https://rpc.test.mezo.org on 2026-11-03.
- Chain ID 31611 (`eth_chainId` returns 0x7b7b). RPC https://rpc.test.mezo.org. Source: solidity/hardhat.config.ts, network `matsnet`.
- Testnet addresses: solidity/deployments/matsnet/*.json (copied to keeper/addresses.js). BorrowerOperations.borrowerOperationsSignaturesAddress() returns 0xD757...639e, which matches.
- MCR 110%, CCR 150%, gas compensation 200 MUSD: solidity/contracts/dependencies/LiquityBase.sol.
- minNetDebt 1800 MUSD, governable: BorrowerOperations.sol line 144; live read returns 1800e18.
- Redemption order: TroveManager.redeemCollateral starts at SortedTroves.getLast() (lowest ratio) and skips troves with ICR < MCR.
- Stability Pool: provideToSP / withdrawFromSP use msg.sender as depositor, so a vault contract can deposit for itself. Not on behalf of another address.
- Stability Pool yield: docs/README.md says there are no direct incentives. Yield is only BTC from liquidations, and the MUSD deposit shrinks by the debt it absorbs. Interest and fees go to the MUSD Savings Rate vault via PCV, not to SP depositors.
- Third-party repay: BorrowerOperations.repayMUSD/addColl only act for msg.sender. BorrowerOperationsSignatures.repayMUSDWithSignature lets anyone submit a borrower-signed EIP-712 RepayMUSD(amount, borrower, nonce, deadline). MUSD is burned from the caller (BorrowerOperations._repayMUSD burns from `_caller`), so our vault pays. addCollWithSignature works the same with msg.value.
- Signature limits: one sequential nonce per borrower shared by all signed ops; the amount is fixed in the signature; there is a deadline.

## What this changes in the concept
1. "Earning yield" in the Stability Pool is weak and pro-cyclical. In a crash the reserve gets partly swapped into BTC exactly when it is needed in MUSD. Adjusted design: the vault holds the reserve in SP by default and also accepts the BTC gains; it uses the BTC as an addColl rescue (second signed message) when MUSD is short. Pitch it honestly as "your reserve backstops the system and earns liquidation BTC", not a savings rate. Check in Discord whether the MUSD Savings Rate vault is open to deposits on testnet; if yes, add it as a second reserve venue. I did not find its address in the repo.
2. Only one pre-signed operation can be live at a time (shared nonce). So arm one RepayMUSD per vault, re-arm after each rescue (bot nudges the user). If the user signs any other Mezo signature op, the armed one goes stale; keeper checks getNonce and alerts.
3. Repay amount must leave net debt >= minNetDebt (1800); the setup page must cap it.
4. Redemption-queue trigger is only safe as an alert plus repay; repaying raises ICR and moves the trove back in the queue. Same contract path.

## Architecture
- TroveGuardFactory: one vault per borrower.
- TroveGuardVault: deposit/withdraw (owner), arm(trigger, amount, deadline, tipBps, sig), rescue(hints) callable by anyone, keeper tip <= 2%, checks ICR improved.
- Keeper (Node, ethers v6): polls vaults, needsRescue(), computes hints with HintHelpers, sends rescue. Also redemption-queue position scan.
- Telegram bot: /watch, /status, /arm (link to signing page), alerts on ICR bands, queue position, stale signature, low reserve. Premium: 1 MUSD/month via MUSD transfer to treasury, checked on-chain; premium gets auto-rescue, free gets alerts only.
- Small web page (Vite) for wallet connect, EIP-712 signing (domain "BorrowerOperationsSignatures", version "1"), deposit.

## Milestones
- Nov 3: verify, scaffold, unit tests on mocks (done).
- Nov 4: fork test against matsnet contracts with a real signed RepayMUSD; hints.
- Nov 5: deploy factory to testnet, open own trove, first real rescue tx. **DONE 2026-11-09** — factory `0x505895594A647eC13686dAf3Eb5964616c7192fA`, vault `0xB4ab1E3Dd0bc1A43340da6DA71a9CDE321f515db`, rescue tx `0xdf59cfbce54db4e5a6785f88e8012fe1ed30dafdfefb75fa7a448113b9f9f17f`. Used a high triggerICR (150%) above the healthy ~129% ICR to exercise the real signed repay path without waiting for liquidation risk. Details in `logs/testnet-rescue.json`.
- Nov 6: BTC-gain addColl path, getNonce staleness check, minNetDebt cap.
- Nov 7: keeper hosted 24/7, redemption-queue alerts.
- Nov 8: Telegram bot with persistence, premium check.
- Nov 9: signing web page.
- Nov 10: second wallet (outside user) end to end, verify contracts on explorer.test.mezo.org.
- Nov 11: deck with revenue model, 2-minute video.
- Nov 12: README, form text, submit. Buffer day before 05:30 UTC Nov 13.

## Level 5 checklist (from Wave 1 judge comments)
- Acts on-chain through BorrowerOperationsSignatures (level 4) and gives MUSD a new job: reserve deposited in SP.
- Outside wallets and an independent keeper using it.
- Verified contracts on the Mezo explorer.
- Read minNetDebt and Recovery Mode on-chain; tell users when the armed rescue can no longer succeed.
- Handle claimCollateral surplus after redemption (pass through to owner).
- Deck with priced revenue model, video under 2 minutes, web link usable without Telegram.

## Risks
- Crowded field (Vigil, Bulwark, Lifeline, AgentVault, KEEL). Differentiator is the productive reserve plus BTC-gain fallback.
- SP losses in liquidations reduce the reserve; show it clearly.
- Signature replay is prevented by Mezo nonce; our risk is stale signatures.
- Testnet MUSD needs a trove; faucet gives BTC and MEZO.
