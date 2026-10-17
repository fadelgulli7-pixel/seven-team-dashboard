# SEVEN Network · Marketing Team — v4.1.0

Updated from the latest SEVEN Family Treasury v4.0 package. Keeps existing schema-3 accounts, approved work, pictures, allocation history and payment records.

## Changes

- Marketing branding replaces SEVEN Family across the interface.
- Every member's name is accompanied by approved-work count, contribution percentage and their calculated share of the 20% team pool. Amounts appear in the personal summary, members, top three, profiles and reports.
- Cash estimates refresh automatically with source data and approved activities, without a manual calculation. Monetary estimates always use all-time approved work, even when the Reports chart is filtered by week/month.
- A complete workspace response supplies work and finance from one store revision, avoiding mismatched percentages during concurrent reviews.
- Forgotten-password recovery uses a private, single-use code created from Your account. No email service or personal email collection is required.
- Missing logo/contribution assets now stop startup with a clear upload instruction, rather than loading a broken dashboard.

## Revenue calculation

Wallet: `UQDzW3xe_-MS8DRXRAAN6LpzzXRqLYOrRNa-b9kLaPKlSyN8`.

Source: `https://seven-transparency.onrender.com/api/dashboard`, read-only and cached for 60 seconds. The browser polls while visible every 30 seconds; it does not speed up the upstream source. This release does not change the transparency application.

1. Eligible revenue = incoming receipts for the configured wallet that the source labels revenue or leaves unannotated. Excluded classifications stay excluded. Current wallet holdings are separate from revenue.
2. Team pool = floor(revenue in atomic units / 5): 20%.
3. Unallocated amount = pool minus previously fixed batches.
4. Estimated next share = positive unallocated amount distributed by each member's all-time approved-work count / the team's approved-work count.
5. Displayed total share = previously fixed entitlement + estimated next share.
6. Estimated unpaid = displayed total share minus recorded payments. The app shows settled due separately, so an estimate is not mistaken for a fixed payable amount.

Example: 100 GRAM eligible revenue gives a 20 GRAM team pool. A member with 25% of approved work receives a 5 GRAM estimate if nothing was previously allocated.

Exact BigInt arithmetic and largest-remainder allocation preserve every atomic unit. Equal contributions share rank; suspended members retain historical contributions. Pending/rejected work contributes zero. GRAM (the upstream label for native TON) and USDT are separate assets and are never added together or converted to USD.

New work changes unallocated estimates. It never rewrites fixed batches or previous payments. Only Owner can fix a batch or record/void a payment. This application calculates shares; it does not transfer funds. Payment entries remain owner declarations with evidence, not automatic blockchain verification.

Unavailable or inconsistent source data shows an unknown estimate, not a fabricated zero. Stale/incomplete data is labeled and cannot be used for a new fixed allocation. If revenue falls below previous fixed allocations, estimates are withheld and fixed records remain visible. The external transparency site's allocation labels are independent of this team's 20% policy; do not treat different labels as additional budgets.

## Forgotten password

While still signed in:

1. Open Your account → Create recovery code (also available from the personal summary reminder).
2. Re-enter the current password.
3. Download/save the displayed private code. It is shown once, expires after 365 days, and can be used once. Creating another code cancels the previous code.

If the password is forgotten:

1. Choose Forgot password? on the login page.
2. Enter username, saved recovery code, new password and its confirmation.
3. Sign in with the new password. All old sessions are revoked and the code is consumed. Create/save another code after signing in.

If a member did not save a code, the owner must verify their identity outside the app, then use Team → Manage → Reset password. The member must change that starter password on sign-in. An owner without a code can use the existing server-operator recovery command below.

Codes are generated from 32 cryptographically random bytes and stored only as SHA-256 hashes. Codes/hashes are excluded from ordinary member APIs. Recovery is rate limited and rejects suspended, expired, reused or superseded codes. Password changes and owner password resets invalidate the previous recovery code. No recovery codes or real passwords are bundled in this ZIP.

Recovery design reference: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

## Upload/update

1. Download a private backup from the existing owner account.
2. Extract the ZIP and upload the CONTENTS of `seven-team-dashboard-main/` into the repository root. Preserve `assets/`, `lib/` and `test/`. Do not upload the ZIP itself or nest the source under an extra directory.
3. Keep the existing persistent disk and `DATA_DIR`. Do not delete/replace `team-data.json`, reinitialize the owner, or clear the disk.
4. Node >=22.13.0 (Node 24 supported). Build: `npm ci`. Start: `npm start`.
5. `/health` must report `2026-10-17-marketing-v4.1.0` after deployment. Sign in with the existing account. No new setup is required.

For a new installation only: configure a persistent data directory and a private `SETUP_TOKEN` of at least 24 characters; the setup screen creates the first owner. Production requires `NODE_ENV=production` and `DATA_DIR` within an actual persistent disk. Preserve those settings when updating. The server binds Render's supplied `PORT`.

## Backup and server-operator recovery

Owner → Download backup requires the current password. It contains private team records and password/recovery hashes; keep it private and never upload it to a public repository. Verify a backup with:

```
node tools.js verify-backup /absolute/path/team-backup.json
```

For owner recovery when no saved code exists, stop the service first. Set `DATA_DIR` to the existing persistent data directory and privately set `OWNER_NEW_PASSWORD` to a new 12–200 character starter password, then run:

```
node tools.js reset-owner
```

Remove `OWNER_NEW_PASSWORD` and restart. The owner must change the starter password. This preserves existing records and clears the old recovery code. The tool refuses an absent/mistyped data directory. Never delete storage locks while another writer is running.

Restore only a verified supported backup with all writers stopped: preserve the current data directory separately, copy the verified file as `DATA_DIR/team-data.json` with owner-only read/write permission, restart one instance and verify sign-in and records. Restore returns to the backup's timestamp, including old credentials; code generation/rotation performed after that timestamp is not retained.

## Verification

`npm test`: 26 passing tests. `npm run check`: passing syntax checks. See `TEST_RESULTS.txt` for scope and limits.

No live Render deployment, source-wallet verification or production-data edits were made by this update. Browser visual testing could not run because Chromium was unavailable and its download failed; check the deployed mobile/desktop interface and image picker. No screenshot or pixel-identical claim is made.
