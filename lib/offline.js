"use strict";
const crypto=require('node:crypto');
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
function prepare(b,input,evidenceIds,evidenceDigests=evidenceIds){
 const location=String(b.location||'').trim(),date=String(b.workDate||'');
 if(location.length<2||location.length>150||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))fail('Enter the work location and a valid past or current date.');
 if(input.description.length<20)fail('Describe the work and its result in at least 20 characters.');
 if(!evidenceIds.length)fail('Attach a photo or video of the offline work.');
 return {...input,platform:'Other',workMode:'offline',location,workDate:date,evidenceIds,evidenceDigests,rewardType:'none'};
}
function identity(a){return crypto.createHash('sha256').update(JSON.stringify([a.title,a.description,a.location,a.workDate,a.link,(a.evidenceDigests||a.evidenceIds).slice().sort()])).digest('hex');}
function submit(d,who,b,input,ids,digests=ids){
 const payload=prepare(b,input,ids,digests),hash=identity(payload);
 if(!/^[a-f0-9-]{36}$/.test(b.requestKey||''))fail('Refresh the activity form and try again.');
 const prior=d.activities.find(a=>a.memberId===who.id&&a.requestKey===b.requestKey);
 if(prior){if(prior.fingerprint!==hash)fail('This submission was already used.',409);return {activity:prior,duplicate:true};}
 if(d.activities.some(a=>a.workMode==='offline'&&a.status!=='rejected'&&(a.fingerprint===hash||(a.evidenceDigests||a.evidenceIds).some(id=>digests.includes(id)))))fail('This work is already recorded. Correct the existing entry.',409);
 const activity={...payload,id:crypto.randomUUID(),memberId:who.id,user:who.name,handle:who.handle,initials:who.initials,status:'pending',version:1,history:[],fingerprint:hash,requestKey:b.requestKey,createdAt:new Date().toISOString()};
 d.activities.unshift(activity);return {activity,duplicate:false};
}
function edit(d,a,b,input,ids,digests=ids){const payload=prepare(b,input,ids,digests),hash=identity(payload);if(d.activities.some(x=>x.id!==a.id&&x.workMode==='offline'&&x.status!=='rejected'&&(x.fingerprint===hash||(x.evidenceDigests||x.evidenceIds).some(id=>digests.includes(id)))))fail('This work is already recorded.',409);Object.assign(a,payload,{fingerprint:hash,status:'pending',reviewNote:'',reviewedBy:null,reviewedAt:null,updatedAt:new Date().toISOString()});}
module.exports={submit,edit};
