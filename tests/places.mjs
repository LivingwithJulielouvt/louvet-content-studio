// Lieux (décors de référence) : l'agence fournit des photos d'un lieu, le client choisit un mot-clé.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readyHarness as harness,photoForm,originalPath} from './harness.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=';
const records=new Map(),bodies=[];
const apiFetch=async(url,opts)=>{if(opts.method==='POST'){const b=JSON.parse(opts.body);bodies.push(b);const id='resp-'+crypto.randomUUID();const out=b.tools?[{type:'image_generation_call',result:png}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({captions:['Uno','Dos','Tres']})}]}];records.set(id,{id,status:'completed',output:out,metadata:b.metadata,usage:{input_tokens:1,output_tokens:1}});return new Response(JSON.stringify({id,status:'queued'}))}return new Response(JSON.stringify(records.get(url.split('/').pop())))};
const h=harness(apiFetch),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);await call('settings',{client_id:c.id,name:c.name,quota_limit:30,active:true,config:{...c.config,allowedEmails:[email]}})}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
const placeForm=(cid,pid)=>{const f=new FormData();f.set('client_id',cid);f.set('purpose','place');f.set('place_id',pid);f.set('file',new File([fs.readFileSync(originalPath)],'lieu.png',{type:'image/png'}));return f};

// Agence : création, limites, client en lecture seule.
assert.equal((await alice('place-save',{client_id:a.id,label:'Comptoir'})).status,403,'clients cannot create places');
assert.equal((await call('place-save',{client_id:a.id,label:''})).status,400,'label required');
const created=await call('place-save',{client_id:a.id,label:'Comptoir',labels:{en:'Counter',es:'Mostrador'},description:'Comptoir en bois clair, lumière du matin'});
assert.equal(created.status,200);const placeId=created.data.id;
const hidden=(await call('place-save',{client_id:a.id,label:'Réserve',active:false})).data.id;
for(let i=0;i<10;i++)assert.equal((await call('place-save',{client_id:a.id,label:'Lieu '+i})).status,200);
assert.equal((await call('place-save',{client_id:a.id,label:'Treizième'})).status,400,'max 12 places per client');
// Photos : agence seulement, 5 maximum.
assert.equal((await alice('upload',placeForm(a.id,placeId))).status,403,'clients cannot upload place photos');
assert.equal((await call('upload',placeForm(b.id,placeId))).status,403,'place of another client refused');
const photoIds=[];for(let i=0;i<5;i++){const r=await call('upload',placeForm(a.id,placeId));assert.equal(r.status,200,JSON.stringify(r.data));photoIds.push(r.data.id)}
assert.equal((await call('upload',placeForm(a.id,placeId))).status,400,'a 6th place photo is refused');
assert.equal((await call('place-photo-remove',{place_id:placeId,file_id:photoIds[4]})).status,200);photoIds.pop();
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(photoIds.at(-1)).n,1);
// Le client voit ses lieux actifs, jamais ceux d'un autre espace ni les fichiers.
let sa=(await alice('state')).data;assert.ok(sa.places.some(p=>p.id===placeId&&p.labels.en==='Counter'));assert.ok(!sa.places.some(p=>p.id===hidden),'inactive places hidden from client');
assert.ok(!sa.files.some(f=>photoIds.includes(f.id)),'place photos are not mixed with product photos');
assert.equal((await alice('file/'+photoIds[0])).status,200,'client can see its own place photos');
assert.equal((await bob('file/'+photoIds[0])).status,403,'another client cannot see them');
assert.equal((await bob('state')).data.places.length,0);
assert.notEqual((await bob('place-delete',{id:placeId})).status,200);
// Génération : photos du lieu + consigne dans la requête envoyée au modèle.
const product=sa.products[0],recipe=sa.recipes[0];
const up=await alice('upload',photoForm(a.id,product.id));
const payload={client_id:a.id,product_id:product.id,recipe_id:recipe.id,photo_ids:[up.data.id],place_id:placeId,request_key:'place-gen-0001'};
assert.equal((await bob('generate',{...payload,client_id:b.id,request_key:'place-foreign-01'})).status,403,'foreign place refused');
assert.equal((await alice('generate',{...payload,place_id:hidden,request_key:'place-hidden-01'})).status,400,'inactive place refused');
bodies.length=0;const gen=await alice('generate',payload);assert.equal(gen.status,200,JSON.stringify(gen.data));
const imageBody=bodies.find(x=>x.tools);assert.ok(imageBody,'image request sent');
const prompt=imageBody.input[0].content[0].text;assert.match(prompt,/Location: recreate the scene inside this exact real place, "Comptoir"/);assert.match(prompt,/Comptoir en bois clair/);
const images=imageBody.input[0].content.filter(x=>x.type==='input_image');assert.ok(images.length>=1+3,'product photo + 3 place photos');
const job=h.sqlite.prepare('SELECT config FROM jobs WHERE id=?').get(gen.data.job_id);const cfg=JSON.parse(job.config);assert.equal(cfg.place.id,placeId);assert.equal(cfg.place.fileIds.length,3,'at most 3 place photos per request');
// Sans lieu : aucune consigne de lieu.
bodies.length=0;await alice('generate',{...payload,place_id:undefined,request_key:'place-none-0001'});assert.ok(!bodies.find(x=>x.tools).input[0].content[0].text.includes('Location:'));
// Variante : le lieu de la version source est conservé.
bodies.length=0;const variant=await alice('generate',{...payload,place_id:undefined,parent_id:gen.data.job_id,request_key:'place-variant-01'});assert.equal(variant.status,200,JSON.stringify(variant.data));
assert.equal(JSON.parse(h.sqlite.prepare('SELECT config FROM jobs WHERE id=?').get(variant.data.job_id).config).place.id,placeId,'variants keep the place');
assert.match(bodies.find(x=>x.tools).input[0].content[0].text,/"Comptoir"/);
// Suppression : le lieu et ses photos disparaissent.
assert.equal((await call('place-delete',{id:placeId})).status,200);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id IN ('+photoIds.map(()=>'?').join(',')+')').get(...photoIds).n,0);
assert.equal((await alice('generate',{...payload,request_key:'place-deleted-01'})).status,403,'deleted place refused');
console.log('places OK — lieux, photos, cloisonnement, consigne de génération, variantes');
