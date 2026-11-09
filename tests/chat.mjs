import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {chatText,CHAT_MAX} from '../lib/studio.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

// ---- Nettoyage du texte ----
assert.equal(chatText('  Bonjour\r\n\r\n\r\n\r\nJulie ‮\u0000 '),'Bonjour\n\nJulie');
assert.equal(chatText('a'.repeat(CHAT_MAX+50)).length,CHAT_MAX);
assert.equal(chatText(null),'');

const fakePng=(w,hh,size=2000)=>{const u=new Uint8Array(size);u.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const v=new DataView(u.buffer);v.setUint32(16,w);v.setUint32(20,hh);return u};
const h=harness(async()=>{throw new Error('no network')});
await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const s=(await h.call('state?client='+c.id)).data,row=s.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email],language:c===b?'en':'fr'}})}
await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>h.call(x,y,'alice','alice@test.local'),bob=(x,y)=>h.call(x,y,'bob','bob@test.local'),agency=(x,y)=>h.call(x,y);
async function photo(who,cid,bytes=fakePng(800,600),mime='image/png'){const i=await who('chat-photo-intent',{client_id:cid,filename:'p.png',mime,size:bytes.length});if(i.status!==200)return i;h.objects.set(i.data.path,bytes);return who('chat-photo-commit',{intent_id:i.data.id})}

// ---- Fil vide ----
let l=await alice('chat-list',{client_id:a.id});assert.equal(l.status,200);assert.deepEqual(l.data.messages,[]);assert.equal(l.data.unread,0);
assert.equal((await alice('state?client='+a.id)).data.chatUnread,0);

// ---- Envoi client : texte, photo, validation ----
let s=await alice('chat-send',{client_id:a.id,body:'  Bonjour Julie !\n\n\n\nUne question <b>svp</b> '});assert.equal(s.status,200,JSON.stringify(s.data));
assert.equal(s.data.message.body,'Bonjour Julie !\n\nUne question <b>svp</b>');assert.equal(s.data.message.author,'client');assert.equal(s.data.message.read,false);
assert.equal((await alice('chat-send',{client_id:a.id,body:'   '})).status,400,'empty message refused');
assert.equal((await alice('chat-send',{client_id:a.id,body:'x'.repeat(CHAT_MAX+1)})).status,400,'too long refused');
const p=await photo(alice,a.id);assert.equal(p.status,200,JSON.stringify(p.data));
assert.equal(h.sqlite.prepare('SELECT purpose FROM files WHERE id=?').get(p.data.id).purpose,'chat');
s=await alice('chat-send',{client_id:a.id,body:'',file_id:p.data.id});assert.equal(s.status,200);assert.equal(s.data.message.file_id,p.data.id);
assert.equal((await alice('chat-send',{client_id:a.id,file_id:p.data.id})).status,409,'same photo cannot be sent twice');
assert.equal((await photo(alice,a.id,new Uint8Array(3000).fill(7))).status,400,'not an image');
assert.equal((await photo(alice,a.id,fakePng(800,600,9*1024*1024))).status,413,'8 MB max');
assert.equal((await photo(alice,a.id,fakePng(800,600),'image/gif')).status,400,'JPG/PNG only');
assert.equal((await alice('upload-intent',{kind:'chat',client_id:a.id,filename:'p.png',mime:'image/png',size:2000})).status,400,'chat kind only through the chat action');
// Une photo de produit ne peut pas être glissée dans le fil.
const prod=h.sqlite.prepare("SELECT id FROM files WHERE client_id=? AND purpose!='chat' LIMIT 1").get(a.id);
if(prod)assert.equal((await alice('chat-send',{client_id:a.id,file_id:prod.id})).status,403);
// Les photos du fil ne remontent pas dans « Mes photos ».
assert.ok(!(await alice('state?client='+a.id)).data.files.some(f=>f.id===p.data.id));

// ---- Isolation entre espaces ----
assert.equal((await bob('chat-list',{client_id:a.id})).status,403,'never read another space');
assert.equal((await bob('chat-send',{client_id:a.id,body:'coucou'})).status,403,'never write in another space');
assert.equal((await bob('chat-read',{client_id:a.id})).status,403);
assert.equal((await bob('file/'+p.data.id)).status,403,'attachment of another space is never served');
assert.equal((await alice('file/'+p.data.id)).status,200,'own attachment served via signed URL');
assert.equal((await agency('file/'+p.data.id)).status,200,'agency sees attachments');
const pb=await photo(bob,b.id);assert.equal(pb.status,200);
assert.equal((await alice('chat-send',{client_id:a.id,file_id:pb.data.id})).status,403,'cannot attach a photo of another space');
assert.equal((await bob('chat-photo-intent',{client_id:a.id,filename:'p.png',mime:'image/png',size:2000})).status,403,'cannot upload into another space');
assert.equal((await bob('chat-list',{client_id:b.id})).data.messages.length,0);

// ---- Boîte de réception de l'agence et compteurs ----
let st=(await agency('state')).data;assert.equal(st.chatUnread,2);assert.equal(st.chatThreads.length,1);
assert.equal(st.chatThreads[0].client_id,a.id);assert.equal(st.chatThreads[0].unread,2);assert.equal(st.chatThreads[0].last_photo,true);assert.equal(st.chatThreads[0].language,'fr');
assert.equal((await alice('state?client='+a.id)).data.chatThreads,undefined,'clients never see the inbox');
assert.equal((await bob('chat-send',{client_id:b.id,body:'Hello, a question'})).status,200);
st=(await agency('state')).data;assert.equal(st.chatThreads.length,2);assert.equal(st.chatThreads[0].client_id,b.id,'most recent first');assert.equal(st.chatThreads[0].language,'en');assert.equal(st.chatUnread,3);
l=await agency('chat-list',{client_id:a.id,read:true});assert.equal(l.data.messages.length,2);assert.equal(l.data.unread,0);
assert.ok((await alice('chat-list',{client_id:a.id})).data.messages.every(m=>m.read),'client sees « Lu »');
assert.equal((await agency('state')).data.chatUnread,1,'only Bob left');

// ---- Réponse de l'agence : notification unique et badge client ----
s=await agency('chat-send',{client_id:a.id,body:'Bonjour Alice, voici la réponse.'});assert.equal(s.status,200);assert.equal(s.data.message.author,'agency');
const pa=await photo(agency,a.id);assert.equal(pa.status,200);assert.equal((await agency('chat-send',{client_id:a.id,body:'Et la photo',file_id:pa.data.id})).status,200);
let as=(await alice('state?client='+a.id)).data;assert.equal(as.chatUnread,2);
assert.equal(as.notifications.filter(n=>/répondu dans vos messages/.test(n.message)).length,1,'one notification until read');
assert.equal((await bob('state?client='+b.id)).data.chatUnread,0,'Bob unaffected');
assert.equal((await alice('chat-read',{client_id:a.id})).data.marked,2);assert.equal((await alice('state?client='+a.id)).data.chatUnread,0);
assert.ok((await agency('chat-list',{client_id:a.id})).data.messages.filter(m=>m.author==='agency').every(m=>m.read));

// ---- Client avant ouverture du studio : le fil reste accessible ----
h.sqlite.prepare('DELETE FROM client_intakes WHERE client_id=?').run(b.id);
assert.equal((await bob('chat-send',{client_id:b.id,body:'Je n’ai pas fini le questionnaire'})).status,200,'chat open before the studio is ready');
assert.equal((await bob('generate',{client_id:b.id})).status,409,'other actions stay gated');

// ---- Limite : 30 messages par heure et par client ----
const n0=h.sqlite.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE client_id=? AND author='client'").get(a.id).n;
for(let i=n0;i<30;i++)assert.equal((await alice('chat-send',{client_id:a.id,body:'m'+i})).status,200);
assert.equal((await alice('chat-send',{client_id:a.id,body:'trop'})).status,429);
assert.equal((await agency('chat-send',{client_id:a.id,body:'L’agence peut toujours répondre'})).status,200,'agency not limited by client quota');
h.sqlite.prepare("UPDATE chat_messages SET created=? WHERE client_id=?").run(new Date(Date.now()-2*3600000).toISOString(),a.id);
assert.equal((await alice('chat-send',{client_id:a.id,body:'Une heure plus tard'})).status,200,'window slides');

// ---- Suppression définitive du client : fil et photos effacés ----
assert.ok(tenantTables.includes('chat_messages'));
assert.equal((await agency('client-lifecycle',{client_id:a.id,mode:'delete',confirm_name:a.name})).data.deleted,true);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE client_id=?').get(a.id).n,0);
assert.equal([...h.objects.keys()].some(k=>k.startsWith(a.id+'/chat/')),false,'attachments purged');
st=(await agency('state')).data;assert.ok(!st.chatThreads.some(t=>t.client_id===a.id));
assert.ok(h.sqlite.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE client_id=?').get(b.id).n>0,'other client untouched');
console.log('chat OK — fil privé par espace, photos cloisonnées, compteurs non lus, boîte agence, limite horaire, purge à la suppression');
