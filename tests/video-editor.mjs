import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {DEFAULT_STYLE,sanitizeStyle,switchLook,hookWords,styleTemplate,MAX_STICKERS,MAX_TITLES} from '../lib/video-style.mjs';
import {subtitleGroups,subtitleFrame,changePoints,editWordText,shiftWords,applyTaps} from '../lib/video-timing.mjs';
import {brandASS,brandFinishArgs,fontsFor,stickerOverlay,sfxSources,sfxEvents,SFX_SOURCES,subtitleY} from '../lib/video-render.mjs';

// ---- Stickers, titres, hook multi-polices : validation ----
const st=sanitizeStyle({stickers:[
  {kind:'emoji',char:'🔥',x:2,y:-1,size:9,s:1,e:1.05,sfx:1},
  {kind:'emoji',char:'abc'},
  {kind:'png',file_id:'../../etc/passwd'},
  {kind:'png',file_id:'sticker_1',x:0.3,y:0.4,size:0.2,s:2,e:4},
  {kind:'svg',file_id:'x'},
],titles:[{text:'  ÉPISODE {2} <b>  ',x:0,y:1,s:0,e:3,font:'comic',color:'red',size:1,sfx:true},{text:''}],hook:{text:'Le vrai levain',wordFonts:{'1':'script','9':'heavy','x':'serif','2':'bogus'}},scale:9,offset:-3,shift:5,sfxKind:'boom',sfxVolume:4});
assert.equal(st.stickers.length,2,'only valid emoji/png stickers kept');
assert.deepEqual([st.stickers[0].x,st.stickers[0].y,st.stickers[0].size],[1,0,0.6],'position/size clamped');
assert.ok(st.stickers[0].e>=st.stickers[0].s+0.2,'minimum duration');assert.equal(st.stickers[0].sfx,true);
assert.equal(st.stickers[1].file_id,'sticker_1');
assert.equal(st.titles.length,1);assert.ok(!/[{}<>\\]/.test(st.titles[0].text),'no ASS/HTML control characters in titles');
assert.equal(st.titles[0].font,'heavy');assert.equal(st.titles[0].color,'#FFFFFF');assert.ok(st.titles[0].x>=0.05&&st.titles[0].y<=0.95&&st.titles[0].size<=0.16);
assert.deepEqual(st.hook.wordFonts,{'1':'script'},'hook word fonts: known fonts on existing words only');
assert.deepEqual([st.scale,st.offset,st.shift,st.sfxKind,st.sfxVolume],[1.5,-0.25,2,'pop',1]);
assert.equal(sanitizeStyle({stickers:Array.from({length:30},()=>({kind:'emoji',char:'✨'}))}).stickers.length,MAX_STICKERS);
assert.equal(sanitizeStyle({titles:Array.from({length:30},()=>({text:'X'}))}).titles.length,MAX_TITLES);
assert.deepEqual(hookWords(st.hook).map(w=>w.font),['serif','script','serif']);
assert.deepEqual(hookWords({text:'A B',font:'heavy'}).map(w=>w.text),['A','B']);
// « Mon style » enregistré = le look, jamais le contenu d'une vidéo.
const tpl=styleTemplate({...st,wordStyles:{'2':'pink'}});
assert.equal(tpl.stickers.length,0);assert.equal(tpl.titles.length,0);assert.equal(tpl.hook.text,'');assert.deepEqual(tpl.wordStyles,{});assert.equal(tpl.shift,0);assert.equal(tpl.scale,1.5,'look settings kept');
// Changer de look garde les stickers, titres et décalage.
const sw=switchLook(st,'bold',DEFAULT_STYLE);assert.equal(sw.stickers.length,2);assert.equal(sw.titles.length,1);assert.equal(sw.shift,2);

// ---- Correction de mot, décalage, calage au tap ----
const ws=[{w:'Trois',s:0.2,e:0.5},{w:'erreurs.',s:0.55,e:1.0},{w:'La',s:2.0,e:2.2},{w:'première',s:2.25,e:2.8}];
const fixed=editWordText(ws,1,'ERREURS.');assert.equal(fixed[1].w,'ERREURS.');assert.equal(fixed[1].s,0.55);assert.equal(fixed[1].e,1.0,'timing kept');
assert.equal(editWordText(ws,1,'   ')[1].w,'erreurs.','empty edit ignored');assert.ok(!/[{}]/.test(editWordText(ws,0,'{\\b1}x')[0].w));
assert.equal(ws[1].w,'erreurs.','original untouched');
assert.deepEqual(shiftWords(ws,0.5).map(w=>w.s),[0.7,1.05,2.5,2.75]);assert.equal(shiftWords(ws,-1)[0].s,0,'never before 0');assert.equal(shiftWords(ws,0),ws);
const ks={...DEFAULT_STYLE,animation:'karaoke'};const groups=subtitleGroups(ws,ks);assert.equal(groups.length,2);
const tapped=applyTaps(ws,groups,[0.5,1.2]);
assert.equal(tapped[0].s,0.5,'block 0 starts at its tap');assert.equal(tapped[2].s,1.2,'block 1 starts at its tap');
assert.ok(tapped[1].e<=1.18+1e-9,'block 0 compressed before the next block');assert.ok(tapped[3].e>tapped[3].s);
assert.deepEqual(applyTaps(ws,groups,[0.5]).slice(2).map(w=>w.s),[2.0,2.25],'untapped blocks keep their timing');
assert.equal(tapped.map(w=>w.w).join(' '),ws.map(w=>w.w).join(' '));

// ---- Image : stickers et titres dans l'aperçu partagé ----
const style=sanitizeStyle({stickers:[{kind:'emoji',char:'🔥',x:0.7,y:0.3,size:0.2,s:1,e:3,sfx:true}],titles:[{text:'ÉPISODE 2',s:0.5,e:2,sfx:true},{text:'FIN',s:3,e:4}],hook:{text:'Le vrai levain',wordFonts:{'2':'script'}}});
let f=subtitleFrame(ws,style,1.5,{duration:5});assert.equal(f.stickers.length,1);assert.equal(f.stickers[0].k,0);assert.equal(f.titles.length,1);assert.equal(f.titles[0].text,'ÉPISODE 2');
assert.equal(f.hook.words[2].font,'script');
f=subtitleFrame(ws,style,3.5,{duration:5});assert.equal(f.stickers.length,0);assert.deepEqual(f.titles.map(t=>t.text),['FIN']);
const cps=changePoints(ws,style,5);for(const t of [0.5,2,3,4])assert.ok(cps.some(x=>Math.abs(x-t)<0.01),'title boundary '+t+' is a change point');
assert.ok(Math.abs(subtitleY({position:'bottom',offset:0.1})-subtitleY({position:'bottom',offset:0})-0.1)<1e-9);assert.ok(subtitleY({position:'bottom',offset:0.25})<=0.92);

// ---- Rendu : ASS des titres et du hook multi-polices ----
const ass=brandASS(ws,style,{format:'9:16',duration:5});
assert.match(ass,/Style: Title/);assert.match(ass,/\\an5\\pos\(\d+,\d+\).*ÉPISODE 2/);assert.match(ass,/FIN/);
assert.match(ass,/\\fnCaveat/,'per-word hook font');
assert.ok(fontsFor(style).includes('Caveat_700Bold.ttf'));assert.ok(fontsFor(style).includes('Anton_400Regular.ttf'),'title font bundled');
const bigger=brandASS(ws,sanitizeStyle({scale:1.5}),{format:'9:16',duration:5}),normal=brandASS(ws,sanitizeStyle({}),{format:'9:16',duration:5});
const fs=(a)=>Number(a.match(/Style: Sub,[^,]+,(\d+)/)[1]);assert.ok(fs(bigger)>fs(normal)*1.4,'size slider scales the subtitle font');

// ---- Rendu : graphe des stickers et bruitages ----
const ov=stickerOverlay([{x:0.7,y:0.3,size:0.2,s:1,e:3},{x:0.5,y:0.5,size:0.1,s:2,e:2.5}],{first:3,width:540,video:'captioned'});
assert.equal(ov.label,'ov1');assert.match(ov.filters[0],/^\[3:v\]scale=108:-1,format=rgba\[stk0\]$/);
assert.match(ov.filters[1],/^\[captioned\]\[stk0\]overlay=x='0\.7\*main_w-overlay_w\/2':y='0\.3\*main_h-overlay_h\/2':enable='between\(t,1,3\)'\[ov0\]$/);
assert.match(ov.filters[3],/^\[ov0\]\[stk1\]overlay=.*between\(t,2,2\.5\)'\[ov1\]$/);
assert.deepEqual(sfxEvents(style),[0.5,1]);assert.deepEqual(sfxEvents(sanitizeStyle({})),[]);
const fx=sfxSources([0.5,1],'click',0.4,5);assert.equal(fx.count,2);assert.equal(fx.args.filter(a=>a==='lavfi').length,2);assert.ok(fx.args.includes(SFX_SOURCES.click));
assert.match(fx.filters[0],/^\[5:a\].*volume=0\.4,adelay=500\|500\[sfx0\]$/);assert.match(fx.filters[1],/^\[6:a\].*adelay=1000\|1000\[sfx1\]$/);
assert.equal(sfxSources(Array.from({length:40},(_,i)=>i),'pop',1,1).count,24,'SFX capped');assert.ok(sfxSources([1],'nope').args.includes(SFX_SOURCES.pop));
for(const k of Object.keys(SFX_SOURCES))assert.ok(!/[;'\[\]]/.test(SFX_SOURCES[k]),'lavfi source is a single safe chain');
const full=brandFinishArgs({subtitles:true,voice:true,music:true,duck:true,duration:10,dims:[540,960],stickers:[{x:0.5,y:0.5,size:0.2,s:0,e:2}],sfx:{events:[0,1.5],kind:'pop',volume:0.6}});
const j=full.join(' ');
assert.ok(full.indexOf('sticker-0.png')>full.indexOf('music'),'sticker inputs follow voice and music');
assert.match(j,/\[3:v\]scale=/,'sticker is input 3 (joined, voice, music)');assert.match(j,/\[4:a\].*adelay=0\|0\[sfx0\]/);assert.match(j,/\[5:a\].*adelay=1500\|1500\[sfx1\]/);
assert.match(j,/\[mixed\]\[sfx0\]\[sfx1\]amix=inputs=3/);assert.equal(full[full.indexOf('-map')+1],'[ov0]');assert.equal(full[full.lastIndexOf('-map')+1],'[withfx]');
const plain=brandFinishArgs({subtitles:false,voice:false,music:false,duration:10,stickers:[{x:0.5,y:0.5,size:0.2,s:0,e:2}]});
assert.match(plain.join(' '),/\[0:v\]\[stk0\]overlay/);assert.equal(plain[plain.lastIndexOf('-map')+1],'[mixed]');

// ---- Serveur : stickers privés, état de l'éditeur, « Mon style » ----
const h=harness(async(url)=>{if(url.endsWith('/responses'))return Response.json({output_text:JSON.stringify({hooks:['Le secret du levain','Pain chaud à 7h']})});throw new Error('unexpected '+url)});
await h.call('state');
const cr=(await h.call('clients',{name:'Créatrice A',config:{workspaceType:'creator',language:'fr',allowedEmails:['ana@test.local']}})).data;
const cr2=(await h.call('clients',{name:'Créatrice B',config:{workspaceType:'creator',language:'es',allowedEmails:['bea@test.local']}})).data;
const brand=(await h.call('clients',{name:'Marque',config:{allowedEmails:['bob@test.local']}})).data;
await h.call('join',{code:cr.code},'ana','ana@test.local');await h.call('join',{code:cr2.code},'bea','bea@test.local');await h.call('join',{code:brand.code},'bob','bob@test.local');
const ana=(a,b)=>h.call(a,b,'ana','ana@test.local'),bea=(a,b)=>h.call(a,b,'bea','bea@test.local'),bob=(a,b)=>h.call(a,b,'bob','bob@test.local');
function png(w=256,hh=256,n=400){const b=new Uint8Array(n);b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52]);const dv=new DataView(b.buffer);dv.setUint32(16,w);dv.setUint32(20,hh);b[24]=8;b[25]=6;return b}
async function sticker(fn,cid,bytes,mime='image/png'){const i=await fn('upload-intent',{kind:'sticker',client_id:cid,filename:'s.png',mime,size:bytes.length});if(i.status!==200)return i;h.objects.set(i.data.path,bytes);return fn('upload-commit',{intent_id:i.data.id})}
assert.equal((await sticker(ana,cr.id,png(),'image/jpeg')).status,400,'PNG only');
assert.equal((await sticker(ana,cr.id,png(256,256,3*1024*1024+1))).status,413,'3 MB cap');
assert.equal((await sticker(ana,cr2.id,png())).status,403,'cannot upload into another space');
const fake=new Uint8Array(400);fake.set([0xff,0xd8,0xff]);assert.equal((await sticker(ana,cr.id,fake)).status,400,'PNG signature checked');
assert.equal((await sticker(ana,cr.id,png(5000,200))).status,400,'oversized image refused');
const okS=await sticker(ana,cr.id,png());assert.equal(okS.status,200,JSON.stringify(okS.data));const sid=okS.data.id;
const otherS=(await sticker(bea,cr2.id,png())).data.id;
let sa=(await ana('state?client='+cr.id)).data;assert.deepEqual(sa.stickerFiles.map(x=>x.id),[sid]);assert.ok(!sa.files?.some?.(x=>x.id===sid),'stickers stay out of the photo library');
assert.equal((await bea('state?client='+cr.id)).status,403);assert.ok(!(await bea('state?client='+cr2.id)).data.stickerFiles.some(x=>x.id===sid),'stickers are private per space');
assert.equal((await bea('file/'+sid)).status>=400,true,'another creator cannot read the sticker');
// Musique : une créatrice peut ajouter la sienne, une marque non.
const mp3=new Uint8Array(4096);mp3.set([0x49,0x44,0x33,3,0,0]);
const mi=await ana('upload-intent',{kind:'music',client_id:cr.id,filename:'m.mp3',mime:'audio/mpeg',size:mp3.length});assert.equal(mi.status,200,JSON.stringify(mi.data));h.objects.set(mi.data.path,mp3);const mid=(await ana('upload-commit',{intent_id:mi.data.id})).data.id;
assert.notEqual((await bob('upload-intent',{kind:'music',client_id:brand.id,filename:'m.mp3',mime:'audio/mpeg',size:mp3.length})).status,200,'brands keep the agency library');
// État de l'éditeur : enregistré dans le brief, isolé par espace.
function clipForm(cid){const bytes=new Uint8Array(2048);bytes.set([0,0,0,24,102,116,121,112,109,112,52,50]);const f=new FormData();f.set('client_id',cid);f.set('file',new File([bytes],'rush.mp4',{type:'video/mp4'}));return f}
const clip=(await h.call('video-upload',clipForm(cr.id),'ana','ana@test.local')).data.id,clip2=(await h.call('video-upload',clipForm(cr.id),'ana','ana@test.local')).data.id;
const beaClip=(await h.call('video-upload',clipForm(cr2.id),'bea','bea@test.local')).data.id;
const edit=(await ana('video-request',{client_id:cr.id,clips:[clip],request_key:'creator-edit-1'})).data.id;
const body={edit_id:edit,style:{animation:'karaoke',stickers:[{kind:'png',file_id:sid,s:1,e:2},{kind:'emoji',char:'🔥',s:0,e:1,sfx:true}],titles:[{text:'ÉPISODE 2',s:0,e:2}],shift:0.3,music:{id:mid}},words:ws,keeps:[[0,4]],base:[[0,4]],fullBase:[[0,6]],cutBase:[[0,4]],clipInfo:[{duration:6,audio:true}],stats:{before:6,after:4,silences:2,found:2,saved:2,timing:'clips'}};
const sv=await ana('video-brand-save',body);assert.equal(sv.status,200,JSON.stringify(sv.data));
const saved=JSON.parse(h.sqlite.prepare('SELECT brief FROM video_edits WHERE id=?').get(edit).brief).brand;
assert.equal(saved.style.stickers.length,2);assert.equal(saved.style.titles[0].text,'ÉPISODE 2');assert.equal(saved.style.shift,0.3);assert.equal(saved.style.music.id,mid);
assert.deepEqual(saved.fullBase,[[0,6]]);assert.deepEqual(saved.cutBase,[[0,4]]);assert.equal(saved.stats.found,2);assert.equal(saved.stats.saved,2);assert.equal(saved.words[1].w,'erreurs.');
assert.equal((await ana('video-brand-save',{...body,style:{stickers:[{kind:'png',file_id:otherS}]}})).status,403,'sticker of another space refused');
assert.equal((await bea('video-brand-save',body)).status,403,'another creator cannot save this edit');
const foreignMusic=await ana('video-brand-save',{...body,style:{music:{id:'nope_123'}}});assert.equal(foreignMusic.data.style.music.id,null,'unknown music dropped');
// Ajouter une vidéo à un montage : seulement une vidéo de cet espace.
assert.equal((await ana('video-edit-add-clip',{edit_id:edit,file_id:beaClip})).status,403);
assert.equal((await bea('video-edit-add-clip',{edit_id:edit,file_id:beaClip})).status,403);
const add=await ana('video-edit-add-clip',{edit_id:edit,file_id:clip2});assert.equal(add.status,200);assert.deepEqual(add.data.clips,[clip,clip2]);
assert.deepEqual((await ana('video-edit-add-clip',{edit_id:edit,file_id:clip2})).data.clips,[clip,clip2],'no duplicate clip');
// « Enregistrer comme mon style » : seulement si l'agence l'a activé.
assert.equal((await ana('video-style-save-own',{client_id:cr.id,style:{font:'serif'}})).status,403,'off by default');
assert.equal((await ana('video-editor-access',{client_id:cr.id,creatorStyleEditable:true})).status,403,'only the agency changes access');
assert.equal((await h.call('video-editor-access',{client_id:cr.id,creatorStyleEditable:true,advancedEditor:false})).status,200);
const own=await ana('video-style-save-own',{client_id:cr.id,style:{font:'serif',hook:{text:'Pas dans le style'},stickers:[{kind:'emoji',char:'🔥'}]}});assert.equal(own.status,200,JSON.stringify(own.data));
assert.equal(own.data.style.font,'serif');assert.equal(own.data.style.hook.text,'');assert.equal(own.data.style.stickers.length,0,'saved style is a template');
assert.equal((await bea('video-style-save-own',{client_id:cr.id,style:{}})).status,403,'never another space');
assert.equal((await bea('video-style-save-own',{client_id:cr2.id,style:{}})).status,403,'access is per creator');
assert.equal((await bob('video-style-save-own',{client_id:brand.id,style:{}})).status,403,'brands never save their own style');
assert.equal((await h.call('video-editor-access',{client_id:brand.id,advancedEditor:true})).status,200);
assert.equal((await bob('state?client='+brand.id)).data.clients[0].config.advancedEditor,true,'brand sees the advanced link flag');
const as=(await h.call('state?client='+cr.id)).data.clients.find(x=>x.id===cr.id);assert.equal(as.config.creatorStyleEditable,true);assert.equal(as.config.videoStyle.font,'serif');
assert.ok(h.sqlite.prepare("SELECT * FROM audit WHERE action='video_editor_access_updated'").get());
console.log('video editor OK');
