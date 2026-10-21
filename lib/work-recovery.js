'use strict';
const crypto=require('node:crypto');
const Rewards=require('./rewards');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
// Identity only: never rewrite historic evidence or ledger proof keys.
function identity(link){
 try{const u=new URL(link),h=u.hostname.replace(/^www\./,'');let m;
 if(['x.com','twitter.com','mobile.twitter.com'].includes(h)&&(m=u.pathname.match(/\/(?:status|statuses)\/(\d+)/)))return 'x:'+m[1];
 if(['t.me','telegram.me'].includes(h)&&(m=u.pathname.match(/^\/(c\/\d+|[a-zA-Z][\w]*)\/(?:\d+\/)?(\d+)\/?$/)))return 'telegram:'+m[1].toLowerCase()+':'+m[2];
 return Rewards.proofKey(link);
 }catch{return null;}
}
function recover(d,b,actor){
 if(actor.role!=='Owner')fail('Only the owner can recover historical work.',403);
 const m=d.members.find(x=>x.id===b.memberId),c=m?.channels?.find(x=>x.id===b.channelId);
 if(!c)fail('Channel not found.',404);
 if(m.id===actor.id)fail('Ask another reviewer to review your work.',403);
 const prior=d.activities.find(a=>a.recoveredChannel?.memberId===m.id&&a.recoveredChannel.channelId===c.id);
 if(prior)return {activity:prior,duplicate:true};
 if(b.version!==c.version||b.revision!==d.revision)fail('This record changed. Refresh and try again.',409);
 if(b.postConfirmed!==true)fail('Confirm this is an individual work link, not a profile or channel.');
 const u=new URL(c.url),h=u.hostname.replace(/^www\./,'');
 if((['x.com','twitter.com'].includes(h)&&! /\/(?:status|statuses)\/\d+/.test(u.pathname))||(['t.me','telegram.me'].includes(h)&&!/^\/(?:c\/\d+|[a-zA-Z][\w]*)\/(?:\d+\/)?\d+\/?$/.test(u.pathname)))fail('A profile or channel is not an individual work submission.');
 const key=identity(c.url);
 if(d.activities.some(a=>identity(a.link)===key)||Rewards.ledger(d).grants.some(g=>!g.voidedAt&&identity(g.proofKey)===key))fail('This work is already recorded. Find its existing entry in Activity feed.',409);
 const title=String(b.title||'').trim(),note=String(b.note||'').trim();
 if(title.length<2||title.length>90||note.length<3||note.length>300)fail('Enter a work title and a recovery reason (3–300 characters).');
 const now=new Date().toISOString();
 const a={id:crypto.randomUUID(),requestKey:crypto.randomUUID(),memberId:m.id,user:m.name,handle:m.handle,initials:m.initials,title,category:'Marketing',platform:c.platform,description:note,link:c.url,status:'pending',version:1,history:[],evidenceIds:[],rewardType:'none',createdAt:now,recoveredChannel:{memberId:m.id,channelId:c.id,version:c.version,submittedAt:c.submittedAt,recoveredBy:actor.id,recoveredAt:now,note}};
 a.fingerprint=crypto.createHash('sha256').update(JSON.stringify([m.id,c.id,c.url])).digest('hex');
 d.activities.unshift(a);
 return {activity:a,duplicate:false};
}
function checkReward(d,a){
 const key=identity(a.link);
 if(key&&Rewards.ledger(d).grants.some(g=>!g.voidedAt&&g.activityId!==a.id&&identity(g.proofKey)===key))fail('This evidence has already earned a reward.',409);
}
module.exports={identity,recover,checkReward};
