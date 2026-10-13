'use strict';
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
const PARAMS = {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024};
function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const digest = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw Error('Invalid password length.');
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = (await scrypt(password, salt, 64, PARAMS)).toString('hex');
  return {passwordAlgorithm: 'scrypt-v1', salt, hash};
}
function validCredentials(record) {
  return record?.passwordAlgorithm === 'scrypt-v1' && /^[a-f0-9]{64}$/.test(record.salt) && /^[a-f0-9]{128}$/.test(record.hash);
}
async function verifyPassword(password, record) {
  if (typeof password !== 'string' || password.length > 200 || !validCredentials(record)) return false;
  const hash = (await scrypt(password, record.salt, 64, PARAMS)).toString('hex');
  return equalSecret(hash, record.hash);
}
class Limiter {
  constructor() { this.items = new Map(); }
  take(key, max, ms) {
    const now = Date.now();
    let entry = this.items.get(key);
    if (!entry || entry.until <= now) {
      // Bound memory without evicting live limits (which would bypass throttles).
      if (this.items.size >= 10000) {
        for (const [id, value] of this.items) if (value.until <= now) this.items.delete(id);
        if (this.items.size >= 10000 && !entry) return false;
      }
      entry = {count: 0, until: now + ms}; this.items.set(key, entry);
    }
    if (entry.count >= max) return false;
    entry.count++; return true;
  }
  clear(key) { this.items.delete(key); }
}
module.exports = {hashPassword, verifyPassword, equalSecret, validCredentials, Limiter};
