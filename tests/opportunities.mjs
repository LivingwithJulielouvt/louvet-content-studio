// Opportunités : carnet de marques écrit par l'agence, lu par les créatrices, suivi privé par espace.
// Données 100 % fictives (example.com).
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {normalizeHandle,normalizeEmail,normalizeSite,nicheKey,countryKey,csvRows,validateOpportunity} from '../lib/opportunities.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

// ---- Normalisation ----
assert.equal(normalizeHandle('@Marque.Exemple'),'marque.exemple');
assert.equal(normalizeHandle('https://www.instagram.com/marque_exemple/?hl=fr'),'marque_exemple');
assert.equal(normalizeHandle('marque exemple'),null);assert.equal(normalizeHandle(''),'');
assert.equal(normalizeEmail(' Contact@Example.com '),'contact@example.com');assert.equal(normalizeEmail('pas-un-mail'),null);
assert.equal(normalizeSite('example.com'),'https://example.com/');assert.equal(normalizeSite('http://example.com'),null);assert.equal(normalizeSite('https://example.com/boutique'),'https://example.com/boutique');
assert.equal(nicheKey('Beauté & soin'),'beauty');assert.equal(nicheKey('belleza'),'beauty');assert.equal(nicheKey('Food & drinks'),'food');assert.equal(nicheKey('Mamá y familia'),'family');assert.equal(nicheKey('astrologie'),null);
assert.equal(countryKey('México'),'MX');assert.equal(countryKey(''),'INTL');assert.equal(countryKey('USA'),'US');assert.equal(countryKey('Mars'),null);
assert.ok(validateOpportunity({brand:'Marque Exemple',niche:'mode'}).error,'needs instagram or email');
assert.ok(validateOpportunity({brand:'Marque Exemple',niche:'mode',email:'a@example.com',note:'x'.repeat(241)}).error);
assert.ok(tenantTables.includes('opportunity_status')&&!tenantTables.includes('opportunities'),'only private tracking is purged with a space');

// ---- CSV (séparateur ; et guillemets) ----
const csv='niche;marque;instagram;email;site;pays;langues;note\n'+
 'Beauté & soin;Marque Exemple Un;@exemple.un;contact@example.com;example.com;FR;fr,en;"Lance une gamme ; cherche des créatrices"\n'+
 'Mode;Marque Exemple Deux;exemple.deux;;https://example.org;MX;es;\n'+
 'Astrologie;Mauvaise Niche;;x@example.com;;FR;;\n'+
 'Voyage;Sans Contact;;;;US;;\n'+
 'Tech;Site HTTP;exemple.tech;;http://example.net;US;en;\n';
const parsed=csvRows(csv);assert.equal(parsed.header,true);assert.equal(parsed.rows.length,5);
assert.equal(parsed.rows[0].value.note,'Lance une gamme ; cherche des créatrices');assert.deepEqual(parsed.rows[0].value.languages,['fr','en']);
assert.equal(parsed.rows.filter(r=>r.error).length,3);assert.equal(parsed.rows[2].line,4);

const h=harness(async()=>{throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
// Ces fonctions sont éteintes par défaut pour les clientes (Agence › Fonctions visibles) : on les allume pour ce test.
await call('features-save',{features:{opportunities:true,testVersions:true,brandCollabs:true,reels:true}});
const setType=(c,type)=>{const row=h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(c.id);h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.config||'{}'),workspaceType:type}),c.id)};
const setup=async(c,email,type)=>{const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);const r=await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}});assert.equal(r.status,200,JSON.stringify(r.data));setType(c,type)};
await setup(a,'alice@test.local','creator');await setup(b,'bob@test.local','creator');
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local'),agency=(x,y)=>call(x,y);

// ---- Agence : ajout, validation, doublon, modification ----
let r=await agency('opportunity-save',{brand:'Marque Exemple',niche:'Mode',instagram:'@Marque.Exemple',email:'Hello@Example.com',site:'example.com',country:'FR',languages:['fr','es'],note:'Collabore souvent avec des créatrices lifestyle.',tags:'slow fashion, lin'});
assert.equal(r.status,200,JSON.stringify(r.data));const o1=r.data.id;
assert.equal((await agency('opportunity-save',{brand:'Marque Exemple bis',niche:'mode',instagram:'marque.exemple'})).status,409,'duplicate handle');
assert.equal((await agency('opportunity-save',{brand:'X',niche:'mode',email:'pas-un-mail'})).status,400);
assert.equal((await agency('opportunity-save',{brand:'X',niche:'mode',instagram:'x.ex',site:'http://example.com'})).status,400);
r=await agency('opportunity-save',{brand:'Autre Exemple',niche:'food',email:'presse@example.org',country:'MX'});assert.equal(r.status,200);const o2=r.data.id;
assert.equal((await agency('opportunity-save',{id:o2,brand:'Autre Exemple',niche:'food',email:'presse@example.org',country:'US'})).status,200);
let s=(await agency('state')).data;assert.equal(s.opportunities.length,2);
const saved=s.opportunities.find(o=>o.id===o1);assert.equal(saved.instagram,'marque.exemple');assert.equal(saved.email,'hello@example.com');assert.equal(saved.site,'https://example.com/');assert.deepEqual(saved.tags,['slow fashion','lin']);
assert.equal(s.opportunities.find(o=>o.id===o2).country,'US');

// ---- Import CSV : aperçu puis enregistrement ----
r=await agency('opportunity-import',{csv});assert.equal(r.status,200,JSON.stringify(r.data));
assert.deepEqual(r.data.summary,{add:2,update:0,errors:3});assert.ok(r.data.preview.find(p=>p.line===4).error);
assert.equal((await agency('state')).data.opportunities.length,2,'preview writes nothing');
r=await agency('opportunity-import',{csv,commit:true});assert.equal(r.status,200);assert.equal(r.data.added,2);assert.equal(r.data.errors,3);
r=await agency('opportunity-import',{csv:'niche,marque,instagram,email\nmode,Marque Exemple,marque.exemple,nouveau@example.com\n',commit:true});assert.equal(r.data.updated,1,'existing handle is updated, not duplicated');
s=(await agency('state')).data;assert.equal(s.opportunities.length,4);assert.equal(s.opportunities.find(o=>o.id===o1).email,'nouveau@example.com');
assert.equal((await agency('opportunity-import',{csv:''})).status,400);
assert.equal((await agency('opportunity-import',{csv:'niche,marque,instagram\n'+Array.from({length:501},(_,i)=>`mode,M${i},m${i}`).join('\n')})).status,413);

// ---- Désactiver : la fiche disparaît pour les créatrices ----
assert.equal((await agency('opportunity-active',{id:o2,active:false})).status,200);

// ---- Créatrices : lecture, suivi privé ----
s=(await alice('state')).data;assert.equal(s.opportunities.length,3,'inactive hidden');assert.ok(s.opportunities.every(o=>o.active));
assert.equal((await alice('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'contacted',note:'Écrit le 2 novembre'})).status,200);
assert.equal((await alice('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'replied',note:'Réponse reçue'})).status,200,'update in place');
assert.equal((await alice('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'maybe'})).status,400);
assert.equal((await alice('opportunity-status',{client_id:a.id,opportunity_id:o2,status:'contacted'})).status,404,'inactive cannot be tracked');
assert.equal((await alice('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'todo',note:'x'.repeat(301)})).status,400);
s=(await alice('state')).data;assert.equal(s.opportunityStatus.length,1);assert.equal(s.opportunityStatus[0].status,'replied');assert.equal(s.opportunityStatus[0].note,'Réponse reçue');
assert.equal((await bob('state')).data.opportunityStatus.length,0,'status is private');
assert.equal((await bob('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'declined'})).status,403,'never write another space status');
assert.equal((await alice('state')).data.opportunityStatus[0].status,'replied');

// ---- Écritures du catalogue réservées à l'agence ----
for(const [act,body] of [['opportunity-save',{brand:'Pirate',niche:'mode',email:'p@example.com'}],['opportunity-active',{id:o1,active:false}],['opportunity-delete',{id:o1}],['opportunity-import',{csv,commit:true}]])assert.equal((await alice(act,body)).status,403,act);
assert.equal((await agency('opportunity-status',{client_id:a.id,opportunity_id:o1,status:'todo'})).status,403,'agency does not track for the creator');

// ---- Une marque (non créatrice) ne voit rien ----
setType(b,'brand');
s=(await bob('state')).data;assert.equal(s.opportunities.length,0);
assert.equal((await bob('opportunity-status',{client_id:b.id,opportunity_id:o1,status:'todo'})).status,403);

// ---- Suppression d'une fiche : le suivi part avec ----
r=await agency('opportunity-save',{brand:'À supprimer',niche:'tech',instagram:'a.supprimer'});const o3=r.data.id;
await alice('opportunity-status',{client_id:a.id,opportunity_id:o3,status:'todo'});
assert.equal((await agency('opportunity-delete',{id:o3})).status,200);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM opportunity_status WHERE opportunity_id=?').get(o3).n,0);

// ---- Purge d'un espace : son suivi disparaît, le catalogue reste ----
const before=h.sqlite.prepare('SELECT COUNT(*) AS n FROM opportunities').get().n;
r=await agency('client-lifecycle',{client_id:a.id,mode:'delete',confirm_name:a.name});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM opportunity_status WHERE client_id=?').get(a.id).n,0);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM opportunities').get().n,before);

console.log('opportunities OK — catalogue agence (ajout, doublons, import CSV avec erreurs), lecture créatrices filtrée, suivi privé, marques exclues, purge');
