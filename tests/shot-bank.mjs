// Banque de plans : un plan filmé pour une idée est réutilisé par toutes les idées qui le demandent,
// et une idée dont tous les plans sont filmés devient automatiquement un montage.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {shotKey,ideaScenes} from '../lib/shot-key.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
function clip(cid,n){const bytes=new Uint8Array(2048+n);bytes.set([0,0,0,24,102,116,121,112,109,112,52,50]);const f=new FormData();f.set('client_id',cid);f.set('file',new File([bytes],'plan-'+n+'.mp4',{type:'video/mp4'}));return f}
assert.equal(shotKey('0–3 s · Plan vertical de Bougie, à la lumière d’une fenêtre.'),shotKey('3-15 s · plan VERTICAL de bougie a la lumiere d une fenetre'));
const ideas=(await alice('ideas?client='+a.id)).data.videoIdeas;assert.ok(ideas.length>=2);
// Trouver un plan demandé par plusieurs idées.
const count=new Map();for(const i of ideas)for(const s of new Set(ideaScenes(i.content).map(shotKey)))count.set(s,(count.get(s)||0)+1);
const [sharedKey]=[...count].find(([,n])=>n>1)||[];assert.ok(sharedKey,'at least one shot is shared between ideas');
const first=ideas.find(i=>ideaScenes(i.content).some(s=>shotKey(s)===sharedKey)),idx=ideaScenes(first.content).findIndex(s=>shotKey(s)===sharedKey);
const up=await alice('video-upload',clip(a.id,1));assert.equal(up.status,200);
const saved=await alice('shot-clip-save',{client_id:a.id,idea_id:first.id,scene_index:idx,file_id:up.data.id});assert.equal(saved.status,200,JSON.stringify(saved.data));
assert.ok(saved.data.reused_in>=1,'the shot is reused by other ideas');
let st=(await alice('ideas?client='+a.id)).data;assert.ok(st.shotClips.some(x=>x.shot_key===sharedKey&&x.file_id===up.data.id));
// Bob ne peut ni lire ni utiliser les plans d'Alice.
assert.equal((await bob('ideas?client='+a.id)).status,403);
assert.notEqual((await bob('shot-clip-save',{client_id:b.id,idea_id:first.id,scene_index:idx,file_id:up.data.id})).status,200);
// Compléter tous les plans d'une idée → montage automatique.
const target=ideas.find(i=>ideaScenes(i.content).some(s=>shotKey(s)===sharedKey));let n=2;let last;
for(const [i,s] of ideaScenes(target.content).entries()){if(st.shotClips.some(x=>x.shot_key===shotKey(s)))continue;const u=await alice('video-upload',clip(a.id,n++));last=await alice('shot-clip-save',{client_id:a.id,idea_id:target.id,scene_index:i,file_id:u.data.id});assert.equal(last.status,200);st=(await alice('ideas?client='+a.id)).data}
const edit=st.videoEdits.find(e=>e.idea_id===target.id);assert.ok(edit,'an automatic montage was created');
assert.equal(edit.brief.auto_assembled,true);assert.equal(edit.clips.length,ideaScenes(target.content).length);
assert.equal(st.videoIdeas.find(i=>i.id===target.id).status,'editing');
// Pas de doublon si on refilme un plan.
const again=await alice('video-upload',clip(a.id,99));await alice('shot-clip-save',{client_id:a.id,idea_id:target.id,scene_index:0,file_id:again.data.id});
st=(await alice('ideas?client='+a.id)).data;assert.equal(st.videoEdits.filter(e=>e.idea_id===target.id).length,1);
console.log('shot-bank OK —',st.videoEdits.filter(e=>e.brief.auto_assembled).length,'montage(s) automatique(s)');
