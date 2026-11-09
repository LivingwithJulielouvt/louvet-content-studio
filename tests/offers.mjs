// Demande d'offre complète depuis la page facturation : visible uniquement par l'agence.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
assert.equal((await alice('offer-request',{client_id:a.id,plan:'complete',message:'Je veux en savoir plus'})).status,200);
assert.equal((await alice('offer-request',{client_id:a.id,plan:'complete'})).data.duplicate,true,'no spam within 24h');
assert.notEqual((await bob('offer-request',{client_id:a.id,plan:'complete'})).status,200,'Bob cannot request for Alice');
const agency=(await call('state')).data;assert.equal(agency.offerRequests.length,1);assert.equal(agency.offerRequests[0].email,'alice@test.local');
assert.equal((await alice('state')).data.offerRequests,undefined);assert.equal((await alice('state')).data.offerRequest.status,'new');
assert.equal((await bob('state')).data.offerRequest,null);
assert.equal((await alice('offer-request-status',{id:agency.offerRequests[0].id,status:'won'})).status,403);
assert.equal((await call('offer-request-status',{id:agency.offerRequests[0].id,status:'contacted'})).status,200);
console.log('offers OK');
