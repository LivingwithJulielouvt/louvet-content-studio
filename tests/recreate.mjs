// « Recréer ce post » : lien Instagram + captures → recette → modèles du studio, sans jamais ouvrir le lien.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readyHarness as harness,originalPath} from './harness.mjs';
import {canonicalInstagram,recreateParam,sanitizeRecipe,suggestTemplates,responseJson,suggestionExists} from '../lib/recreate.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

// ---- Liens ----
assert.equal(canonicalInstagram('instagram.com/p/AbCdE123/?igsh=xyz'),'https://www.instagram.com/p/AbCdE123/');
assert.equal(canonicalInstagram('https://www.instagram.com/reels/AbCdE123/'),'https://www.instagram.com/reel/AbCdE123/');
assert.equal(canonicalInstagram('https://www.instagram.com/compte/reel/AbCdE123'),'https://www.instagram.com/reel/AbCdE123/');
for(const bad of ['https://evil.com/p/AbCdE123/','https://www.instagram.com/share/reel/xyz','https://user:pw@instagram.com/p/AbCdE123/','javascript:alert(1)','https://www.instagram.com/stories/x/1'])assert.equal(canonicalInstagram(bad),null,bad);
assert.equal(recreateParam('?recreate='+encodeURIComponent('https://www.instagram.com/p/AbCdE123/')),'https://www.instagram.com/p/AbCdE123/');
assert.equal(recreateParam('?text='+encodeURIComponent('Regarde ça https://www.instagram.com/reel/AbCdE123/?igsh=1 trop bien')),'https://www.instagram.com/reel/AbCdE123/');
assert.equal(recreateParam('?recreate=https://evil.com/x'),null);
assert.ok(tenantTables.includes('inspirations')&&tenantTables.includes('site_imports'));

// ---- Recette bornée ----
const r0=sanitizeRecipe({kind:'reel',intent:'hack',mood:'neon',slides:99,summary:'x'.repeat(900),texts:{title:'T',items:['a','',...Array(9).fill('b')]},shots:[{duration:99,framing:'gros plan',action:'Verser le café'},{action:''}],colors:['#abcdef','red','#123']},{creator:true});
assert.equal(r0.kind,'reel');assert.equal(r0.intent,'tips');assert.equal(r0.mood,'editorial');assert.equal(r0.slides,1);assert.equal(r0.summary.length,400);
assert.equal(r0.shots.length,1);assert.equal(r0.shots[0].duration,15);assert.deepEqual(r0.colors,['#ABCDEF']);assert.equal(r0.texts.items.length,6);
const r1=sanitizeRecipe(null,{creator:false,fallbackKind:'carousel',fallbackIntent:'offer'});assert.equal(r1.kind,'carousel');assert.equal(r1.intent,'offer');assert.ok(r1.slides>=2);
assert.equal(responseJson({output_text:'```json\n{"a":1}\n```'}).a,1);assert.equal(responseJson({output_text:'pas de json'}),null);

// ---- Suggestions : 3 modèles, existants, dans le bon format, déterministes ----
const creatorCfg={workspaceType:'creator',creatorStrategy:{pillars:['cuisine']}};
for(const kind of ['post','carousel','reel']){
  const rec=sanitizeRecipe({kind,intent:'recipe',mood:'fun',slides:4},{creator:true});
  const s1=suggestTemplates(creatorCfg,rec),s2=suggestTemplates(creatorCfg,rec);
  assert.equal(s1.length,3,kind);assert.deepEqual(s1,s2,'deterministic');assert.ok(s1.every(suggestionExists));
  if(kind==='carousel')assert.ok(s1.every(x=>x.format==='4:5'));
}
const brandSug=suggestTemplates({workspaceType:'brand'},sanitizeRecipe({kind:'post',intent:'offer'},{creator:false}));
assert.equal(brandSug.length,3);assert.ok(brandSug.every(suggestionExists));

// ---- Parcours complet (IA simulée) ----
let aiCalls=0,lastBody=null;
const h=harness(async(url,init)=>{if(String(url).endsWith('/responses')){aiCalls++;lastBody=JSON.parse(init.body);return new Response(JSON.stringify({output_text:JSON.stringify({kind:'carousel',intent:'tips',mood:'minimal',slides:3,summary:'Un carrousel de conseils, une idée par diapo.',layout:'Grand titre puis une astuce par diapo',hook:'Question directe',texts:{title:'3 astuces pour votre pain',subtitle:'Testées à la boulangerie',items:['Farine','Eau','Temps'],caption:'Lequel essayez-vous ?'},shots:[],colors:['#F2E8DC']})}),{status:200,headers:{'content-type':'application/json'}})}throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local');
const png=fs.readFileSync(originalPath);
async function upload(who,cid){const it=await who('recreate-upload-intent',{client_id:cid,filename:'capture.png',mime:'image/png',size:png.length});assert.equal(it.status,200,JSON.stringify(it.data));h.objects.set(it.data.path,new Uint8Array(png));const c=await who('recreate-upload-commit',{intent_id:it.data.id});assert.equal(c.status,200,JSON.stringify(c.data));return c.data.id}
const f1=await upload(alice,a.id),f2=await upload(alice,a.id),fb=await upload(bob,b.id);
assert.equal(h.sqlite.prepare('SELECT purpose FROM files WHERE id=?').get(f1).purpose,'inspiration');
let st=(await alice('state')).data;assert.ok(!st.files.some(f=>f.id===f1),'captures never in Mes visuels');
// Le type « inspiration » ne passe pas par l'envoi normal, et l'envoi d'inspiration n'enregistre pas un autre type.
assert.equal((await alice('upload-intent',{client_id:a.id,kind:'inspiration',filename:'x.png',mime:'image/png',size:png.length})).status,400);
const vid=await alice('upload-intent',{client_id:a.id,kind:'photo',filename:'x.png',mime:'image/png',size:png.length});assert.equal((await alice('recreate-upload-commit',{intent_id:vid.data.id})).status,400);
assert.equal((await alice('recreate-upload-intent',{client_id:a.id,filename:'x.mp4',mime:'video/mp4',size:5000})).status,400,'frames are images');
assert.equal((await bob('recreate-upload-intent',{client_id:a.id,filename:'x.png',mime:'image/png',size:png.length})).status,403);

let r=await alice('recreate-analyze',{client_id:a.id,url:'https://www.instagram.com/p/AbCdE123/?igsh=1',file_ids:[f1,f2]});
assert.equal(r.status,200,JSON.stringify(r.data));const ins=r.data.inspiration;
assert.equal(ins.url,'https://www.instagram.com/p/AbCdE123/');assert.equal(ins.ai,true);assert.equal(ins.recipe.kind,'carousel');assert.equal(ins.recipe.texts.title,'3 astuces pour votre pain');assert.equal(ins.suggestions.length,3);
assert.equal(aiCalls,1);const content=lastBody.input[0].content;assert.equal(content.filter(x=>x.type==='input_image').length,2);assert.match(content[0].text,/NEVER copy the original text/);assert.ok(content[1].image_url.startsWith('data:image/png;base64,'));
assert.equal((await alice('recreate-analyze',{client_id:a.id,url:'https://evil.com/p/x',file_ids:[f1]})).status,400);
assert.equal((await alice('recreate-analyze',{client_id:a.id,file_ids:[]})).status,400,'screenshot required');
assert.equal((await alice('recreate-analyze',{client_id:a.id,file_ids:[fb]})).status,403,'never another space capture');
assert.equal((await bob('recreate-analyze',{client_id:a.id,file_ids:[f1]})).status,403);
st=(await alice('state')).data;assert.equal(st.inspirations.length,1);assert.equal(st.inspirations[0].recipe.intent,'tips');
assert.equal((await bob('state')).data.inspirations.length,0);

// ---- Sans IA : choix manuel, format déduit du nombre de captures ----
h.env.AI_GENERATION_ENABLED='false';
r=await alice('recreate-analyze',{client_id:a.id,file_ids:[f1,f2],intent:'list'});assert.equal(r.status,200);assert.equal(r.data.inspiration.ai,false);assert.equal(r.data.inspiration.recipe.kind,'carousel');assert.equal(r.data.inspiration.recipe.slides,2);
r=await alice('recreate-analyze',{client_id:a.id,file_ids:[f1],kind:'reel'});assert.equal(r.data.inspiration.recipe.kind,'reel');assert.equal(aiCalls,1,'no AI call when disabled');
h.env.AI_GENERATION_ENABLED='true';

// ---- Suppression : la recette et ses captures ----
const delId=r.data.inspiration.id;
assert.equal((await bob('recreate-delete',{id:delId})).status,403);
assert.equal((await alice('recreate-delete',{id:delId})).status,200);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM inspirations WHERE id=?').get(delId).n,0);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(f1).n,0,'captures removed with the recipe');

// ---- Limite horaire : 10 analyses par heure ----
const f3=await upload(alice,a.id);
const used=h.sqlite.prepare("SELECT COUNT(*) n FROM audit WHERE client_id=? AND action='ai_call:recreate-analyze'").get(a.id).n;
for(let i=used;i<10;i++)assert.equal((await alice('recreate-analyze',{client_id:a.id,file_ids:[f3]})).status,200);
assert.equal((await alice('recreate-analyze',{client_id:a.id,file_ids:[f3]})).status,429);

// ---- Fonction éteinte par l'agence ----
assert.equal((await call('features-save',{features:{recreate:false}})).status,200);
assert.equal((await alice('recreate-upload-intent',{client_id:a.id,filename:'x.png',mime:'image/png',size:png.length})).status,403);
assert.equal((await call('features-save',{features:{recreate:true}})).status,200);

// ---- Purge à la suppression de l'espace ----
assert.ok(h.sqlite.prepare('SELECT COUNT(*) n FROM inspirations WHERE client_id=?').get(a.id).n>0);
console.log('recreate OK — liens canoniques, ?recreate, recette bornée, suggestions déterministes, captures privées, IA simulée sans copie, chemin sans IA, cloisonnement, suppression, limite horaire, interrupteur');
