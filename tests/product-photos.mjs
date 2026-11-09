// Bibliothèque photo produit : 1 à 5 photos enregistrées et réutilisées.
import assert from 'node:assert/strict';
import {readyHarness as harness,photoForm} from './harness.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
const product=(await alice('state')).data.products[0];
const before=h.sqlite.prepare("SELECT COUNT(*) n FROM files WHERE product_id=? AND purpose='original'").get(product.id).n;
const ids=[];
for(let i=before;i<5;i++){const r=await alice('upload',photoForm(a.id,product.id));assert.equal(r.status,200,JSON.stringify(r.data));ids.push(r.data.id)}
assert.equal((await alice('upload',photoForm(a.id,product.id))).status,409,'a 6th photo is refused');
// Bob ne peut pas retirer une photo d'Alice.
assert.notEqual((await bob('product-photo-delete',{client_id:b.id,file_id:ids[0]})).status,200);
assert.equal((await alice('product-photo-delete',{client_id:a.id,file_id:ids[0]})).status,200);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(ids[0]).n,0);
assert.equal((await alice('upload',photoForm(a.id,product.id))).status,200,'room again after removal');
// Les photos de marque ne comptent pas dans la limite produit.
const brand=photoForm(a.id,product.id);brand.set('purpose','brand');assert.equal((await alice('upload',brand)).status,200);
console.log('product-photos OK');
