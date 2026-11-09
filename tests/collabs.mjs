// Collaborations : une marque cliente accepte (ou non) d'être contactée par les créatrices du studio ;
// les créatrices proposent, la marque répond, son contact n'apparaît qu'après « Intéressée ». Données fictives.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {validateCollabProfile,normalizeCollabLink} from '../lib/collabs.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

assert.equal(normalizeCollabLink('@Ma.Marque'),'@ma.marque');assert.equal(normalizeCollabLink('instagram.com/ma.marque/'),'@ma.marque');
assert.equal(normalizeCollabLink('example.com'),'https://example.com/');assert.equal(normalizeCollabLink('http://example.com'),null);
assert.ok(validateCollabProfile({enabled:true}).error,'enabled needs an offer');
assert.ok(validateCollabProfile({enabled:true,offer_types:['product'],offer:'x'.repeat(281),niche:'food',countries:['FR']}).error);
assert.ok(!validateCollabProfile({enabled:false}).error,'disabling needs nothing');
assert.deepEqual(validateCollabProfile({enabled:true,offer_types:['product','hack'],offer:'Coffret offert.',niche:'Food & boissons',countries:['FR','XX']}).value.offer_types,['product']);
assert.ok(['brand_collab_profiles','collab_requests'].every(t=>tenantTables.includes(t)));

const h=harness(async()=>{throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
// Ces fonctions sont éteintes par défaut pour les clientes (Agence › Fonctions visibles) : on les allume pour ce test.
await call('features-save',{features:{opportunities:true,testVersions:true,brandCollabs:true,reels:true}});
const setCfg=(id,extra)=>{const row=h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(id);h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.config||'{}'),...extra}),id)};
const setup=async(c,email)=>{const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);const r=await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}});assert.equal(r.status,200,JSON.stringify(r.data))};
await setup(a,'brand@test.local');await setup(b,'brand2@test.local');
const mk=async(name,email,type)=>{const c=(await call('clients',{name,config:{allowedEmails:[email]}})).data;setCfg(c.id,{workspaceType:type});return c};
const lea=await mk('Léa Exemple','lea@test.local','creator'),zoe=await mk('Zoé Exemple','zoe@test.local','creator');
setCfg(a.id,{workspaceType:'brand',brand:'Maison Exemple'});setCfg(b.id,{workspaceType:'brand'});
setCfg(lea.id,{creatorStrategy:{displayName:'Léa en cuisine',pillars:['Recettes rapides']}});
for(const [c,u,e] of [[a,'brand','brand@test.local'],[b,'brand2','brand2@test.local'],[lea,'lea','lea@test.local'],[zoe,'zoe','zoe@test.local']])assert.equal((await call('join',{code:c.code},u,e)).status,200);
const brand=(x,y)=>call(x,y,'brand','brand@test.local'),brand2=(x,y)=>call(x,y,'brand2','brand2@test.local'),leaC=(x,y)=>call(x,y,'lea','lea@test.local'),zoeC=(x,y)=>call(x,y,'zoe','zoe@test.local'),agency=(x,y)=>call(x,y);

// ---- Par défaut : la marque n'est pas visible ----
let s=(await brand('state')).data;assert.equal(s.collabProfile.enabled,false);assert.equal(s.collabProfile.consent_at,null);
assert.equal((await leaC('state')).data.collabBrands.length,0);
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Bonjour',instagram:'lea'})).status,404,'cannot propose to a brand that did not opt in');

// ---- Activation (consentement daté) ----
let r=await brand('collab-profile-save',{client_id:a.id,enabled:true});assert.equal(r.status,400,'offer required to enable');
r=await brand('collab-profile-save',{client_id:a.id,enabled:true,offer_types:['product','affiliate'],offer:'Un coffret offert et un code de 15 %.',niche:'food',countries:['FR','MX'],looking_for:'Des Reels recettes.',link:'@maison.exemple'});
assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(r.data.profile.consent_at);const consent=r.data.profile.consent_at;
assert.equal((await leaC('collab-profile-save',{client_id:lea.id,enabled:false})).status,403,'creators have no brand profile');
assert.equal((await brand('collab-profile-save',{client_id:b.id,enabled:false})).status,403,'never another space');
// ---- Relecture par l'agence : une nouvelle offre reste invisible tant qu'elle n'est pas validée ----
assert.equal(r.data.profile.review_status,'pending');assert.equal(r.data.profile.has_approved,false);
assert.equal((await leaC('state')).data.collabBrands.length,0,'pending offer invisible to creators');
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Bonjour',instagram:'lea'})).status,404,'no proposal before approval');
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id='__agency__' AND message LIKE 'Nouvelle offre de collaboration à valider : Maison Exemple'").get().n,1,'agency notified');
s=(await agency('state?client='+a.id)).data;assert.equal(s.collabPendingOffers.length,1);assert.equal(s.collabPendingOffers[0].brand_name,'Maison Exemple');assert.equal(s.collabPendingOffers[0].approved,null);
assert.ok(s.notifications.some(n=>n.message.startsWith('Nouvelle offre de collaboration')),'agency bell shows it');
assert.ok(!(await brand('state')).data.notifications.some(n=>n.message.startsWith('Nouvelle offre')),'agency notices never reach clients');
// Réenregistrer la même version en attente ne renotifie pas.
await brand('collab-profile-save',{client_id:a.id,enabled:true,offer_types:['affiliate','product'],offer:'Un coffret offert et un code de 15 %.',niche:'food',countries:['MX','FR'],looking_for:'Des Reels recettes.',link:'@maison.exemple'});
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id='__agency__'").get().n,1,'no duplicate notice');
assert.equal((await brand('collab-offer-review',{client_id:a.id,decision:'approve'})).status,403,'brand cannot approve');
assert.equal((await leaC('collab-offer-review',{client_id:a.id,decision:'approve'})).status,403,'creator cannot approve');
assert.equal((await agency('collab-offer-review',{client_id:a.id,decision:'maybe'})).status,400);
assert.equal((await agency('collab-offer-review',{client_id:'nope',decision:'approve'})).status,404);
r=await agency('collab-offer-review',{client_id:a.id,decision:'approve'});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await agency('collab-offer-review',{client_id:a.id,decision:'approve'})).status,409,'review once');
s=(await brand('state')).data;assert.equal(s.collabProfile.review_status,'approved');assert.ok(s.collabProfile.has_approved);
assert.ok(s.notifications.some(n=>n.message.startsWith('Votre offre de collaboration est validée')),'brand notified of approval');
assert.equal((await agency('state')).data.collabPendingOffers.length,0);
s=(await leaC('state')).data;assert.equal(s.collabBrands.length,1);
const card=s.collabBrands[0];assert.equal(card.name,'Maison Exemple');assert.equal(card.offer,'Un coffret offert et un code de 15 %.');assert.equal(card.link,'@maison.exemple');
assert.ok(!JSON.stringify(s.collabBrands).includes('brand@test.local'),'brand email never exposed');assert.equal(card.consent_at,undefined);
assert.equal((await brand2('state')).data.collabBrands,undefined,'brands do not see other brands');

// ---- Proposition d'une créatrice ----
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'',instagram:'lea'})).status,400);
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Idée',instagram:''})).status,400,'instagram required');
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'x'.repeat(601),instagram:'lea'})).status,400);
r=await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Un Reel recette avec votre coffret ?',instagram:'@lea.exemple',portfolio:'example.com/lea'});assert.equal(r.status,200,JSON.stringify(r.data));const req=r.data.id;
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Encore',instagram:'lea'})).status,409,'one open request per pair');
assert.equal((await zoeC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Pirate',instagram:'zoe'})).status,403,'never in another creator space');
assert.equal((await brand2('collab-request',{client_id:b.id,brand_client_id:a.id,message:'x',instagram:'b'})).status,403,'brands cannot propose');
assert.ok(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id=? AND message LIKE 'Une créatrice vous propose%'").get(a.id).n===1,'brand notified');

// ---- La marque voit la proposition, la créatrice ne voit pas encore de contact ----
s=(await brand('state')).data;assert.equal(s.collabReceived.length,1);assert.equal(s.collabReceived[0].creator_name,'Léa en cuisine');assert.equal(s.collabReceived[0].creator_topic,'Recettes rapides');assert.equal(s.collabReceived[0].instagram,'lea.exemple');
assert.equal((await brand2('state')).data.collabReceived.length,0,'other brand sees nothing');
s=(await leaC('state')).data;assert.equal(s.collabSent[0].status,'open');assert.equal(s.collabSent[0].contact_email,'');
assert.equal((await zoeC('state')).data.collabSent.length,0,'other creator sees nothing');

// ---- Réponse ----
assert.equal((await brand2('collab-respond',{client_id:b.id,id:req,decision:'accept',contact_email:'x@example.com'})).status,404,'only the addressed brand answers');
assert.equal((await brand('collab-respond',{client_id:a.id,id:req,decision:'accept'})).status,400,'email required to accept');
assert.equal((await brand('collab-respond',{client_id:a.id,id:req,decision:'maybe'})).status,400);
r=await brand('collab-respond',{client_id:a.id,id:req,decision:'accept',contact_email:'Partenariats@Example.com',reply:'Avec plaisir !'});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await brand('collab-respond',{client_id:a.id,id:req,decision:'decline'})).status,409,'answer once');
s=(await leaC('state')).data;assert.equal(s.collabSent[0].status,'accepted');assert.equal(s.collabSent[0].contact_email,'partenariats@example.com');assert.equal(s.collabSent[0].reply,'Avec plaisir !');
assert.ok(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id=? AND message LIKE 'Une marque est intéressée%'").get(lea.id).n===1,'creator notified');
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:a.id,message:'Encore',instagram:'lea'})).status,409,'already accepted');

// ---- Refus puis délai de 30 jours ----
r=await zoeC('collab-request',{client_id:zoe.id,brand_client_id:a.id,message:'Des stories ?',instagram:'zoe.exemple'});assert.equal(r.status,200);
assert.equal((await brand('collab-respond',{client_id:a.id,id:r.data.id,decision:'decline',reply:'Pas cette saison.'})).status,200);
s=(await zoeC('state')).data;assert.equal(s.collabSent[0].status,'declined');assert.equal(s.collabSent[0].contact_email,'');assert.equal(s.collabSent[0].reply,'Pas cette saison.');
assert.equal((await zoeC('collab-request',{client_id:zoe.id,brand_client_id:a.id,message:'Encore ?',instagram:'zoe'})).status,409,'wait 30 days');
h.sqlite.prepare('UPDATE collab_requests SET updated=? WHERE id=?').run(new Date(Date.now()-31*86400000).toISOString(),r.data.id);
r=await zoeC('collab-request',{client_id:zoe.id,brand_client_id:a.id,message:'Nouvelle idée',instagram:'zoe'});assert.equal(r.status,200,'allowed after 30 days');

// ---- Agence : vue d'ensemble, masquer une proposition ----
s=(await agency('state')).data;assert.equal(s.collabOverview.length,3);assert.equal(s.collabOpenBrands,1);
assert.equal((await leaC('collab-hide',{id:r.data.id,hidden:true})).status,403);
assert.equal((await agency('collab-hide',{id:r.data.id,hidden:true})).status,200);
assert.equal((await brand('state')).data.collabReceived.length,2,'hidden request no longer shown to the brand');
assert.equal((await brand('collab-respond',{client_id:a.id,id:r.data.id,decision:'accept',contact_email:'a@example.com'})).status,404);

// ---- Modification : l'ancienne version validée reste visible pendant la relecture ----
r=await brand('collab-profile-save',{client_id:a.id,enabled:true,offer_types:['paid'],offer:'Nouvelle offre rémunérée.',niche:'food',countries:['FR'],looking_for:'Des Reels recettes.',link:'@maison.exemple'});
assert.equal(r.data.profile.review_status,'pending');assert.ok(r.data.profile.has_approved);
s=(await leaC('state')).data;assert.equal(s.collabBrands[0].offer,'Un coffret offert et un code de 15 %.','old approved version still shown');assert.deepEqual(s.collabBrands[0].offer_types,['affiliate','product']);
let pend=(await agency('state')).data.collabPendingOffers;assert.equal(pend.length,1);assert.equal(pend[0].submitted.offer,'Nouvelle offre rémunérée.');assert.equal(pend[0].approved.offer,'Un coffret offert et un code de 15 %.','diff data for the agency');
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id='__agency__'").get().n,2,'edit notifies the agency');
// Refus avec motif : l'ancienne version reste en ligne, la marque voit le motif.
r=await agency('collab-offer-review',{client_id:a.id,decision:'refuse',reason:'Précisez la rémunération.'});assert.equal(r.status,200);
s=(await brand('state')).data;assert.equal(s.collabProfile.review_status,'refused');assert.equal(s.collabProfile.review_reason,'Précisez la rémunération.');
assert.ok(s.notifications.some(n=>n.message.startsWith('Votre offre de collaboration n’a pas été validée')));
assert.equal((await leaC('state')).data.collabBrands[0].offer,'Un coffret offert et un code de 15 %.');
// Revenir à la version validée : visible sans nouvelle relecture.
r=await brand('collab-profile-save',{client_id:a.id,enabled:true,offer_types:['product','affiliate'],offer:'Un coffret offert et un code de 15 %.',niche:'food',countries:['FR','MX'],looking_for:'Des Reels recettes.',link:'@maison.exemple'});
assert.equal(r.data.profile.review_status,'approved','unchanged approved offer needs no review');assert.equal((await agency('state')).data.collabPendingOffers.length,0);

// ---- Pause : la marque disparaît aussitôt ----
r=await brand('collab-profile-save',{client_id:a.id,enabled:false});assert.equal(r.status,200);assert.equal(r.data.profile.consent_at,consent,'consent date kept on pause');
assert.equal((await leaC('state')).data.collabBrands.length,0);assert.equal((await leaC('state')).data.collabSent[0].contact_email,'partenariats@example.com','accepted contact stays');
assert.equal((await zoeC('collab-request',{client_id:zoe.id,brand_client_id:a.id,message:'x',instagram:'zoe'})).status,404,'paused brand takes no proposals');
// Réactivation avec la version déjà validée : visible tout de suite.
r=await brand('collab-profile-save',{client_id:a.id,enabled:true,offer_types:['product','affiliate'],offer:'Un coffret offert et un code de 15 %.',niche:'food',countries:['FR','MX'],looking_for:'Des Reels recettes.',link:'@maison.exemple'});
assert.equal(r.data.profile.review_status,'approved');assert.equal((await leaC('state')).data.collabBrands.length,1,'re-enabled approved offer visible at once');
assert.notEqual((await brand('state')).data.collabProfile.consent_at,null);

// ---- Limite : 10 propositions par jour ----
const t=new Date().toISOString();
for(let i=0;i<10;i++)h.sqlite.prepare("INSERT INTO collab_requests(id,client_id,brand_client_id,user_id,message,status,created,updated) VALUES(?,?,?,?,?,?,?,?)").run('fake-'+i,lea.id,'other-'+i,'lea','x','declined',t,t);
// E-mail interne à l'agence (Brevo) : seulement si les envois sont activés ; un échec ne bloque jamais la marque.
const sent=[];Object.assign(h.env,{EMAIL_DELIVERY_ENABLED:'true',BREVO_API_KEY:'test',BREVO_SENDER_EMAIL:'studio@example.com',BREVO_FETCH:async(url,o)=>{sent.push({url,body:JSON.parse(o.body)});return new Response('{"messageId":"m1"}',{status:201})}});
await brand2('collab-profile-save',{client_id:b.id,enabled:true,offer_types:['product'],offer:'Produit offert.',niche:'beauty',countries:['FR']});
assert.equal(sent.length,1);assert.ok(sent[0].url.endsWith('/smtp/email'));assert.equal(sent[0].body.to[0].email,'agency@test.local');assert.ok(sent[0].body.subject.startsWith('Offre de collaboration à valider'));
h.env.BREVO_FETCH=async()=>{throw new Error('down')};await agency('collab-offer-review',{client_id:b.id,decision:'refuse'});
assert.equal((await brand2('collab-profile-save',{client_id:b.id,enabled:true,offer_types:['product'],offer:'Produit offert, livraison incluse.',niche:'beauty',countries:['FR']})).status,200,'email failure is silent');
h.env.EMAIL_DELIVERY_ENABLED='false';
assert.equal((await agency('collab-offer-review',{client_id:b.id,decision:'approve'})).status,200);
assert.equal((await leaC('collab-request',{client_id:lea.id,brand_client_id:b.id,message:'Bonjour',instagram:'lea'})).status,429);

// ---- Purge : les propositions disparaissent des deux côtés ----
r=await agency('client-lifecycle',{client_id:a.id,mode:'delete',confirm_name:a.name});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM collab_requests WHERE brand_client_id=?').get(a.id).n,0);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM brand_collab_profiles WHERE client_id=?').get(a.id).n,0);
assert.equal((await leaC('state')).data.collabSent.filter(x=>x.brand_client_id===a.id).length,0);
r=await agency('client-lifecycle',{client_id:lea.id,mode:'delete',confirm_name:lea.name});assert.equal(r.status,200);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM collab_requests WHERE client_id=?').get(lea.id).n,0);

console.log('collabs OK — consentement daté, relecture agence (en attente invisible, ancienne version visible, refus motivé, notification),  offre visible des seules créatrices sans e-mail, proposition unique, réponse, contact après « Intéressée », délai de 30 jours, masquage agence, pause, limite quotidienne, purge des deux côtés');
