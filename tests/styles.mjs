import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
const h=harness(()=>{throw new Error('No rendering service is configured')});await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const s=(await h.call('state?client='+c.id)).data,row=s.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})}await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
assert.equal((await h.call('seed-styles',{},'alice','alice@test.local')).status,403);assert.equal((await h.call('seed-styles',{})).status,200);
let state=(await h.call('state?client='+a.id)).data;assert.equal(state.videoStyles.length,3);const style=state.videoStyles[0];assert.equal(state.videoRenderConnected,true);assert.equal(state.videoRenderMode,'browser');
assert.equal((await h.call('assign-style',{client_id:a.id,style_id:style.id,enabled:true},'alice','alice@test.local')).status,403);
assert.equal((await h.call('assign-style',{client_id:a.id,style_id:style.id,enabled:true})).status,200);
const alice=(await h.call('state',null,'alice','alice@test.local')).data,bob=(await h.call('state',null,'bob','bob@test.local')).data;assert.equal(alice.videoStyles.length,1);assert.equal(alice.videoStyles[0].config,undefined);assert.equal(bob.videoStyles.length,0);
function clipForm(cid){const bytes=new Uint8Array(2048);bytes.set([0,0,0,24,102,116,121,112,109,112,52,50]);const f=new FormData();f.set('client_id',cid);f.set('file',new File([bytes],'rush.mp4',{type:'video/mp4'}));return f}
const af=(await h.call('video-upload',clipForm(a.id),'alice','alice@test.local')).data.id,bf=(await h.call('video-upload',clipForm(b.id),'bob','bob@test.local')).data.id;
assert.equal((await h.call('video-request',{client_id:b.id,clips:[bf],style_id:style.id,request_key:'unauthorized-style-1'},'bob','bob@test.local')).status,403);
const edit=await h.call('video-request',{client_id:a.id,clips:[af],style_id:style.id,request_key:'authorized-style-1'},'alice','alice@test.local');assert.equal(edit.status,200);const old=JSON.parse(h.sqlite.prepare('SELECT brief FROM video_edits WHERE id=?').get(edit.data.id).brief);assert.equal(old.style.config.shotSeconds,style.config.shotSeconds);
await h.call('video-style',{id:style.id,name:'Style version suivante',description:'Nouveaux réglages',config:{...style.config,shotSeconds:8}});const snapshot=JSON.parse(h.sqlite.prepare('SELECT brief FROM video_edits WHERE id=?').get(edit.data.id).brief);assert.equal(snapshot.style.config.shotSeconds,old.style.config.shotSeconds,'editing a saved style must not overwrite an existing montage request');
assert.equal((await h.call('state',null,'alice','alice@test.local')).data.videoEdits[0].brief.style.config,undefined,'client does not receive agency technical settings');
assert.equal((await h.call('video-style',{name:'Invalid',config:{shotSeconds:'not-a-number'}})).status,400);
console.log('PASS: agency-owned montage styles, per-client authorization, simple client labels, immutable request snapshots, invalid settings rejected, browser renderer declared separately from remote rendering.');
