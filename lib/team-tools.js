'use strict';
// Team conversation and image bytes have their own store: chat never changes ledger revisions.
const crypto=require('node:crypto');
const path=require('node:path');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const reviewer=m=>['Owner','Manager'].includes(m.role);
function validIds(ids){return ids===undefined||(Array.isArray(ids)&&ids.length<=3&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&UUID.test(id)));}
function open(directory){
 const {DatabaseSync}=require('node:sqlite');
 const filename=path.join(directory,'team-tools.sqlite');
 const db=new DatabaseSync(filename);
 require('node:fs').chmodSync(filename,0o600);
 db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, memberId TEXT NOT NULL, requestKey TEXT NOT NULL, text TEXT NOT NULL, createdAt TEXT NOT NULL, deletedBy TEXT, deletedAt TEXT, UNIQUE(memberId,requestKey));
 CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, memberId TEXT NOT NULL, digest TEXT NOT NULL, bytes BLOB NOT NULL, createdAt TEXT NOT NULL, UNIQUE(memberId,digest));`);
 if(!db.prepare('PRAGMA table_info(evidence)').all().some(c=>c.name==='mime'))db.exec("ALTER TABLE evidence ADD COLUMN mime TEXT NOT NULL DEFAULT 'image/jpeg'");
 return {
  mime(id){return db.prepare('SELECT mime FROM evidence WHERE id=?').get(id)?.mime||'image/jpeg';},
  close(){db.close();},
  list(before){const n=before===null?Number.MAX_SAFE_INTEGER:Number(before);if(!Number.isSafeInteger(n)||n<1)fail('Invalid message page.');const rows=db.prepare('SELECT seq,id,memberId,text,createdAt,deletedAt FROM messages WHERE seq < ? ORDER BY seq DESC LIMIT 101').all(n);const hasMore=rows.length>100;return {messages:rows.slice(0,100).reverse().map(m=>({...m,text:m.deletedAt?'':m.text})),hasMore};},
  message(who,b){if(typeof b.text!=='string'||!b.text.trim()||b.text.trim().length>2000||!UUID.test(b.requestKey||''))fail('Use a message of 1–2000 characters.');const prior=db.prepare('SELECT id,text FROM messages WHERE memberId=? AND requestKey=?').get(who.id,b.requestKey);if(prior){if(prior.text!==b.text.trim())fail('This message was already submitted.',409);return prior.id;}const id=crypto.randomUUID();db.prepare('INSERT INTO messages(id,memberId,requestKey,text,createdAt) VALUES(?,?,?,?,?)').run(id,who.id,b.requestKey,b.text.trim(),new Date().toISOString());return id;},
  remove(who,id){if(!reviewer(who))fail('Only an owner or manager can moderate chat.',403);if(!UUID.test(id||''))fail('Invalid message.');if(!db.prepare('SELECT id FROM messages WHERE id=?').get(id))fail('Message not found.',404);db.prepare('UPDATE messages SET text=\'\',deletedBy=?,deletedAt=? WHERE id=? AND deletedAt IS NULL').run(who.id,new Date().toISOString(),id);},
  upload(who,b){const media=b.media||b.image;let mime,bytes;
   if(typeof media!=='string'||media.length>28000000)fail('Choose a JPEG image or MP4/WebM video up to 20 MB.');
   const match=/^data:(image\/jpeg|video\/mp4|video\/webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(media);if(!match)fail('Choose a JPEG image or MP4/WebM video up to 20 MB.');mime=match[1];bytes=Buffer.from(match[2],'base64');
   const jpeg=mime==='image/jpeg'&&bytes.length>=4&&bytes.length<=1000000&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
   const mp4=mime==='video/mp4'&&bytes.length>=16&&bytes.toString('ascii',4,8)==='ftyp';
   const webm=mime==='video/webm'&&bytes.length>=16&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
   if(bytes.length>20*1024*1024||!(jpeg||mp4||webm))fail('Invalid image or video. Use JPEG, MP4 or WebM up to 20 MB.');
   const digest=crypto.createHash('sha256').update(bytes).digest('hex');const prior=db.prepare('SELECT id FROM evidence WHERE memberId=? AND digest=?').get(who.id,digest);if(prior)return prior.id;const size=db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS total, COALESCE(SUM(CASE WHEN memberId=? THEN length(bytes) ELSE 0 END),0) AS own FROM evidence').get(who.id);if(size.total+bytes.length>1073741824||size.own+bytes.length>262144000)fail('Screenshot storage limit reached. Contact the owner.',409);const id=crypto.randomUUID();db.prepare('INSERT INTO evidence(id,memberId,digest,bytes,createdAt,mime) VALUES(?,?,?,?,?,?)').run(id,who.id,digest,bytes,new Date().toISOString(),mime);return id;},
  digests(ids){return ids.map(id=>db.prepare('SELECT digest FROM evidence WHERE id=?').get(id).digest);},
  owned(who,ids){if(!validIds(ids))fail('Attach up to 3 screenshots.');for(const id of ids||[]){if(db.prepare('SELECT memberId FROM evidence WHERE id=?').get(id)?.memberId!==who.id)fail('Screenshot not found.',404);}return ids||[];},
  image(who,id,d){if(!UUID.test(id))fail('Screenshot not found.',404);const row=db.prepare('SELECT memberId,bytes FROM evidence WHERE id=?').get(id);if(!row)fail('Screenshot not found.',404);const linked=[...d.activities,...(d.rewards?.referrals||[])].some(r=>r.evidenceIds?.includes(id));if(row.memberId!==who.id&&!(reviewer(who)&&linked))fail('Screenshot not found.',404);return row.bytes;}
 };
}
module.exports={open,validIds};
