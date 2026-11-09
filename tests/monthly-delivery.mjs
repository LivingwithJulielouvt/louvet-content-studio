// Livraison mensuelle : 6 contenus préparés (offerts), validés par l'agence, invisibles pour le client avant le 3.
import assert from 'node:assert/strict';
import {readyHarness as harness,photoForm} from './harness.mjs';
import {runDailyStudio,deliveryTargetMonth} from '../lib/studio.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=';
const records=new Map();
const apiFetch=async(url,opts)=>{if(opts.method==='POST'){const b=JSON.parse(opts.body);const id='resp-'+crypto.randomUUID();const n=Number((b.input[0].content[0].text||'').match(/Write (\d)/)?.[1]||3);const out=b.tools?[{type:'image_generation_call',result:png}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({captions:Array.from({length:n},(_,i)=>'Légende '+(i+1))})}]}];records.set(id,{id,status:'completed',output:out,metadata:b.metadata,usage:{input_tokens:1,output_tokens:1}});return new Response(JSON.stringify({id,status:'queued'}))}return new Response(JSON.stringify(records.get(url.split('/').pop())))};
const h=harness(apiFetch),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
const product=(await alice('state')).data.products[0];assert.equal((await alice('upload',photoForm(a.id,product.id))).status,200);
const quotaBefore=h.sqlite.prepare('SELECT quota_used FROM clients WHERE id=?').get(a.id).quota_used;
const month=deliveryTargetMonth();
// Seule l'agence peut préparer et valider.
assert.equal((await alice('delivery-prepare',{client_id:a.id})).status,403);
const prep=await call('delivery-prepare',{client_id:a.id,month});assert.equal(prep.status,200,JSON.stringify(prep.data));assert.equal(prep.data.jobs.length,2);
assert.equal(h.sqlite.prepare('SELECT quota_used FROM clients WHERE id=?').get(a.id).quota_used,quotaBefore,'delivery content is agency-funded');
await call('poll',{job_ids:prep.data.jobs});
let agencyView=(await call('state?client='+a.id)).data;const delivery=agencyView.deliveries.find(d=>d.month===month);
assert.ok(delivery);assert.equal(delivery.candidates.length,6);assert.ok(delivery.candidates.every(c=>c.caption.startsWith('Légende')));
// Avant envoi, le client ne voit rien de la livraison.
let clientView=(await alice('state')).data;
assert.equal(clientView.deliveries.length,0);assert.ok(!clientView.jobs.some(j=>prep.data.jobs.includes(j.id)),'prepared jobs are hidden');
for(const c of delivery.candidates)assert.equal((await call('delivery-approve',{client_id:a.id,month,task_id:c.task_id})).status,200);
// Bob ne peut pas glisser une image d'Alice dans sa livraison, ni l'agence dépasser 6.
assert.notEqual((await bob('delivery-approve',{client_id:b.id,month,task_id:delivery.candidates[0].task_id})).status,200);
const v=await call('delivery-validate',{client_id:a.id,month});assert.equal(v.status,200,JSON.stringify(v.data));assert.equal(v.data.status,'validated');
clientView=(await alice('state')).data;assert.equal(clientView.deliveries.length,0,'not visible before the 3rd');
// Le 3 à 9 h (Monterrey), la tâche quotidienne envoie la livraison.
const summary=await runDailyStudio(h.env,new Date(month+'-03T15:10:00Z'));assert.equal(summary.sent,1);
assert.equal((await runDailyStudio(h.env,new Date(month+'-03T15:10:00Z'))).sent,0,'sent only once');
clientView=(await alice('state')).data;const sent=clientView.deliveries[0];
assert.equal(sent.status,'sent');assert.equal(sent.items.length,6);assert.equal(sent.candidates,undefined,'client never sees agency candidates');
assert.ok(clientView.jobs.some(j=>prep.data.jobs.includes(j.id)),'jobs visible after sending');
assert.equal((await alice('file/'+sent.items[0].file_id)).status,200);
assert.equal((await bob('file/'+sent.items[0].file_id)).status,403);
assert.equal((await bob('state')).data.deliveries.length,0);
console.log('monthly-delivery OK');
