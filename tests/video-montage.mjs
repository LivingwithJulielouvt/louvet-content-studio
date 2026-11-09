import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {DEFAULT_STYLE,sanitizeStyle,lookStyle,switchLook,applyIntent,wordLook} from '../lib/video-style.mjs';
import {speechSilences,sanitizeWords,wordsFromTranscript,proportionalWords,silencesToKeeps,parseSilences,keptDuration,trimKeeps,remapWords,sourceTime,subtitleGroups,subtitleFrame,changePoints,buildPlan} from '../lib/video-timing.mjs';
import {brandASS,brandFinishArgs,fontsFor,analysisAudioArgs,silenceArgs,segmentArgs,renderSettings} from '../lib/video-render.mjs';

// ---- Style : validation, looks, intentions ----
const evil=sanitizeStyle({font:'Comic',size:'xxl',position:'left',color:'red',animation:'explode',hook:{text:'{\\b1}Hook <script>'},wordStyles:{'3':'yellow','x':'pink','4':'rainbow','5':'normal'},music:{id:'../../etc',volume:9},rhythm:{target:45}});
assert.equal(evil.font,'sans');assert.equal(evil.size,'m');assert.equal(evil.position,'bottom');assert.equal(evil.color,'#FFFFFF');assert.equal(evil.animation,'word');
assert.ok(!/[{}\\<>]/.test(evil.hook.text),'ASS/HTML control characters removed from the hook');
assert.deepEqual(evil.wordStyles,{'3':'yellow'},'only known word styles on numeric indexes');assert.equal(evil.music.id,null);assert.equal(evil.music.volume,1);assert.equal(evil.rhythm.target,null);
const mine={...DEFAULT_STYLE,font:'rounded',highlight:'#FF0000'};
assert.equal(lookStyle('mine',mine).font,'rounded');assert.equal(lookStyle('soft',mine).font,'serif');assert.equal(lookStyle('bold',mine).animation,'label');
const custom=sanitizeStyle({...mine,hook:{text:'Le secret du levain'},wordStyles:{'2':'pink'},music:{id:'m1'}});
const bold=switchLook(custom,'bold',mine);assert.equal(bold.font,'heavy');assert.equal(bold.hook.text,'Le secret du levain','look change keeps the hook');assert.deepEqual(bold.wordStyles,{'2':'pink'});assert.equal(bold.music.id,'m1');
const dyn=applyIntent(sanitizeStyle({animation:'fade'}),'dynamic');assert.equal(dyn.rhythm.zooms,true);assert.equal(dyn.rhythm.jumpCuts,true);assert.equal(dyn.animation,'word');
const calm=applyIntent(dyn,'calm');assert.equal(calm.animation,'fade');assert.equal(calm.rhythm.zooms,false);assert.ok(calm.music.volume<dyn.music.volume);
const s30=applyIntent(DEFAULT_STYLE,'shorter');assert.equal(s30.rhythm.target,30);assert.equal(applyIntent(s30,'shorter').rhythm.target,15);assert.equal(applyIntent(applyIntent(s30,'shorter'),'shorter').rhythm.target,15);
assert.equal(wordLook(custom,2).color,'#F2B8C6');assert.equal(wordLook({...custom,wordStyles:{'1':'script'}},1).font,'script');

// ---- Mots, silences, recalage ----
assert.deepEqual(sanitizeWords([{w:'Hola',s:0,e:0.4},{w:'',s:1,e:2},{w:'x',s:-1,e:1},{w:'{bad}',s:0.5,e:0.9}]),[{w:'Hola',s:0,e:0.4},{w:'bad',s:0.5,e:0.9}]);
assert.equal(wordsFromTranscript({words:[{word:' Bonjour',start:0.1,end:0.5}]})[0].w,'Bonjour');
const prop=proportionalWords('Un deux trois quatre',4);assert.equal(prop.length,4);assert.ok(prop[3].e<=4);assert.ok(prop[1].s>prop[0].s);
const sil=parseSilences('[silencedetect] silence_start: 2.0\n[silencedetect] silence_end: 3.5 | silence_duration: 1.5\nsilence_start: 8.2',10);
assert.deepEqual(sil,[[2,3.5],[8.2,10]]);
assert.deepEqual(speechSilences([[2,3.5],[5,9]],[{duration:6,audio:true},{duration:4,audio:false}]),[[2,3.5],[5,6]],'silent B-roll is never cut');
const keeps=silencesToKeeps(sil,10);assert.deepEqual(keeps,[[0,2.12],[3.38,8.32]]);assert.equal(keptDuration(keeps),7.06);
assert.deepEqual(trimKeeps(keeps,3),[[0,2.12],[3.38,4.26]]);
const src=[{w:'Bonjour',s:0.2,e:0.8},{w:'silence',s:2.5,e:3.0},{w:'pain',s:4.0,e:4.5}].map((w,i)=>({...w,oi:i}));
const fin=remapWords(src,keeps);assert.equal(fin.length,2,'words inside a cut silence disappear');assert.equal(fin[1].oi,2,'source index survives the remap');assert.ok(Math.abs(fin[1].s-(2.12+0.62))<0.01);
assert.ok(Math.abs(sourceTime(keeps,fin[1].s)-4.0)<0.01,'final time maps back to source time');

// ---- Image des sous-titres (aperçu = rendu) ----
const ws=[{w:'Notre',s:0,e:0.3},{w:'pain',s:0.35,e:0.6},{w:'au',s:0.65,e:0.75},{w:'levain.',s:0.8,e:1.2},{w:'Commandez',s:2.5,e:3.0},{w:'aujourd’hui',s:3.05,e:3.6}];
assert.equal(subtitleGroups(ws,{...DEFAULT_STYLE,animation:'karaoke'}).length,2,'split at punctuation');assert.equal(subtitleGroups(ws,DEFAULT_STYLE).length,4,'word by word keeps lines short');
const st=sanitizeStyle({wordStyles:{'1':'yellow'}});
let f=subtitleFrame(ws,st,0.4,{duration:4});assert.equal(f.group,0);assert.deepEqual(f.words.map(w=>w.visible),[true,true,false],'word by word reveal');assert.equal(f.words[1].color,'#F5D76E');
f=subtitleFrame(ws,{...st,animation:'karaoke'},0.4,{duration:4});assert.equal(f.words.every(w=>w.visible),true);
assert.equal(subtitleFrame(ws,st,2.0,{duration:4}).group,-1,'nothing on screen between groups');
f=subtitleFrame(ws,{...st,animation:'typewriter'},2.75,{duration:4});assert.ok(f.words[0].text.length<'Commandez'.length&&f.words[0].text.length>0,'typewriter shows part of the word');
f=subtitleFrame(ws,{...st,animation:'fade'},0.05,{duration:4});assert.ok(f.opacity<1);
const hooked=sanitizeStyle({hook:{text:'Le vrai levain'},outro:{text:'dupain.mx'}});
assert.equal(subtitleFrame(ws,hooked,1,{duration:10}).hook.text,'Le vrai levain');assert.equal(subtitleFrame(ws,hooked,3.2,{duration:10}).hook,null);
f=subtitleFrame(ws,hooked,8,{duration:10});assert.equal(f.outro.text,'dupain.mx');assert.equal(f.group,-1);
assert.equal(subtitleFrame(ws,{...st,uppercase:true},0.4,{duration:4}).words[0].text,'NOTRE');
const pts=changePoints(ws,st,4);assert.ok(pts.includes(0.35)&&pts.includes(4));assert.deepEqual([...pts].sort((a,b)=>a-b),pts);

// ---- Plan de rendu ----
const plan=buildPlan([[0,2],[4,9]],[5,5],[true,false],DEFAULT_STYLE);
assert.deepEqual(plan.map(p=>[p.input,p.start,p.duration]),[[0,0,2],[0,4,1],[1,0,4]],'keeps span clip boundaries');assert.equal(plan[2].audio,false);
const jc=buildPlan([[0,5]],[5],[true],{...DEFAULT_STYLE,rhythm:{jumpCuts:true,zooms:false}});assert.equal(jc.length,3);assert.deepEqual(jc.map(p=>p.zoom),[1,1.08,1]);
const zm=buildPlan([[0,2],[2,4],[4,6]],[6],[true],{...DEFAULT_STYLE,rhythm:{zooms:true},wordStyles:{'0':'yellow'}},[{w:'x',s:2.5,e:2.8,oi:0}]);
assert.deepEqual(zm.map(p=>p.zoom),[1,1.15,1],'zoom lands on the highlighted word');
const seg=segmentArgs({input:0,start:1,duration:2,zoom:1.15,fill:true,audio:true},0,renderSettings({format:'9:16',duration:30})).join(' ');assert.match(seg,/crop/);

// ---- Sous-titres ASS et mixage ----
for(const animation of ['word','stack','typewriter','fade','highlight','karaoke','label','none']){
  const ass=brandASS(ws,sanitizeStyle({animation,hook:{text:'Le vrai levain'},wordStyles:{'1':'script'}}),{format:'9:16',duration:4});
  assert.match(ass,/\[Events\]/);assert.match(ass,/Dialogue:/,animation);assert.match(ass,/Le vrai levain/,'hook in '+animation);
  assert.match(ass,/Caveat/,'script word uses the handwritten font in '+animation);
  const lines=ass.split('\n').filter(l=>l.startsWith('Dialogue:'));assert.ok(lines.length<400,'events merged in '+animation);
  if(animation==='fade')assert.match(ass,/\\fad\(/);if(animation==='label')assert.match(ass,/Label/);
}
assert.deepEqual(fontsFor(sanitizeStyle({font:'heavy',hook:{text:'x',font:'serif'},wordStyles:{'0':'script'}})).sort(),['Anton_400Regular.ttf','Caveat_700Bold.ttf','DMSerifDisplay_400Regular.ttf'].sort());
const mix=brandFinishArgs({subtitles:true,voice:true,music:true,duck:true,musicVolume:0.35,duration:20}).join(' ');
assert.match(mix,/fontsdir=fonts/);assert.match(mix,/sidechaincompress/,'music ducks under the voice');
assert.doesNotMatch(brandFinishArgs({subtitles:false,voice:false,music:false,duration:20}).join(' '),/sidechain|ass=/);
assert.match(analysisAudioArgs([{audio:true},{audio:false}]).join(' '),/16000/);assert.match(silenceArgs().join(' '),/silencedetect=noise=-35dB:d=0.45/);

// ---- Serveur : transcription, hooks, enregistrement, demande de vérification ----
let calls=0,mode='ok';
const h=harness(async(url,init)=>{calls++;
  if(url.endsWith('/audio/transcriptions')){assert.equal(init.body.get('response_format'),'verbose_json');assert.equal(init.body.get('timestamp_granularities[]'),'word');
    if(mode==='fail')return Response.json({error:{code:'server_error'}},{status:500});
    return Response.json({text:'Notre pain',words:[{word:'Notre',start:0.1,end:0.4},{word:'pain',start:0.45,end:0.9}]})}
  if(url.endsWith('/responses'))return Response.json({output_text:JSON.stringify({hooks:['Le secret du levain','Pain chaud à 7h','{bad} <hook>']})});
  throw new Error('unexpected '+url)});
await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const s=(await h.call('state?client='+c.id)).data,row=s.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})}
await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
function clipForm(cid){const bytes=new Uint8Array(2048);bytes.set([0,0,0,24,102,116,121,112,109,112,52,50]);const f=new FormData();f.set('client_id',cid);f.set('file',new File([bytes],'rush.mp4',{type:'video/mp4'}));return f}
const af=(await h.call('video-upload',clipForm(a.id),'alice','alice@test.local')).data.id;
const edit=(await h.call('video-request',{client_id:a.id,clips:[af],request_key:'brand-edit-1'},'alice','alice@test.local')).data.id;
const used=()=>h.sqlite.prepare('SELECT quota_used FROM clients WHERE id=?').get(a.id).quota_used;
const mp3=(n=4096)=>{const x=new Uint8Array(n);x.set([0x49,0x44,0x33,3,0,0]);return x};
const tform=(o={})=>{const f=new FormData();f.set('edit_id',o.edit||edit);f.set('source','clips');f.set('request_key',o.key||'transcribe-'+Math.random());f.set('audio',new File([o.bytes||mp3()],'audio.mp3',{type:'audio/mpeg'}));return f};
const tr=(o={})=>h.call('video-transcribe',tform(o),o.user||'alice',(o.user||'alice')+'@test.local');
h.env.AI_GENERATION_ENABLED='false';assert.equal((await tr()).status,503,'gated when AI is disabled');assert.equal(calls,0);h.env.AI_GENERATION_ENABLED='true';
assert.equal((await tr({bytes:new Uint8Array(4096)})).status,400,'non-MP3 refused');
assert.equal((await tr({bytes:mp3(3*1024*1024+10)})).status,413,'3 MB cap');assert.equal(calls,0);
assert.equal((await tr({user:'bob'})).status,403,'another client cannot transcribe this edit');
const start=used();const ok=await tr({key:'transcribe-fixed'});assert.equal(ok.status,200,JSON.stringify(ok.data));assert.equal(ok.data.words.length,2);assert.equal(ok.data.credits_charged,0);assert.equal(used(),start,'transcription free by default');
const n=calls;const dup=await tr({key:'transcribe-fixed'});assert.equal(dup.data.duplicate,true);assert.equal(calls,n,'idempotent by request key');
// Coût configurable par l'agence + remboursement en cas d'échec.
{const s=(await h.call('state?client='+a.id)).data,row=s.clients.find(x=>x.id===a.id);const r=await h.call('settings',{client_id:a.id,name:a.name,quota_limit:row.quota_limit,active:true,config:{...row.config,transcribeCost:1}});assert.equal(r.status,200,JSON.stringify(r.data))}
const paid=await tr();assert.equal(paid.data.credits_charged,1);assert.equal(used(),start+1);
mode='fail';assert.equal((await tr()).status,502);assert.equal(used(),start+1,'failed transcription refunded');mode='ok';
// Hooks : IA nettoyée, sans IA on repart de l'idée.
const hk=await h.call('video-hooks',{edit_id:edit},'alice','alice@test.local');assert.equal(hk.status,200);assert.ok(hk.data.hooks.length>=2);assert.ok(hk.data.hooks.every(x=>!/[{}<>]/.test(x)));
assert.equal((await h.call('video-hooks',{edit_id:edit},'bob','bob@test.local')).status,403);
// Enregistrement : le style est validé côté serveur.
assert.equal((await h.call('video-render-start',{edit_id:edit,extras:{brand:true}},'alice','alice@test.local')).status,400,'brand render requires a prepared video');
const save=await h.call('video-brand-save',{edit_id:edit,style:{font:'nope',animation:'karaoke',hook:{text:'<b>Le levain</b>'},rhythm:{target:30}},words:[{w:'Notre',s:0.1,e:0.4},{w:'{x}',s:'a',e:1}],keeps:[[0,2],[5,1],[3,'x']],base:[[0,2]],clipInfo:[{duration:5,audio:true}],stats:{before:5,after:2,silences:1}},'alice','alice@test.local');
assert.equal(save.status,200,JSON.stringify(save.data));
const brief=JSON.parse(h.sqlite.prepare('SELECT brief FROM video_edits WHERE id=?').get(edit).brief);
assert.equal(brief.brand.style.font,'sans');assert.equal(brief.brand.style.animation,'karaoke');assert.ok(!/[<>]/.test(brief.brand.style.hook.text));assert.deepEqual(brief.brand.keeps,[[0,2]]);assert.equal(brief.brand.words.length,1);assert.equal(brief.duration,30);
assert.equal((await h.call('video-brand-save',{edit_id:edit,style:{}},'bob','bob@test.local')).status,403);
const job=await h.call('video-render-start',{edit_id:edit,extras:{brand:true}},'alice','alice@test.local');assert.equal(job.status,200,JSON.stringify(job.data));
// Demande de vérification : seulement avec une vidéo finale, seulement par le client concerné.
assert.equal((await h.call('video-review-request',{edit_id:edit},'alice','alice@test.local')).status,400,'needs a final video first');
h.sqlite.prepare('UPDATE video_edits SET output_file=? WHERE id=?').run(af,edit);
assert.equal((await h.call('video-review-request',{edit_id:edit},'bob','bob@test.local')).status,403);
assert.equal((await h.call('video-review-request',{edit_id:edit,note:'Le prix est-il bon ?'},'alice','alice@test.local')).status,200);
const agencyState=(await h.call('state')).data;assert.equal(agencyState.videoReviews.length,1);assert.equal(agencyState.videoReviews[0].id,edit);
assert.equal((await h.call('state',null,'alice','alice@test.local')).data.videoReviews.length,0,'clients never see the review queue');
assert.equal((await h.call('video-review-done',{edit_id:edit,comment:'Parfait'},'alice','alice@test.local')).status,403,'only the agency closes a review');
assert.equal((await h.call('video-review-done',{edit_id:edit,comment:'Parfait, publiez !'})).status,200);
assert.equal((await h.call('state')).data.videoReviews.length,0);
// « Mon style » enregistré par l'agence.
assert.equal((await h.call('video-style-save',{client_id:a.id,style:{font:'serif'}},'alice','alice@test.local')).status,403);
const ss=await h.call('video-style-save',{client_id:a.id,style:{font:'serif',animation:'bogus'}});assert.equal(ss.status,200);assert.equal(ss.data.style.font,'serif');assert.equal(ss.data.style.animation,'word');
console.log('video-montage OK — style, calage mot à mot, silences, ASS animés, mixage, transcription (crédits, cloisonnement, 3 Mo), hooks, vérification agence');
