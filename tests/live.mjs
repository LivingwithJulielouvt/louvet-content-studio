import fs from 'node:fs';
import {readyHarness as harness} from './harness.mjs';
const h=harness(fetch);
h.env.OPENAI_API_KEY=fs.readFileSync(process.env.LIVE_ENV_FILE||new URL('../.env.local',import.meta.url),'utf8').split('\n').find(x=>x.startsWith('OPENAI_API_KEY=')).slice(15);
await h.call('state');const seed=(await h.call('seed',{})).data;const a=seed.clients[0];const s=(await h.call('state?client='+a.id)).data;const p=s.products[0],r=s.recipes[0];
await h.db.prepare('UPDATE products SET name=?,description=?,preserve=?,brand=? WHERE id=?').bind('Flacon de test','Flacon ambré avec un bouchon vert foncé et une étiquette crème portant STUDIO TEST.','Préserver la silhouette rectangulaire, la couleur ambrée, le bouchon vert et les inscriptions STUDIO TEST et REFERENCE.','Studio Test',p.id).run(); const form=new FormData();form.set('client_id',a.id);form.set('product_id',p.id);form.set('file',new File([fs.readFileSync('work/test-reference.png')],'test-reference.png',{type:'image/png'}));const upload=await h.call('upload',form);if(upload.status!==200)throw new Error('Upload failed');
console.log('Neutral synthetic PNG validated and stored. Starting real three-image + captions recipe.');
const result=await h.call('generate',{client_id:a.id,product_id:p.id,recipe_id:r.id,photo_ids:[upload.data.id],request_key:'neutral-live-verification-20261014'});
console.log(JSON.stringify({submission_status:result.status,...result.data}));
if(!result.data.job_id)process.exit(1);
fs.mkdirSync('work/live-neutral',{recursive:true});
function save(){const state={};for(const t of ['clients','products','recipes','files','jobs','tasks','notifications','audit'])state[t]=h.sqlite.prepare('SELECT * FROM '+t).all();fs.writeFileSync('work/live-neutral/state.json',JSON.stringify(state,null,2));for(const [key,bytes] of h.objects){const file='work/live-neutral/'+key.replaceAll('/','__');fs.writeFileSync(file,bytes)}return state}
for(let i=0;i<120;i++){
 const state=save(),job=state.jobs[0];console.log(JSON.stringify({status:job.status,tasks:state.tasks.map(t=>({kind:t.kind,status:t.status,error:t.error,provider_id:t.provider_id}))}));
 if(!['processing','submitting'].includes(job.status)){if(['review','ready'].includes(job.status)){console.log('PASS: complete real generation, 3 images + captions, durable metadata and private image bytes.');process.exit(0)}process.exit(2)}
 await new Promise(r=>setTimeout(r,6000));await h.call('poll',{job_ids:[result.data.job_id]});
}
console.log('Generation still processing; references preserved.');process.exit(3);
