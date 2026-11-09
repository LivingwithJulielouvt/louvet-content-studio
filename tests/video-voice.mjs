import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {subtitleChunks,autoSubtitleSRT,finishArgs,renderSettings,checkRender} from '../lib/video-render.mjs';
// Sous-titres automatiques : lignes courtes, durée totale respectée.
const long='Bonjour à tous ! Aujourd’hui, je vous présente notre nouvelle bougie ambrée, coulée à la main dans notre atelier de Monterrey. Écrivez-nous pour la commander dès cette semaine.';
const chunks=subtitleChunks(long);assert.ok(chunks.length>=4);assert.ok(chunks.every(c=>c.length<=42),'chunks stay short');assert.equal(chunks.join(' ').replace(/\s+/g,' '),long.replace(/\s+/g,' '),'no word lost');
assert.deepEqual(subtitleChunks('[note interne] Hola'),['Hola'],'bracketed notes are not subtitled');
const srt=autoSubtitleSRT(long,12.5);assert.match(srt,/^1\n00:00:00,000 --> /);assert.match(srt,/--> 00:00:12,500\n[^\n]+\n$/,'last subtitle ends with the voice');assert.equal(autoSubtitleSRT('',10),'');
const base=renderSettings({format:'9:16',duration:30});
assert.throws(()=>checkRender({...base,subtitles:true},{}),/sous-titres automatiques/);checkRender({...base,subtitles:true},{autoSubtitles:true});
const voiceOnly=finishArgs({...base,voice:true}).join(' ');assert.match(voiceOnly,/-i voice\.mp3/);assert.match(voiceOnly,/amix=inputs=2/);assert.match(voiceOnly,/-c:a aac/);
assert.match(finishArgs({...base,voice:true,music:true}).join(' '),/volume=0\.12\[music\].*amix=inputs=3/,'music is ducked under the voice');
assert.equal(finishArgs(base).join(' ').includes('voice'),false,'no voice, unchanged pipeline');
// Action serveur : génération, crédits, cloisonnement, limites.
let calls=0,mode='ok';const mp3=new Uint8Array(4096);mp3.set([0x49,0x44,0x33,3,0,0]);
const h=harness(async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/audio/speech');const body=JSON.parse(init.body);assert.ok(body.input.length<=600);assert.ok(['coral','ash','nova'].includes(body.voice));if(mode==='fail')return Response.json({error:{code:'server_error'}},{status:500});return new Response(mp3,{status:200,headers:{'Content-Type':'audio/mpeg'}})});
await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const s=(await h.call('state?client='+c.id)).data,row=s.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})}
await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
function clipForm(cid){const bytes=new Uint8Array(2048);bytes.set([0,0,0,24,102,116,121,112,109,112,52,50]);const f=new FormData();f.set('client_id',cid);f.set('file',new File([bytes],'rush.mp4',{type:'video/mp4'}));return f}
const af=(await h.call('video-upload',clipForm(a.id),'alice','alice@test.local')).data.id;
const edit=(await h.call('video-request',{client_id:a.id,clips:[af],request_key:'voice-edit-1'},'alice','alice@test.local')).data.id;
const used=()=>h.sqlite.prepare('SELECT quota_used FROM clients WHERE id=?').get(a.id).quota_used;
const start=used();const voice=(o={})=>h.call('video-voice',{edit_id:edit,script:'Notre bougie ambrée est coulée à la main. Commandez-la aujourd’hui.',voice:'calm',request_key:'voice-key-'+Math.random(),...o},o.user||'alice',(o.user||'alice')+'@test.local');
h.env.AI_GENERATION_ENABLED='false';assert.equal((await voice()).status,503,'gated when AI is disabled');assert.equal(calls,0);assert.equal(used(),start);h.env.AI_GENERATION_ENABLED='true';
assert.equal((await voice({script:'x'.repeat(601)})).status,400,'script limited to 600 characters');assert.equal((await voice({script:'   '})).status,400);assert.equal(calls,0);
const ok=await voice({request_key:'voice-key-fixed'});assert.equal(ok.status,200,JSON.stringify(ok.data));assert.equal(ok.data.credits_charged,1);assert.equal(used(),start+1,'one credit charged');
const fileId=ok.data.voice.file_id;assert.equal(h.sqlite.prepare('SELECT purpose FROM files WHERE id=?').get(fileId).purpose,'video_voice');
const again=await voice({request_key:'voice-key-fixed'});assert.equal(again.data.duplicate,true);assert.equal(used(),start+1,'same request is not charged twice');
const st=(await h.call('state',null,'alice','alice@test.local')).data.videoEdits.find(e=>e.id===edit);assert.equal(st.brief.voice.file_id,fileId);assert.equal(st.brief.voice.request_key,undefined);
assert.equal((await h.call('file/'+fileId,null,'alice','alice@test.local')).status,200,'owner can listen');
assert.equal((await h.call('file/'+fileId,null,'bob','bob@test.local')).status,403,'another client cannot fetch the voice');
assert.equal((await voice({user:'bob'})).status,403,'another client cannot add a voice to this edit');
mode='fail';const before=used();assert.equal((await voice()).status,502);assert.equal(used(),before,'failed call is refunded');mode='ok';
const regen=await voice();assert.equal(regen.status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(fileId).n,0,'previous voice replaced');
h.sqlite.prepare('UPDATE clients SET quota_limit=quota_used WHERE id=?').run(a.id);assert.equal((await voice()).status,402,'no credits left');
const r=await h.call('video-render-start',{edit_id:edit,extras:{voice:true,autoSubtitles:true}},'alice','alice@test.local');assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.voice,regen.data.voice.file_id);assert.equal(r.data.settings.voice,true);assert.equal(r.data.settings.subtitles,true);
console.log('video-voice OK — voix off (crédits, remboursement, cloisonnement, limite 600) et sous-titres automatiques');
