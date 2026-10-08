# SEVEN Team Dashboard

A shared team activity dashboard with English, Arabic, and Badini Kurdish interface options. Team members sign in to their own accounts and record activities under their own names. The server stores members and activities together in a JSON data file; team members using the same deployment see the same data.

## Run locally

Requires Node.js 18 or newer. No third-party packages are required.

```bash
npm start
```

Open http://localhost:3000. On the first visit, create the workspace owner's account. Use a unique username and a strong password of at least 12 characters. The owner can add managers and members from the Team Members page and give each person their username and starter password privately. Members can change their passwords from the account button after signing in.

## Data storage

By default, data is stored in `./data/team-data.json`. Set `DATA_DIR` to a persistent writable directory when deploying. For example, on a host with persistent disks, mount a disk and point `DATA_DIR` to its mount path. If the host uses an ephemeral filesystem, data can be lost when the app restarts or redeploys. Run one server instance for this JSON-file storage; multiple instances need a shared database.

Back up `team-data.json` regularly. Passwords are stored as salted scrypt hashes. The server does not provide password reset or account recovery, so the owner should keep credentials safe.

## Roles and activity records

- Owner: creates the first account and can add team members.
- Manager and Member: can sign in and add activities.
- Each activity is attributed by the server to the signed-in account; the form cannot select another person.
- Summary cards, charts, category counts, and contributor reports use saved activity records.

The app keeps the selected language in the browser. Team records are stored on the server, not in browser storage.

Existing browser-only demo records are not imported automatically. A fresh deployment starts with an empty team; create member accounts and enter new activity records after setup.
