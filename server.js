'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {FileStore}=require('./lib/store');
const Rewards=require('./lib/rewards');
const TeamTools=require('./lib/team-tools');
const Channels=require('./lib/channels');
const Payouts=require('./lib/payouts');
const Campaigns=require('./lib/campaigns');
const Wallet=require('./lib/wallet');
const Recovery=require('./lib/recovery');
const {validPhoto}=require('./lib/profile');
const {hashPassword,verifyPassword,equalSecret,Limiter}=require('./lib/security');
const categories=['Marketing','Content','Community','Partnership','Development','Other'];
const platforms=['X (Twitter)','Telegram','YouTube','TikTok','Instagram','Discord','Website','Blog','Business','Facebook','Other'];
const BUILD='2026-10-18-marketing-v5.6.5';
const TTL=30*24*60*60*1000;
const COOKIE='seven_session';
const error=(status,message)=>Object.assign(new Error(message),{status});
const safeMember=(m,viewer=m)=>({...Object.fromEntries(['id','name','handle','username','role','initials','createdAt','active','mustChangePassword','photo'].map(k=>[k,m[k]])),hasWallet:!!m.walletAddress,channels:m.channels||[],profileComplete:m.role==='Owner'||!!m.fullName&&!!m.walletAddress,...(m.role!=='Owner'&&(viewer.id===m.id||viewer.role==='Owner')?{fullName:m.fullName||'',phone:m.phone||''}:{}),...(viewer.id===m.id||viewer.role==='Owner'?{walletAddress:m.walletAddress||''}:{}),recoveryReady:!!m.recovery&&Date.parse(m.recovery.expiresAt)>Date.now()});
const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=200;
function teamManager(who){if(!['Owner','Manager'].includes(who.role))throw error(403,'Permission denied.');}
function canManage(who,target,action){teamManager(who);if(who.role==='Manager'&&(target.role!=='Member'||target.id===who.id||action==='role'))throw error(403,'Permission denied.');}
function memberInput(body, onboarding=false) {
  if(onboarding)body={...body,name:body.name||body.username};
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>50||typeof body.username!=='string'||!/^[a-zA-Z0-9_.-]{3,32}$/.test(body.username)||!validPassword(body.password))throw error(400,'Enter a name, a valid username, and a password of 12–200 characters.');
  if((!onboarding||body.walletAddress)&&!Wallet.validWallet(body.walletAddress))throw error(400,'Enter a valid Solana receiving wallet address.');
  const name=body.name.trim(),username=body.username.toLowerCase();
  return {id:crypto.randomUUID(),walletAddress:body.walletAddress,name,username,handle:'@'+String(body.handle||username).trim().replace(/^@+/,'').slice(0,40),initials:name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),createdAt:new Date().toISOString(),active:true,authVersion:0};
}
function activityInput(body) {
  const title=typeof body.title==='string'?body.title.trim():'';
  if(title.length<2||title.length>90||!categories.includes(body.category))throw error(400,'Enter a title and choose a valid category.');
  const description=typeof body.description==='string'?body.description.trim():'';
  if(description.length>300)throw error(400,'Description is too long.');
  let link='';
  if(body.link){try{const u=new URL(body.link);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)throw Error();u.hash='';link=u.href;}catch{throw error(400,'Enter a valid http or https link.');}}
  return {title,category:body.category,platform:platforms.includes(body.platform)?body.platform:'Other',description,link};
}
function fingerprint(a){return crypto.createHash('sha256').update(JSON.stringify([a.memberId,a.title.toLowerCase(),a.category,a.platform,a.description,a.link,a.sourceId,a.campaignId])).digest('hex');}
function audit(d,actor,action,target,details={}) {d.audit.push({id:crypto.randomUUID(),actorId:actor.id,actorName:actor.name,action,target,details,createdAt:new Date().toISOString()});}
function send(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));}
async function readBody(req,maxBytes=32768){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'Send JSON data.');
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>maxBytes)throw error(413,'Request is too large.');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw error(400,'Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw error(400,'Invalid request.');return body;
}
async function createApp(options={}) {
  const env=options.env||process.env;
  const payouts=Payouts.create(env,options.payoutConnection);
  const dataDir=options.dataDir||env.DATA_DIR||path.join(__dirname,'data');
  if(env.NODE_ENV==='production'&&!env.DATA_DIR&&!options.dataDir)throw Error('Set DATA_DIR to your persistent disk before production startup.');
  // Read required assets before acquiring the data-directory lock.
  const html=await fs.readFile(path.join(__dirname,'index.html'));
  // Refuse a partial upload before opening the persistent store.
  for(const asset of ['team-tools.js','seven-logo.png','contributions.js','languages.js','solana-web3.js','wallets.js']){
    try{await fs.access(path.join(__dirname,'assets',asset));}
    catch{throw Error('Missing assets/'+asset+'. Upload the entire assets folder from the ZIP.');}
  }
  const dummy=await hashPassword(crypto.randomBytes(32).toString('hex'));
  const store=options.store||await new FileStore(path.resolve(dataDir)).open();
  let teamTools;
  try{teamTools=TeamTools.open(path.resolve(dataDir));}catch(e){await store.close();throw e;}
  const publicActivity=({history,fingerprint,requestKey,evidenceIds,...a},who)=>({...a,...(who.id===a.memberId||['Owner','Manager'].includes(who.role)?{evidenceIds:evidenceIds||[]}: {})});
  const sessionFile=path.join(path.resolve(dataDir),'sessions.json');
  const sessionFs=require('node:fs');
  let saved=[];try{saved=JSON.parse(await fs.readFile(sessionFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const sessions=new Map(saved.filter(([,s])=>s&&s.expiresAt>Date.now())),limiter=new Limiter();
  const existingOwner=store.data.members.find(m=>m.role==='Owner');
  if(existingOwner&&!existingOwner.projectProfileVersion)await store.transaction(d=>{const m=d.members.find(m=>m.role==='Owner');m.name='SEVEN Network';m.handle='@SEVN_Network';m.initials='SN';delete m.fullName;delete m.phone;m.projectProfileVersion=1;audit(d,m,'project_profile_enabled',m.id);});

  function saveSessions(){const temp=sessionFile+'.tmp';sessionFs.writeFileSync(temp,JSON.stringify([...sessions]),{mode:0o600});sessionFs.renameSync(temp,sessionFile);}


  let cryptoJobs=0;
  async function cryptoWork(fn){if(cryptoJobs>=8)throw error(429,'Service is busy. Try again shortly.');cryptoJobs++;try{return await fn();}finally{cryptoJobs--;}}
  function secure(req){return req.socket.encrypted||env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https';}
  function cookie(req,value,age){return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure(req)?'; Secure':''}`;}
  function sidOf(req){const raw=(req.headers.cookie||'').match(/(?:^|;\s*)seven_session=([a-f0-9-]+)/)?.[1];return raw&&crypto.createHash('sha256').update(raw).digest('hex');}
  function beginSession(req,res,member,status=200){
    const perUser=[...sessions].filter(([,s])=>s.memberId===member.id);
    for(const [sid]of perUser.slice(0,Math.max(0,perUser.length-4)))sessions.delete(sid);
    const sid=crypto.randomUUID(),csrf=crypto.randomUUID();
    sessions.set(crypto.createHash('sha256').update(sid).digest('hex'),{memberId:member.id,authVersion:member.authVersion,csrf,expiresAt:Date.now()+TTL});saveSessions();
    send(res,status,{member:safeMember(member),csrf},{'Set-Cookie':cookie(req,sid,TTL/1000)});
  }
  function identity(req,data=store.data){const s=sessions.get(sidOf(req));const m=s&&data.members.find(m=>m.id===s.memberId);if(!s||s.expiresAt<=Date.now()||!m||!m.active||s.authVersion!==m.authVersion)throw error(401,'Please sign in again.');return {session:s,member:m};}
  function actor(req,d){const {member}=identity(req,d);if(member.mustChangePassword)throw error(403,'Change your starter password first.');return member;}
  function owner(m){if(m.role!=='Owner')throw error(403,'Only the owner can do this.');}
  function throttle(key,max=8,ms=15*60*1000){if(!limiter.take(key,max,ms))throw error(429,'Too many attempts. Try again later.');}
  function revoke(id){for(const [sid,s]of sessions)if(s.memberId===id)sessions.delete(sid);saveSessions();}
  const cleanup=setInterval(()=>{for(const [id,s]of sessions)if(s.expiresAt<=Date.now())sessions.delete(id);for(const [id,s]of limiter.items)if(s.until<=Date.now())limiter.items.delete(id);},60000);cleanup.unref();
  async function api(req,res,url){
    const route=url.pathname,ip=req.socket.remoteAddress;
    if(req.method==='GET'&&route==='/api/status')return send(res,200,{setupNeeded:!store.data.members.length,setupEnabled:typeof env.SETUP_TOKEN==='string'&&env.SETUP_TOKEN.length>=24,build:BUILD});
    if(req.method==='POST'){
      const origin=req.headers.origin;
      if(origin){let host;try{host=new URL(origin).host;}catch{throw error(403,'Invalid origin.');}if(host!==req.headers.host)throw error(403,'Request could not be verified.');}
    }
    if(req.method==='POST'&&route==='/api/setup'){
      throttle('setup:'+ip,10);const b=await readBody(req);
      if(store.data.members.length)throw error(409,'The owner account already exists.');
      if(!env.SETUP_TOKEN||env.SETUP_TOKEN.length<24)throw error(503,'Owner setup is locked. Configure SETUP_TOKEN on the server.');
      if(!equalSecret(b.setupToken,env.SETUP_TOKEN))throw error(403,'Setup code is incorrect.');
      const m={...memberInput(b),...await cryptoWork(()=>hashPassword(b.password)),role:'Owner',handle:'@SEVN_Network',mustChangePassword:false,projectProfileVersion:1};
      await store.transaction(d=>{if(d.members.length)throw error(409,'The owner account already exists.');d.members.push(m);audit(d,m,'owner_created',m.id);});return beginSession(req,res,m,201);
    }
    if(req.method==='POST'&&route==='/api/login'){
      const b=await readBody(req),name=String(b.username||'').trim().toLowerCase();
      if(name.length>32)throw error(400,'Invalid username.');
      throttle('login-ip:'+ip,120);throttle('login-user:'+name,8);
      const m=store.data.members.find(m=>m.username.toLowerCase()===name);
      const ok=await cryptoWork(()=>verifyPassword(b.password,m||dummy));
      if(!ok||!m||!m.active)throw error(401,'Username or password is incorrect.');
      const latest=store.data.members.find(x=>x.id===m.id);
      if(!latest.active||latest.authVersion!==m.authVersion)throw error(401,'Please sign in again.');
      limiter.clear('login-user:'+name);return beginSession(req,res,latest);
    }
    if(req.method==='POST'&&route==='/api/recovery/reset'){
      const b=await readBody(req),username=String(b.username||'').trim().toLowerCase().slice(0,33);
      throttle('recovery-ip:'+ip,40);throttle('recovery-user:'+username,8);
      if(!validPassword(b.newPassword))throw error(400,'Use a password of 12–200 characters.');
      // Equal password-hashing work for unknown, suspended, expired and valid codes.
      const credentials=await cryptoWork(()=>hashPassword(b.newPassword));
      const changed=await store.transaction(d=>{
        const m=d.members.find(x=>x.username===username);
        if(!m||!m.active||!Recovery.matches(m.recovery,b.code))throw error(400,'Recovery details are incorrect or expired.');
        Object.assign(m,credentials,{mustChangePassword:false,authVersion:m.authVersion+1});
        delete m.recovery; audit(d,m,'password_recovered',m.id);return m;
      });
      revoke(changed.id);limiter.clear('login-user:'+username);limiter.clear('recovery-user:'+username);
      return send(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/logout'){
      const s=sessions.get(sidOf(req));if(s&&!equalSecret(req.headers['x-csrf-token'],s.csrf))throw error(403,'Request could not be verified.');sessions.delete(sidOf(req));saveSessions();return send(res,200,{ok:true},{'Set-Cookie':cookie(req,'',0)});
    }
    const {member,session}=identity(req);
    if(req.method==='POST'&&!equalSecret(req.headers['x-csrf-token'],session.csrf))throw error(403,'Request could not be verified.');
    if(req.method==='GET'&&route==='/api/me')return send(res,200,{member:safeMember(member),csrf:session.csrf});
    if(req.method==='POST'&&route==='/api/password'){
      throttle('password:'+member.id);const b=await readBody(req);
      if(!await cryptoWork(()=>verifyPassword(b.currentPassword,member)))throw error(401,'Current password is incorrect.');
      if(!validPassword(b.newPassword)||b.newPassword===b.currentPassword)throw error(400,'Use a different password of 12–200 characters.');
      const creds=await cryptoWork(()=>hashPassword(b.newPassword));
      const updated=await store.transaction(d=>{const m=identity(req,d).member;Object.assign(m,creds,{mustChangePassword:false,authVersion:m.authVersion+1});delete m.recovery;audit(d,m,'password_changed',m.id);return m;});
      revoke(member.id);return beginSession(req,res,updated);
    }
    actor(req);
    if(route==='/api/chat'&&req.method==='GET')return send(res,200,teamTools.list(url.searchParams.get('before')));
    if(route==='/api/chat'&&req.method==='POST'){throttle('chat:'+member.id,20,60000);const b=await readBody(req);return send(res,201,{id:teamTools.message(actor(req),b)});}
    if(route==='/api/chat/remove'&&req.method==='POST'){const b=await readBody(req);teamTools.remove(actor(req),b.id);return send(res,200,{ok:true});}
    if(route==='/api/evidence'&&req.method==='POST'){throttle('evidence:'+member.id,15,60000);const b=await readBody(req,1400100);return send(res,201,{id:teamTools.upload(actor(req),b)});}
    const evidenceRoute=route.match(/^\/api\/evidence\/([a-f0-9-]+)$/);
    if(evidenceRoute&&req.method==='GET'){const bytes=teamTools.image(actor(req),evidenceRoute[1],store.data);res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline; filename="screenshot.jpg"'});return res.end(Buffer.from(bytes));}

    if(req.method==='POST'&&route==='/api/recovery/code'){
      throttle('recovery-generate:'+member.id,8);const b=await readBody(req);
      if(!await cryptoWork(()=>verifyPassword(b.password,member)))throw error(401,'Current password is incorrect.');
      const issued=Recovery.issue();
      await store.transaction(d=>{const m=actor(req,d);m.recovery=issued.record;audit(d,m,'recovery_code_created',m.id);});
      return send(res,201,{code:issued.code,expiresAt:issued.record.expiresAt});
    }
    if(req.method==='POST'&&route==='/api/profile'){
      throttle('profile:'+member.id,30);const b=await readBody(req,160000);
      const name=typeof b.name==='string'?b.name.trim():'';
      if(name.length<2||name.length>50)throw error(400,'Use a name of 2–50 characters.');
      if(typeof b.photo!=='string'||(b.photo!==''&&!validPhoto(b.photo)))throw error(400,'Choose a JPEG photo smaller than 100 KB.');
      if(!Wallet.validWallet(b.walletAddress))throw error(400,'Enter a valid Solana receiving wallet address.');
      const contact=member.role==='Owner'?{}:Channels.contact({...b,role:member.role});
      if(b.handle!==undefined){if(typeof b.handle!=='string'||b.handle.trim().length>40)throw error(400,'Invalid Telegram handle.');contact.handle=b.handle.trim()?'@'+b.handle.trim().replace(/^@+/,''):'';}
      const updated=await store.transaction(d=>{const who=actor(req,d);Object.assign(who,{...contact,walletAddress:b.walletAddress,name,initials:name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),photo:b.photo});if(who.role==='Owner'){delete who.fullName;delete who.phone;}audit(d,who,'profile_updated',who.id);return who;});
      return send(res,200,{member:safeMember(updated)});
    }
    if(req.method==='POST'&&route==='/api/channels'){
      const b=await readBody(req);const channel=await store.transaction(d=>{const who=actor(req,d);Channels.contact(who);const c=Channels.add(who,b);audit(d,who,'channel_submitted',c.id);return c;});return send(res,201,{channel});
    }
    if(req.method==='POST'&&route==='/api/channels/review'){
      const b=await readBody(req);const channel=await store.transaction(d=>{const who=actor(req,d),target=d.members.find(m=>m.id===b.memberId);if(!target)throw error(404,'Member not found.');const c=Channels.review(target,b,who);audit(d,who,'channel_'+c.status,c.id,{memberId:target.id,note:c.note});return c;});return send(res,200,{channel});
    }
    if(route==='/api/finance'||route.startsWith('/api/finance/'))throw error(410,'Revenue sharing has been retired.');
    const rewardView=()=>{const view=Rewards.summary(store.data);view.walletPayments=(store.data.payoutJobs||[]).filter(j=>member.role==='Owner'||j.memberId===member.id).map(j=>Object.fromEntries(['id','memberId','status','amount','usdCents','recipient','source','signature','createdAt','confirmedAt'].map(k=>[k,j[k]])));if(member.role!=='Owner')view.payments=view.payments.map(p=>Object.fromEntries(['id','memberId','amountCents','currency','createdAt','voidedAt'].map(k=>[k,p[k]])));if(!['Owner','Manager'].includes(member.role))view.referrals=view.referrals.filter(c=>c.memberId===member.id).map(c=>Object.fromEntries(['id','memberId','claimedUsdCents','verifiedUsdCents','commissionCents','status','createdAt','confirmedAt','reviewNote','reversalReason','evidenceIds'].map(k=>[k,c[k]])));return view;};
    if(req.method==='POST'&&route==='/api/rewards/prepare-transfer'){
      owner(member);const b=await readBody(req);const d=store.data;owner(actor(req,d));
      if(b.revision!==d.revision)throw error(409,'This record changed. Refresh and try again.');
      const recipient=d.members.find(m=>m.id===b.memberId);
      if(!recipient||!recipient.active)throw error(400,'Choose an active member.');
      if(!Rewards.summary(d).members.some(m=>m.memberId===b.memberId&&m.dueCents>0))throw error(400,'This member has no unpaid reward.');
      Payouts.unreserved(d,b.memberId);return send(res,200,Wallet.transfer(recipient.walletAddress,b.amount,env));
    }
    if(route==='/api/campaigns'&&req.method==='GET')return send(res,200,{campaigns:store.data.campaigns||[]});
    if(route==='/api/campaigns'&&req.method==='POST'){const b=await readBody(req);const campaign=await store.transaction(d=>{const who=actor(req,d);const c=Campaigns.create(d,b,who);audit(d,who,'campaign_created',c.id);return c;});return send(res,201,{campaign});}
    if(route==='/api/campaigns/close'&&req.method==='POST'){const b=await readBody(req);await store.transaction(d=>{const who=actor(req,d);owner(who);const c=d.campaigns?.find(c=>c.id===b.id);if(!c)throw error(404,'Campaign not found.');c.active=false;audit(d,who,'campaign_closed',c.id);});return send(res,200,{ok:true});}
    if(route==='/api/payout/config'&&req.method==='GET'){owner(member);return send(res,200,{config:Payouts.config(store.data),jobs:(store.data.payoutJobs||[]).map(({signedTransaction,message,transaction,...j})=>j)});}
    if(route==='/api/payout/config'&&req.method==='POST'){const b=await readBody(req);const cfg=await store.transaction(d=>{const who=actor(req,d);owner(who);const cfg=Payouts.configure(d,b);audit(d,who,'payout_wallet_updated',who.id);return cfg;});return send(res,200,{config:cfg});}
    if(req.method==='POST'&&['/api/payout/prepare','/api/payout/submit','/api/payout/reconcile'].includes(route)){owner(member);const b=await readBody(req);const who=actor(req);owner(who);throttle('payout:'+who.id,30,60000);const job=route.endsWith('/prepare')?await payouts.prepare(store,b,who):route.endsWith('/submit')?await payouts.submit(store,b,who):await payouts.reconcile(store,b.jobId,who);return send(res,200,{job});}
    if(req.method==='GET'&&route==='/api/rewards')return send(res,200,rewardView());
    if(req.method==='GET'&&route==='/api/workspace'){
      const d=store.data;
      return send(res,200,{member:safeMember(member),members:d.members.map(m=>safeMember(m,member)),activities:d.activities.map(a=>publicActivity(a,member)),revision:d.revision,build:BUILD,campaigns:d.campaigns||[],rewards:rewardView()});
    }
    if(req.method==='POST'&&['/api/rewards/policy','/api/rewards/payment','/api/rewards/void','/api/rewards/award','/api/rewards/referral','/api/rewards/referral-review'].includes(route)){
      const b=await readBody(req);const result=await store.transaction(d=>{const who=actor(req,d);if(b.revision!==d.revision)throw error(409,'This record changed. Refresh and try again.');let r;
        if(route.endsWith('/referral')){throttle('referral-claim:'+who.id,20,60000);const evidenceIds=teamTools.owned(who,b.evidenceIds);r=Rewards.claimReferral(d,b,who);r.evidenceIds=evidenceIds;}
        else if(route.endsWith('/referral-review')){r=Rewards.reviewReferral(d,b,who);}
        else if(route.endsWith('/award')){const a=d.activities.find(a=>a.id===b.activityId);if(!a)throw error(404,'Activity not found.');if(b.version!==a.version)throw error(409,'This record changed. Refresh and try again.');r=Rewards.award(d,a,b,who);if(!r)throw error(400,'Choose a paid reward type.');}
        else{owner(who);if(route.endsWith('/policy'))r=Rewards.updatePolicy(d,b);else if(route.endsWith('/payment')){Payouts.unreserved(d,b.memberId);r=Rewards.payment(d,b,who);}else{const entry=d.rewards?.[b.kind==='grant'?'grants':'payments']?.find(x=>x.id===b.id);if(entry)Payouts.unreserved(d,entry.memberId);if(b.kind==='payment'&&(d.payoutJobs||[]).some(j=>j.paymentId===b.id&&j.status==='confirmed'))throw error(409,'Confirmed on-chain payments cannot be voided here.');r=Rewards.voidEntry(d,b,who);}}
        audit(d,who,'rewards.'+route.split('/').pop(),r.id,{amountCents:r.amountCents||null});return r;
      });return send(res,201,{id:result.id});
    }
    if(req.method==='GET'&&route==='/api/data')return send(res,200,{member:safeMember(member),members:store.data.members.map(m=>safeMember(m,member)),activities:store.data.activities.map(a=>publicActivity(a,member)),revision:store.data.revision,build:BUILD});
    if(req.method==='GET'&&route==='/api/audit'){owner(member);return send(res,200,{events:store.data.audit.slice(-200).reverse()});}
    if(req.method==='POST'&&route==='/api/backup'){
      owner(member);const b=await readBody(req);throttle('backup:'+member.id,3);
      if(!await cryptoWork(()=>verifyPassword(b.password,member)))throw error(401,'Current password is incorrect.');
      owner(actor(req));return send(res,200,store.data,{'Content-Disposition':`attachment; filename="seven-team-backup-${new Date().toISOString().slice(0,10)}.json"`});
    }
    if(req.method==='POST'&&route==='/api/members'){
      teamManager(member);throttle('member-create:'+member.id,30);const b=await readBody(req);
      if(member.role==='Manager'&&b.role&&b.role!=='Member')throw error(403,'Permission denied.');
      const m={...memberInput(b,true),...(b.fullName?Channels.contact({...b,role:b.role==='Manager'?'Manager':'Member'}):{}),channels:[],...await cryptoWork(()=>hashPassword(b.password)),role:b.role==='Manager'?'Manager':'Member',mustChangePassword:true};
      await store.transaction(d=>{const who=actor(req,d);teamManager(who);if(who.role==='Manager'&&m.role!=='Member')throw error(403,'Permission denied.');if(d.members.some(x=>x.username===m.username))throw error(409,'That username is already in the team.');d.members.push(m);audit(d,who,'member_created',m.id,{role:m.role});});return send(res,201,{member:safeMember(m)});
    }
    const manage=route.match(/^\/api\/members\/([a-f0-9-]+)$/);
    if(req.method==='POST'&&manage){
      teamManager(member);const b=await readBody(req);const target=store.data.members.find(x=>x.id===manage[1]);if(!target)throw error(404,'Member not found.');canManage(member,target,b.action);const actions=['role','active','reset-password'];if(!actions.includes(b.action))throw error(400,'Invalid member action.');
      let creds;if(b.action==='reset-password'){throttle('reset:'+member.id,20);if(!validPassword(b.password))throw error(400,'Use a password of 12–200 characters.');creds=await cryptoWork(()=>hashPassword(b.password));}
      const changed=await store.transaction(d=>{const who=actor(req,d);const m=d.members.find(x=>x.id===manage[1]);if(!m)throw error(404,'Member not found.');canManage(who,m,b.action);if(m.role==='Owner')throw error(409,'The owner cannot be suspended or changed here.');
        if(b.action==='role'){if(!['Manager','Member'].includes(b.role))throw error(400,'Invalid role.');m.role=b.role;}
        if(b.action==='active'){if(typeof b.active!=='boolean')throw error(400,'Invalid status.');m.active=b.active;}
        if(creds){Object.assign(m,creds,{mustChangePassword:true});delete m.recovery;}m.authVersion++;audit(d,who,'member_'+b.action,m.id,{role:m.role,active:m.active});return m;});
      revoke(changed.id);return send(res,200,{member:safeMember(changed)});
    }
    if(req.method==='POST'&&route==='/api/activities'){
      throttle('activity:'+member.id,30,60000);const b=await readBody(req),input=activityInput(b);
      if(typeof b.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.requestKey))throw error(400,'Refresh the activity form and try again.');
      const result=await store.transaction(d=>{const who=actor(req,d);if(!Wallet.validWallet(who.walletAddress))throw error(400,'Save your Solana wallet in Edit profile before submitting work.');const prior=d.activities.find(a=>a.memberId===who.id&&a.requestKey===b.requestKey);if(prior){if(prior.fingerprint!==fingerprint({...input,memberId:who.id,sourceId:b.sourceId,campaignId:b.campaignId}))throw error(409,'This submission was already used. Open a new form.');return {activity:prior,duplicate:true};}const source=Channels.approvedSource(who,{...b,platform:input.platform});const campaign=Campaigns.source(d,who,{...b,platform:input.platform});const payload={...input,evidenceIds:teamTools.owned(who,b.evidenceIds),...Rewards.quote(d,b),memberId:who.id,sourceId:source.id,sourceUrl:source.url,campaignId:campaign.id,campaignTitle:campaign.title};const hash=fingerprint(payload);
        const existing=d.activities.find(a=>a.memberId===who.id&&a.requestKey===b.requestKey);
        if(existing){if(existing.fingerprint!==hash)throw error(409,'This submission was already used. Open a new form.');return {activity:existing,duplicate:true};}
        const duplicate=d.activities.find(a=>a.memberId===who.id&&(a.fingerprint===hash||(input.link&&a.link===input.link)));
        if(duplicate)throw error(409,'This work is already recorded. Correct the existing entry if needed.');
        const a={...payload,id:crypto.randomUUID(),user:who.name,handle:who.handle,initials:who.initials,status:'pending',version:1,history:[],fingerprint:hash,requestKey:b.requestKey,createdAt:new Date().toISOString()};
        d.activities.unshift(a);audit(d,who,'activity_submitted',a.id);return {activity:a,duplicate:false};});return send(res,result.duplicate?200:201,result);
    }
    const work=route.match(/^\/api\/activities\/([a-f0-9-]+)\/(review|edit)$/);
    if(req.method==='POST'&&work){
      const b=await readBody(req);const result=await store.transaction(d=>{const who=actor(req,d);const a=d.activities.find(x=>x.id===work[1]);if(!a)throw error(404,'Activity not found.');if(b.version!==a.version)throw error(409,'This record changed. Refresh and try again.');
        const before={...a};delete before.history;
        if(work[2]==='review'){
          if(!['Owner','Manager'].includes(who.role))throw error(403,'Only an owner or manager can review work.');
          if(who.id===a.memberId)throw error(403,'Ask another reviewer to review your work.');
          if(a.status!=='pending')throw error(409,'This work has already been reviewed.');
          if(!['approved','rejected'].includes(b.status))throw error(400,'Invalid review.');
          const note=String(b.note||'').trim();if(note.length>300||b.status==='rejected'&&note.length<3)throw error(400,'Give a short reason for rejection (3–300 characters).');
          Object.assign(a,{status:b.status,reviewNote:note,reviewedBy:who.name,reviewedAt:new Date().toISOString()});
          if(b.status==='approved'){if(a.campaignId)a.qualityScores=Campaigns.quality(b);if(a.sourceId)Channels.approvedSource(d.members.find(m=>m.id===a.memberId),a);const grant=Rewards.award(d,a,b,who);if(grant)a.rewardGrantId=grant.id;}
          audit(d,who,'activity_'+b.status,a.id,{note});
        }else{
          if(a.memberId!==who.id)throw error(403,'Only the author can correct this work.');
          if(a.status==='approved')throw error(409,'Approved work is locked.');
          const source=Channels.approvedSource(who,{...b,platform:activityInput(b).platform});const campaign=Campaigns.source(d,who,{...b,platform:activityInput(b).platform},a.id);if(['none','custom'].includes(b.rewardType||'none'))delete a.rewardQuote;const input=activityInput(b),hash=fingerprint({...input,memberId:who.id,sourceId:source.id,campaignId:campaign.id});
          if(d.activities.some(x=>x.id!==a.id&&x.memberId===who.id&&(x.fingerprint===hash||(input.link&&x.link===input.link))))throw error(409,'This work is already recorded.');
          Object.assign(a,input,{evidenceIds:teamTools.owned(who,b.evidenceIds===undefined?a.evidenceIds:b.evidenceIds)},Rewards.quote(d,b,a),{sourceId:source.id,sourceUrl:source.url,campaignId:campaign.id,campaignTitle:campaign.title,fingerprint:hash,status:'pending',reviewNote:'',reviewedBy:null,reviewedAt:null,updatedAt:new Date().toISOString()});audit(d,who,'activity_corrected',a.id);
        }
        a.history.push(before);a.version++;return a;});return send(res,200,{activity:result});
    }
    throw error(404,'Not found.');
  }
  const scripts=[...html.toString().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      if(url.pathname==='/health'&&req.method==='GET')return send(res,200,{ok:true,build:BUILD});
      if(!['GET','HEAD'].includes(req.method))throw error(405,'Method not allowed.');
      const assets={'/assets/team-tools.js':['team-tools.js','text/javascript; charset=utf-8'],'/assets/wallets.js':['wallets.js','text/javascript; charset=utf-8'],'/assets/languages.js':['languages.js','text/javascript; charset=utf-8'],'/assets/solana-web3.js':['solana-web3.js','text/javascript; charset=utf-8'],'/assets/seven-logo.png':['seven-logo.png','image/png'],'/assets/contributions.js':['contributions.js','text/javascript; charset=utf-8']};
      if(assets[url.pathname]){const [file,type]=assets[url.pathname];const bytes=await fs.readFile(path.join(__dirname,'assets',file));res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'});return res.end(req.method==='HEAD'?undefined:bytes);}
      if(!['/','/index.html'].includes(url.pathname))throw error(404,'Not found.');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':`default-src 'self'; script-src 'self' ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'`});res.end(req.method==='HEAD'?undefined:html);
    }catch(e){if(!res.headersSent&&!res.destroyed)send(res,e.status||500,{error:e.status?e.message:'Could not save or complete the request. Please try again.',...(e.status&&/^PAYOUT_[A-Z_]+$/.test(e.code||'')?{code:e.code,...(e.diagnostic?{diagnostic:e.diagnostic}:{})}:{})});if(!e.status)console.error('Request failed:',e.code||e.message);}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store,async close(){clearInterval(cleanup);await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});teamTools.close();await store.close();}};
}
if(require.main===module){
  createApp().then(app=>{app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('SEVEN Team '+BUILD+' ready'));let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0));});}).catch(e=>{console.error('Startup failed:',e.message);process.exitCode=1;});
}
module.exports={createApp,activityInput};
