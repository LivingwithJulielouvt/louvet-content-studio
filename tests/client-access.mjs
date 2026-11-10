// Accès client par client : montage vidéo fermé par défaut, options réglées à l'invitation puis modifiables ; codes bêta.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {applyClientAccess,sanitizeAccess,hasVideoAccess} from '../lib/features.mjs';

// Règles pures
assert.deepEqual(sanitizeAccess({video:true,recreate:false,hack:true,reels:'oui'}),{video:true,recreate:false});
assert.equal(hasVideoAccess({}),false);
assert.equal(hasVideoAccess({access:{video:true}}),true);
const f=applyClientAccess({recreate:true,opportunities:false,opportunitiesMode:'countdown'},{access:{recreate:false,opportunities:true}});
assert.equal(f.recreate,false);assert.equal(f.opportunities,true);assert.equal(f.opportunitiesMode,'open');assert.equal(f.video,false);

// readyClients : questionnaire terminé (le fixture ouvre aussi la vidéo) ; on referme pour tester l'état « fermé ».
const h=harness(()=>{throw Error('No paid API call is allowed')},{readyClients:true}),call=h.call;
await call('state');
const [a]=(await call('seed',{})).data.clients;
{const row=(await call('state?client='+a.id)).data.clients.find(x=>x.id===a.id);await call('settings',{client_id:a.id,name:a.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:['alice@test.local']}});}
assert.equal((await call('join',{code:a.code},'alice','alice@test.local')).status,200);
assert.equal((await call('client-access-save',{client_id:a.id,access:{video:false}})).status,200);

// Fermé par défaut : la cliente ne peut ni demander un montage ni envoyer une vidéo ; l'agence garde l'accès.
const closed=await call('video-request',{client_id:a.id},'alice','alice@test.local');
assert.equal(closed.status,403);assert.match(closed.data.error,/montage vidéo/);
const up=await call('upload-intent',{kind:'video',client_id:a.id,filename:'r.mp4',mime:'video/mp4',size:5000},'alice','alice@test.local');
assert.equal(up.status,403);
const ag=await call('video-request',{client_id:a.id});
assert.ok(!(ag.status===403&&/montage vidéo/.test(ag.data.error||'')),'agency never gated');
assert.equal((await call(`state?client=${a.id}`,undefined,'alice','alice@test.local')).data.features.video,false);

// Seule l'agence règle l'accès.
assert.equal((await call('client-access-save',{client_id:a.id,access:{video:true}},'alice','alice@test.local')).status,403);
const saved=await call('client-access-save',{client_id:a.id,access:{video:true,recreate:false,bogus:true}});
assert.equal(saved.status,200);assert.deepEqual(saved.data.access,{video:true,recreate:false});
const open=await call('video-request',{client_id:a.id},'alice','alice@test.local');
assert.ok(!(open.status===403&&/montage vidéo/.test(open.data.error||'')),'video opened');
const st=(await call(`state?client=${a.id}`,undefined,'alice','alice@test.local')).data;
assert.equal(st.features.video,true);assert.equal(st.features.recreate,false);
assert.equal((await call('recreate-suggest',{client_id:a.id},'alice','alice@test.local')).status,403);
// Réglage gardé quand l'agence modifie autre chose.
assert.equal((await call('client-access-save',{client_id:a.id,access:{recreate:true}})).data.access.video,true);
// Refermé.
await call('client-access-save',{client_id:a.id,access:{video:false}});
assert.equal((await call('video-request',{client_id:a.id},'alice','alice@test.local')).status,403);

// Invitation bêta : espace + code à usage unique, options choisies dès la création.
assert.equal((await call('beta-invite-create',{name:'Testeuse',workspaceType:'creator'},'alice','alice@test.local')).status,403);
const inv=await call('beta-invite-create',{name:'Créatrice bêta test',workspaceType:'creator',language:'es',access:{video:true}});
assert.equal(inv.status,200);assert.match(inv.data.code,/^BETA-[A-F0-9]{32}$/);
const row=h.sqlite.prepare('SELECT * FROM clients WHERE id=?').get(inv.data.id);const cfg=JSON.parse(row.config);
assert.equal(hasVideoAccess(JSON.parse(h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get((await call('beta-invite-create',{name:'Marque sans option'})).data.id).config)),false);
assert.equal(cfg.workspaceType,'creator');assert.equal(cfg.language,'es');assert.equal(cfg.access.video,true);assert.equal(row.quota_limit,20);
const invite=h.sqlite.prepare('SELECT * FROM beta_invites WHERE client_id=?').get(inv.data.id);
assert.ok(invite&&!invite.claimed_by&&invite.token_hash!==inv.data.code&&Date.parse(invite.expires_at)>Date.now()+50*86400000);
assert.ok(h.sqlite.prepare('SELECT * FROM beta_usage WHERE client_id=?').get(inv.data.id));
console.log('client-access OK — montage vidéo fermé par défaut et ouvert client par client, options par espace (agence seule, gardées dans le temps), invitations bêta avec options');
