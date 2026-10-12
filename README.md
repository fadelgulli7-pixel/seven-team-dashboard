# SEVEN Team Dashboard v3

A private English / Arabic / Badini Kurdish workspace for team work, reviews and reporting. Node.js 22 or newer; no third-party runtime packages.

## Before upgrading an existing service

**Preserve the live data before any redeploy.** The ZIP contains application code only, not your running team's accounts or records. The old service normally stores them at `data/team-data.json` beside `server.js`, unless `DATA_DIR` was already configured.

1. Locate the actual live `team-data.json` and download a private copy before redeploying. Do not publish it in GitHub. The file contains salted password hashes and private records.
2. Mount a persistent disk. Set `DATA_DIR` to a directory on that disk. Merely setting the environment variable does not make a directory persistent.
3. If moving an existing workspace, stop writes/the old service and copy the complete live file to `DATA_DIR/team-data.json` before starting v3. Do not initialize an empty workspace instead of importing the existing one.
4. Upload **all** source files and folders from this package to the repository, including `lib/`. Keep the existing data directory in place. Use `npm start` and set `NODE_ENV=production`.
5. Run only one instance. This version uses a single-process JSON store with an exclusive lock, not a shared SQL database. Use HTTPS.
6. After startup, sign in using the existing owner's username and password. Existing accounts and activity IDs are retained. Existing activities remain approved historical contributions, explicitly tagged as legacy imports; they are not claimed to have been manually reviewed.
7. Check `/health` for build `2026-10-12-team-v3`, member counts, old work and a new pending/review workflow.

Production startup refuses to run without `DATA_DIR`. It cannot detect whether the hosting provider actually persists that directory; you must configure the disk. No automatic paid disk or hosting plan is provisioned by this package.

## Brand new workspace

Set `SETUP_TOKEN` to a private random string of at least 24 characters. Generate one on your own machine or private server shell:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Enter that code on the initial owner setup page. It is never sent to clients by the server. After the owner exists, the setup endpoint stays closed; you may remove `SETUP_TOKEN`. Existing workspaces do not need this variable to sign in.

## Local use and tests

```bash
npm test
npm start
```

For first-time local setup, set `SETUP_TOKEN` in your shell environment before `npm start`. In development, data defaults to `./data`. The app reads the process environment; `.env.example` is a guide, not an automatically loaded file.

## Team workflow

- **Owner:** adds accounts; changes Manager/Member roles; suspends/restores access; issues starter passwords; downloads private backups and views the last 200 audit events. Full audit history is retained in the data file.
- **Manager:** reviews other people's work and records their own work. Cannot create/manage accounts, export full backups or approve their own work.
- **Member:** records work and corrects their own pending/rejected work. Cannot alter approved work or review others.
- New work is pending until a different Owner or Manager approves it. An owner needs a manager to review the owner's own work.
- Only approved work contributes to performance rankings and growth. Pending work remains visible as pending, including in reports.
- Rejection requires a reason. The author can correct and resubmit the same record. Previous versions and review decisions are retained; outdated review actions are rejected.
- The server attributes work to the signed-in user. Reusing a submission key returns the same record. An identical record or the same proof URL from the same member is blocked. This is not automated proof-of-work verification: reviewers must check the link and description.
- New/reset accounts must choose their own password at first sign-in. Role changes, password resets and suspension revoke all sessions for that member; historical contributions remain.
- Sessions expire after 12 hours and after server restart. Credentials are hashed with salted scrypt; hashes never appear in normal team responses.
- Reports use the Asia/Baghdad calendar, Monday-start weeks and actual calendar months. A dash for growth means the previous period had no approved work, so percentage growth is undefined.
- Automatic refresh every 30 seconds while the page is visible, plus a manual refresh button. Work feed shows 50/200/1000 records at a time; the server still loads the entire small-team dataset. Move to a database and server pagination for large teams.
- Export report downloads JSON for the selected period (including explicit work status). It is not an account backup.

## Storage, backups and recovery

Writes are serialized. Each mutation operates on a private draft. Data is validated, written to a unique temporary file, fsynced, then atomically renamed before the in-memory state is committed. Failed writes leave the previous visible state intact. This does not protect against failure of the entire disk or host.

On migration from v2, an untouched `pre-upgrade-<timestamp>.json` is retained in the same data directory. Before the first write each UTC day, a daily backup of the prior file is kept in `backups/`; the latest 30 backup days are retained. These are local backups on the same disk. Use the owner's **Download backup** regularly and store a copy somewhere separate and private.

Never delete the data file to fix a sign-in issue. If an initialized data file goes missing, startup fails instead of allowing a stranger to create a new owner. Invalid data also fails closed.

### Restore a verified backup

1. Stop the service and all other writers.
2. Validate the chosen backup using `node tools.js verify-backup /absolute/path/backup.json`.
3. Copy the current data directory to a separate private recovery location before replacing anything.
4. Copy the verified backup to the configured directory as `team-data.json`, using restrictive file permissions (owner read/write only).
5. Restart one instance, then check member counts, records and sign-in. Restoration returns the workspace to the backup's timestamp; later records need separate reconciliation.

### Stale lock after a crash

Normal shutdown removes `team-data.lock`. An abrupt termination may leave it behind. **First verify that no process/instance is using this data directory.** Only then remove `DATA_DIR/team-data.lock` and restart one instance. The lock contains PID/host/time for diagnosis. Never automatically remove locks on each startup.

### Owner forgot their password

Stop the service. Keep `DATA_DIR` set to the existing data directory. Privately set `OWNER_NEW_PASSWORD` to a fresh 12–200 character starter password, then run:

```bash
node tools.js reset-owner
```

This requires server-level access, is audited, and preserves records. Remove `OWNER_NEW_PASSWORD`, restart and sign in; change the starter password immediately when prompted. Regular members can use the owner's reset action instead.

## Verification and limits

Run `npm test` for protected setup, CSRF and role checks, review/duplicate concurrency, correction history, session revocation, legacy migration, disk-failure rollback, repeatable rate limits and storage locks. Tests use temporary directories and fictitious users, not production data.

This is a small-team activity tracker, not a miner, wallet, payment processor or rewards contract. No production deployment or production-data migration is performed by downloading this ZIP.
