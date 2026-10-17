'use strict';
const crypto=require('node:crypto');
const {equalSecret}=require('./security');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function normalized(code){return typeof code==='string'?code.trim().toUpperCase().replace(/[-\s]/g,''):'';}
function issue(){const raw=crypto.randomBytes(32).toString('hex').toUpperCase();return {code:raw.match(/.{8}/g).join('-'),record:{hash:digest(raw),expiresAt:new Date(Date.now()+365*86400000).toISOString()}};}
function valid(record){return record&&/^[a-f0-9]{64}$/.test(record.hash)&&typeof record.expiresAt==='string'&&Number.isFinite(Date.parse(record.expiresAt));}
function matches(record,code){const raw=normalized(code);return !!(valid(record)&&raw.length===64&&/^[A-F0-9]+$/.test(raw)&&Date.parse(record.expiresAt)>Date.now()&&equalSecret(digest(raw),record.hash));}
module.exports={issue,valid,matches};
