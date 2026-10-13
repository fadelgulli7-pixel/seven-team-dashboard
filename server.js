'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {FileStore}=require('./lib/store');
const {hashPassword,verifyPassword,equalSecret,Limiter}=require('./lib/security');
const categories=['Marketing','Content','Community','Partnership','Development','Other'];
const platforms=['X (Twitter)','Telegram','YouTube','TikTok','Instagram','Discord','Website','Blog','Business','Other'];
const BUILD='2026-10-12-team-v3.0.1';
const TTL=12*60*60*1000;
const COOKIE='seven_session';
const error=(status,message)=>Object.assign(new Error(message),{status});
const safeMember=m=>Object.fromEntries(['id','name','handle','username','role','initials','createdAt','active','mustChangePassword'].map(k=>[k,m[k]]));
const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=200;
function memberInput(body) {
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>50||typeof body.username!=='string'||!/^[a-zA-Z0-9_.-]{3,32}$/.test(body.username)||!validPassword(body.password))throw error(400,'Enter a name, a valid username, and a password of 12–200 characters.');
  const name=body.name.trim(),username=body.username.toLowerCase();
  return {id:crypto.randomUUID(),name,username,handle:'@'+String(body.handle||username).trim().replace(/^@+/,'').slice(0,40),initials:name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),createdAt:new Date().toISOString(),active:true,authVersion:0};
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
function fingerprint(a){return crypto.createHash('sha256').update(JSON.stringify([a.memberId,a.title.toLowerCase(),a.category,a.platform,a.description,a.link])).digest('hex');}
function audit(d,actor,action,target,details={}) {d.audit.push({id:crypto.randomUUID(),actorId:actor.id,actorName:actor.name,action,target,details,createdAt:new Date().toISOString()});}
function send(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));}
async function readBody(req){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'Send JSON data.');
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>32768)throw error(413,'Request is too large.');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw error(400,'Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw error(400,'Invalid request.');return body;
}
async function createApp(options={}) {
  const env=options.env||process.env;
  const dataDir=options.dataDir||env.DATA_DIR||path.join(__dirname,'data');
  if(env.NODE_ENV==='production'&&!env.DATA_DIR&&!options.dataDir)throw Error('Set DATA_DIR to your persistent disk before production startup.');
  // Read required assets before acquiring the data-directory lock.
  const html=await fs.readFile(path.join(__dirname,'index.html'));
  const dummy=await hashPassword(crypto.randomBytes(32).toString('hex'));
  const store=options.store||await new FileStore(path.resolve(dataDir)).open();
  const sessions=new Map(),limiter=new Limiter();
  let cryptoJobs=0;
  async function cryptoWork(fn){if(cryptoJobs>=8)throw error(429,'Service is busy. Try again shortly.');cryptoJobs++;try{return await fn();}finally{cryptoJobs--;}}
  function secure(req){return req.socket.encrypted||env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https';}
  function cookie(req,value,age){return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure(req)?'; Secure':''}`;}
  function sidOf(req){return (req.headers.cookie||'').match(/(?:^|;\s*)seven_session=([a-f0-9-]+)/)?.[1];}
  function beginSession(req,res,member,status=200){
    const perUser=[...sessions].filter(([,s])=>s.memberId===member.id);
    for(const [sid]of perUser.slice(0,Math.max(0,perUser.length-4)))sessions.delete(sid);
    const sid=crypto.randomUUID(),csrf=crypto.randomUUID();
    sessions.set(sid,{memberId:member.id,authVersion:member.authVersion,csrf,expiresAt:Date.now()+TTL});
    send(res,status,{member:safeMember(member),csrf},{'Set-Cookie':cookie(req,sid,TTL/1000)});
  }
  function identity(req,data=store.data){const s=sessions.get(sidOf(req));const m=s&&data.members.find(m=>m.id===s.memberId);if(!s||s.expiresAt<=Date.now()||!m||!m.active||s.authVersion!==m.authVersion)throw error(401,'Please sign in again.');return {session:s,member:m};}
  function actor(req,d){const {member}=identity(req,d);if(member.mustChangePassword)throw error(403,'Change your starter password first.');return member;}
  function owner(m){if(m.role!=='Owner')throw error(403,'Only the owner can do this.');}
  function throttle(key,max=8,ms=15*60*1000){if(!limiter.take(key,max,ms))throw error(429,'Too many attempts. Try again later.');}
  function revoke(id){for(const [sid,s]of sessions)if(s.memberId===id)sessions.delete(sid);}
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
      const m={...memberInput(b),...await cryptoWork(()=>hashPassword(b.password)),role:'Owner',mustChangePassword:false};
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
    if(req.method==='POST'&&route==='/api/logout'){
      const s=sessions.get(sidOf(req));if(s&&!equalSecret(req.headers['x-csrf-token'],s.csrf))throw error(403,'Request could not be verified.');sessions.delete(sidOf(req));return send(res,200,{ok:true},{'Set-Cookie':cookie(req,'',0)});
    }
    const {member,session}=identity(req);
    if(req.method==='POST'&&!equalSecret(req.headers['x-csrf-token'],session.csrf))throw error(403,'Request could not be verified.');
    if(req.method==='GET'&&route==='/api/me')return send(res,200,{member:safeMember(member),csrf:session.csrf});
    if(req.method==='POST'&&route==='/api/password'){
      throttle('password:'+member.id);const b=await readBody(req);
      if(!await cryptoWork(()=>verifyPassword(b.currentPassword,member)))throw error(401,'Current password is incorrect.');
      if(!validPassword(b.newPassword)||b.newPassword===b.currentPassword)throw error(400,'Use a different password of 12–200 characters.');
      const creds=await cryptoWork(()=>hashPassword(b.newPassword));
      const updated=await store.transaction(d=>{const m=identity(req,d).member;Object.assign(m,creds,{mustChangePassword:false,authVersion:m.authVersion+1});audit(d,m,'password_changed',m.id);return m;});
      revoke(member.id);return beginSession(req,res,updated);
    }
    actor(req);
    if(req.method==='GET'&&route==='/api/data')return send(res,200,{member:safeMember(member),members:store.data.members.map(safeMember),activities:store.data.activities.map(({history,fingerprint,requestKey,...a})=>a),revision:store.data.revision,build:BUILD});
    if(req.method==='GET'&&route==='/api/audit'){owner(member);return send(res,200,{events:store.data.audit.slice(-200).reverse()});}
    if(req.method==='POST'&&route==='/api/backup'){
      owner(member);const b=await readBody(req);throttle('backup:'+member.id,3);
      if(!await cryptoWork(()=>verifyPassword(b.password,member)))throw error(401,'Current password is incorrect.');
      owner(actor(req));return send(res,200,store.data,{'Content-Disposition':`attachment; filename="seven-team-backup-${new Date().toISOString().slice(0,10)}.json"`});
    }
    if(req.method==='POST'&&route==='/api/members'){
      owner(member);throttle('member-create:'+member.id,30);const b=await readBody(req);
      const m={...memberInput(b),...await cryptoWork(()=>hashPassword(b.password)),role:b.role==='Manager'?'Manager':'Member',mustChangePassword:true};
      await store.transaction(d=>{const who=actor(req,d);owner(who);if(d.members.some(x=>x.username===m.username))throw error(409,'That username is already in the team.');d.members.push(m);audit(d,who,'member_created',m.id,{role:m.role});});return send(res,201,{member:safeMember(m)});
    }
    const manage=route.match(/^\/api\/members\/([a-f0-9-]+)$/);
    if(req.method==='POST'&&manage){
      owner(member);const b=await readBody(req);const actions=['role','active','reset-password'];if(!actions.includes(b.action))throw error(400,'Invalid member action.');
      let creds;if(b.action==='reset-password'){throttle('reset:'+member.id,20);if(!validPassword(b.password))throw error(400,'Use a password of 12–200 characters.');creds=await cryptoWork(()=>hashPassword(b.password));}
      const changed=await store.transaction(d=>{const who=actor(req,d);owner(who);const m=d.members.find(x=>x.id===manage[1]);if(!m)throw error(404,'Member not found.');if(m.role==='Owner')throw error(409,'The owner cannot be suspended or changed here.');
        if(b.action==='role'){if(!['Manager','Member'].includes(b.role))throw error(400,'Invalid role.');m.role=b.role;}
        if(b.action==='active'){if(typeof b.active!=='boolean')throw error(400,'Invalid status.');m.active=b.active;}
        if(creds)Object.assign(m,creds,{mustChangePassword:true});m.authVersion++;audit(d,who,'member_'+b.action,m.id,{role:m.role,active:m.active});return m;});
      revoke(changed.id);return send(res,200,{member:safeMember(changed)});
    }
    if(req.method==='POST'&&route==='/api/activities'){
      throttle('activity:'+member.id,30,60000);const b=await readBody(req),input=activityInput(b);
      if(typeof b.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.requestKey))throw error(400,'Refresh the activity form and try again.');
      const result=await store.transaction(d=>{const who=actor(req,d);const payload={...input,memberId:who.id};const hash=fingerprint(payload);
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
          audit(d,who,'activity_'+b.status,a.id,{note});
        }else{
          if(a.memberId!==who.id)throw error(403,'Only the author can correct this work.');
          if(a.status==='approved')throw error(409,'Approved work is locked.');
          const input=activityInput(b),hash=fingerprint({...input,memberId:who.id});
          if(d.activities.some(x=>x.id!==a.id&&x.memberId===who.id&&(x.fingerprint===hash||(input.link&&x.link===input.link))))throw error(409,'This work is already recorded.');
          Object.assign(a,input,{fingerprint:hash,status:'pending',reviewNote:'',reviewedBy:null,reviewedAt:null,updatedAt:new Date().toISOString()});audit(d,who,'activity_corrected',a.id);
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
      if(!['/','/index.html'].includes(url.pathname))throw error(404,'Not found.');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':`default-src 'self'; script-src 'self' ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'`});res.end(req.method==='HEAD'?undefined:html);
    }catch(e){if(!res.headersSent&&!res.destroyed)send(res,e.status||500,{error:e.status?e.message:'Could not save or complete the request. Please try again.'});if(!e.status)console.error('Request failed:',e.code||e.message);}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store,async close(){clearInterval(cleanup);await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await store.close();}};
}
if(require.main===module){
  createApp().then(app=>{app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('SEVEN Team '+BUILD+' ready'));let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0));});}).catch(e=>{console.error('Startup failed:',e.message);process.exitCode=1;});
}
module.exports={createApp,activityInput};
