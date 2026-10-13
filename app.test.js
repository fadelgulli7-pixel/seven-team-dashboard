'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {createApp} = require('../server');
const {FileStore, validate} = require('../lib/store');
const {hashPassword, verifyPassword, equalSecret, Limiter} = require('../lib/security');
const password = 'Owner-test-only-482!';
const setupToken = 'test-only-setup-code-1234567890';
async function directory(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(),'seven-test-')); t.after(()=>fs.rm(dir,{recursive:true,force:true})); return dir; }
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'seven-test-'));
  const app = await createApp({dataDir:dir,env:{SETUP_TOKEN:setupToken}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await app.close();await fs.rm(dir,{recursive:true,force:true});});
  const url='http://127.0.0.1:'+app.server.address().port;
  function client() {
    let cookie='',csrf='';
    return async (route,body,extra={})=>{
      const response=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
      const value=await response.json(); if(value.csrf)csrf=value.csrf;
      return {status:response.status,body:value};
    };
  }
  const owner=client();
  assert.equal((await owner('/api/setup',{name:'Test Owner',username:'owner',password,setupToken})).status,201);
  return {app,dir,url,client,owner};
}
test('password hashes are salted, bounded and verified; rate limits expire', async()=>{
  const a=await hashPassword(password),b=await hashPassword(password);
  assert.notEqual(a.hash,b.hash); assert(await verifyPassword(password,a)); assert.equal(await verifyPassword('incorrect',a),false);
  assert.equal(await verifyPassword({},a),false); assert.equal(await verifyPassword('x'.repeat(201),a),false);
  assert(equalSecret('abc','abc')); assert.equal(equalSecret(undefined,'abc'),false);
  const l=new Limiter();assert(l.take('a',1,1000));assert.equal(l.take('a',1,1000),false);l.items.get('a').until=0;assert(l.take('a',1,1000));l.clear('a');assert(l.take('a',1,1000));
});
test('setup is protected and single-use; anonymous, CSRF and origin requests blocked', async t=>{
  const f=await fixture(t),anonymous=f.client();
  assert.equal((await anonymous('/api/data')).status,401);
  assert.equal((await anonymous('/api/setup',{setupToken})).status,409);
  assert.equal((await f.owner('/api/members',{}, {'X-CSRF-Token':''})).status,403);
  assert.equal((await f.owner('/api/members',{}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await f.owner('/health')).body.ok,true);
  const data=(await f.owner('/api/data')).body;assert.equal(data.members.length,1);assert.equal(data.members[0].hash,undefined);assert.equal(data.members[0].salt,undefined);
});
test('missing or wrong setup token cannot create owner',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seven-test-')),app=await createApp({dataDir:dir,env:{}});t.after(async()=>{await app.close();await fs.rm(dir,{recursive:true,force:true});});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setupToken:'wrong'})});
  assert.equal(response.status,503);assert.equal(app.store.data.members.length,0);
});
test('member workflow, concurrent duplicates, rejection, correction, approval, stale version and suspension',async t=>{
  const f=await fixture(t);
  const created=await f.owner('/api/members',{name:'Test Member',username:'member',password});assert.equal(created.status,201);
  const member=f.client();assert.equal((await member('/api/login',{username:'member',password})).status,200);
  assert.equal((await member('/api/data')).status,403);
  assert.equal((await member('/api/password',{currentPassword:password,newPassword:'Member-changed-482!'})).status,200);
  assert.equal((await member('/api/members',{name:'Not Allowed',username:'other',password})).status,403);
  assert.equal((await member('/api/backup',{password:'Member-changed-482!'})).status,403);
  const work={title:'Community post',category:'Community',platform:'Telegram',description:'Test work',link:'https://example.com/proof',requestKey:crypto.randomUUID()};
  const submissions=await Promise.all([member('/api/activities',work),member('/api/activities',work)]);
  assert.deepEqual(submissions.map(x=>x.status).sort(),[200,201]);assert.equal(f.app.store.data.activities.length,1);
  const id=submissions[0].body.activity.id;
  assert.equal((await member('/api/activities',{...work,requestKey:crypto.randomUUID()})).status,409);
  assert.equal((await member(`/api/activities/${id}/review`,{version:1,status:'approved'})).status,403);
  assert.equal((await f.owner(`/api/activities/${id}/review`,{version:1,status:'rejected',note:'Fix proof'})).status,200);
  assert.equal((await member(`/api/activities/${id}/edit`,{...work,version:2,description:'Corrected'})).status,200);
  assert.equal((await f.owner(`/api/activities/${id}/review`,{version:1,status:'approved'})).status,409);
  assert.equal((await f.owner(`/api/activities/${id}/review`,{version:3,status:'approved'})).status,200);
  assert.equal((await member(`/api/activities/${id}/edit`,{...work,version:4})).status,409);
  assert.equal(f.app.store.data.activities[0].history.length,3);
  const backup=await f.owner('/api/backup',{password});assert.equal(backup.status,200);validate(backup.body);
  assert.equal((await f.owner('/api/members/'+created.body.member.id,{action:'active',active:false})).status,200);
  assert.equal((await member('/api/data')).status,401);assert.equal(f.app.store.data.activities[0].status,'approved');
});
test('owner cannot self-approve and password reset revokes sessions',async t=>{
  const f=await fixture(t);
  const a=await f.owner('/api/activities',{title:'Owner work',category:'Other',requestKey:crypto.randomUUID()});
  assert.equal((await f.owner('/api/activities/'+a.body.activity.id+'/review',{version:1,status:'approved'})).status,403);
  const m=await f.owner('/api/members',{name:'Manager Test',username:'manager',password,role:'Manager'});
  const manager=f.client();await manager('/api/login',{username:'manager',password});await manager('/api/password',{currentPassword:password,newPassword:'Manager-changed-482!'});
  assert.equal((await manager('/api/activities/'+a.body.activity.id+'/review',{version:1,status:'approved'})).status,200);
  assert.equal((await manager('/api/audit')).status,403);
  await f.owner('/api/members/'+m.body.member.id,{action:'reset-password',password:'Reset-starter-123!'});
  assert.equal((await manager('/api/data')).status,401);
  assert.equal((await manager('/api/login',{username:'manager',password:'Reset-starter-123!'})).body.member.mustChangePassword,true);
});
test('serialized writes survive reopen; lock blocks second writer; failed write rolls back',async t=>{
  const dir=await directory(t),store=await new FileStore(dir).open();
  await assert.rejects(new FileStore(dir).open(),/locked/);
  await Promise.all(Array.from({length:10},(_,i)=>store.transaction(d=>{d.audit.push({action:'test'+i,createdAt:new Date().toISOString()});})));
  assert.equal(store.data.revision,10);
  const previous=await fs.readFile(store.file,'utf8'),write=store.writeAtomic.bind(store);
  store.writeAtomic=async()=>{throw Error('Simulated disk failure');};
  await assert.rejects(store.transaction(d=>d.audit.push({action:'lost',createdAt:new Date().toISOString()})),/disk failure/);
  assert.equal(store.data.audit.length,10);assert.equal(await fs.readFile(store.file,'utf8'),previous);
  store.writeAtomic=write;await store.close();
  const reopened=await new FileStore(dir).open();assert.equal(reopened.data.audit.length,10);await reopened.close();
  assert.equal((await fs.readdir(path.join(dir,'backups'))).length,1);
});
test('corrupt, unknown-schema and missing initialized data fail closed without overwrite',async t=>{
  const dir=await directory(t),s=await new FileStore(dir).open();await s.close();
  for(const raw of ['not json',JSON.stringify({members:[],activities:[]})]) {
    await fs.writeFile(s.file,raw);await assert.rejects(new FileStore(dir).open());assert.equal(await fs.readFile(s.file,'utf8'),raw);
  }
  await fs.unlink(s.file);await assert.rejects(new FileStore(dir).open(),/missing/);
});
test('HTML scripts parse and CSP matches actual inline bytes',async t=>{
  const f=await fixture(t),res=await fetch(f.url),html=await res.text(),csp=res.headers.get('content-security-policy');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){new vm.Script(match[1]);assert(csp.includes(crypto.createHash('sha256').update(match[1]).digest('base64')));}
  assert.equal((await fetch(f.url+'/lib/store.js')).status,404);
  assert.equal((await fetch(f.url+'/data/team-data.json')).status,404);
});
test('production fails closed without explicit data path',async()=>{
  await assert.rejects(createApp({env:{NODE_ENV:'production'}}),/DATA_DIR/);
});
test('maintenance backup verification and owner recovery preserve records and survive restart',async t=>{
  const {execFile}=require('node:child_process'),{promisify}=require('node:util');
  const run=promisify(execFile),dir=await directory(t),store=await new FileStore(dir).open();
  const id=crypto.randomUUID();
  await store.transaction(async d=>d.members.push({id,name:'Recovery Owner',username:'owner',role:'Owner',active:true,mustChangePassword:false,authVersion:0,createdAt:new Date().toISOString(),...await hashPassword(password)}));
  await store.close();
  const tool=path.join(__dirname,'../tools.js');
  const result=await run(process.execPath,[tool,'verify-backup',path.join(dir,'team-data.json')]);assert.match(result.stdout,/Valid backup: 1 members/);
  await run(process.execPath,[tool,'reset-owner'],{env:{...process.env,DATA_DIR:dir,OWNER_NEW_PASSWORD:'Recovery-password-123!'}});
  const restored=await new FileStore(dir).open();
  const owner=restored.data.members[0];assert.equal(owner.id,id);assert.equal(owner.authVersion,1);assert.equal(owner.mustChangePassword,true);
  assert(await verifyPassword('Recovery-password-123!',owner));assert.equal(await verifyPassword(password,owner),false);
  assert.equal(restored.data.audit.at(-1).action,'owner_password_recovered');await restored.close();
});
