'use strict';
const crypto=require('node:crypto');
const WALLET='UQDzW3xe_-MS8DRXRAAN6LpzzXRqLYOrRNa-b9kLaPKlSyN8';
const RAW='0:f35b7c5effe312f0345744000de8ba73cd746a2d83ab44d6be6fd90b68f2a54b';
const SOURCE='https://seven-transparency.onrender.com';
const ASSETS=[{id:'TON',symbol:'GRAM',decimals:9},{id:'0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe',symbol:'USDT',decimals:6}];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const integer=s=>typeof s==='string'&&/^\d{1,40}$/.test(s);
function units(s,decimals){if(typeof s!=='string'||!/^\d{1,20}(\.\d{1,9})?$/.test(s))fail('Enter a positive decimal amount.');let [a,b='']=s.split('.');if(b.length>decimals)fail('Too many decimal places.');const n=BigInt(a)*10n**BigInt(decimals)+BigInt(b.padEnd(decimals,'0')||'0');if(n<=0n)fail('Amount must be positive.');return n;}
function parseSnapshot(d){
 if(!d||!d.configured||!Number.isFinite(Date.parse(d.updatedAt))||!Array.isArray(d.wallets)||!Array.isArray(d.rows))fail('Treasury source is unavailable.',503);
 const w=d.wallets.find(w=>w&&w.address===RAW);if(!w)fail('Treasury wallet does not match.',503);
 const seen=new Set();const receipts=d.rows.filter(r=>r&&r.to===RAW&&r.direction==='in'&&(!r.annotation||r.annotation.category==='revenue'));
 for(const r of receipts){if(typeof r.id!=='string'||seen.has(r.id)||!integer(r.raw)||!r.asset||typeof r.asset.id!=='string')fail('Invalid treasury records.',503);seen.add(r.id);}
 const assets=ASSETS.map(a=>{const b=(w.balances||[]).find(b=>b.asset.id===a.id);if(b&&(!integer(b.raw)||b.asset.decimals!==a.decimals))fail('Invalid asset balance.',503);const rows=receipts.filter(r=>r.asset.id===a.id);if(rows.some(r=>r.asset.decimals!==a.decimals))fail('Invalid asset precision.',503);const revenue=rows.reduce((s,r)=>s+BigInt(r.raw),0n);return {...a,balance:b?.raw??null,revenue:String(revenue),pool:String(revenue/5n),receiptIds:rows.map(r=>r.id)};});
 return {updatedAt:d.updatedAt,partial:w.complete!==true,sourceStale:!!d.stale||!!d.lastError,assets};
}
function sourceFresh(s){return !!s&&!s.partial&&!s.sourceStale&&Date.now()-Date.parse(s.updatedAt)<30*60*1000&&Date.parse(s.updatedAt)<=Date.now()+60000;}
function createTreasury(fetcher=fetch){let snapshot=null,lastAttempt=0,error=null,pending;return async()=>{if(Date.now()-lastAttempt>60000&&!pending){lastAttempt=Date.now();pending=(async()=>{try{const r=await fetcher(SOURCE+'/api/dashboard',{signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Error();const txt=await r.text();if(txt.length>10*1024*1024)throw Error();snapshot=parseSnapshot(JSON.parse(txt));error=null;}catch{error='Treasury sync failed. Last successful data may be outdated.';}finally{pending=null;}})();}if(pending)await pending;return {snapshot,error};};}
function ledger(d){return d.treasury||{batches:[],payments:[]};}
function distribute(amount,members,activities){
 const counts=new Map();for(const a of activities)if(a.status==='approved')counts.set(a.memberId,(counts.get(a.memberId)||0)+1);
 const rows=members.map(m=>({memberId:m.id,name:m.name,count:counts.get(m.id)||0})).filter(m=>m.count>0).sort((a,b)=>a.memberId.localeCompare(b.memberId));
 const total=rows.reduce((s,r)=>s+r.count,0);if(!total)return [];
 let left=amount;for(const r of rows){r.raw=String(amount*BigInt(r.count)/BigInt(total));r.remainder=amount*BigInt(r.count)%BigInt(total);left-=BigInt(r.raw);}
 for(const r of [...rows].sort((a,b)=>a.remainder===b.remainder?a.memberId.localeCompare(b.memberId):a.remainder>b.remainder?-1:1)){if(!left)break;r.raw=String(BigInt(r.raw)+1n);left--;}
 return rows.map(({remainder,...r})=>r);
}
function summary(d,state){const l=ledger(d);const approved=d.activities.filter(a=>a.status==='approved');const workCounts=new Map();for(const a of approved)workCounts.set(a.memberId,(workCounts.get(a.memberId)||0)+1);return {wallet:WALLET,source:SOURCE,percent:20,updatedAt:state.snapshot?.updatedAt||null,partial:state.snapshot?.partial??true,fresh:sourceFresh(state.snapshot)&&!state.error,error:state.error,assets:ASSETS.map(a=>{
 const s=state.snapshot?.assets.find(x=>x.id===a.id);const batches=l.batches.filter(b=>b.assetId===a.id),payments=l.payments.filter(p=>p.assetId===a.id&&!p.voidedAt);const allocated=batches.reduce((n,b)=>n+BigInt(b.raw),0n),paid=payments.reduce((n,p)=>n+BigInt(p.raw),0n);const unallocated=s?BigInt(s.pool)-allocated:null;
 const estimates=distribute(unallocated>0n?unallocated:0n,d.members,d.activities);
 return {...a,balance:s?.balance??null,revenue:s?.revenue??null,pool:s?.pool??null,allocated:String(allocated),paid:String(paid),outstanding:String(allocated-paid),unallocated:unallocated===null?null:String(unallocated),members:d.members.map(m=>{const entitled=batches.reduce((n,b)=>n+BigInt(b.allocations.find(x=>x.memberId===m.id)?.raw||0),0n),p=payments.filter(p=>p.memberId===m.id).reduce((n,p)=>n+BigInt(p.raw),0n);const estimate=unallocated===null||unallocated<0n?null:(estimates.find(x=>x.memberId===m.id)?.raw||'0');const count=workCounts.get(m.id)||0;return {memberId:m.id,approvedCount:count,approvedTotal:approved.length,workPercent:approved.length?count/approved.length*100:0,entitled:String(entitled),paid:String(p),owed:String(entitled-p),estimate,estimatedTotal:estimate===null?null:String(entitled+BigInt(estimate)),estimatedUnpaid:estimate===null?null:String(entitled-p+BigInt(estimate))};})};}),batches:l.batches,payments:l.payments};}
function settle(d,state,b,actor){
 if(!sourceFresh(state.snapshot)||state.error)fail('A fresh, complete treasury snapshot is required.',409);
 if(b.revision!==d.revision||b.sourceUpdatedAt!==state.snapshot.updatedAt)fail('This record changed. Refresh and try again.',409);
 if(typeof b.note!=='string'||b.note.trim().length<3||b.note.length>200)fail('Enter a settlement title (3–200 characters).');
 const a=summary(d,state).assets.find(a=>a.id===b.assetId);if(!a)fail('Invalid asset.');const raw=BigInt(a.unallocated);if(raw<=0n)fail('No unallocated team budget.',409);
 const allocations=distribute(raw,d.members,d.activities);if(!allocations.length)fail('Approve work before allocating funds.',409);
 const batch={id:crypto.randomUUID(),assetId:a.id,raw:String(raw),note:b.note.trim(),createdAt:new Date().toISOString(),actorId:actor.id,actorName:actor.name,sourceUpdatedAt:state.snapshot.updatedAt,revenue:a.revenue,pool:a.pool,percent:20,weighting:'all-time-approved-work',activityIds:d.activities.filter(a=>a.status==='approved').map(a=>a.id),receiptIds:state.snapshot.assets.find(x=>x.id===a.id).receiptIds,allocations};
 d.treasury??={batches:[],payments:[]};d.treasury.batches.push(batch);return batch;
}
function payment(d,b,actor){
 if(b.revision!==d.revision)fail('This record changed. Refresh and try again.',409);
 const a=ASSETS.find(a=>a.id===b.assetId);if(!a||!d.members.some(m=>m.id===b.memberId))fail('Invalid asset or member.');
 const raw=units(b.amount,a.decimals),l=ledger(d);const due=summary(d,{snapshot:null}).assets.find(x=>x.id===a.id).members.find(x=>x.memberId===b.memberId);
 if(raw>BigInt(due.owed))fail('Payment exceeds the settled amount due.',409);
 let u;try{u=new URL(b.proof);if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048)throw Error();u.hash='';}catch{fail('Enter an HTTPS payment evidence link.');}
 if(typeof b.note!=='string'||b.note.trim().length<3||b.note.length>200)fail('Enter a payment note (3–200 characters).');
 if(l.payments.some(p=>!p.voidedAt&&p.proof===u.href))fail('This payment evidence is already recorded.',409);
 const p={id:crypto.randomUUID(),assetId:a.id,memberId:b.memberId,raw:String(raw),proof:u.href,note:b.note.trim(),createdAt:new Date().toISOString(),actorId:actor.id,actorName:actor.name};d.treasury??={batches:[],payments:[]};d.treasury.payments.push(p);return p;
}
function voidPayment(d,b,actor){if(b.revision!==d.revision)fail('This record changed. Refresh and try again.',409);const p=ledger(d).payments.find(p=>p.id===b.id);if(!p||p.voidedAt)fail('Payment is missing or already voided.',409);if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>200)fail('Enter a correction reason (3–200 characters).');Object.assign(p,{voidedAt:new Date().toISOString(),voidedBy:actor.id,voidReason:b.reason.trim()});return p;}
function validateTreasury(d){if(d.treasury===undefined)return;const l=d.treasury;if(!l||!Array.isArray(l.batches)||!Array.isArray(l.payments))throw Error('Invalid treasury ledger.');const ids=new Set(),memberIds=new Set(d.members.map(m=>m.id));for(const b of l.batches){if(!b.id||ids.has(b.id)||!ASSETS.some(a=>a.id===b.assetId)||!integer(b.raw)||BigInt(b.raw)<=0n||!Array.isArray(b.allocations)||!b.allocations.length||!Number.isFinite(Date.parse(b.createdAt)))throw Error('Invalid treasury batch.');if(typeof b.note!=='string'||b.note.length<3||b.note.length>200||!memberIds.has(b.actorId)||!Number.isFinite(Date.parse(b.sourceUpdatedAt))||!integer(b.revenue)||!integer(b.pool)||b.percent!==20||!Array.isArray(b.receiptIds)||!Array.isArray(b.activityIds))throw Error('Invalid treasury batch metadata.');ids.add(b.id);const seen=new Set();let sum=0n;for(const a of b.allocations){if(!memberIds.has(a.memberId)||seen.has(a.memberId)||!integer(a.raw)||!Number.isSafeInteger(a.count)||a.count<=0)throw Error('Invalid treasury allocation.');seen.add(a.memberId);sum+=BigInt(a.raw);}if(sum!==BigInt(b.raw))throw Error('Treasury allocation mismatch.');}
 for(const p of l.payments){if(!p.id||ids.has(p.id)||!memberIds.has(p.memberId)||!ASSETS.some(a=>a.id===p.assetId)||!integer(p.raw)||!Number.isFinite(Date.parse(p.createdAt)))throw Error('Invalid treasury payment.');if(BigInt(p.raw)<=0n||typeof p.note!=='string'||p.note.length<3||p.note.length>200||!memberIds.has(p.actorId))throw Error('Invalid treasury payment metadata.');let u;try{u=new URL(p.proof);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password||u.href.length>2048)throw Error('Invalid payment evidence.');if(p.voidedAt&&(!Number.isFinite(Date.parse(p.voidedAt))||!memberIds.has(p.voidedBy)||typeof p.voidReason!=='string'||p.voidReason.length<3||p.voidReason.length>200))throw Error('Invalid payment correction.');ids.add(p.id);}
 for(const a of summary(d,{snapshot:null}).assets)if(a.members.some(m=>BigInt(m.owed)<0n))throw Error('Treasury payment exceeds allocation.');
}
module.exports={WALLET,RAW,SOURCE,ASSETS,units,parseSnapshot,sourceFresh,createTreasury,summary,distribute,settle,payment,voidPayment,validateTreasury};
