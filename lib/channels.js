'use strict';
const crypto=require('node:crypto');
const PLATFORMS=['X (Twitter)','Telegram','YouTube','TikTok','Instagram','Discord','Website','Blog','Business','Facebook','Other'];
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
function contact(b){
 if(b.role==='Owner')return {};
 const fullName=String(b.fullName||'').trim().replace(/\s+/g,' '),phone=String(b.phone||'').replace(/[\s()-]/g,'');
 if(fullName.length>100||fullName.split(' ').length<3||!fullName.split(' ').every(x=>/\p{L}/u.test(x)))fail('Enter your three-part full name.');
 if(phone&&!/^\+?[0-9]{7,15}$/.test(phone))fail('Enter a valid phone number with country code.');
 return {fullName,phone};
}
function channelInput(b){
 if(!PLATFORMS.includes(b.platform))fail('Choose a valid platform.');
 let u;try{u=new URL(b.url);}catch{fail('Enter a public HTTPS page or channel link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2048)fail('Enter a public HTTPS page or channel link.');
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 const hosts={'X (Twitter)':['x.com','twitter.com'],Telegram:['t.me','telegram.me'],YouTube:['youtube.com','m.youtube.com','youtu.be'],TikTok:['tiktok.com'],Instagram:['instagram.com'],Discord:['discord.com','discord.gg'],Facebook:['facebook.com','m.facebook.com','fb.com']};
 if(hosts[b.platform]&&!hosts[b.platform].includes(host))fail('The link does not match the selected platform.');
 if(host==='localhost'||!host.includes('.')||/^[\d.:]+$/.test(host)||host.endsWith('.local'))fail('Use a public page link.');
 if(hosts[b.platform]&&u.pathname==='/')fail('Enter the specific page or channel, not the platform home page.');
 u.hash='';u.hostname=host==='twitter.com'?'x.com':host;u.pathname=u.pathname.replace(/\/+$/,'')||'/';
 return {platform:b.platform,url:u.href};
}
function add(m,b){const v=channelInput(b);m.channels??=[];if(m.channels.length>=30)fail('Maximum 30 channels.');if(m.channels.some(c=>c.url===v.url&&c.status!=='rejected'))fail('This channel is already submitted.',409);const c={...v,id:crypto.randomUUID(),version:1,status:'pending',submittedAt:new Date().toISOString()};m.channels.push(c);return c;}
function review(m,b,actor){if(!['Owner','Manager'].includes(actor.role)||m.id===actor.id)fail('Another owner or manager must review this channel.',403);const c=m.channels?.find(c=>c.id===b.channelId);if(!c)fail('Channel not found.',404);if(c.version!==b.version)fail('Channel changed. Refresh and try again.',409);if(!['approved','rejected'].includes(b.status))fail('Choose approve or reject.');const note=String(b.note||'').trim();if(note.length<3||note.length>300)fail('Enter a review reason (3–300 characters).');if(b.status==='approved'&&(b.activeConfirmed!==true||b.ownershipConfirmed!==true))fail('Check recent activity and ownership before approving.');Object.assign(c,{status:b.status,note,reviewerId:actor.id,reviewedAt:new Date().toISOString(),activeConfirmed:b.status==='approved',ownershipConfirmed:b.status==='approved',version:c.version+1});return c;}
function approvedSource(m,b){contact(m);const c=m.channels?.find(c=>c.id===b.sourceId&&c.status==='approved'&&c.platform===b.platform);if(!c)fail('Complete your profile and choose an approved page or channel before submitting work.',403);return c;}
function validate(m){if(m.fullName!==undefined||m.phone!==undefined)contact(m);if(m.channels===undefined)return;if(!Array.isArray(m.channels)||m.channels.length>30)fail('Invalid channel records.');const ids=new Set();for(const c of m.channels){channelInput(c);if(!/^[a-f0-9-]{36}$/.test(c.id)||ids.has(c.id)||!['pending','approved','rejected'].includes(c.status)||!Number.isInteger(c.version)||c.version<1)fail('Invalid channel record.');ids.add(c.id);if(c.status==='approved'&&(!c.activeConfirmed||!c.ownershipConfirmed||!c.reviewerId||!c.note))fail('Missing channel review.');}}
module.exports={PLATFORMS,contact,channelInput,add,review,approvedSource,validate};
