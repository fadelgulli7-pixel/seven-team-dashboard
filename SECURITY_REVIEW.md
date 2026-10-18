# Current supplement — 5.6.4

The user's diagnostic and Phantom primary docs identified wallet-added Lighthouse assertions as the mismatch. Added constrained read-only guard compatibility in lib/payout-message.js. This deliberately replaces whole-message equality ONLY for a strict unchanged-payment prefix plus approved trailing guards. It does not disable guards, remove signed instructions, allow arbitrary programs or permit payment edits. Read README.md for the exact acceptance policy, pinned upstream reference, tests and limits.

71 tests pass, including adversarial edits and guarded retries/chain failure. Real mobile and production transfer still require verification. No dependencies added; no production data or funds touched. Solflare classification unchanged.

---
# Current supplement — v5.6.3

No-download owner diagnostic summary/text field and clipboard/manual-selection fallback. No payout validation relaxation. 68 regression tests pass. Unresolved mobile signed-message mismatch remains under investigation.

---
# Current supplement — 5.6.2

The supplied live screenshot still rejects a changed signed message. The cause remains unconfirmed. Added owner-only bounded diagnostic response and explicit download of a summary containing no signed transaction or signature. No authorization or message-equality checks relaxed. 68 tests pass. Production deployment and real mobile payment remain unverified. See README.md for current instructions and limitations.

---
# Current review — 5.6.1

Reviewed application areas: HTTP authorization and CSRF, auth/recovery/session persistence, atomic storage and backup protections, profile privacy, page/campaign review, rewards and referral ledger, Solana token construction, wallet adapters, browser/server serialization, payout reservation/signature/broadcast/reconciliation, locale error handling, static asset routing and CSP. Historical treasury code remains a validation-only compatibility shim.

Resolved: fixed fees in newly reserved messages, specific signed-validation errors, visible uncertain-status notices, and reconciliation before wallet signing. No signed-message relaxation. 66 tests passed; production dependency npm audit: zero known advisories. See README.md for detailed findings, evidence, legacy-job instructions and operational limitations.

Mobile Phantom signed-validation root cause remains unconfirmed until the updated build is tested on the device; wallet automatic fee insertion is a documented compatibility risk addressed by the patch. Solflare site classification requires its support review. No production data or funds were touched.

---
Historical security review:

# Security review — SEVEN Marketing 5.5.1

## Findings resolved

- High advisory GHSA-3gc7-fjrx-p6mg in native bigint-buffer and affected dependents: removed the dependency chain entirely, without suppressing audit results.
- stream-json advisories GHSA-528h-pc64-c93x, GHSA-hqr4-qq8f-hg3x and GHSA-mjw6-4jj6-33hc: removed by upgrading jayson to 5.0.0.
- uuid advisory GHSA-w5hq-g745-h8pq: removed affected dependency through the same upgrade.

Advisory details: https://github.com/advisories/GHSA-3gc7-fjrx-p6mg and https://github.com/advisories/GHSA-w5hq-g745-h8pq .

## Controls checked

Role enforcement on server APIs, starter-password restrictions, anonymous access, CSRF and Origin checks, independent review, escaping of user content, CSP, private contact/wallet/backup handling, password hash/recovery controls, persisted session token digests and revocation, atomic store writes, signed transaction message equality, exactly-once ledger reconciliation and duplicate payment reservations.

## Evidence and boundaries

56 automated tests pass, including a real local RPC request and transaction compatibility fixtures against the official prior SDK. Production dependencies report zero known advisories at review time. See TEST_RESULTS.txt and DEPENDENCY_AUDIT.json.

Not an independent security certification. Actual Render environment, account security, persistent disk, backups, mobile Phantom flow and live payment remain operational checks. Start with a few authorized members after deployment and verify one end-to-end submission/review and a deliberately small owner-approved payment before broad onboarding. No seed phrase/private key is stored by this app. Owner/manager access intentionally allows the documented reviews; any stolen privileged account remains a material risk.

Production read-only observation: v5.5.0; anonymous /api/me was rejected (401). Deploy this patch first, then verify build v5.5.1. No production mutation was performed.
