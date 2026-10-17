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
