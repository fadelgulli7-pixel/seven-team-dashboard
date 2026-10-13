(function(root){
'use strict';
// Percentages share one denominator: all approved work in the selected period,
// including historical contributions of suspended members. Equal counts share rank.
function summarize(members,activities){
  const counts=new Map();let total=0;
  for(const a of activities){if(a.status!=='approved')continue;counts.set(a.memberId,(counts.get(a.memberId)||0)+1);total++;}
  const rows=members.map(m=>({...m,count:counts.get(m.id)||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  let previous=-1,rank=0;
  return rows.map((m,i)=>{if(m.count!==previous)rank=i+1;previous=m.count;return {...m,rank:m.count?rank:null,percent:total?m.count/total*100:0,total};});
}
if(typeof module!=='undefined'&&module.exports)module.exports={summarize};else root.SevenContributions={summarize};
})(typeof globalThis!=='undefined'?globalThis:this);
