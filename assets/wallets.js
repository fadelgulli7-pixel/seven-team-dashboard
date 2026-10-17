(function(root){
 'use strict';
 const valid=name=>['solflare','phantom'].includes(name);
 const label=name=>name==='solflare'?'Solflare':'Phantom';
 function provider(name,scope=root){if(!valid(name))throw Error('Unsupported wallet.');if(name==='solflare')return scope.solflare?.isSolflare?scope.solflare:scope.solana?.isSolflare?scope.solana:null;return scope.phantom?.solana?.isPhantom?scope.phantom.solana:scope.solana?.isPhantom?scope.solana:null;}
 function browse(name,origin){if(!valid(name))throw Error('Unsupported wallet.');const next=new URL('/',origin);next.hash='owner-wallet-'+name;return (name==='solflare'?'https://solflare.com/ul/v1/browse/':'https://phantom.com/ul/browse/')+encodeURIComponent(next.href)+'?ref='+encodeURIComponent(origin);}
 async function connect(name,scope=root){const p=provider(name,scope);if(!p)throw Object.assign(Error('Open this panel inside the selected wallet.'),{code:'WALLET_MISSING'});const response=await p.connect();if(response===false)throw Error('Wallet connection was not approved.');const publicKey=p.publicKey||response?.publicKey;if(!publicKey||typeof publicKey.toString!=='function')throw Error('Wallet connection was not approved.');return {provider:p,publicKey:publicKey.toString()};}
 async function sign(name,transaction,expected,scope=root){const c=await connect(name,scope);if(c.publicKey!==expected)throw Object.assign(Error('Choose the saved payout account in the selected wallet.'),{code:'WALLET_MISMATCH'});return c.provider.signTransaction(transaction);}
 const api={valid,label,provider,browse,connect,sign};root.SevenWallets=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
