// Calendrier : le client ajoute ses propres contenus (visuel, modèle, vidéo, note), sans toucher aux posts de l'agence.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {validEntryDate} from '../lib/calendar-entries.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

const day=(n=0)=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
assert.ok(validEntryDate(day()));assert.ok(!validEntryDate('2026-02-30'));assert.ok(!validEntryDate('2001-01-01'));assert.ok(!validEntryDate('demain'));assert.ok(!validEntryDate(day(900)));
assert.ok(tenantTables.includes('calendar_entries'),'purged with the client space');

const h=harness(async()=>{throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local'),agency=(x,y)=>call(x,y);
const file=(cid,purpose,mime)=>{const id=crypto.randomUUID();h.sqlite.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,cid,null,cid+'/'+id,purpose+'.bin',mime,1000,100,100,purpose,new Date().toISOString());return id};
const img=file(a.id,'generated','image/png'),design=file(a.id,'design','image/png'),vid=file(a.id,'video_result','video/mp4'),orig=file(a.id,'original','image/jpeg'),bobImg=file(b.id,'generated','image/png');
h.sqlite.prepare('INSERT INTO designs VALUES(?,?,?,?,?)').run(design,a.id,'text','quote',new Date().toISOString());
const edit=crypto.randomUUID();h.sqlite.prepare('INSERT INTO video_edits VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(edit,a.id,null,'alice','k1','{}','completed','[]',vid,new Date().toISOString(),new Date().toISOString());
const pending=crypto.randomUUID();h.sqlite.prepare('INSERT INTO video_edits VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(pending,a.id,null,'alice','k2','{}','requested','[]',null,new Date().toISOString(),new Date().toISOString());

// ---- Ajouts du client ----
let r=await alice('calendar-entry-save',{client_id:a.id,kind:'image',ref_id:img,date:day(2),title:'Ma bougie',caption:'Nouvelle bougie ✨'});assert.equal(r.status,200,JSON.stringify(r.data));const eImg=r.data.id;
r=await alice('calendar-entry-save',{client_id:a.id,kind:'design',ref_id:design,date:day(3)});assert.equal(r.status,200,JSON.stringify(r.data));
r=await alice('calendar-entry-save',{client_id:a.id,kind:'video',ref_id:edit,date:day(4)});assert.equal(r.status,200,'video by montage id');
r=await alice('calendar-entry-save',{client_id:a.id,kind:'video',ref_id:vid,date:day(5)});assert.equal(r.status,200,'video by file id');
r=await alice('calendar-entry-save',{client_id:a.id,kind:'note',date:day(1),title:'Story coulisses'});assert.equal(r.status,200);const eNote=r.data.id;
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'video',ref_id:pending,date:day(4)})).status,409,'video not ready');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'note',date:day(1),title:'  '})).status,400,'empty note');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'note',date:'2026-13-01',title:'x'})).status,400,'bad date');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'gif',date:day(),title:'x'})).status,400,'bad kind');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'image',ref_id:orig,date:day()})).status,400,'raw product photos are not visuals');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'image',ref_id:vid,date:day()})).status,400,'kind must match media');
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'image',date:day()})).status,400,'visual required');

let s=(await alice('state')).data;assert.equal(s.calendarEntries.length,5);
const ei=s.calendarEntries.find(e=>e.id===eImg);assert.equal(ei.media,'image');assert.equal(ei.caption,'Nouvelle bougie ✨');assert.equal(ei.done,false);
assert.equal(s.calendarEntries.filter(e=>e.media==='video').length,2);
assert.equal(s.rewards.total,0,'own entries never earn points');

// ---- Déplacer, cocher, supprimer ses ajouts ----
assert.equal((await alice('calendar-entry-save',{id:eImg,date:day(6),title:'Ma bougie',caption:'Texte revu'})).status,200);
assert.equal((await alice('calendar-entry-done',{id:eImg,done:true})).status,200);
assert.equal((await alice('calendar-entry-done',{id:eImg,done:'oui'})).status,400);
s=(await alice('state')).data;const moved=s.calendarEntries.find(e=>e.id===eImg);assert.equal(moved.date,day(6));assert.equal(moved.caption,'Texte revu');assert.equal(moved.done,true);
assert.equal((await alice('calendar-entry-delete',{id:eNote})).status,200);assert.equal((await alice('state')).data.calendarEntries.length,4);

// ---- Cloisonnement ----
assert.equal((await bob('calendar-entry-save',{client_id:a.id,kind:'note',date:day(),title:'intrus'})).status,403,'never write in another space');
assert.equal((await bob('calendar-entry-save',{id:eImg,date:day(),title:'pirate'})).status,403,'never move another space entry');
assert.equal((await bob('calendar-entry-done',{id:eImg,done:false})).status,403);
assert.equal((await bob('calendar-entry-delete',{id:eImg})).status,403);
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'image',ref_id:bobImg,date:day()})).status,403,'never attach another space visual');
assert.equal((await bob('calendar-entry-save',{client_id:b.id,kind:'image',ref_id:img,date:day()})).status,403);
assert.equal((await bob('state')).data.calendarEntries.length,0);
assert.equal((await alice('state?client='+b.id)).status,403);

// ---- Agence : lecture et retrait, mais pas d'ajout ni de validation à la place du client ----
assert.equal((await agency('state?client='+a.id)).data.calendarEntries.length,4,'agency sees client additions');
assert.equal((await agency('calendar-entry-save',{client_id:a.id,kind:'note',date:day(),title:'x'})).status,403,'agency uses publication-save');
assert.equal((await agency('calendar-entry-done',{id:eImg,done:false})).status,403);
// Les posts de l'agence restent sous son contrôle.
const post=(await agency('publication-save',{client_id:a.id,title:'Post agence',date:day(1),platform:'Instagram'})).data.id;
assert.equal((await alice('publication-save',{client_id:a.id,id:post,version:1,title:'modifié',date:day(2),platform:'Instagram'})).status,403);
assert.equal((await alice('publication-delete',{id:post,version:1})).status,403);
assert.equal((await alice('calendar-entry-delete',{id:post})).status,404,'agency post is not a client entry');
assert.equal((await agency('calendar-entry-delete',{id:eImg})).status,200,'agency may remove a client entry');

// ---- Limite horaire ----
const n0=h.sqlite.prepare('SELECT COUNT(*) AS n FROM calendar_entries WHERE client_id=?').get(a.id).n;
h.sqlite.prepare('DELETE FROM calendar_entries WHERE client_id=?').run(a.id);
for(let i=0;i<60;i++)assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'note',date:day(),title:'n'+i})).status,200);
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'note',date:day(),title:'trop'})).status,429);
assert.ok(n0>=0);
console.log('calendar-client OK — ajouts client (visuel, modèle, vidéo, note), déplacement, publié, suppression, cloisonnement, agence en lecture, limite horaire');
