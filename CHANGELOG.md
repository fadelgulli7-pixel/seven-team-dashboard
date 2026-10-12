# Version 3.0.0 — 2026-10-12

- Protected one-time owner setup using a private environment token.
- Async scrypt, bounded crypto work, repeatable login throttles, expiring sessions, session revocation and stricter CSP.
- Serialized draft transactions, fsynced temporary file writes, atomic replacement, daily local backup retention, pre-migration backup and exclusive writer lock.
- Failure to save no longer leaves a ghost record in the visible state. Corrupt or unexpectedly missing initialized data fails closed.
- Compatibility migration retains existing accounts, credentials, IDs, unknown metadata and historical work credit.
- Owner controls for roles, suspension and password reset; enforced starter-password change and local server-operator owner recovery.
- Pending / approved / rejected work, reviewer notes, author corrections, immutable history, no self-approval, stale-review protection, duplicate submission protection and audit log.
- Approvals drive rankings and growth. Calendar periods use Asia/Baghdad. Reports and private backups can be downloaded.
- Live refresh, search/status filters and constrained feed rendering.
- Fixed translation attribute initialization that could break page startup, modern HTML username-pattern compatibility, calendar month calculation and chart-label spacing.
- Expanded Arabic and Badini labels and mobile/RTL controls.

## Verification

- 9 automated Node integration/storage/security/calendar tests pass (`npm test`), using only temporary test data.
- Full UI workflow tested against the real local HTTP server in a DOM environment: setup, new member, forced password change, submission, rejection, correction, approval, language switch and suspension.
- Chromium tested at 390px mobile and 1440px desktop: setup, submission, account modal, Kurdish RTL, no horizontal overflow and no JavaScript/CSP errors.
- Visual mobile and desktop screenshots reviewed internally.
- No production data accessed or migrated, and no deployment performed.
