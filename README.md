# SEVEN Family — design and contributions update 3.1.0

This package updates the uploaded application. It does not deploy a live service.

## New in this version

- Gold/violet/black responsive design and the supplied generated SEVEN coin logo.
- Personal summary after sign-in: name, photo, approved count, contribution percentage, rank and pending count.
- Edit profile: each member changes their own name and photo. JPEG, PNG and WebP uploads are cropped centrally and compressed in the browser to a 256px JPEG; photos remain with the existing persistent team data. Initials appear until a photo is uploaded. This is not an automatic Telegram photo import.
- Members page lists everyone, sorted by approved contributions, with names, pictures, counts and percentages. Tap a name for their profile and recent work.
- Three leading contributors appear on the overview and reports. Reports include every member, including zero contributors. Only contributors with approved work receive a podium card.
- Reports offer week, month and all-time periods using Baghdad time. The overview/member summaries are all-time.
- Percentage = approved work by this member / all approved team work in the chosen period × 100. Pending/rejected work never increases rank. Suspended members retain their historical contributions. Equal counts share a rank; tied display order is by name, then member ID. Rounded percentages may sum to 99.9% or 100.1%.
- Profile editing, member lists, reports and existing English/Arabic/Badini UI are supported. Activity forms now include selectable platform tiles.
- Report exports include contribution counts, percentages and ranks, excluding photo bytes.
- Existing schema 3 accounts and records remain compatible. No reset or new database is required.

## Update an existing deployment

1. Use the app's owner-only backup before deploying.
2. Unzip and upload the CONTENTS of `seven-team-dashboard-main` to your repository root. Include `assets`, `lib` and `test` along with `server.js`, `index.html`, `package.json`, `package-lock.json` and `tools.js`.
3. Keep the current persistent disk, `DATA_DIR` and other environment values. Do not upload or replace production data with a local empty directory.
4. Build: `npm ci`. Start: `npm start`. Use Node 24 (or another supported Node version >=22.13).
5. Check `/health` for build `2026-10-13-family-v3.1.0`.
6. Sign in with the existing account. Choose Edit profile to add your name/photo; open Team and Reports to see contributions.

No passwords, live user records, development fixtures, or node_modules are included.

## Verification limits

See TEST_RESULTS.txt. Server/security/storage, ranking logic and frontend render output tests pass. A real-browser visual/end-to-end run could not be completed because Chromium was unavailable and its download failed. Check mobile layout and the image picker after deployment. The layout recreates the reference style; it is not a verified pixel-identical copy.

---

# SEVEN Team Dashboard 3.0.1

An English / Arabic / Badini Kurdish team activity dashboard. This repair supplies the missing `lib/store.js`, `lib/security.js` and automated tests. It preserves the supplied UI and review workflow. It is a team dashboard, not the SEVEN mining bot or a payment service.

## Upload the complete package

Extract the ZIP first. Upload the **contents** of `seven-team-dashboard-main/` into the GitHub repository root, preserving `lib/` and `test/` as folders. Do not upload the ZIP itself as the application, and do not put `store.js` beside `server.js`.

Required paths:

- `server.js`
- `index.html`
- `package.json`
- `package-lock.json`
- `lib/store.js`
- `lib/security.js`
- `tools.js`
- `test/app.test.js`

`npm run check` checks JavaScript syntax. `npm test` runs the included tests. `npm start` starts the server. Node.js 22.13 or newer is required; runtime dependencies are all built into Node.

## Render settings

Use the repository directory containing `package.json` as the service root.

- Build command: `npm ci`
- Start command: `npm start`
- Health path: `/health`
- `NODE_ENV=production`
- `DATA_DIR=/var/data/seven` **only if an actual persistent disk is mounted at `/var/data`**. Otherwise use a directory inside your actual persistent mount.
- For a new workspace: set `SETUP_TOKEN` to a secret random string of at least 24 characters. The app never sends its value to visitors.
- Use one service instance. The JSON store is not designed for multiple writers or horizontal scaling.

The server uses Render's supplied `PORT` and binds to `0.0.0.0`. `/health` should report build `2026-10-13-family-v3.1.0`. Merely setting `DATA_DIR` does not create a persistent disk. Disk/provider setup must be completed in your own service; this package does not provision or purchase hosting.

Generate a setup token privately on your own computer/server:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Open the site and enter this token, your name, username, and a unique 12–200 character password. After creating the owner, setup stays closed; you can remove `SETUP_TOKEN`. Never commit real tokens, passwords, backups or the data directory to GitHub. `.env.example` documents settings; the app does not automatically load `.env`.

## Existing data — read before redeploying

The supplied ZIP contains **no live account or activity data and no original storage/security modules**. Their previous data format and password-hashing parameters cannot be established from this package. This repair uses explicit `schemaVersion: 3` data and `scrypt-v1` credentials. It does **not** invent a migration for unverified older data.

If you already have team accounts/records, first download a private copy of the actual live `team-data.json` before any redeploy or disk-path change. Validate it with:

```bash
node tools.js verify-backup /absolute/path/team-data.json
```

If validation rejects an older format, stop and arrange a migration against that actual format and its original credential algorithm. Do not delete the file, reset the workspace, or change the schema number by hand. Unsupported or corrupt data is refused without overwriting it. A new empty directory cannot reveal that you previously had data elsewhere: verify the correct mount/path before setup.

For a supported backup, stop all writers, preserve the current directory separately, then copy the verified file to `DATA_DIR/team-data.json` with owner-only read/write permissions. Restart one instance and verify records/sign-in. Restore returns the data to the backup timestamp.

## Workflow

- Owner adds members/managers, suspends access, changes roles, resets starter passwords, views audit events and exports private backups.
- New/reset accounts must change their starter password before accessing team data.
- Members submit work and can correct their own pending/rejected entries. Approved work is locked.
- Another Owner or Manager must approve/reject work; nobody can approve their own submission. Rejection requires a reason.
- Duplicate submissions and stale review versions are rejected. Corrections retain previous versions.
- Only approved work counts toward rankings. Reports use Asia/Baghdad calendar periods.
- All signed-in members with completed password setup can see the team's member list and activity feed.
- Reviewers must manually verify proof links; this is not automated payment or proof verification.

## Storage and security

Passwords use random salts and asynchronous scrypt. Sessions are HTTP-only, same-site cookies, expire after 12 hours and are cleared by a restart. Production cookies require HTTPS. Role changes, suspension and password changes revoke that member's sessions. POST actions use CSRF checks; private setup also needs the setup token. Login attempts and cryptographic concurrency are limited.

Transactions are serialized on private drafts. Each write is validated, written to a new file, fsynced and atomically renamed before committing the in-memory draft. The store holds an exclusive `team-data.lock`. A `.initialized` marker prevents silently creating a new workspace when an initialized data file disappears in the same directory.

Before the first mutation of each UTC day, the previous committed file is copied to `backups/YYYY-MM-DD.json`; up to 30 daily backups are retained. These copies are on the same disk. Use **Download backup** and keep a separate private copy for protection against complete disk loss. A downloaded backup contains password hashes and private records.

After an abrupt crash a stale lock may remain. First verify no instance or maintenance command is using this directory, then remove only the stale `team-data.lock` and restart. Never automatically remove the lock at startup.

### Owner password recovery

Stop the service. Set `DATA_DIR` to the existing directory and privately set `OWNER_NEW_PASSWORD` to a fresh 12–200 character starter password. Run:

```bash
node tools.js reset-owner
```

Remove `OWNER_NEW_PASSWORD`, restart and sign in with the same username. Change the starter password immediately. Records are preserved and recovery is audited. Do not run this while the service owns the data-directory lock.

## Validation and limits

The included automated tests exercise protected setup, CSRF/origin/role checks, forced password change, duplicate submissions, review/correction history, stale versions, suspension, session invalidation, private backup export, storage locks, serialized writes, reopen persistence, failed-write rollback, fail-closed data handling and inline-script CSP hashes.

This is a small-team single-instance store: data and sessions are in memory, and each mutation rewrites the JSON file. Back up regularly. Proxy connections may share the same IP limiter; account-specific limits still apply. A larger or multi-instance deployment needs a shared database/session backend.

Local checks do not confirm your live Render environment, disk mount, GitHub upload or pre-existing data compatibility. No live deployment is performed by downloading this package.
