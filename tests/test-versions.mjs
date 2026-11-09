// Versions à tester (créatrices) : recettes déterministes, séries cloisonnées, envoi des versions rendues,
// statistiques, gagnante, calendrier et purge.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readyHarness as harness} from './harness.mjs';
import {buildRecipes,fillHooks,maxVersions,sanitizeAxes,describeRecipe,scoreVersions,sanitizeMetrics,versionKeeps,versionStyle,DEFAULT_AXES,AXES,HOOK_BANK} from '../lib/test-versions.mjs';
import {sanitizeStyle} from '../lib/video-style.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

// ---- Recettes ----
const key=r=>JSON.stringify(AXES.map(a=>r[a]));
for(const lang of ['fr','es','en']){const h=fillHooks([],10,{lang,subject:'pain'});assert.equal(h.length,10,lang);assert.equal(new Set(h).size,10);assert.ok(h.every(x=>x.length<=70&&/^[A-ZÀ-Ý0-9¿]/u.test(x)),h.join('|'))}
assert.equal(HOOK_BANK.fr.length,HOOK_BANK.es.length);assert.equal(HOOK_BANK.fr.length,HOOK_BANK.en.length);
const ctx={hooks:fillHooks(['Le vrai levain'],10,{lang:'fr',subject:'le pain'}),music:['m1','m2']};
assert.equal(ctx.hooks[0],'Le vrai levain','AI/existing hooks first');
for(const n of [3,5,10]){
  const a=buildRecipes(n,[...DEFAULT_AXES,'music'],ctx),b=buildRecipes(n,[...DEFAULT_AXES,'music'],ctx);
  assert.equal(a.length,n);assert.deepEqual(a,b,'deterministic');assert.equal(new Set(a.map(key)).size,n,'all different');
  assert.deepEqual(a.map(r=>r.label),'ABCDEFGHIJ'.split('').slice(0,n));
  assert.equal(new Set(a.map(r=>r.hook)).size,n,'one hook per version');
  assert.equal(a[0].subs,'classic');assert.equal(a[0].duration,'full');assert.equal(a[0].start,'start');assert.equal(a[0].cover,'none');
  if(n>=5){for(const ax of ['subs','duration','start','cover','music'])assert.ok(new Set(a.map(r=>r[ax])).size>1,'axis varies: '+ax)}
}
// Axes cochés uniquement.
const only=buildRecipes(5,['subs'],ctx);assert.equal(only.length,5);assert.ok(only.every(r=>r.hook===ctx.hooks[0]&&r.duration==='full'&&r.start==='start'&&r.cover==='none'));
assert.equal(maxVersions(['duration'],ctx),2);assert.equal(buildRecipes(5,['duration'],ctx).length,2,'never more versions than possible combinations');
assert.deepEqual(sanitizeAxes(['music','subs','nope'],{hooks:['a'],music:[]}),['subs'],'music needs at least one track');
assert.deepEqual(sanitizeAxes(['hook'],{hooks:['a']}),[],'a single hook cannot vary');
// Série à partir d'une gagnante : A = la gagnante, puis un seul réglage change (l'accroche gagnante reste).
const win={hook:'Le vrai levain',subs:'label',music:'m2',duration:'short',start:'teaser-mid',cover:'top-heavy'};
const again=buildRecipes(5,[...DEFAULT_AXES,'music'],ctx,win);assert.equal(again.length,5);
assert.deepEqual(again[0],{label:'A',...win});
for(const r of again.slice(1)){const diff=AXES.filter(a=>r[a]!==win[a]);assert.equal(diff.length,1,JSON.stringify(r));assert.notEqual(diff[0],'hook')}
assert.match(describeRecipe(a5(),'fr',ctx),/Accroche « .+ » · .+ · version (complète|courte)/);
assert.match(describeRecipe({...win},'en',ctx),/Hook “Le vrai levain” · label subtitles · short cut · highlight first · bold cover title · music 2/);
assert.match(describeRecipe({...win,music:null},'es',ctx),/solo voz/);
function a5(){return buildRecipes(5,DEFAULT_AXES,ctx)[1]}
// Passages et style d'une version.
const base=[[0,4],[5,9],[10,20]];
const full=versionKeeps(base,20,{duration:'full',start:'start'}),short=versionKeeps(base,20,{duration:'short',start:'start'}),teaser=versionKeeps(base,20,{duration:'full',start:'teaser-end'});
const len=k=>k.reduce((n,[x,y])=>n+y-x,0);
assert.equal(len(full),18);assert.ok(Math.abs(len(short)-12.6)<0.01,'short ≈ 70 %');assert.deepEqual(teaser[0],[16,17.4]);assert.ok(Math.abs(len(teaser)-19.4)<0.01);
const st=sanitizeStyle(versionStyle(sanitizeStyle({}),{hook:'Salut',subs:'label',music:'m1',cover:'top-heavy'},'Ma routine du matin'));
assert.equal(st.hook.text,'Salut');assert.equal(st.font,'heavy');assert.equal(st.animation,'label');assert.equal(st.music.id,'m1');assert.equal(st.titles.length,1);assert.equal(st.titles[0].text,'Ma routine du matin');assert.equal(st.titles[0].font,'heavy');
assert.equal(sanitizeStyle(versionStyle(sanitizeStyle({}),{subs:'soft',cover:'none'},'x')).titles.length,0);
const inherited=sanitizeStyle(versionStyle(sanitizeStyle({hook:{text:'Ancien',wordFonts:{'1':'script'}},stickers:[{kind:'emoji',char:'🔥',s:0,e:2}]}),{hook:'Nouvelle accroche',subs:'classic',cover:'none'},''));
assert.equal(inherited.stickers.length,0,'montage stickers are not reused');assert.deepEqual(inherited.hook.wordFonts||{},{},'no per-word fonts from another hook');
// Score et gagnante.
let sc=scoreVersions([{label:'A',views:1000,likes:50},{label:'B',views:900,saves:60},{label:'C',views:null}]);
assert.equal(sc.winner,'B');assert.equal(sc.versions[1].score,100);assert.equal(sc.versions[0].score,Math.round(1050/1080*100));assert.equal(sc.versions[2].score,null);assert.equal(sc.tie,false);
assert.equal(scoreVersions([{label:'A',views:10},{label:'B',views:null}]).winner,null,'needs two measured versions');
sc=scoreVersions([{label:'A',views:100},{label:'B',views:100}]);assert.equal(sc.winner,'A');assert.equal(sc.tie,true);
sc=scoreVersions([{label:'A',views:100,likes:10},{label:'B',views:110}]);assert.equal(sc.winner,'B','same score: more views wins');assert.equal(sc.tie,false);
assert.throws(()=>sanitizeMetrics({views:''}),/vues/);assert.throws(()=>sanitizeMetrics({views:-1}));assert.throws(()=>sanitizeMetrics({views:1.5}));assert.throws(()=>sanitizeMetrics({views:12,likes:'beaucoup'}));
assert.deepEqual(sanitizeMetrics({views:'12',likes:3}),{views:12,likes:3,saves:null,shares:null});
assert.ok(tenantTables.includes('test_batches')&&tenantTables.includes('test_versions'),'purged with the client space');

// ---- Serveur ----
const h=harness(async()=>{throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
// Ces fonctions sont éteintes par défaut pour les clientes (Agence › Fonctions visibles) : on les allume pour ce test.
await call('features-save',{features:{opportunities:true,testVersions:true,brandCollabs:true,reels:true}});
const setType=(c,type)=>{const row=h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(c.id);h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.config||'{}'),workspaceType:type}),c.id)};
const setup=async(c,email,type)=>{const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);const r=await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}});assert.equal(r.status,200,JSON.stringify(r.data));setType(c,type)};
await setup(a,'alice@test.local','creator');await setup(b,'bob@test.local','brand');
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local'),agency=(x,y)=>call(x,y);
const now=new Date().toISOString();
const file=(cid,purpose,mime)=>{const id=crypto.randomUUID();h.sqlite.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,cid,null,cid+'/'+id,purpose+'.bin',mime,1000,100,100,purpose,now);h.objects.set(cid+'/'+id,new Uint8Array(1000));return id};
const rush=file(a.id,'video_original','video/mp4'),music=file(a.id,'video_music','audio/mpeg'),bobRush=file(b.id,'video_original','video/mp4'),bobMusic=file(b.id,'video_music','audio/mpeg');
const edit=crypto.randomUUID();h.sqlite.prepare('INSERT INTO video_edits VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(edit,a.id,null,'alice','k1',JSON.stringify({title:'Pain du matin'}),'requested',JSON.stringify([rush]),null,now,now);
const bobEdit=crypto.randomUUID();h.sqlite.prepare('INSERT INTO video_edits VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(bobEdit,b.id,null,'bob','k2','{}','requested',JSON.stringify([bobRush]),null,now,now);

const create=(x={})=>alice('test-batch-create',{client_id:a.id,source:{edit_id:edit},count:5,axes:[...DEFAULT_AXES,'music'],hooks:['Le vrai levain'],music:[music],lang:'fr',title:'Pain du matin',...x});
let r=await create();assert.equal(r.status,200,JSON.stringify(r.data));
const batch=r.data.id;assert.equal(r.data.versions.length,5);assert.equal(r.data.versions[0].recipe.hook,'Le vrai levain');assert.deepEqual(r.data.clips,[rush]);
assert.equal(new Set(r.data.versions.map(v=>key(v.recipe))).size,5);
// Validation et cloisonnement.
assert.equal((await create({count:4})).status,400,'3, 5 or 10 only');
assert.equal((await create({axes:[]})).status,400);
assert.equal((await create({music:[bobMusic]})).status,403,'never another space music');
assert.equal((await create({source:{edit_id:bobEdit}})).status,403,'never another space video');
assert.equal((await create({source:{file_id:bobRush}})).status,403);
assert.equal((await create({source:{file_id:music}})).status,400,'music is not a video');
assert.equal((await bob('test-batch-create',{client_id:b.id,source:{edit_id:bobEdit},count:3,axes:['subs']})).status,403,'brand spaces: creators only');
assert.equal((await bob('test-batch-create',{client_id:a.id,source:{edit_id:edit},count:3,axes:['subs']})).status,403);
assert.equal((await bob('state')).data.testBatches.length,0);
r=await alice('test-batch-create',{client_id:a.id,source:{file_id:rush},count:3,axes:['subs','duration']});assert.equal(r.status,200,'raw upload as source');const small=r.data.id;assert.equal(r.data.versions.length,3);

// Envoi d'une version rendue (vrai MP4 vertical).
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'louvet-tv-'));
const mp4=(name,size)=>{execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=#19352d:size='+size+':rate=30','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-f','mp4',path.join(dir,name)]);return new Uint8Array(fs.readFileSync(path.join(dir,name)))};
const vertical=mp4('v.mp4','540x960'),wide=mp4('w.mp4','640x360');
async function upload(user,cid,version,bytes,mime='video/mp4'){const intent=await call('upload-intent',{kind:'test-version',client_id:cid,version_id:version,filename:'v.mp4',mime,size:bytes.length},user,user+'@test.local');if(intent.status!==200)return intent;h.objects.set(intent.data.path,bytes);return call('upload-commit',{intent_id:intent.data.id},user,user+'@test.local')}
let st0=(await alice('state')).data.testBatches;const vs=st0.find(x=>x.id===batch).versions;assert.equal(st0.find(x=>x.id===batch).status,'rendering');
assert.equal((await upload('bob',b.id,vs[0].id,vertical)).status,403,'never upload into another space version');
assert.equal((await upload('bob',a.id,vs[0].id,vertical)).status,403);
assert.equal((await upload('alice',a.id,vs[0].id,wide)).status,400,'vertical MP4 only');
assert.equal((await upload('alice',a.id,vs[0].id,vertical,'video/quicktime')).status,400,'MP4 required');
for(const v of vs){r=await upload('alice',a.id,v.id,vertical);assert.equal(r.status,200,JSON.stringify(r.data))}
assert.equal((await upload('alice',a.id,vs[0].id,vertical)).status,409,'one file per version');
let bt=(await alice('state')).data.testBatches.find(x=>x.id===batch);assert.equal(bt.status,'ready');assert.ok(bt.versions.every(v=>v.file_id));
const vfile=bt.versions[1].file_id;assert.equal(h.sqlite.prepare('SELECT purpose FROM files WHERE id=?').get(vfile).purpose,'video_result');

// Statistiques et gagnante.
assert.equal((await alice('test-version-winner',{version_id:vs[1].id})).status,400,'needs two measured versions');
assert.equal((await alice('test-version-metrics',{version_id:vs[0].id,views:''})).status,400,'views required');
assert.equal((await alice('test-version-metrics',{version_id:vs[0].id,views:-3})).status,400);
assert.equal((await alice('test-version-metrics',{version_id:vs[0].id,views:1200,likes:80,saves:10,shares:5})).status,200);
assert.equal((await alice('test-version-metrics',{version_id:vs[1].id,views:1500,likes:40,saves:90,shares:30})).status,200);
assert.equal((await bob('test-version-metrics',{version_id:vs[2].id,views:1})).status,403);
assert.equal((await agency('test-version-metrics',{version_id:vs[2].id,views:1})).status,403,'only the creator enters her stats');
bt=(await alice('state')).data.testBatches.find(x=>x.id===batch);assert.equal(bt.suggested,'B');assert.equal(bt.versions[1].score,100);assert.equal(bt.measured,2);
assert.equal((await bob('test-version-winner',{version_id:vs[1].id})).status,403);
assert.equal((await alice('test-version-winner',{version_id:vs[1].id})).status,200);
bt=(await alice('state')).data.testBatches.find(x=>x.id===batch);assert.ok(bt.versions[1].winner);assert.equal(bt.versions.filter(v=>v.winner).length,1);
// Nouvelle série à partir de la gagnante.
r=await alice('test-batch-create',{client_id:a.id,source:{edit_id:edit},count:5,axes:bt.axes,hooks:[],music:[music],parent_version_id:vs[1].id});assert.equal(r.status,200,JSON.stringify(r.data));
assert.deepEqual({...r.data.versions[0].recipe},{...bt.versions[1].recipe},'version A = the winner');const child=r.data.id;
assert.equal((await bob('test-batch-create',{client_id:b.id,source:{edit_id:bobEdit},count:5,axes:['subs'],parent_version_id:vs[1].id})).status,403);
// Arrêt d'un rendu : les versions sans fichier disparaissent.
assert.equal((await alice('test-batch-stop',{batch_id:child})).status,200);assert.ok(!(await alice('state')).data.testBatches.find(x=>x.id===child),'nothing rendered: the set is removed');
// Calendrier : une version rendue s'ajoute comme une vidéo.
const day=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
assert.equal((await alice('calendar-entry-save',{client_id:a.id,kind:'video',ref_id:vfile,date:day})).status,200,'version file accepted by the calendar');
assert.equal((await bob('calendar-entry-save',{client_id:b.id,kind:'video',ref_id:vfile,date:day})).status,403);
assert.equal((await alice('test-batch-delete',{batch_id:batch})).status,409,'scheduled version protects its set');
assert.equal((await bob('test-batch-delete',{batch_id:small})).status,403);
const entry=(await alice('state')).data.calendarEntries[0].id;assert.equal((await alice('calendar-entry-delete',{id:entry})).status,200);
const keys=bt.versions.map(v=>h.sqlite.prepare('SELECT key FROM files WHERE id=?').get(v.file_id).key);
assert.equal((await alice('test-batch-delete',{batch_id:batch})).status,200);
assert.ok(keys.every(k=>!h.objects.has(k)),'files removed from storage');assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM test_versions WHERE batch_id=?').get(batch).n,0);
// Limite quotidienne.
for(let i=0;i<5;i++)h.sqlite.prepare("INSERT INTO test_batches(id,client_id,user_id,count,axes,context,title,status,created,updated) VALUES(?,?,?,3,'[]','{}','','ready',?,?)").run(crypto.randomUUID(),a.id,'alice',now,now);
assert.equal((await create({count:3})).status,429,'5 sets per day');
// Purge à la suppression de l'espace.
assert.ok(h.sqlite.prepare('SELECT COUNT(*) AS n FROM test_versions WHERE client_id=?').get(a.id).n>0);
r=await agency('client-lifecycle',{client_id:a.id,mode:'delete',confirm_name:a.name});assert.equal(r.status,200,JSON.stringify(r.data));
for(const t of ['test_batches','test_versions'])assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM '+t+' WHERE client_id=?').get(a.id).n,0,t+' purged');
console.log('test-versions OK — recettes déterministes (3/5/10), axes, gagnante, envoi MP4 vertical cloisonné, statistiques, calendrier, suppression, limite');
