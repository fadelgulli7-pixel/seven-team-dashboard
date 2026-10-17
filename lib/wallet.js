'use strict';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function publicKey(s){
  if(typeof s!=='string'||s.length<32||s.length>44)return null;
  let n=0n;for(const c of s){const i=alphabet.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
  const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}
  for(const c of s){if(c!=='1')break;bytes.unshift(0);}
  return bytes.length===32?Buffer.from(bytes):null;
}
function validWallet(s){
  const bytes=publicKey(s);if(!bytes||bytes.every(b=>b===0))return false;
  const P=(1n<<255n)-19n,mod=x=>(x%P+P)%P;
  const pow=(x,n)=>{let r=1n;for(x=mod(x);n;n>>=1n,x=mod(x*x))if(n&1n)r=mod(r*x);return r;};
  const sign=bytes[31]>>7;bytes[31]&=127;
  let y=0n;for(let i=31;i>=0;i--)y=(y<<8n)+BigInt(bytes[i]);if(y>=P)return false;
  const d=mod(-121665n*pow(121666n,P-2n)),den=mod(d*y*y+1n);if(!den)return false;
  const x2=mod((y*y-1n)*pow(den,P-2n));
  return x2===0n?sign===0:pow(x2,(P-1n)/2n)===1n;
}
function transfer(recipient,amount,env){
  const fail=message=>{throw Object.assign(Error(message),{status:400});};
  if(!validWallet(recipient))fail('Save a valid Solana receiving wallet first.');
  const mint=env.SEVEN_TOKEN_MINT,decimals=Number(env.SEVEN_TOKEN_DECIMALS);
  if(!publicKey(mint)||env.SEVEN_TOKEN_DECIMALS===undefined||!Number.isInteger(decimals)||decimals<0||decimals>18)fail('Owner: configure the verified SEVEN_TOKEN_MINT and SEVEN_TOKEN_DECIMALS on the server.');
  if(typeof amount!=='string'||amount.length>40||!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount)||((amount.split('.')[1]||'').length>decimals))fail('Enter a positive SEVEN amount using the token decimals.');
  const units=BigInt(amount.replace('.',''))*10n**BigInt(decimals-(amount.split('.')[1]||'').length);
  if(units<=0n||units>18446744073709551615n)fail('SEVEN amount is outside the token transfer range.');
  return {recipient,amount,mint,uri:'solana:'+recipient+'?'+new URLSearchParams({amount,'spl-token':mint,label:'SEVEN Marketing',message:'Marketing reward'})};
}
module.exports={publicKey,validWallet,transfer};
