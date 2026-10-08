'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'team-data.json');
const PORT = Number(process.env.PORT) || 3000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'seven_session';
const MAX_BODY = 32 * 1024;
const categories = ['Marketing', 'Content', 'Community', 'Partnership', 'Development', 'Other'];
const platforms = ['X (Twitter)', 'Telegram', 'YouTube', 'TikTok', 'Instagram', 'Discord', 'Website', 'Blog', 'Business', 'Other'];
const sessions = new Map();
const loginAttempts = new Map();
let setupInProgress = false;
let store = { members: [], activities: [] };
let writeQueue = Promise.resolve();

function send(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(value));
}
function fail(res, status, message) { send(res, status, { error: message }); }
function newId() { return crypto.randomUUID(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, member) {
  if (!member.passwordSalt || !member.passwordHash) return false;
  const candidate = crypto.scryptSync(password, member.passwordSalt, 64);
  const expected = Buffer.from(member.passwordHash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function safeMember(member) {
  return { id: member.id, name: member.name, handle: member.handle, username: member.username, role: member.role, initials: member.initials, createdAt: member.createdAt };
}
function persist() {
  const task = writeQueue.catch(() => {}).then(async () => {
    const temp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
    await fs.promises.rename(temp, DB_FILE);
  });
  writeQueue = task;
  return task;
}
async function loadStore() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  try {
    const parsed = JSON.parse(await fs.promises.readFile(DB_FILE, 'utf8'));
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.activities)) throw new Error('Invalid team data file');
    store = parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    store = { members: [], activities: [] };
    await persist();
  }
}
function cookieSecure(req) { return req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https'; }
function cookieHeader(req, value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cookieSecure(req) ? '; Secure' : ''}`;
}
function getSession(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9-]+)`));
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session || session.expiresAt < Date.now()) { sessions.delete(match[1]); return null; }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}
function requireSession(req, res) {
  const session = getSession(req);
  if (!session) { fail(res, 401, 'Please sign in again.'); return null; }
  return session;
}
function csrfOk(req, session) { return req.headers['x-csrf-token'] === session.csrf; }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => { if (tooLarge) return; body += chunk; if (Buffer.byteLength(body) > MAX_BODY) { tooLarge = true; reject(Object.assign(new Error('Request is too large.'), { status: 413 })); } });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(Object.assign(new Error('Invalid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function validPassword(password) { return typeof password === 'string' && password.length >= 12 && password.length <= 200; }
function validName(name) { return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 50; }
function validUsername(username) { return typeof username === 'string' && /^[a-zA-Z0-9_.-]{3,32}$/.test(username); }
function createMember({ name, handle, username, password, role }) {
  const cleanName = name.trim();
  const cleanHandle = String(handle || '').trim().replace(/^@+/, '').slice(0, 40);
  const credentials = hashPassword(password);
  return { id: newId(), name: cleanName, handle: cleanHandle ? `@${cleanHandle}` : `@${username}`, username: username.toLowerCase(), role, initials: cleanName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(), passwordSalt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date().toISOString() };
}
async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, { setupNeeded: store.members.length === 0 });
  if (req.method === 'POST' && url.pathname === '/api/setup') {
    if (store.members.length || setupInProgress) return fail(res, 409, 'The owner account is already set up.');
    setupInProgress = true;
    let body;
    try { body = await readBody(req); } catch (err) { setupInProgress = false; throw err; }
    if (!isObject(body)) { setupInProgress = false; return fail(res, 400, 'Invalid request.'); }
    if (store.members.length) return fail(res, 409, 'The owner account is already set up.');
    if (!validName(body.name) || !validUsername(body.username) || !validPassword(body.password)) { setupInProgress = false; return fail(res, 400, 'Enter a name, a username with 3–32 letters or numbers, and a password of at least 12 characters.'); }
    const owner = createMember({ ...body, role: 'Owner' });
    store.members.push(owner);
    try { await persist(); } finally { setupInProgress = false; }
    const sid = newId(); const csrf = newId(); sessions.set(sid, { memberId: owner.id, csrf, expiresAt: Date.now() + SESSION_TTL_MS });
    return send(res, 201, { member: safeMember(owner), csrf }, { 'Set-Cookie': cookieHeader(req, sid, SESSION_TTL_MS / 1000) });
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    if (!isObject(body)) return fail(res, 400, 'Invalid request.');
    const username = String(body.username || '').trim().toLowerCase();
    const attemptKey = `${req.socket.remoteAddress}:${username}`;
    const attempt = loginAttempts.get(attemptKey);
    if (attempt && attempt.until > Date.now()) return fail(res, 429, 'Too many login attempts. Try again later.');
    const member = store.members.find(m => m.username === username);
    if (!member || typeof body.password !== 'string' || !verifyPassword(body.password, member)) {
      const count = (attempt && Date.now() - attempt.started < 15 * 60 * 1000 ? attempt.count : 0) + 1;
      loginAttempts.set(attemptKey, { count, started: attempt?.started || Date.now(), until: count >= 8 ? Date.now() + 15 * 60 * 1000 : 0 });
      return fail(res, 401, 'Username or password is incorrect.');
    }
    loginAttempts.delete(attemptKey);
    const sid = newId(); const csrf = newId(); sessions.set(sid, { memberId: member.id, csrf, expiresAt: Date.now() + SESSION_TTL_MS });
    return send(res, 200, { member: safeMember(member), csrf }, { 'Set-Cookie': cookieHeader(req, sid, SESSION_TTL_MS / 1000) });
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = getSession(req);
    if (session && !csrfOk(req, session)) return fail(res, 403, 'Request could not be verified.');
    const raw = req.headers.cookie || ''; const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9-]+)`));
    if (match) sessions.delete(match[1]);
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, '', 0) });
  }
  const session = requireSession(req, res);
  if (!session) return;
  const member = store.members.find(m => m.id === session.memberId);
  if (!member) return fail(res, 401, 'Please sign in again.');
  if (req.method === 'GET' && url.pathname === '/api/me') return send(res, 200, { member: safeMember(member), csrf: session.csrf });
  if (req.method === 'GET' && url.pathname === '/api/data') return send(res, 200, { member: safeMember(member), members: store.members.map(safeMember), activities: store.activities });
  if (req.method === 'POST' && !csrfOk(req, session)) return fail(res, 403, 'Request could not be verified.');
  if (req.method === 'POST' && url.pathname === '/api/password') {
    const body = await readBody(req);
    if (!isObject(body)) return fail(res, 400, 'Invalid request.');
    if (!verifyPassword(String(body.currentPassword || ''), member)) return fail(res, 401, 'Current password is incorrect.');
    if (!validPassword(body.newPassword)) return fail(res, 400, 'The new password must have at least 12 characters.');
    const credentials = hashPassword(body.newPassword);
    member.passwordSalt = credentials.salt; member.passwordHash = credentials.hash;
    await persist();
    for (const [sid, active] of sessions) if (active.memberId === member.id && active !== session) sessions.delete(sid);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/activities') {
    const body = await readBody(req);
    if (!isObject(body)) return fail(res, 400, 'Invalid request.');
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 2 || title.length > 90 || !categories.includes(body.category)) return fail(res, 400, 'Enter a title and choose a valid category.');
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) : '';
    const platform = platforms.includes(body.platform) ? body.platform : 'Other';
    let link = '';
    if (body.link) { try { const parsed = new URL(body.link); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); link = parsed.href; } catch { return fail(res, 400, 'Enter a valid http or https link.'); } }
    const activity = { id: newId(), user: member.name, handle: member.handle, initials: member.initials, memberId: member.id, title, category: body.category, platform, description, link, createdAt: new Date().toISOString() };
    store.activities.unshift(activity); await persist(); return send(res, 201, { activity });
  }
  if (req.method === 'POST' && url.pathname === '/api/members') {
    if (member.role !== 'Owner') return fail(res, 403, 'Only the owner can add team members.');
    const body = await readBody(req);
    if (!isObject(body)) return fail(res, 400, 'Invalid request.');
    if (!validName(body.name) || !validUsername(body.username) || !validPassword(body.password)) return fail(res, 400, 'Enter a name, a username with 3–32 letters or numbers, and a password of at least 12 characters.');
    const role = ['Manager', 'Member'].includes(body.role) ? body.role : 'Member';
    if (store.members.some(m => m.username === body.username.toLowerCase())) return fail(res, 409, 'That username is already in the team.');
    const added = createMember({ ...body, role }); store.members.push(added); await persist(); return send(res, 201, { member: safeMember(added) });
  }
  return fail(res, 404, 'Not found.');
}
function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
  let file;
  if (url.pathname === '/' || url.pathname === '/index.html') file = path.join(ROOT, 'index.html');
  else return res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }), res.end('Not found');
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('App could not be loaded.'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return fail(res, 400, 'Invalid request URL.'); }
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    if (res.headersSent || res.destroyed) return;
    fail(res, err.status || 500, err.status ? err.message : 'The request could not be completed.');
    if (!err.status) console.error(err);
  }
});
loadStore().then(() => server.listen(PORT, '0.0.0.0', () => console.log(`SEVEN Team is running on port ${PORT}`))).catch(err => { console.error('Could not load the team data file:', err); process.exit(1); });
