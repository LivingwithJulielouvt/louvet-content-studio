import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {FEATURE_DEFAULTS,sanitizeFeatures,featureForAction} from '../lib/features.mjs';

// ---- Réglages purs ----
assert.deepEqual(FEATURE_DEFAULTS,{opportunities:false,testVersions:false,brandCollabs:true,reels:true,recreate:true,siteImport:true});
assert.deepEqual(sanitizeFeatures({opportunities:true,evil:true,reels:'yes'}),{...FEATURE_DEFAULTS,opportunities:true},'unknown keys and non-booleans ignored');
assert.equal(featureForAction('test-batch-create'),'testVersions');
assert.equal(featureForAction('upload-intent',{kind:'test-version'}),'testVersions');
assert.equal(featureForAction('upload-intent',{kind:'product'}),null);
assert.equal(featureForAction('recreate-analyze'),'recreate');assert.equal(featureForAction('recreate'),'recreate');
assert.equal(featureForAction('site-import'),'siteImport');assert.equal(featureForAction('site-import-apply'),'siteImport');
assert.equal(featureForAction('reel-claim'),'reels');assert.equal(featureForAction('collab-profile-save'),'brandCollabs');
assert.equal(featureForAction('opportunity-save'),null,'agency catalogue actions are not client features');

// ---- Serveur ----
const h=harness(async()=>{throw new Error('no network')});
let clock=Date.parse('2026-11-01T12:00:00Z');h.env.FEATURES_NOW=()=>clock;
await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email,type] of [[a,'alice@test.local','creator'],[b,'bob@test.local','brand']]){const row=(await h.call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}});const cfg=JSON.parse(h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(c.id).config);h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...cfg,workspaceType:type}),c.id)}
await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>h.call(x,y,'alice','alice@test.local'),bob=(x,y)=>h.call(x,y,'bob','bob@test.local');
const soon=r=>r.status===403&&/arrive bientôt/.test(r.data.error||'');

// Compte à rebours par défaut : date fixée à la première lecture (+20 jours), puis stable (ne glisse pas).
let f=(await h.call('state')).data.features;
assert.equal(f.opportunitiesMode,'countdown');assert.equal(f.opportunities,false);
assert.equal(f.opportunitiesOpenAt,new Date(clock+20*86400000).toISOString());
const openAt=f.opportunitiesOpenAt;clock+=3*86400000;
assert.equal((await alice('state?client='+a.id)).data.features.opportunitiesOpenAt,openAt,'lazy date persisted, never slides');
assert.equal(f.testVersions,false);assert.equal(f.brandCollabs,true);assert.equal(f.reels,true);assert.equal(f.recreate,true);assert.equal(f.siteImport,true);

// Pendant le compte à rebours : aucune donnée de marque, actions refusées aimablement.
const oid=(await h.call('opportunity-save',{brand:'Marque Exemple',niche:'Mode',instagram:'@marque.exemple',email:'contact@example.com',site:'example.com',country:'FR',languages:['fr'],note:'note'})).data.id||(await h.call('state')).data.opportunities?.[0]?.id;
let st=(await alice('state?client='+a.id)).data;
assert.equal(st.opportunities,undefined,'no brand list during countdown');assert.ok(!JSON.stringify(st).includes('contact@example.com'));assert.ok(!JSON.stringify(st).includes('Marque Exemple'));
assert.ok(soon(await alice('opportunity-status',{id:oid,status:'contacted'})));
assert.ok(soon(await alice('opportunity-contact',{id:'o1'})));
// « Me prévenir à l'ouverture ».
let n=await alice('opportunities-notify',{enabled:true});assert.equal(n.status,200);assert.equal(n.data.notify,'pending');
assert.equal((await alice('state?client='+a.id)).data.opportunitiesNotify,'pending');
assert.equal((await h.call('opportunities-notify',{enabled:true})).status,403,'agency cannot opt in');
// Marque : même date (pour l'encart « Bientôt »), rien d'autre.
assert.equal((await bob('state?client='+b.id)).data.features.opportunitiesOpenAt,openAt);
const {runDailyStudio}=await import('../lib/studio.mjs');
assert.equal((await runDailyStudio(h.env)).opportunities_announced,0,'nothing announced before opening');

// À la date : ouverture automatique (côté serveur), notification une seule fois.
clock=Date.parse(openAt)+60000;
f=(await alice('state?client='+a.id)).data.features;assert.equal(f.opportunities,true);assert.equal(f.opportunitiesMode,'countdown');
assert.ok(!soon(await alice('opportunity-status',{id:oid,status:'contacted'})),'opens by itself at the date');
assert.equal((await runDailyStudio(h.env)).opportunities_announced,1);
assert.equal((await runDailyStudio(h.env)).opportunities_announced,0,'notified once');
const notes=h.sqlite.prepare("SELECT message FROM notifications WHERE client_id=?").all(a.id).map(x=>x.message);
assert.equal(notes.filter(m=>/sélection de marques à contacter est ouverte/.test(m)).length,1);
assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE client_id=? AND message LIKE '%marques à contacter%'").get(b.id).n,0,'brands are not notified');

// Masqué / Ouvert / nouvelle date.
let r=await h.call('features-save',{features:{opportunitiesMode:'hidden'}});assert.equal(r.status,200);assert.equal(r.data.features.opportunities,false);
assert.ok(soon(await alice('opportunity-status',{id:oid,status:'contacted'})),'hidden: refused');
r=await h.call('features-save',{features:{opportunitiesMode:'countdown',opportunitiesOpenAt:new Date(clock+5*86400000).toISOString()}});
assert.equal(r.data.features.opportunities,false);assert.equal(r.data.features.opportunitiesOpenAt,new Date(clock+5*86400000).toISOString());
assert.equal((await h.call('features-save',{features:{opportunitiesOpenAt:'demain'}})).status,400);
r=await h.call('features-save',{features:{opportunitiesMode:'open'}});assert.equal(r.data.features.opportunities,true);
assert.equal((await alice('features-save',{features:{opportunitiesMode:'open'}})).status,403);

// Autres fonctions : refusées aux clientes quand elles sont éteintes, jamais à l'agence.
assert.ok(soon(await alice('test-batch-create',{client_id:a.id})),'test versions off by default');
assert.ok(soon(await alice('upload-intent',{client_id:a.id,kind:'test-version'})));
assert.ok(!soon(await h.call('test-batch-create',{client_id:a.id})),'agency is never blocked');
assert.ok(!soon(await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/ABCdef123/'})));
r=await h.call('features-save',{features:{testVersions:true,reels:false,evil:true}});
assert.equal(r.status,200);assert.equal(r.data.features.testVersions,true);assert.equal(r.data.features.reels,false);assert.equal('evil' in r.data.features,false);
assert.ok(!soon(await alice('test-batch-create',{client_id:a.id})),'switched on: no longer "coming soon"');
assert.ok(soon(await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/XYZdef123/'})),'switched off: refused');
console.log('features OK — fonctions visibles réglées par l’agence, Opportunités en compte à rebours (date fixe, ouverture automatique, prévenir une fois), agence jamais bloquée');
