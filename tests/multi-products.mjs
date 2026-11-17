// Visuel multi-produits : plusieurs produits du client réunis sur une même image.
import assert from 'node:assert/strict';
import {readyHarness as harness,photoForm} from './harness.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=';
const records=new Map(),bodies=[];
const apiFetch=async(url,opts)=>{if(opts.method==='POST'){const b=JSON.parse(opts.body);bodies.push(b);const id='resp-'+crypto.randomUUID();const out=b.tools?[{type:'image_generation_call',result:png}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({captions:['Uno','Dos','Tres']})}]}];records.set(id,{id,status:'completed',output:out,metadata:b.metadata,usage:{input_tokens:1,output_tokens:1}});return new Response(JSON.stringify({id,status:'queued'}))}return new Response(JSON.stringify(records.get(url.split('/').pop())))};
const h=harness(apiFetch),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);await call('settings',{client_id:c.id,name:c.name,quota_limit:30,active:true,config:{...c.config,allowedEmails:[email]}})}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
const sa=(await alice('state')).data,recipe=sa.recipes[0];
const main=sa.products[0];
const mk=async(name)=>{const r=await alice('products',{client_id:a.id,name,description:'Desc '+name,preserve:'',commercial:'',brand:'x'});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.id};
const p2=await mk('Bougie Ambre'),p3=await mk('Savon Lavande'),noPhoto=await mk('Sans photo');
const up=await alice('upload',photoForm(a.id,main.id));assert.equal(up.status,200);
for(const p of [p2,p3]){assert.equal((await alice('upload',photoForm(a.id,p))).status,200);assert.equal((await alice('upload',photoForm(a.id,p))).status,200);assert.equal((await alice('upload',photoForm(a.id,p))).status,200)}
const base={client_id:a.id,product_id:main.id,recipe_id:recipe.id,photo_ids:[up.data.id]};
assert.equal((await alice('generate',{...base,extra_product_ids:[noPhoto],request_key:'multi-nophoto-1'})).status,400,'extra product without photo refused');
const bp=(await bob('state')).data.products[0];
assert.equal((await alice('generate',{...base,extra_product_ids:[bp.id],request_key:'multi-foreign-1'})).status>=400,true,'foreign product refused');
assert.equal((await alice('generate',{...base,extra_product_ids:[p2,p3,noPhoto,'x'],request_key:'multi-toomany-1'})).status,400,'max 3 extra products');
bodies.length=0;
const gen=await alice('generate',{...base,extra_product_ids:[p2,p3,main.id],request_key:'multi-ok-00001'});assert.equal(gen.status,200,JSON.stringify(gen.data));
const img=bodies.find(x=>x.tools),txt=img.input[0].content[0].text;
assert.match(txt,/Bougie Ambre/);assert.match(txt,/Savon Lavande/);assert.match(txt,/together in the same single image/);
assert.equal(img.input[0].content.filter(x=>x.type==='input_image').length<=16,true,'16 images max');
assert.equal(img.input[0].content.filter(x=>x.type==='input_image').length>=5,true,'1 main + 2×2 extra photos');
const job=(await alice('state')).data.jobs.find(j=>j.id===gen.data.job_id);
assert.deepEqual(job.config.extraProducts.map(p=>p.name),['Bougie Ambre','Savon Lavande'],'main product not duplicated');
bodies.length=0;await alice('generate',{...base,request_key:'multi-single-01'});
assert.ok(!bodies.find(x=>x.tools).input[0].content[0].text.includes('together in the same single image'),'single product unchanged');
console.log('multi-products OK');
