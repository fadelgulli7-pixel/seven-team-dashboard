'use strict';
const crypto=require('node:crypto');
const {Connection,PublicKey,Transaction,ComputeBudgetProgram}=require('@solana/web3.js');
const {getMint,getAssociatedTokenAddress,createAssociatedTokenAccountIdempotentInstruction,createTransferCheckedInstruction}=require('./token');
const bs58=require('bs58').default;
const Wallet=require('./wallet');const Rewards=require('./rewards');
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
const live=j=>['prepared','broadcast'].includes(j.status);
function config(d){return d.payoutConfig||{provider:'phantom',walletAddress:''};}
function configure(d,b){if(!Wallet.validWallet(b.walletAddress)||!['phantom','solflare'].includes(b.provider))fail('Connect your Solana payout wallet first.');d.payoutConfig={provider:b.provider,walletAddress:b.walletAddress,updatedAt:new Date().toISOString()};return d.payoutConfig;}
function unreserved(d,memberId){if((d.payoutJobs||[]).some(j=>j.memberId===memberId&&live(j)))fail('A wallet payment is already reserved. Check its status before starting another.',409);}
function validate(d){if(d.payoutConfig!==undefined&&(!Wallet.validWallet(d.payoutConfig.walletAddress)||!['phantom','solflare'].includes(d.payoutConfig.provider)))fail('Invalid payout wallet configuration.');if(d.payoutJobs===undefined)return;if(!Array.isArray(d.payoutJobs))fail('Invalid wallet payment history.');const ids=new Set(),signatures=new Set();for(const j of d.payoutJobs){if(!j.id||ids.has(j.id)||!d.members.some(m=>m.id===j.memberId)||!['prepared','broadcast','confirmed','failed','expired'].includes(j.status)||!Wallet.validWallet(j.source)||!Wallet.validWallet(j.recipient)||!Number.isSafeInteger(j.usdCents)||j.usdCents<=0||!Number.isInteger(j.lastValidBlockHeight)||!j.message||!j.transaction)fail('Invalid wallet payment record.');ids.add(j.id);if(j.signature){if(signatures.has(j.signature))fail('Duplicate wallet payment signature.');signatures.add(j.signature);}if(j.status==='confirmed'&&!d.rewards?.payments.some(p=>p.id===j.paymentId&&!p.voidedAt))fail('Missing confirmed wallet payment ledger entry.');}}
// Specify fees before signing. Any subsequent wallet message mutation is still rejected.
// 200,000 CU * 10,000 micro-lamports/CU = 2,000 lamports priority fee.
function messageDiagnostic(job,tx){
 const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const expected=Transaction.from(Buffer.from(job.transaction,'base64'));
 const describe=i=>{if(!i)return null;const d=Buffer.from(i.data),budget=i.programId.equals(ComputeBudgetProgram.programId);return {program:i.programId.toBase58(),keyCount:i.keys.length,dataBytes:d.length,dataHash:digest(d),...(budget&&d[0]===2&&d.length===5?{computeUnits:d.readUInt32LE(1)}:{}),...(budget&&d[0]===3&&d.length===9?{microLamports:d.readBigUInt64LE(1).toString()}:{})};};
 const before=expected.compileMessage(),after=tx.compileMessage();
 const changes=[];
 for(let i=0;i<Math.max(expected.instructions.length,tx.instructions.length);i++){
  const a=expected.instructions[i],b=tx.instructions[i];
  const keys=x=>JSON.stringify(x?.keys.map(k=>[k.pubkey.toBase58(),k.isSigner,k.isWritable]));
  if(!a||!b||!a.programId.equals(b.programId)||!Buffer.from(a.data).equals(Buffer.from(b.data))||keys(a)!==keys(b))changes.push({index:i,expected:describe(a),returned:describe(b),keysChanged:keys(a)!==keys(b)});
 }
 return {format:'seven-payment-diagnostic-v1',jobId:job.id,expectedMessageHash:digest(Buffer.from(job.message,'base64')),returnedMessageHash:digest(tx.serializeMessage()),feePayerChanged:expected.feePayer.toBase58()!==tx.feePayer?.toBase58(),blockhashChanged:expected.recentBlockhash!==tx.recentBlockhash,headerChanged:JSON.stringify(before.header)!==JSON.stringify(after.header),accountOrderChanged:JSON.stringify(before.accountKeys.map(k=>k.toBase58()))!==JSON.stringify(after.accountKeys.map(k=>k.toBase58())),expectedInstructionCount:expected.instructions.length,returnedInstructionCount:tx.instructions.length,changes};
}
function signedPayment(job,encoded){
 const reject=(code,message,diagnostic)=>{throw Object.assign(Error(message),{status:400,code,...(diagnostic?{diagnostic}:{})});};
 let raw,tx;
 try{if(typeof encoded!=='string'||encoded.length>5000||!encoded.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error();raw=Buffer.from(encoded,'base64');tx=Transaction.from(raw);}
 catch{reject('PAYOUT_ENCODING','The signed transaction could not be read. No payment was broadcast.');}
 if(tx.feePayer?.toBase58()!==job.source)reject('PAYOUT_SIGNER','The signed payment uses a different source wallet. No payment was broadcast.');
 if(tx.serializeMessage().toString('base64')!==job.message)reject('PAYOUT_MESSAGE_CHANGED','The signed transaction does not match the prepared SEVEN payment. The wallet changed its message or fees. No payment was broadcast.',messageDiagnostic(job,tx));
 if(!tx.verifySignatures())reject('PAYOUT_SIGNATURE','The wallet signature is missing or invalid. No payment was broadcast.');
 return {tx,raw};
}
function create(env,custom){
 const connection=custom||new Connection(env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',{commitment:'confirmed',confirmTransactionInitialTimeout:20000});
 const mint=env.SEVEN_TOKEN_MINT||'Ho3DNyGDTuKoFdA1bd6obE9xaL4RuStHUW1eLpodHS53';const decimals=Number(env.SEVEN_TOKEN_DECIMALS??9);
 async function prepare(store,b,actor){if(actor.role!=='Owner')fail('Only the owner can pay rewards.',403);const initial=store.data;unreserved(initial,b.memberId);const cfg=config(initial);if(!cfg.walletAddress)fail('Save your payout wallet first.');const member=initial.members.find(m=>m.id===b.memberId&&m.active);if(!member)fail('Choose an active member.');const due=Rewards.summary(initial).members.find(m=>m.memberId===member.id)?.dueCents;if(!due||due<=0)fail('This member has no unpaid reward.');
  const quoted=Wallet.transfer(member.walletAddress,b.amount,{SEVEN_TOKEN_MINT:mint,SEVEN_TOKEN_DECIMALS:String(decimals)});const payer=new PublicKey(cfg.walletAddress),token=new PublicKey(mint);const chainMint=await getMint(connection,token,'confirmed');if(chainMint.decimals!==decimals)fail('SEVEN token decimals do not match the blockchain.');
  const from=await getAssociatedTokenAddress(token,payer),to=await getAssociatedTokenAddress(token,new PublicKey(member.walletAddress));const units=BigInt(b.amount.replace('.',''))*10n**BigInt(decimals-(b.amount.split('.')[1]||'').length);const balance=await connection.getTokenAccountBalance(from,'confirmed');if(BigInt(balance.value.amount)<units)fail('Your payout wallet has insufficient SEVEN.');
  const latest=await connection.getLatestBlockhash('confirmed');const tx=new Transaction({feePayer:payer,recentBlockhash:latest.blockhash}).add(ComputeBudgetProgram.setComputeUnitLimit({units:200000}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:10000}),createAssociatedTokenAccountIdempotentInstruction(payer,to,new PublicKey(member.walletAddress),token),createTransferCheckedInstruction(from,token,to,payer,units,decimals));
  const job={provider:cfg.provider,id:crypto.randomUUID(),memberId:member.id,source:cfg.walletAddress,recipient:member.walletAddress,amount:b.amount,mint,usdCents:due,status:'prepared',transaction:tx.serialize({requireAllSignatures:false}).toString('base64'),message:tx.serializeMessage().toString('base64'),blockhash:latest.blockhash,lastValidBlockHeight:latest.lastValidBlockHeight,createdAt:new Date().toISOString(),ownerId:actor.id};
  await store.transaction(d=>{if(d.revision!==b.revision||config(d).walletAddress!==job.source||d.members.find(m=>m.id===member.id)?.walletAddress!==job.recipient||Rewards.summary(d).members.find(m=>m.memberId===member.id)?.dueCents!==due)fail('This record changed. Refresh and try again.',409);unreserved(d,member.id);d.payoutJobs??=[];d.payoutJobs.push(job);});return job;
 }
 async function reconcile(store,id,actor){if(actor.role!=='Owner')fail('Only the owner can reconcile payments.',403);let j=store.data.payoutJobs?.find(j=>j.id===id);if(!j)fail('Wallet payment not found.',404);if(j.ownerId!==actor.id)fail('Only the owner can reconcile this payment.',403);if(!live(j))return j;
  if(!j.signature){if(await connection.getBlockHeight('confirmed')<=j.lastValidBlockHeight)return j;await store.transaction(d=>{const q=d.payoutJobs.find(q=>q.id===id);if(q.status==='prepared'&&!q.signature)q.status='expired';});return store.data.payoutJobs.find(j=>j.id===id);}
  const status=(await connection.getSignatureStatuses([j.signature],{searchTransactionHistory:true})).value[0];if(!status)return j;
  if(status.err){await store.transaction(d=>{const q=d.payoutJobs.find(q=>q.id===id);if(q.status==='broadcast'){q.status='failed';q.chainError=JSON.stringify(status.err);}});return store.data.payoutJobs.find(j=>j.id===id);}
  if(!['confirmed','finalized'].includes(status.confirmationStatus))return j;
  await store.transaction(d=>{const q=d.payoutJobs.find(q=>q.id===id);if(q.status==='confirmed')return;if(q.status!=='broadcast')fail('Unexpected payment state.',409);const payment=Rewards.payment(d,{memberId:q.memberId,amount:(q.usdCents/100).toFixed(2),proof:'https://solscan.io/tx/'+q.signature,note:'Confirmed wallet SEVEN reward '+q.id},actor);q.status='confirmed';q.paymentId=payment.id;q.confirmedAt=new Date().toISOString();});return store.data.payoutJobs.find(j=>j.id===id);
 }
 async function submit(store,b,actor){if(actor.role!=='Owner')fail('Only the owner can pay rewards.',403);let job=store.data.payoutJobs?.find(j=>j.id===b.jobId);if(!job||job.ownerId!==actor.id)fail('Wallet payment not found.',404);if(!live(job))return job;if(job.status==='prepared'){const m=store.data.members.find(m=>m.id===job.memberId);if(!m?.active||m.walletAddress!==job.recipient)fail('Recipient account or wallet changed. Wait for the prepared transaction to expire before preparing a new payment.',409);}const {tx,raw}=signedPayment(job,b.signedTransaction);
  const signature=bs58.encode(tx.signature);await store.transaction(d=>{const j=d.payoutJobs.find(j=>j.id===b.jobId);if(!live(j))fail('Payment already finished.',409);if(j.signature&&j.signature!==signature)fail('A different signed transaction is already recorded.',409);j.signature=signature;j.signedTransaction=raw.toString('base64');j.status='broadcast';});
  // Persist the exact signature BEFORE broadcast. Every retry uses the same bytes.
  try{const result=await connection.sendRawTransaction(raw,{skipPreflight:false,maxRetries:3,preflightCommitment:'confirmed'});if(result!==signature)throw Error('Unexpected RPC signature.');}catch(e){return {...store.data.payoutJobs.find(j=>j.id===b.jobId),notice:'Payment status is uncertain. Use Check payment status; do not start another transfer.'};}
  return reconcile(store,b.jobId,actor);
 }
 return {prepare,submit,reconcile};
}
module.exports={config,configure,unreserved,validate,create,signedPayment,messageDiagnostic};
