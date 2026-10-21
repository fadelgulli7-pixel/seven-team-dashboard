'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const Channels=require('../lib/channels');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function uiFunction(name,next){const begin=html.indexOf('    function '+name+'('),end=html.indexOf('    function '+next+'(',begin);assert.ok(begin>=0&&end>begin);return html.slice(begin,end);}
test('search finds renamed members, usernames, handles and direct work links without changing records',()=>{
 const data={members:[{id:'one',name:'Issac New',username:'issaice',handle:'@GemstoneLabsX'}],activities:[{memberId:'one',title:'Guide',user:'Old Name',description:'Verification',link:'https://x.com/GemstoneLabsX/status/123'}]};
 const before=JSON.stringify(data),ctx=vm.createContext({data});vm.runInContext(uiFunction('workMatchesSearch','pendingChannelRows'),ctx);
 for(const q of ['Issac','ISSAICE','@GemstoneLabsX','Old Name','/status/123','Verification'])assert.equal(ctx.workMatchesSearch(data.activities[0],q),true,q);
 assert.equal(ctx.workMatchesSearch(data.activities[0],'Reegir'),false);assert.equal(JSON.stringify(data),before);
});
test('page review queue shows all pending pages separately from work and preserves member identities',()=>{
 const data={members:[{id:'reegir',channels:[{id:'a',status:'pending'},{id:'b',status:'approved'}]},{id:'issac',channels:[{id:'c',status:'pending'}]},{id:'other'}],activities:[{id:'work',status:'pending'}]};
 const before=JSON.stringify(data),ctx=vm.createContext({data});vm.runInContext(uiFunction('pendingChannelRows','reviewInbox'),ctx);
 assert.deepEqual(Array.from(ctx.pendingChannelRows(),r=>[r.member.id,r.channel.id]),[['reegir','a'],['issac','c']]);assert.equal(JSON.stringify(data),before);
});
test('new X post URLs are rejected without mutating records; historical pending and approved pages remain reviewable',()=>{
 const m={id:crypto.randomUUID(),role:'Member',channels:[]};
 assert.throws(()=>Channels.add(m,{platform:'X (Twitter)',url:'https://x.com/reegir/status/123?s=46'}),/profile link/);assert.deepEqual(m.channels,[]);
 const c=Channels.add(m,{platform:'X (Twitter)',url:'https://x.com/reegir'});assert.equal(c.status,'pending');
 c.url='https://x.com/reegir/status/123?s=46';const before=JSON.stringify(m);Channels.validate(m);assert.equal(JSON.stringify(m),before);
 assert.throws(()=>Channels.review(m,{channelId:c.id,version:1,status:'approved',note:'Checked',activeConfirmed:true,ownershipConfirmed:true},{id:m.id,role:'Owner'}),{status:403});
 Channels.review(m,{channelId:c.id,version:1,status:'approved',note:'Checked historical source',activeConfirmed:true,ownershipConfirmed:true},{id:crypto.randomUUID(),role:'Owner'});Channels.validate(m);assert.equal(c.url,'https://x.com/reegir/status/123?s=46');assert.equal(c.version,2);
});
test('all inline browser scripts compile',()=>{for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});
