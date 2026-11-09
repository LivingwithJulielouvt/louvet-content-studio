// Cloisonnement : une cliente ne doit JAMAIS lire ni modifier l'espace d'une autre.
// Chaque action de l'API est rejouée par Alice avec les identifiants de l'espace de Bob.
import assert from 'node:assert/strict';
import {readyHarness as harness,photoForm} from './harness.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})).status,200)}
assert.equal((await call('join',{code:a.code},'alice','alice@test.local')).status,200);
assert.equal((await call('join',{code:b.code},'bob','bob@test.local')).status,200);
const bob=(p,body)=>call(p,body,'bob','bob@test.local'),alice=(p,body)=>call(p,body,'alice','alice@test.local');
const bobState=(await bob('state')).data;const bp=bobState.products[0];
const up=await bob('upload',photoForm(b.id,bp.id));assert.equal(up.status,200);
const bobFile=up.data.id;
// Messages de Bob avec l'agence (texte + photo jointe) : rien ne doit en sortir.
assert.equal((await bob('chat-send',{client_id:b.id,body:'bob-secret-chat'})).status,200);
const ci=await bob('chat-photo-intent',{client_id:b.id,filename:'c.png',mime:'image/png',size:2000});assert.equal(ci.status,200);{const u=new Uint8Array(2000);u.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const v=new DataView(u.buffer);v.setUint32(16,600);v.setUint32(20,600);h.objects.set(ci.data.path,u)}
const bobChatFile=(await bob('chat-photo-commit',{intent_id:ci.data.id})).data.id;assert.ok(bobChatFile);
assert.equal((await bob('chat-send',{client_id:b.id,file_id:bobChatFile})).status,200);
// Note de calendrier de Bob : elle ne doit jamais sortir de son espace.
const bobEntry=await bob('calendar-entry-save',{client_id:b.id,kind:'note',date:new Date().toISOString().slice(0,10),title:'bob-secret-note'});assert.equal(bobEntry.status,200,JSON.stringify(bobEntry.data));
// Reel et offre de collaboration de Bob : privés.
const bobReel=await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/BobSecretReel1/'});assert.equal(bobReel.status,200,JSON.stringify(bobReel.data));
assert.equal((await bob('collab-profile-save',{client_id:b.id,enabled:false,offer:'bob-secret-offer'})).status,200);
// Tout ce qui identifie Bob : si une réponse à Alice contient l'un de ces textes, c'est une fuite.
const secrets=[bobReel.data.id,'BobSecretReel1','bob-secret-offer',bobEntry.data.id,b.id,b.name,b.code,bp.id,bobFile,bobChatFile,'bob-secret-chat','bob@test.local'].filter(Boolean);
const actions=['place-save','place-delete','place-photo-remove','approve','assign-style','billing-checkout','billing-link','billing-portal','billing-settings','billing-sync','client-intake','client-lifecycle','clients','connection-check','correction','creator-strategy','email-retry','feedback','generate','idea-update','ideas','intake-review','intake-save','intake-test','intake-test-clear','intake-test-save','mail-fact','mail-preference','mail-retry','mail-weekly','monthly-maintenance','occasion','poll','process-correction','products','public-requests','publication-confirm','publication-delete','publication-save','quality-profile','recipes','refresh-ideas','retry','rotate-code','save-rule','seed','seed-styles','settings','toggle-rule','upload-intent','user-access','video-output','video-render-fail','video-render-heartbeat','video-render-start','video-request','video-status','video-style','video-brand-save','video-edit-add-clip','video-editor-access','video-style-save-own','booking-request','booking-link','booking-done','design-delete','template-text','template-settings','template-favorite','chat-list','chat-send','chat-read','chat-photo-intent','chat-photo-commit','calendar-entry-save','calendar-entry-done','calendar-entry-delete','opportunity-save','opportunity-active','opportunity-delete','opportunity-import','opportunity-status','collab-profile-save','collab-request','collab-respond','collab-hide','collab-offer-review','reel-claim','reel-review','test-batch-create','test-batch-stop','test-version-metrics','test-version-winner','test-batch-delete','recreate-upload-intent','recreate-upload-commit','recreate-analyze','recreate-delete','site-import','site-import-apply','site-import-agency-apply'];
const attack={batch_id:bobFile,version_id:bobFile,source:{file_id:bobFile},count:3,axes:['subs'],ref_id:bobFile,date:new Date().toISOString().slice(0,10),done:true,client_id:b.id,product_id:bp.id,id:bp.id,file_id:bobFile,user_id:'bob',mode:'delete',confirm_name:b.name,name:'piratage',kind:'photo',filename:'x.png',mime:'image/png',size:2000};
const leaks=[];
for(const action of actions){
 for(const req of [()=>call(action+'?client='+b.id,null,'alice','alice@test.local'),()=>alice(action,attack)]){
  const r=await req();const body=JSON.stringify(r.data||'');
  if(r.status<300&&secrets.some(s=>body.includes(s)))leaks.push(action+' → '+r.status);
 }
}
for(const path of ['file/'+bobFile,'file/'+bobChatFile,'state?client='+b.id,'client-intake?client='+b.id]){const r=await call(path,null,'alice','alice@test.local');if(r.status<300)leaks.push(path+' → '+r.status)}
assert.deepEqual(leaks,[],'Fuites détectées : '+leaks.join(', '));
// L'espace de Bob est intact après toutes les tentatives d'Alice.
const after=(await bob('state')).data;
assert.equal(after.clients.length,1);assert.equal(after.clients[0].name,b.name);assert.equal(after.products.length,bobState.products.length);
assert.equal((await bob('file/'+bobFile)).status,200);
const bobChat=(await bob('chat-list',{client_id:b.id})).data;assert.equal(bobChat.messages.length,2,'Alice could not post in Bob’s thread');assert.equal(bobChat.messages.some(m=>m.read),false,'Alice could not mark Bob’s thread read');
assert.equal((await bob('state')).data.calendarEntries.length,1,'Alice could not delete Bob’s calendar note');
assert.equal((await bob('state')).data.reelCollab.claims[0].status,'pending','Alice could not review Bob’s Reel');
// Alice ne voit que son propre espace.
const aliceState=(await alice('state')).data;assert.equal(aliceState.clients.length,1);assert.equal(aliceState.clients[0].id,a.id);
console.log('isolation OK —',actions.length,'actions testées, aucune fuite');
