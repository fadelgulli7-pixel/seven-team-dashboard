SEVEN Marketing v5.6.5 — confirmed receipts and settlement status
Confirmed blockchain payments show Received in member profile and personal view, including amount, settlement, time, source, recipient and explorer link. Details are restricted to owner and recipient.
Owner refresh reconciles up to 10 broadcast jobs; an open broadcast dialog checks again every 5 seconds. Unknown results stay reserved. No signing or new transfers occur during reconciliation.
Existing server-side zero-due rejection remains. New approved earnings permit only the new outstanding amount; previous receipts remain. Added regression tests for settlement/new earnings and private receipt rendering.
Deploy all source files; preserve DATA_DIR, sessions and backups. This build has not been deployed by the assistant. Opening the owner panel reconciles previous broadcast payments, including the successful payment shown by the user.

# SEVEN Marketing v5.6.4 — Phantom Lighthouse compatibility

Build: `2026-10-18-marketing-v5.6.4`.

## Evidence and fix

The user's 5.6.3 diagnostic shows 4 reserved instructions and 6 returned instructions, unchanged payer/blockhash, unchanged first four instructions, and two trailing single-account instructions targeting `L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`. This is Lighthouse. Phantom documents that it appends Lighthouse runtime assertions as user protection. The earlier whole-message byte-equality check rejected these legitimate additions. Explicit priority fees alone did not address this cause.

Primary references:
- https://docs.phantom.com/developer-powertools/lighthouse
- https://phantom.com/learn/blog/anti-spoofing-security
- https://github.com/Jac0xb/lighthouse/tree/4c579479c98635e419b1b167f08be02a71604a71

`lib/payout-message.js` now allows a narrowly constrained Lighthouse tail while checking the original payment strictly. Original payer/blockhash, original instruction order/data/programs/accounts/privileges, and their reconstructed reserved message must match. At most three trailing instructions may be added. Each must target the exact Lighthouse ID, have one account already referenced by the reserved message, bounded data (3–512 bytes), and an approved read-only assertion opcode (2,3,5,6,7,8,9,10). Original account privileges cannot change; the only new account may be the read-only non-signer Lighthouse program. MemoryWrite/MemoryClose, delta/memory, Merkle/CPI, unknown opcodes/programs, extra transfers, fee edits, account changes and new signers are rejected.

The original signed transaction INCLUDING the guards is signature-verified, persisted before broadcast and sent without stripping or rebuilding it. The saved base reservation is not rewritten. A different guarded signature cannot replace an already reserved signature. Chain assertion failures do not post payments. Unknown results stay reserved; once-only confirmed ledger reconciliation remains in effect.

This compatibility rule checks instruction envelope/privileges, not every assertion argument; the known assertion entrypoints validate their payload and conditions onchain. A malformed or unsatisfied assertion can still fail the chain transaction, with a network fee, and never counts as payment. No Lighthouse memory or CPI operation is accepted.

## Validation

71 automated tests pass and npm run check passes. New tests sign real local transactions with representative Lighthouse assertions derived from the pinned upstream Borsh definitions; compare the actual broadcast/persisted signed bytes; reconcile once; reject payment/fee/blockhash/privilege/program changes and memory/CPI opcodes; prevent guarded signature replacement and false ledger payment after assertion failure. Existing browser/server serialization, session, authorization, reward and storage tests also pass. RPC/provider tests are mocked except the existing local HTTP RPC compatibility check. No real mobile-wallet transfer, live funds sent or production mutation/deployment was performed. The user's actual guard payload bytes were not supplied; representative fixtures are labeled accordingly.

## Deploy

Upload ALL files, especially new lib/payout-message.js, lib/payouts.js and server.js. Keep DATA_DIR/team-data.json/sessions.json/backups. Build npm ci; start node server.js. Check /health for the build above. Check the existing payment first; if expired close and prepare a new one. Never duplicate a broadcast/unknown payment. Verify one deliberately small owner-approved mobile payment after deployment and inspect its confirmed transaction before broader payouts.

This fixes the identified Phantom integration incompatibility. Solflare's external domain classification remains a separate support review issue; no security feature is disabled or bypassed.

---
Historical notes:

# SEVEN Marketing v5.6.3 — diagnostic visible without downloads

Build: `2026-10-18-marketing-v5.6.3`.

Wallet browser downloads did not work on the user's device. On PAYOUT_MESSAGE_CHANGED the dialog now directly shows a compact readable difference summary and the full diagnostic JSON in a read-only text field. Copy payment diagnostic writes to the clipboard when allowed; if blocked or unavailable it focuses and selects the text for manual copy. A screenshot of the compact summary is also useful. No Blob download is required. No report is automatically sent or stored, and no signed transaction/private key/signature is included.

This is an evidence collection usability fix. It does not assert that the signed-message mismatch is fixed. Exact-message/signature/reservation security remains unchanged. Solflare domain classification still needs its own support review.

Validation: 68 tests pass. Tests cover visible summary, full JSON, permitted clipboard, rejected clipboard and missing clipboard; locale parity and prior payment/security tests. Inline browser script parses. No production mutation, funds sent or real mobile-wallet test performed.

Upload the complete source to the existing repository, keeping DATA_DIR and all existing data/session files. Build npm ci; start node server.js. Verify the build above. After a rejected signed-message attempt the report appears automatically: copy the diagnostic text or send a screenshot; do not repeatedly retry amounts or wallets.

---
Historical notes:

# SEVEN Marketing v5.6.2 — signed-message diagnostics

Build: `2026-10-18-marketing-v5.6.2`.

The user's new screenshot confirms PAYOUT_MESSAGE_CHANGED persists after 5.6.1. Fee insertion alone has NOT been established as the root cause, and live payment success has not been demonstrated. This release adds evidence collection, not a claim that mobile payments are fixed.

On signed-message rejection, only the owner sees a Download payment diagnostic button. The JSON describes before/after instruction counts, program IDs, compute-unit limit/price where applicable, key-change flags, blockhash/header/account-order change flags, and SHA-256 hashes. It contains neither the signed transaction, raw serialized messages, signature, private key nor recovery phrase. The application does not save this report to the persistent store or send it elsewhere; the owner may choose to download and share it for troubleshooting.

All existing exact-message, source-account, signature, reservation and ledger protections remain enforced. Solflare domain classification remains a separate issue for official support review.

Validation: 68 passing automated tests, including precise changed-fee and changed-blockhash diagnostics, extra-instruction detection, absence of signed bytes/signature in the report, owner UI download flow and the prior 66 regression tests. Changed JS plus inline browser script compile successfully. Node dependencies are unchanged from the zero-advisory 5.6.1 check. No live mobile-wallet test, transfer or production deployment was performed.

Deploy the complete tree preserving DATA_DIR/team-data.json/sessions.json/backups. Build npm ci; start node server.js. Verify the build above. Open the existing reserved job and Check payment status; if expired, a new preparation is required. Never duplicate a broadcast/unknown payment. If message rejection recurs after an owner-approved signing attempt, download seven-payment-diagnostic.json and attach it to the troubleshooting conversation; do not keep retrying with different amounts or wallets.

---
Historical notes:

# SEVEN Marketing v5.6.1 — payout validation review

Build: `2026-10-18-marketing-v5.6.1`.

## Current changes

- New prepared payouts include fixed ComputeBudget limit (200,000 units) and price (10,000 micro-lamports/unit; 2,000 lamports priority fee). They are part of the exact reserved message before the wallet sees it. This addresses compatibility with wallets that automatically insert fee instructions when absent; it does not accept arbitrary changes to a signed transaction.
- Decoding, source-wallet mismatch, changed message and invalid/missing signature now produce distinct owner-visible errors, localized in all six non-English interface dictionaries. The API also returns a bounded PAYOUT_* code.
- The wallet dialog displays uncertain-broadcast notices instead of discarding them.
- The dialog reconciles the same job before opening signing, so an expired unsigned payment is displayed as expired rather than signed again.
- Old jobs and messages are preserved. For an old unsigned prepared job: Check payment status until expired, close, then prepare a new job. A broadcast/unknown job stays reserved and requires reconciliation; never create a second payment to work around it.

## Investigation result and limits

The supplied Phantom screenshot proves that signed validation rejected the submission. It does not identify which former combined check failed. Browser/server serialization was reproduced with the vendored browser SDK and locally generated real Ed25519 signatures: exact bytes and signature verification succeed. Wallet fee insertion is a plausible compatibility cause, based on Phantom's own published behavior, and is addressed in new preparations. It is not proven from the screenshot alone.

Reference: https://github.com/orgs/phantom/discussions/203 (Phantom representative describes automatic priority fees when absent). Exact equality, signer verification, saved-before-broadcast signature, duplicate reservations and once-only ledger posting remain enforced.

Solflare's domain security block is a separate external finding. This release does not remove or evade it. Ask official Solflare support to review the domain. No live payment, actual mobile-wallet test, production mutation or deployment was performed.

## Validation

66 automated tests pass. Includes the real local HTTP RPC compatibility test; browser-bundle round trip with genuine signatures; modeled conditional wallet fee insertion; refusal of changed transfer data, extra transfer, fee changes, different payer, missing/corrupt signature and unreadable bytes; legacy immutable message expiry; UI reconciliation-before-sign and visibility of uncertain notices. Chain/provider tests use mocks. All application JavaScript and the inline browser script parse successfully. Production Node dependency audit: zero known advisories at review time; this is not a blanket security certification or a separate audit of every vendored browser-library line.

## Deploy

Upload the complete ZIP contents to the existing repository, including assets and lib. Build `npm ci`; start `node server.js`. Keep the existing persistent DATA_DIR, team-data.json, sessions.json and backups. Check `/health` for the build above. No public/private keys or credentials should be pasted into source or chat.

---
Historical release notes:

# SEVEN Marketing v5.6 — Solflare support

The payout settings now explicitly select Solflare or Phantom. On mobile, the Connect button opens the chosen wallet's own browser through its official browse link. Log in to the panel there, connect the intended Solana account and save its public address. No new dependency or private-key storage is added.

Solflare connect may return a boolean or nothing, so the adapter reads provider.publicKey instead of assuming a Phantom-shaped response. False/rejected connections and account mismatches fail before signing. Only signTransaction is used: the server still compares exact reserved message bytes, verifies the signature, persists it before broadcast and reconciles once. The integration never silently uses a different wallet provider.

Existing payout config is retained, including Phantom. Choose Solflare explicitly under Rewards > My payout wallet, press Connect Solflare and save. Previously reserved payments are not rewritten or cancelled by changing wallet settings. A prepared payment can be signed by either selected wallet only if it controls the same saved source public key. Broadcast/unknown results must be checked before any new payment. Switching wallet does not establish why an earlier transaction failed.

Required upload: the entire source tree, especially assets/wallets.js, assets/languages.js, index.html, server.js and lib/payouts.js. Preserve DATA_DIR, team-data.json and sessions.json. Build npm ci; start node server.js. Health build: 2026-10-17-marketing-v5.6.0.

Validation: 61 full-suite tests pass, plus focused adapter/locale regression checks; Solflare-like mocked provider signs a real locally generated Solana transaction and the server records exactly one confirmed ledger payment with a mocked chain. No actual mobile-wallet end-to-end transfer, live fund movement or production deployment was performed. A different wallet cannot guarantee resolution of an unknown RPC/network issue. Production npm audit is retained separately.

Official integration references:
https://docs.solflare.com/solflare/technical/deeplinks/other-methods/browse
https://docs.solflare.com/solflare/technical/integrate-solflare/solflare-wallet-sdk

---
Historical release notes:

# v5.5.1 security maintenance — 2026-10-17

Use this full replacement instead of v5.5.0. Current npm production audit: 0 known advisories (previously 9 affected packages, 3 high and 6 moderate, from three dependency roots). This is a point-in-time dependency report, not a guarantee against vulnerabilities.

Removed @solana/spl-token and its native bigint-buffer dependency chain. The narrowly scoped classic SPL Token module in lib/token.js validates the standard 82-byte initialized mint account, derives the ATA, and creates only the idempotent ATA and TransferChecked instructions needed by this application. Eight independent official SDK 0.4.14 fixture cases verify identical PDA addresses, instruction bytes, program IDs, signer and writable flags, including u64 boundary amounts. Invalid mint owner/size/state and invalid amounts fail closed. No Token-2022 support is added. Full signed-payment reservation/reconciliation tests pass.

The jayson dependency is pinned to 5.0.0 via an explicit override to remove affected stream-json and uuid dependencies. A real localhost HTTP JSON-RPC request verifies web3.js compatibility. Lockfile is included. npm ci is verified, and startup/check/tests pass. The existing browser web3.js 1.98.4 asset is unchanged; npm audit reports the installed Node dependency tree, not a separate browser bundle audit.

Production read-only checks observed build 2026-10-17-marketing-v5.5.0 and HTTP 401 for anonymous /api/me. This confirms the older version is deployed, not that production is fully audited. No production changes, real payouts or exhaustive penetration test were performed. Upload all files including lib/token.js, package.json and package-lock.json; preserve DATA_DIR and existing records. Verify /health reports v5.5.1 after Render deploy.

# SEVEN Marketing v5.5

This release updates the existing v5.4 dashboard. Upload the full source tree; keep the existing DATA_DIR persistent disk and team-data.json. Build with npm ci, start with node server.js. Do not upload a local data folder.

- Scheduled marketing tasks use campaigns: title, objective, instructions, start, deadline, topic and required deliverable. Members can open Campaigns from the home page or Rewards. Choose Invites + Post, or Educational tasks + Educational video, for example. New submissions are rejected outside the active window or if their reward task type does not match the required deliverable. Older campaign records remain readable. Device-local inputs are converted to ISO and displayed in Baghdad time. Owner must write the campaign content in the audience language; user-authored text is deliberately not machine translated.
- Member telephone is optional; if supplied, its format is validated. Members still use their three-part name. The owner project profile does not collect or expose fullName or telephone.
- Existing owner profile is migrated once to SEVEN Network / @SEVN_Network, removing its personal contact fields. Authentication username/password, work, rewards and historical audit records are preserved. Owner profile name remains editable. New owner setup requests the project name.
- Sessions last 30 days from sign-in and survive service restarts on the same DATA_DIR. Only SHA-256 digests of opaque session cookies are stored in a private mode-0600 sessions.json, with CSRF secrets and authVersion. Logout persists revocation; password changes, recovery, suspension and access changes still invalidate sessions. Browser clearing cookies, deliberate logout, expiry or changing DATA_DIR requires signing in again. Existing pre-upgrade in-memory sessions require one new sign-in. Session data is never part of the public dashboard or ordinary team-data backup.
- Six non-English dictionaries now cover all 491 registered interface keys (English is the source language), including reward explanations and recovery screens. Language switching recognizes previously translated labels. Brand names, wallet addresses and user-authored text stay unchanged. Unknown server errors use a localized actionable message rather than leaking English/internal details; this is not a professional linguistic certification or a claim about every external Phantom/browser error.

Validation: npm run check and node test suite; real localhost restart with retained cookie, hash-only persistence, logout and password revocation; optional phone/project privacy; scheduled task and deliverable enforcement; dictionary parity and reverse language switching. No live Render deployment, mobile visual inspection or actual payment was performed in this environment. Existing Phantom payment checks are preserved.

---
Previous release notes (historical):

# v5.4 — campaign quality, seven locales and Phantom wallet payments

## New languages
English, Kurdish Badini and Arabic remain. Turkish, Persian, Spanish and French add 230 translated interface labels each, covering sign-in, profiles, pages, campaigns, reviews, rewards and Phantom payments. Some extended legacy help, detailed rate descriptions and technical errors retain English fallback. Member-authored names, briefs, notes and posts are not machine-translated. Persian, Arabic and Kurdish use RTL; the other locales use LTR.

## Phantom payment flow
Owner: Rewards → My payout wallet → Connect Phantom → Save changes. On a phone, this opens the panel inside Phantom's in-app browser; sign into the owner account there once. Select the intended Solana mainnet account before saving. Only its public address is stored; no wallet private key or seed is requested.

For a member with earned unpaid rewards, click Send SEVEN, enter the explicitly agreed SEVEN amount for the displayed entire USD amount due, then prepare and confirm in Phantom. There is no implied USD/SEVEN exchange rate. The app builds a checked SPL-token transfer and recipient associated token account, Phantom signs it, and the server saves the exact signature before broadcasting those signed bytes. Only a confirmed/finalized chain result creates a USD payment ledger entry. Network SOL fees and any recipient-token-account rent are paid by the connected wallet and shown by Phantom.

An uncertain chain result stays reserved; use My payout wallet → Check payment status. Do not make another manual transfer for it. Retries use the same signed bytes. Unsigned prepared jobs can expire after their blockhash expires; failed on-chain transactions create no payment. Existing manual payment records remain supported, but ledger payment/void actions are blocked while that member has a reserved wallet job. Confirmed on-chain ledger payments cannot be voided through the ordinary correction button.

The default verified SEVEN mint is Ho3DNyGDTuKoFdA1bd6obE9xaL4RuStHUW1eLpodHS53 (9 decimals, classic SPL Token). Optional SOLANA_RPC_URL should point to a reliable Solana mainnet RPC. Optional SEVEN_TOKEN_MINT and SEVEN_TOKEN_DECIMALS must agree with the chain; mismatches fail before signing. This project does not use TREASURY_PRIVATE_KEY.

## Campaign policy
New work requires a complete member profile, an independently approved promotion page, and an active owner-created campaign. A campaign states its goal, content brief/acceptance criteria, deadline, output cap per member and posting interval. The UI starts at 3 outputs/member and 24 hours; the owner can change these when creating the campaign. These are project policy choices, not universal academic standards.

Reviewers score accuracy, originality, usefulness, production and compliance from 0–20 each. Acceptance requires 75/100 and at least 15/20 for accuracy and compliance. All existing originality/evidence/quality confirmations, duplicate-proof checks, saved quotes and budget caps still apply. Human review is essential: scores do not automatically certify factual accuracy or detect all copied content. Historical submissions, grants, payments and quotes are preserved rather than retroactively rescored.

The application checks campaign state/caps/spacing and review scores on the server. No automatic payment is earned merely by creating more posts, views or likes. Source eligibility and actual posting permission remain manual human checks.

## Validation boundary
Automated tests use real locally generated Ed25519 signatures, exact transaction-message comparison and mocked RPC responses for success, unknown results, expiry, tampering and duplicate settlement. No real-wallet payment, production migration or mobile-device end-to-end test was executed here. A low-value owner-approved pilot is needed after deployment before routine payouts.

## Upgrade
Upload the complete project, including package-lock.json and assets; npm install/ci installs locked dependencies. Keep the same persistent DATA_DIR and team-data.json. Do not upload node_modules or replace existing production data. Existing accounts, original quotes, rewards and histories remain valid. No campaign is created automatically: the owner defines the first real campaign before new submissions.

# v5.3 — promotion channel approval and owner custom rewards

- Required private three-part full name and phone number, plus existing Solana receiving address. Phone and full name are visible only to the member and owner.
- Instagram, TikTok, Discord, X, Telegram, Facebook, YouTube and the existing other-platform options are available.
- Members submit a public page/channel link for each place they plan to promote SEVEN. An independent Owner/Manager must check genuine recent activity and posting rights, then approve or reject with a reason. This is a manual review; the app does not claim to automatically measure followers or activity.
- New activities require a complete profile and an approved source on the selected platform. Revoking source approval blocks subsequent submissions and approval of pending work tied to it. Old historical activities and ledger entries are preserved.
- The owner may assign a custom USD reward to independently reviewed work; a reason and all quality checks are required. Managers cannot assign custom amounts. Existing weekly and unpaid-budget limits, duplicate-proof guards, and payout evidence still apply. Members can request a custom review but cannot choose their own amount.
- Existing fixed rates are preserved as project policy, not academic or market standards. USD remains valuation; SEVEN is entered explicitly when preparing an owner wallet transfer.

Deploy all files together using the same persistent DATA_DIR. Do not upload a sample data folder or delete existing team-data.json. Existing accounts complete their contact details in Edit profile, then submit their pages through Pages and channels. Owner reviews those pages from Team members → Pages and channels.

# SEVEN Network · Marketing Team — v5.2

Fixed, reviewed USD task rewards and verified purchase referrals replace all revenue sharing. No project-wallet address, holdings, revenue total, external treasury connection, or income-based reward estimate is served by this application.

## Transparent pricing model

Price in USD = reference hourly rate × agreed standard minutes / 60. The default reference is $15/hour, selected from the lower end of Upwork's published historical $15–$45/hour social-media-marketer range. This is a planning anchor, not a claim that each platform has an official price.

The standard times below are proposed SEVEN planning assumptions. They have not been experimentally measured in this project. The scope matters: a short Telegram caption using a supplied visual is different from writing a full original post or producing that visual. Pay agreed standard effort, not inflated self-reported hours. Before revising estimates, a suggested pilot is to log completion times and quality outcomes for 20 comparable accepted samples and inspect the median; this is a proposed method, not a completed study.

| Deliverable | Standard minutes | Default reward | Paid works/member/week |
| --- | ---: | ---: | ---: |
| Short Telegram announcement using an approved supplied visual | 2 | $0.50 | 7 |
| Original X or Facebook caption + supplied approved visual | 10 | $2.50 | 7 |
| Original 30–90 second TikTok/Reel/Short | 40 | $10 | 3 |
| Original educational video, 2–8 minutes | 120 | $30 | 1 |
| Original campaign design | 20 | $5 | 3 |
| Original educational article, 400+ words | 40 | $10 | 2 |

Originality, evidence, accuracy and quality are acceptance gates; views, likes and follower counts alone do not produce pay. The task checklist still applies, so a low-quality submission does not earn merely because a time estimate exists.

Owners edit the reference hourly rate, task minutes and weekly limits; the server calculates prices. A Telegram social-post submission is mapped to the Telegram tier, preventing it from claiming the X price. An existing v5 quote—including an already submitted $1 Telegram quote—is honored unchanged. Old earned grants/payments are never repriced. New submissions use the new model. Previously customized task budget caps are preserved during upgrade; the model changes future prices, not old obligations.

Default task member cap: $30/week. Task team cap: $100/week. Shared outstanding unpaid cap: $300. Weeks start Monday in Asia/Baghdad. Referral commissions are separate from the task weekly/count caps but use the shared unpaid cap. If a commission cannot fit the available unpaid budget, the claim stays pending until the owner reconciles payments or changes the budget; the app never trims the promised 5% to fit a cap.

Four accepted new X posts = $10. Four short Telegram posts = $2. These amounts do not depend on project-wallet holdings or income. Quotes remain conditional on scope, evidence, quality review and available budgets; the owner must agree campaign scope before requesting work.

## Purchase referral commission — 5%

A member submits a purchase referral with seller + unique order ID, claimed USD value and a private individual receipt/evidence link. No money is created by submission alone.

A different Owner/Manager must verify the actual settled purchase in the merchant's records, its net USD value, attribution to this referrer before purchase, no self-referral, no duplicate and no refund. A pasted URL and claimed amount are not automatic payment verification. This release does not connect to a payment provider or auto-verify blockchain transactions.

Commission in cents = floor(verified net purchase cents × 5 / 100). For a confirmed $100 purchase, commission is exactly $5. Only a direct single-level purchase referral earns; signing up, recruiting another referrer or claiming a screenshot does not earn a commission. Verified net value excludes refunds/cancellations, taxes and pass-through charges; non-USD valuation must be supported by the reviewer's evidence, not an app-invented exchange rate.

The server blocks self-review, known self-referral references, reused orders and repeated normalized receipt links. Different aliases/URLs for one real purchase still require manual identity/evidence checks. One unique order/receipt earns once; there are no duplicate or recurring grants for the same purchase.

Commissions appear by the member's name, separately from task earnings. Overall earned/paid/due totals include both. A reversed unpaid commission remains in the audit history and the order cannot earn again. Paid commissions cannot be silently reversed into a negative balance: payment records must first be reconciled by the owner. Refunds/corrections are manual; the app does not monitor a merchant's refunds.

Ordinary members see only their own claim status/amounts, without receipt URLs, buyer references or raw order IDs. Owners/Managers can inspect purchase evidence to perform verification. Other members cannot view another person's claims. Payment evidence remains owner-only as before. No project-wallet/source data is added to member APIs.

## Work and reward workflow

1. The member selects the reward task type and submits original work with a public evidence link. The server saves that type's current price and policy version; clients cannot choose a custom payout.
2. Another Owner/Manager opens the evidence, checks authorship/publication, confirms originality/no prior cross-post reward, and reviews the stated quality requirements. A person cannot approve/award their own work.
3. On approval, the server checks type, immutable price, duplicate activity/proof, per-type count, member/team weekly budgets, and unpaid cap. Approval and the fixed reward grant are committed together. Failed checks leave the activity pending, without a partial grant.
4. A valid reward appears by the member's name, personal summary, profile, leaderboard and Task rewards table. Ranking uses earned task and referral reward value in the selected period, rather than a percentage of income. Approved-work counts remain available separately.
5. Only Owner records a payment after paying outside this app. Exact cents prevent rounding surprises. Payments cannot exceed earned due. Member APIs omit payment evidence URLs and private notes; the owner can inspect the evidence.
6. Owner can void an incorrect payment/grant with a recorded reason. Records remain in the audit trail. A paid grant cannot be voided until its payment records are reconciled, so balances cannot silently become negative.

One original work earns once. Cross-posting the same work does not create extra rewards. Normalized evidence links prevent repeated paid proof even across members. Different URLs for copied/cross-posted content still require human review; the app does not automatically understand video originality or detect fake engagement. Likes/views/follower counts alone never generate rewards.

Old approved work and counts are preserved with no automatic retroactive dollar grant. Another reviewer may use Review task reward to assign a fixed reward after checking evidence and budgets. Existing historical revenue allocations/payments remain privately stored for owner backup/reconciliation; they are not deleted or converted to USD. This release does not decide whether an old confirmed obligation should be waived.

## Privacy and retired treasury

- No external treasury requests are made. `/api/finance` and its mutation routes return 410 without treasury data.
- `/api/workspace`, `/api/data` and `/api/rewards` exclude historical treasury records, source-wallet addresses and balances. The page contains no configured project wallet/source URL.
- Payment evidence URLs and private payment notes are owner-only, since a transaction evidence page could reveal the sending wallet.
- Owner-only, password-protected backups retain the full original private ledger and security hashes. Never put that backup in a public repository.
- `lib/treasury.js` is now a validation-only compatibility shim and overwrites its old source-connector implementation. The old guide/test filenames are included as replacement files for an in-place upload.
- This removes information from the current application; it cannot erase an address already published on blockchain explorers, another site, old screenshots, or Git commit history. Do not treat the formerly public address as secret.

## Updating GitHub / Render

1. Take an owner-only backup.
2. Extract the ZIP. Upload all contents of `seven-team-dashboard-main/` into the repository root, preserving `assets`, `lib`, and `test`. Include the replacement `lib/treasury.js` and new `lib/rewards.js` and `lib/legacy-treasury.js`.
3. Preserve the existing persistent disk and `DATA_DIR`; never delete `team-data.json` or re-create the existing owner.
4. Node >=22.13.0. Build `npm ci`; start `npm start`.
5. `/health` should report `2026-10-17-marketing-v5.2.0`.
6. Sign in with the existing account and open Task rewards. Set the campaign's actual budget/rates before inviting creators to perform new work.

This ZIP is source code and does not deploy itself. Missing required assets stop startup with a clear upload instruction. Existing schema-3 data is compatible; the optional rewards ledger is created on the first relevant write. No real accounts, passwords or private production data are bundled.

## Password recovery and maintenance

Your account → Create recovery code requires the current password. Download/save the displayed single-use private code before forgetting the password. It expires after 365 days. Generating a new code invalidates the old one. Forgot password? accepts the username, saved code and a new password; a successful reset revokes all old sessions. Password changes and owner starter-password resets also clear the old code.

A member without a saved code contacts the owner for identity verification and a starter-password reset through Team → Manage. An owner without a code can use the existing maintenance recovery procedure: stop the service, privately set `DATA_DIR` to the existing directory and `OWNER_NEW_PASSWORD` to a new 12–200 character password, then run `node tools.js reset-owner`. Remove the password environment variable and restart. Never clear existing data to regain access.

Verify backups with `node tools.js verify-backup /absolute/path/backup.json`. Restore only a verified supported backup with writers stopped, after preserving the current data directory separately. A restore returns accounts, security credentials and reward records to that backup timestamp.

## Research and policy rationale

Fiverr's content-creator cost guide explains fixed-price deliverables, production complexity and scope-based pricing; it does not prescribe one price per social post. TikTok's creator guidance emphasizes originality, quality and engagement and is a separate platform program. The small SEVEN rates above are a proposed project budget, not rates claimed to be paid by those companies or a rule followed by all advanced projects.

- https://www.fiverr.com/resources/guides/costs/content-creator
- https://newsroom.tiktok.com/introducing-the-new-creator-rewards-program

`MARKETING_POLICY_KU.txt` contains the operating policy in Badini Kurdish. `npm test` and `npm run check` verify the package; see TEST_RESULTS.txt for evidence and limits. Real-browser visual QA remains unavailable because Chromium could not be installed in this environment. Check mobile layout and image-picker interactions after deployment.

## Additional research reference

https://www.upwork.com/hire/social-media/cost/

Upwork's $15–$45 hourly range is historical marketplace information; the app's per-task minute assumptions are SEVEN defaults that require local review. There is no scientifically universal Telegram/X per-post tariff claimed here. The explicit formula makes the budget reproducible and auditable, not empirically proven without a pilot.


## SEVEN wallet payouts (5.2)
New accounts and profile saves require a personal, on-curve Solana public address.
Existing accounts remain readable and recoverable; complete the wallet in Edit
profile before submitting new work. A member sees their own address; only Owner
sees other members' addresses. Managers cannot prepare transfers.

In Render environment, set `SEVEN_TOKEN_MINT` to the **verified SEVEN SPL mint**
and `SEVEN_TOKEN_DECIMALS` to that mint's verified decimal precision. Neither has
a guessed default. The supplied address
`ryMZPBP7XsnvTuuVugS3r2Q69QN1TnVM5kQzVPK2YWT` has NOT been verified as a mint
or a sending wallet, and is not hardcoded into a payment link. Do not use a
sending wallet address as the mint. Never put private keys on this server.

Owner opens a member profile or Team rewards, chooses Send SEVEN, enters the
agreed token quantity and prepares a Solana Pay link. The server takes the
recipient from the current saved profile, requires an active member with unpaid
rewards and checks the workspace revision. A second explicit click opens a
compatible installed wallet. Confirm the actual mint, recipient, quantity and
sending account in the wallet. Wallet support varies; the full recipient is
selectable for manual sending. The link cannot force a particular sending wallet.

Task/referral amounts and the existing ledger remain USD valuations. No USD to
SEVEN conversion or market price is assumed. Agree the SEVEN quantity separately.
Opening a wallet does not move funds or clear a balance. After successful payment,
use Record payment with the settled USD valuation, transaction evidence URL and
a note containing SEVEN quantity and agreed conversion. The application does not
verify settlement on-chain or store a token-denominated accounting ledger.

Protocol reference: https://docs.solanapay.com/spec
No production wallet transaction or real-device wallet launch was tested.
