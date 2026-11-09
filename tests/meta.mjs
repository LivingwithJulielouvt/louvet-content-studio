// Publication Instagram : désactivée par défaut, connexion par compte, publication d'un post du calendrier.
import assert from 'node:assert/strict';
import {readyHarness as harness,photoForm} from './harness.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:c.quota_limit,active:true,config:{...c.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
// Sans configuration : rien ne part.
let st=(await alice('state')).data;assert.equal(st.meta.enabled,false);
const product=st.products[0];const up=await alice('upload',photoForm(a.id,product.id));
const post=(await call('publication-save',{client_id:a.id,date:'2026-12-01',platform:'Instagram',title:'Post test',caption:'Bonjour Instagram',file_id:up.data.id})).data.id;
assert.equal((await alice('meta-publish',{post_id:post,request_key:'key-00000001'})).status,503);
// Configuration + approbation Meta simulées.
Object.assign(h.env,{META_APP_ID:'123',META_APP_SECRET:'secret',META_TOKEN_KEY:Buffer.alloc(32,7).toString('base64'),STUDIO_URL:'https://studio.test',META_PUBLISHING_ENABLED:'true',META_POLL_MS:'1'});
const calls=[];
h.env.META_FETCH=async(url,opts={})=>{calls.push([opts.method||'GET',String(url),opts.body||'']);const u=String(url);
 if(u.startsWith('https://api.instagram.com/oauth/access_token'))return Response.json({access_token:'short',user_id:'1789'});
 if(u.includes('ig_exchange_token'))return Response.json({access_token:'long-token',expires_in:5184000});
 if(u.includes('/me?'))return Response.json({user_id:'1789',username:'alice.brand'});
 if(u.endsWith('/1789/media'))return Response.json({id:'container-1'});
 if(u.includes('/container-1?'))return Response.json({status_code:'FINISHED'});
 if(u.endsWith('/1789/media_publish'))return Response.json({id:'media-9'});
 if(u.includes('/media-9?'))return Response.json({permalink:'https://instagram.com/p/xyz'});
 return Response.json({error:{message:'unexpected '+u}},{status:400})};
// Connexion : Alice obtient un lien Instagram ; le state est lié à son compte.
const connect=await h.call('meta-connect?client='+a.id,null,'alice','alice@test.local');assert.equal(connect.status,302);
const loc=new URL(connect.location);assert.equal(loc.host,'www.instagram.com');assert.equal(loc.searchParams.get('redirect_uri'),'https://studio.test/api/studio/meta-callback');
assert.equal((await bob('meta-connect?client='+a.id)).status,403,'Bob cannot connect Alice’s Instagram');
const state=h.sqlite.prepare('SELECT state FROM meta_oauth_states WHERE client_id=?').get(a.id).state;
// Bob ne peut pas réutiliser le state d'Alice.
await call('meta-callback?code=abc&state='+state,null,'bob','bob@test.local');
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM meta_connections').get().n,0);
const s2=(await h.call('meta-connect?client='+a.id,null,'alice','alice@test.local'),h.sqlite.prepare('SELECT state FROM meta_oauth_states WHERE client_id=?').get(a.id).state);
await call('meta-callback?code=abc&state='+s2,null,'alice','alice@test.local');
const conn=h.sqlite.prepare('SELECT * FROM meta_connections WHERE client_id=?').get(a.id);assert.equal(conn.username,'alice.brand');
assert.ok(!conn.token_encrypted.includes('long-token'),'token stored encrypted');
// Publication.
assert.notEqual((await bob('meta-publish',{post_id:post,request_key:'key-00000002'})).status,200);
const pub=await alice('meta-publish',{post_id:post,request_key:'key-00000003'});assert.equal(pub.status,200,JSON.stringify(pub.data));
assert.equal(pub.data.permalink,'https://instagram.com/p/xyz');
const media=calls.find(c=>c[1].endsWith('/1789/media'));assert.match(media[2],/image_url=/);assert.match(media[2],/caption=Bonjour/);
assert.ok([...h.objects.keys()].some(k=>k.startsWith(a.id+'/meta-exports/')&&k.endsWith('.jpg')),'image converted to JPEG');
st=(await alice('state')).data;assert.equal(st.publicationPosts.find(p=>p.id===post).published,1);
assert.equal((await alice('meta-publish',{post_id:post,request_key:'key-00000003'})).data.duplicate,true);
assert.equal((await alice('meta-publish',{post_id:post,request_key:'key-00000004'})).status,409);
assert.equal((await bob('state')).data.meta.connection,null);
console.log('meta OK');
