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
