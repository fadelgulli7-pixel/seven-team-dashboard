'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {validCredentials} = require('./security');
const {validPhoto} = require('./profile');
const LOCK_MODE = 'sqlite-exclusive-v1';
// Render attaches a persistent disk to only one instance at a time and stops
// the previous instance before mounting it in a replacement. Do not infer
// that guarantee from a different hostname on an arbitrary shared filesystem.
async function isRenderDisk(directory) {
  if (process.platform !== 'linux' || process.env.RENDER !== 'true' ||
      !/^srv-/.test(process.env.RENDER_SERVICE_ID || '')) return false;
  const real = await fs.realpath(directory);
  const mounts = await fs.readFile('/proc/self/mountinfo', 'utf8');
  return mounts.split('\n').some(line => {
    const fields = line.split(' ');
    const mount = (fields[4] || '').replace(/\\([0-7]{3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
    return mount && mount !== '/' && (real === mount || real.startsWith(mount + '/'));
  });
}
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
    need(m.photo===undefined||m.photo===''||validPhoto(m.photo), 'member photo');
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
    await this.acquireLock();
    try {
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
  async acquireLock() {
    // Only this small coordination file uses SQLite. All team data remains in
    // team-data.json. SQLite's OS locks are released even after SIGKILL.
    const sqlite = require('node:sqlite');
    const Database = sqlite.Database || sqlite.DatabaseSync;
    let database;
    try {
      database = new Database(path.join(this.directory, 'team-data.writer.sqlite'));
      database.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS writer_lock (id INTEGER PRIMARY KEY); COMMIT; BEGIN EXCLUSIVE;');
    } catch (e) {
      if (database) database.close();
      if (e.errcode === 5 || e.errcode === 6 || /database is (locked|busy)/i.test(e.message))
        throw Error('Storage is locked. Another writer is still running; no data was changed.');
      throw e;
    }
    this.lockDatabase = database;
    const temp = this.lockPath + '.' + crypto.randomUUID() + '.tmp';
    try {
      await fs.chmod(path.join(this.directory, 'team-data.writer.sqlite'), 0o600);
      let raw;
      try { raw = await fs.readFile(this.lockPath, 'utf8'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (raw !== undefined) {
        let previous;
        try { previous = JSON.parse(raw); }
        catch { throw Error('Storage is locked. Legacy lock metadata is invalid; inspect team-data.lock.'); }
        if (!object(previous)) throw Error('Storage is locked. Legacy lock metadata is invalid; inspect team-data.lock.');
        if (previous.lockMode !== LOCK_MODE) {
          if (!Number.isSafeInteger(previous.pid) || previous.pid <= 0 ||
              typeof previous.host !== 'string' || !previous.host || !date(previous.createdAt))
            throw Error('Storage is locked. Legacy lock metadata is invalid; inspect team-data.lock.');
          if (previous.host === os.hostname()) {
            try { process.kill(previous.pid, 0); }
            catch (e) { if (e.code !== 'ESRCH') throw Error('Storage is locked. Cannot verify the legacy writer has stopped.'); previous.stopped = true; }
            if (!previous.stopped) throw Error('Storage is locked. The legacy writer is still running; no data was changed.');
          } else if (!await isRenderDisk(this.directory)) {
            throw Error('Storage is locked. Cannot verify the legacy writer on another host has stopped.');
          }
          // Archive the original lock for inspection, without touching data.
          await fs.writeFile(this.lockPath + '.legacy-' + crypto.randomUUID() + '.json', raw, {flag: 'wx', mode: 0o600});
          console.log('Recovered stopped legacy storage writer; existing team data preserved.');
        }
      }
      const handle = await fs.open(temp, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify({lockMode: LOCK_MODE, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString()}));
        await handle.sync();
      } finally { await handle.close(); }
      // Keep a permanent sentinel, including on close, so an older app version
      // cannot bypass the new OS lock and start writing simultaneously.
      await fs.rename(temp, this.lockPath);
    } catch (e) { await this.releaseLock(); throw e; }
    finally { await fs.rm(temp, {force: true}); }
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
    if (!this.lockDatabase) return;
    this.lockDatabase.close(); this.lockDatabase = null;
  }
  async close() { this.closed = true; await this.queue; await this.releaseLock(); }
}
module.exports = {FileStore, validate};
