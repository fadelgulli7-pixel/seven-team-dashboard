'use strict';
const {PublicKey,Transaction}=require('@solana/web3.js');
// Phantom runtime validation: https://docs.phantom.com/developer-powertools/lighthouse
// Lighthouse instruction enum: https://github.com/Jac0xb/lighthouse/blob/4c579479c98635e419b1b167f08be02a71604a71/programs/lighthouse/src/instruction.rs
const LIGHTHOUSE=new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');
// Only single-target, read-only assertion entrypoints. NEVER MemoryWrite (0),
// MemoryClose (1), delta/memory or Merkle/CPI entrypoints. Keep guards in the
// transaction that is actually verified, persisted and broadcast.
const ASSERTIONS=new Set([2,3,5,6,7,8,9,10]);
function sameInstruction(a,b){return a.programId.equals(b.programId)&&Buffer.from(a.data).equals(Buffer.from(b.data))&&a.keys.length===b.keys.length&&a.keys.every((k,i)=>k.pubkey.equals(b.keys[i].pubkey)&&k.isSigner===b.keys[i].isSigner&&k.isWritable===b.keys[i].isWritable);}
function compatibleMessage(job,returned){
 if(returned.serializeMessage().toString('base64')===job.message)return true;
 const original=Transaction.from(Buffer.from(job.transaction,'base64'));
 if(returned.feePayer?.toBase58()!==job.source||returned.recentBlockhash!==original.recentBlockhash||returned.nonceInfo||returned.instructions.length<=original.instructions.length||returned.instructions.length>original.instructions.length+3)return false;
 // Exact original instruction bytes, account order and privileges. Wallets may
 // append guards, but may not edit, insert, remove or reorder any payment step.
 if(!original.instructions.every((ix,i)=>sameInstruction(ix,returned.instructions[i])))return false;
 const expected=original.compileMessage(),actual=returned.compileMessage();
 const privileges=m=>new Map(m.accountKeys.map((k,i)=>[k.toBase58(),{signer:m.isAccountSigner(i),writable:m.isAccountWritable(i)}]));
 const before=privileges(expected),after=privileges(actual);
 for(const [key,flags] of before){const got=after.get(key);if(!got||got.signer!==flags.signer||got.writable!==flags.writable)return false;}
 // The only new account may be the read-only executable Lighthouse program.
 for(const [key,flags] of after)if(!before.has(key)&&(key!==LIGHTHOUSE.toBase58()||flags.signer||flags.writable))return false;
 const guards=returned.instructions.slice(original.instructions.length);
 if(!guards.every(ix=>ix.programId.equals(LIGHTHOUSE)&&ix.data.length>=3&&ix.data.length<=512&&ASSERTIONS.has(ix.data[0])&&ix.keys.length===1&&before.has(ix.keys[0].pubkey.toBase58())))return false;
 // Recompile just the unchanged payment to ensure its original message, including
 // signer/header semantics, exactly matches the saved reservation. No guard is
 // removed from the actual signed transaction.
 const payment=new Transaction({feePayer:original.feePayer,recentBlockhash:original.recentBlockhash}).add(...returned.instructions.slice(0,original.instructions.length));
 return payment.serializeMessage().toString('base64')===job.message;
}
module.exports={LIGHTHOUSE,compatibleMessage};
