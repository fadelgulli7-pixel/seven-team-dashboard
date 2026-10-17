'use strict';
// Maintenance is local to the host. Never expose these commands as HTTP routes.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {FileStore,validate}=require('./lib/store');
const {hashPassword}=require('./lib/security');
async function main(){
 const command=process.argv[2];
 if(command==='verify-backup'){
  if(!process.argv[3])throw Error('Usage: node tools.js verify-backup /absolute/path/backup.json');
  const data=validate(JSON.parse(await fs.readFile(path.resolve(process.argv[3]),'utf8')));
  console.log(`Valid backup: ${data.members.length} members, ${data.activities.length} activities. No changes made.`);return;
 }
 if(command==='reset-owner'){
  if(!process.env.DATA_DIR)throw Error('Set DATA_DIR to the existing persistent data directory.');
  const password=process.env.OWNER_NEW_PASSWORD;
  if(typeof password!=='string'||password.length<12||password.length>200)throw Error('Set OWNER_NEW_PASSWORD to a unique 12–200 character password.');
  // Refuse to create a fresh workspace on a mistyped directory.
  await fs.access(path.join(path.resolve(process.env.DATA_DIR),'team-data.json'));
  const store=await new FileStore(path.resolve(process.env.DATA_DIR)).open();
  try{
   const creds=await hashPassword(password);
   await store.transaction(d=>{const owner=d.members.find(m=>m.role==='Owner');if(!owner)throw Error('Owner not found.');Object.assign(owner,creds,{active:true,mustChangePassword:true,authVersion:owner.authVersion+1});delete owner.recovery;d.audit.push({id:crypto.randomUUID(),actorId:'server-operator',actorName:'Server operator',action:'owner_password_recovered',target:owner.id,details:{},createdAt:new Date().toISOString()});});
   console.log('Owner starter password reset. Existing records preserved. Remove OWNER_NEW_PASSWORD and restart the service.');
  }finally{await store.close();}return;
 }
 throw Error('Commands: verify-backup PATH | reset-owner (service must be stopped)');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
