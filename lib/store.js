'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {validCredentials} = require('./security');
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function validate(d) {
  const need = (ok, message) => { if (!ok) throw Error('Invalid team data: ' + message + '. Existing data was not replaced.'); };
  need(object(d) && d.schemaVersion === 3, 'unsupported schema; an explicit migration is required');
  need(Number.isSafeInteger(d.revision) && d.revision >= 0, 'revision');
  need(Array.isArray(d.members) && Array.isArray(d.activities) && Array.isArray(d.audit), 'collections');
  const ids = new Set(), names = new Set(), activityIds = new Set();
  for (const m of d.members) {
    need(object(m) && typeof m.id === 'string' && ID.test(m.id) && !ids.has(m.id), 'member ID'); ids.add(m.id);
    need(typeof m.username === 'string' && /^[a-z0-9_.-]{3,32}$/.test(m.username) && !names.has(m.username), 'unique username'); names.add(m.username);
    need(typeof m.name === 'string' && m.name.length >= 2 && m.name.length <= 50, 'member name');
    need(['Owner','Manager','Member'].includes(m.role) && typeof m.active === 'boolean' && typeof m.mustChangePassword === 'boolean', 'member access');
    need(Number.isSafeInteger(m.authVersion) && m.authVersion >= 0 && validCredentials(m), 'credentials');
    need(date(m.createdAt), 'member date');
  }
  need(d.members.length === 0 || d.members.filter(m => m.role === 'Owner' && m.active).length === 1, 'one active owner');
  for (const a of d.activities) {
    need(object(a) && ID.test(a.id) && !activityIds.has(a.id), 'activity ID'); activityIds.add(a.id);
    need(ids.has(a.memberId) && typeof a.title === 'string' && a.title.length >= 2 && a.title.length <= 90, 'activity author/title');
    need(['pending','approved','rejected'].includes(a.status) && Number.isSafeInteger(a.version) && a.version >= 1 && Array.isArray(a.history), 'activity review');
    need(date(a.createdAt) && typeof a.description === 'string' && a.description.length <= 300, 'activity date/description');
    need(typeof a.link === 'string', 'activity link');
    if (a.link) { let u; try { u = new URL(a.link); } catch {} need(u && ['https:','http:'].includes(u.protocol) && !u.username && !u.password && a.link.length <= 2048, 'safe activity link'); }
    need(typeof a.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(a.fingerprint) && ID.test(a.requestKey), 'submission identity');
  }
  for (const e of d.audit) need(object(e) && typeof e.action === 'string' && date(e.createdAt), 'audit event');
  return d;
}
class FileStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'team-data.json');
    this.lockPath = path.join(directory, 'team-data.lock');
    this.marker = path.join(directory, '.initialized');
    this.queue = Promise.resolve(); this.closed = true;
  }
  async open() {
    await fs.mkdir(this.directory, {recursive: true, mode: 0o700});
    try { this.lock = await fs.open(this.lockPath, 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') throw Error('Storage is locked. Stop other writers; inspect team-data.lock before removing a stale lock.'); throw e; }
    try {
      await this.lock.writeFile(JSON.stringify({pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString()}));
      await this.lock.sync();
      let raw;
      try { raw = await fs.readFile(this.file, 'utf8'); }
      catch (e) {
        if (e.code !== 'ENOENT') throw e;
        let initialized = false;
        try { await fs.access(this.marker); initialized = true; } catch (err) { if (err.code !== 'ENOENT') throw err; }
        if (initialized) throw Error('Initialized team-data.json is missing. Restore a verified backup; do not create a new owner.');
        this.data = {schemaVersion: 3, revision: 0, members: [], activities: [], audit: []};
        await this.writeAtomic(this.data);
      }
      if (raw !== undefined) this.data = validate(JSON.parse(raw));
      await fs.writeFile(this.marker, 'SEVEN team schema 3\n', {mode: 0o600});
      this.closed = false; return this;
    } catch (e) { await this.releaseLock(); throw e; }
  }
  async writeAtomic(data) {
    const temp = this.file + '.' + crypto.randomUUID() + '.tmp';
    let handle;
    try {
      handle = await fs.open(temp, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(data, null, 2) + '\n');
      await handle.sync(); await handle.close(); handle = null;
      await fs.rename(temp, this.file);
      // Rename is the commit point. A subsequent directory-sync failure must
      // not report a rollback: the destination already contains the new data.
      try { const dir = await fs.open(this.directory, 'r'); try { await dir.sync(); } finally { await dir.close(); } }
      catch (e) { console.error('Directory sync unavailable:', e.code); }
    } finally { if (handle) await handle.close(); await fs.rm(temp, {force: true}); }
  }
  async backup() {
    const directory = path.join(this.directory, 'backups');
    await fs.mkdir(directory, {recursive: true, mode: 0o700});
    const name = new Date().toISOString().slice(0, 10) + '.json';
    // Copy the previous committed file, once per UTC day. Never overwrite it.
    try { await fs.copyFile(this.file, path.join(directory, name), require('node:fs').constants.COPYFILE_EXCL); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    const names = (await fs.readdir(directory)).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    for (const old of names.slice(0, Math.max(0, names.length - 30))) await fs.unlink(path.join(directory, old));
  }
  transaction(fn) {
    if (this.closed) return Promise.reject(Error('Store is closed.'));
    const next = this.queue.then(async () => {
      const draft = structuredClone(this.data);
      const result = await fn(draft);
      draft.revision = this.data.revision + 1;
      validate(draft);
      await this.backup();
      await this.writeAtomic(draft);
      this.data = draft;
      return structuredClone(result);
    });
    this.queue = next.catch(() => {}); return next;
  }
  async releaseLock() {
    if (!this.lock) return;
    await this.lock.close(); this.lock = null;
    await fs.unlink(this.lockPath);
  }
  async close() { this.closed = true; await this.queue; await this.releaseLock(); }
}
module.exports = {FileStore, validate};
