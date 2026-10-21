'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const TeamTools=require('../lib/team-tools'),{createApp}=require('../server');
const image='data:image/jpeg;base64,'+Buffer.from([255,216,1,2,3,255,217]).toString('base64');
test('chat pagination, idempotency, moderation and durable private evidence',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seven-tools-'));let db=TeamTools.open(dir);
 try{
 const user={id:crypto.randomUUID(),role:'Member'},other={id:crypto.randomUUID(),role:'Member'},manager={id:crypto.randomUUID(),role:'Manager'};
 const key=crypto.randomUUID(),id=db.message(user,{text:'hello',requestKey:key});assert.equal(db.message(user,{text:'hello',requestKey:key}),id);
 assert.throws(()=>db.message(user,{text:'different',requestKey:key}),{status:409});
 for(let i=0;i<105;i++)db.message(user,{text:'message '+i,requestKey:crypto.randomUUID()});
 const latest=db.list(null);assert.equal(latest.messages.length,100);assert.equal(latest.hasMore,true);assert.equal(db.list(latest.messages[0].seq).messages.length,6);
 assert.throws(()=>db.remove(other,id),{status:403});db.remove(manager,id);
 const pic=db.upload(user,{image});assert.equal(db.upload(user,{image}),pic);assert.deepEqual(db.owned(user,[pic]),[pic]);
 assert.throws(()=>db.owned(other,[pic]),{status:404});assert.throws(()=>db.owned(user,[pic,pic]),{status:400});assert.throws(()=>db.upload(user,{image:'data:image/svg+xml;base64,PHN2Zz4='}),{status:400});
 assert.throws(()=>db.upload(user,{image:'data:image/jpeg;base64,'+'A'.repeat(1400000)}),{status:400});
 const data={activities:[],rewards:{referrals:[]}};assert.throws(()=>db.image(manager,pic,data),{status:404});data.activities.push({evidenceIds:[pic]});assert.ok(db.image(manager,pic,data).length);assert.throws(()=>db.image(other,pic,data),{status:404});
 db.close();db=TeamTools.open(dir);assert.ok(db.image(user,pic,data).length);assert.equal(db.list(2).messages[0].text,'');
 }finally{db.close();await fs.rm(dir,{recursive:true,force:true});}
});
test('HTTP authentication, private evidence and existing reward balances are preserved',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seven-http-'));const token=crypto.randomUUID();let app=await createApp({dataDir:dir,env:{SETUP_TOKEN:token}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 async function call(who,url,body,expected=200,extra={}){const headers={...extra};if(who?.cookie)headers.cookie=who.cookie;if(body){headers['Content-Type']='application/json';headers['X-CSRF-Token']=who?.csrf||'';}
 const r=await fetch(base+url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const type=r.headers.get('content-type');const b=type?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());assert.equal(r.status,expected,JSON.stringify(b));if(who&&r.headers.get('set-cookie'))who.cookie=r.headers.get('set-cookie').split(';')[0];if(who&&b.csrf)who.csrf=b.csrf;return b;}
 try{
 const owner={},member={},other={};const password='test-only-starter-123',newPassword='test-only-changed-456';const wallet=require('@solana/web3.js').Keypair.generate().publicKey.toBase58();
 await call(owner,'/api/setup',{name:'Test Owner',username:'testowner',password,walletAddress:wallet,setupToken:token},201);
 const created=await call(owner,'/api/members',{username:'testmember',password},201);
 await call(owner,'/api/members',{username:'testother',password},201);
 await call(member,'/api/login',{username:'testmember',password});
 await call(member,'/api/chat',undefined,403);
 await call(member,'/api/password',{currentPassword:password,newPassword});
 await call(other,'/api/login',{username:'testother',password});await call(other,'/api/password',{currentPassword:password,newPassword});
 await call(null,'/api/chat',undefined,401);
 const revision=app.store.data.revision,ledger=JSON.stringify(app.store.data);
 const message=await call(member,'/api/chat',{text:'<img src=x onerror=alert(1)>',requestKey:crypto.randomUUID()},201);
 const pic=await call(member,'/api/evidence',{image},201);
 assert.equal(app.store.data.revision,revision);assert.equal(JSON.stringify(app.store.data),ledger);
 await call({...member,csrf:'bad'},'/api/chat',{text:'bad',requestKey:crypto.randomUUID()},403);
 await call(other,'/api/chat/remove',{id:message.id},403);
 await call(owner,'/api/evidence/'+pic.id,undefined,404);
 await call(other,'/api/evidence/'+pic.id,undefined,404);
 await call(null,'/api/evidence/'+pic.id,undefined,401);
 await call(member,'/api/evidence/'+pic.id);
 const claim=await call(member,'/api/rewards/referral',{orderId:'seller-order-001',amount:'20.00',proof:'https://example.org/order-001',evidenceIds:[pic.id],revision:app.store.data.revision},201);
 await call(owner,'/api/evidence/'+pic.id);await call(other,'/api/evidence/'+pic.id,undefined,404);
 assert.deepEqual((await call(other,'/api/rewards')).referrals,[]);
 await call(owner,'/api/rewards/referral-review',{id:claim.id,decision:'confirmed',amount:'20.00',buyerReference:'independent-buyer',paymentVerified:true,attributionVerified:true,notSelfVerified:true,revision:app.store.data.revision},201);
 const saved=JSON.stringify(app.store.data.rewards),rev=app.store.data.revision;
 await call(owner,'/api/chat/remove',{id:message.id});await call(member,'/api/chat',{text:'more conversation',requestKey:crypto.randomUUID()},201);
 assert.equal(app.store.data.revision,rev);assert.equal(JSON.stringify(app.store.data.rewards),saved);
 assert.equal(app.store.data.rewards.grants[0].amountCents,100);
 await call(member,'/api/profile',{name:'Test Member',fullName:'Test Example Member',walletAddress:wallet,photo:''});
 const channel=(await call(member,'/api/channels',{platform:'Website',url:'https://example.org/member'},201)).channel;
 const queueSnapshot=JSON.stringify(app.store.data),queueRevision=app.store.data.revision;
 const ownerQueue=await call(owner,'/api/workspace');
 assert.equal(ownerQueue.members.find(m=>m.id===created.member.id).channels[0].status,'pending');
 assert.equal(ownerQueue.activities.length,0); // Registering a page is not submitting work.
 assert.equal(JSON.stringify(app.store.data),queueSnapshot);assert.equal(app.store.data.revision,queueRevision);
 await call(member,'/api/channels',{platform:'X (Twitter)',url:'https://x.com/test/status/123'},400);
 assert.equal(JSON.stringify(app.store.data),queueSnapshot);assert.equal(app.store.data.revision,queueRevision);

 await call(owner,'/api/channels/review',{memberId:created.member.id,channelId:channel.id,version:1,status:'approved',note:'Verified test channel',activeConfirmed:true,ownershipConfirmed:true});
 const campaign=(await call(owner,'/api/campaigns',{title:'Test campaign',objective:'Test screenshot evidence',brief:'Submit original content with supporting evidence.',deadline:new Date(Date.now()+86400000).toISOString(),maxPerMember:3,gapHours:1},201)).campaign;
 const payload={title:'Original test work',description:'Test work',category:'Content',platform:'Website',link:'https://example.org/work-001',sourceId:channel.id,campaignId:campaign.id,rewardType:'none',requestKey:crypto.randomUUID(),evidenceIds:[pic.id]};
 const activity=(await call(member,'/api/activities',payload,201)).activity;
 assert.deepEqual((await call(owner,'/api/workspace')).activities[0].evidenceIds,[pic.id]);
 assert.equal((await call(other,'/api/workspace')).activities[0].evidenceIds,undefined);
 await call(member,'/api/activities',{...payload},200);
 await call(member,'/api/activities/'+activity.id+'/edit',{...payload,version:1,evidenceIds:[]});
 assert.deepEqual(app.store.data.activities[0].evidenceIds,[]);
 assert.equal(JSON.stringify(app.store.data.rewards),saved);
 await call(owner,'/api/members/'+created.member.id,{action:'active',active:false});await call(member,'/api/chat',undefined,401);
 const durable=JSON.stringify(app.store.data);await app.close();app=null;
 const reopened=await createApp({dataDir:dir,env:{SETUP_TOKEN:token}});app=reopened;assert.equal(JSON.stringify(app.store.data),durable);
 }finally{if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});
