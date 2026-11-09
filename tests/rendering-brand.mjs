// Rendu réel du montage des marques avec le moteur WebAssembly livré :
// analyse audio + silences, coupe, zoom, sous-titres mot à mot avec polices embarquées, hook, musique atténuée sous la voix.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {analysisAudioArgs,silenceArgs,segmentArgs,joinArgs,brandASS,brandFinishArgs,fontsFor} from '../lib/video-render.mjs';
import {parseSilences,speechSilences,silencesToKeeps,keptDuration,remapWords,sourceTime,buildPlan} from '../lib/video-timing.mjs';
import {sanitizeStyle,applyIntent} from '../lib/video-style.mjs';
import {sfxEvents} from '../lib/video-render.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'louvet-brand-'));
const native=(args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:dir,stdio:'pipe'});
// Rush 1 : 2 s de son, 1,5 s de silence, 2,5 s de son. Rush 2 : vertical, sans son.
native(['-f','lavfi','-i','testsrc2=size=320x240:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6','-filter_complex',"[1:a]volume='if(between(t,2,3.5),0,1)':eval=frame[a]",'-map','0:v','-map','[a]','-t','6','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-f','mp4','source-0']);
native(['-f','lavfi','-i','color=c=#19352d:size=240x320:rate=30','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-f','mp4','source-1']);
native(['-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','1','-c:a','libmp3lame','music.mp3']);
globalThis.self={location:{href:'file:///ffmpeg-core.js'}};
const create=(await import('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js')).default;
const ff=await create({wasmBinary:fs.readFileSync(new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',import.meta.url))});
const logs=[];ff.setLogger(x=>logs.push(x.message));
function run(args,probe=false){ff.setTimeout(180000);(probe?ff.ffprobe:ff.exec)(...args);const code=ff.ret;ff.reset();if(!probe)assert.equal(code,0,logs.slice(-15).join('\n'))}
for(const f of ['source-0','source-1'])ff.FS.writeFile(f,fs.readFileSync(path.join(dir,f)));ff.FS.writeFile('music',fs.readFileSync(path.join(dir,'music.mp3')));
const clips=[];for(let i=0;i<2;i++){run(['-v','error','-show_streams','-show_format','-of','json','-o','meta.json','source-'+i],true);const p=JSON.parse(ff.FS.readFile('meta.json',{encoding:'utf8'}));clips.push({duration:Number(p.format.duration),audio:p.streams.some(s=>s.codec_type==='audio')})}
const total=clips.reduce((n,c)=>n+c.duration,0);
// Analyse : piste légère + silences.
run(analysisAudioArgs(clips));const mp3=ff.FS.readFile('analysis.mp3');assert.ok(mp3.length>1000&&mp3.length<200000,'light analysis track');
logs.length=0;run(silenceArgs());const silences=parseSilences(logs.join('\n'),total);
assert.ok(silences.some(([s,e])=>s>1.8&&s<2.3&&e>3.3&&e<3.8),'detected the 1.5 s silence: '+JSON.stringify(silences));
const keeps=silencesToKeeps(speechSilences(silences,clips),total);assert.ok(keptDuration(keeps)<total-1,'silence cut from the video');assert.ok(keptDuration(keeps)>total-2,'silent B-roll is kept');
// Mots (temps des rushes) → temps final.
const src=[['Notre',0.2,0.6],['pain',0.7,1.1],['au',1.2,1.4],['levain.',1.5,1.9],['Venez',3.7,4.2],['goûter',4.3,4.9],['!',5.0,5.2]].map(([w,s,e],i)=>({w,s,e,oi:i}));
const words=remapWords(src,keeps);assert.equal(words.length,7);
let style=sanitizeStyle({font:'sans',animation:'word',hook:{text:'Le vrai levain',font:'serif'},outro:{text:'dupain.mx'},wordStyles:{'3':'yellow','5':'script'},music:{id:'m'}});
style=applyIntent(style,'dynamic');
const plan=buildPlan(keeps,clips.map(c=>c.duration),clips.map(c=>c.audio),style,words.map(w=>({...w,s:sourceTime(keeps,w.s),e:sourceTime(keeps,w.e)})));
assert.ok(plan.some(p=>p.zoom>1),'zoom on strong words');assert.ok(plan.some(p=>!p.audio),'silent rush handled');
const settings={format:'9:16',transition:'cut',originalAudio:true};
plan.forEach((p,i)=>run(segmentArgs({...p,fill:true},i,settings)));
ff.FS.writeFile('shots.txt',plan.map((_,i)=>`file 'shot-${i}.mp4'`).join('\n'));run(joinArgs());
const duration=keptDuration(keeps);
ff.FS.writeFile('words.ass',brandASS(words,style,{format:'9:16',duration}));ff.FS.mkdir('fonts');
for(const f of fontsFor(style))ff.FS.writeFile('fonts/'+f,fs.readFileSync(new URL('../public/media-engine/fonts/'+f,import.meta.url)));
logs.length=0;run(['-loglevel','verbose',...brandFinishArgs({subtitles:true,voice:false,music:true,duck:true,musicVolume:style.music.volume,duration})]);
const joined=logs.join('\n');assert.doesNotMatch(joined,/fontselect: failed|Glyph 0x[0-9A-F]+ not found/i,'bundled fonts used');for(const name of ['Inter','DM Serif Display','Caveat'])assert.match(joined,new RegExp('fontselect: \\('+name),'libass loaded '+name);
const out=ff.FS.readFile('final.mp4');fs.writeFileSync(path.join(dir,'brand.mp4'),out);
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(dir,'brand.mp4')]).toString());
const v=probe.streams.find(s=>s.codec_type==='video');assert.equal(v.codec_name,'h264');assert.equal(`${v.width}x${v.height}`,'540x960');assert.ok(probe.streams.some(s=>s.codec_type==='audio'));
assert.ok(Math.abs(Number(probe.format.duration)-duration)<0.35,`duration ${probe.format.duration} vs ${duration}`);
// Images de contrôle : hook (0,5 s) et mot surligné.
native(['-ss','0.5','-i','brand.mp4','-frames:v','1','hook.png']);native(['-ss',String(Math.max(0.1,words[3].s+0.1)),'-i','brand.mp4','-frames:v','1','word.png']);
// Éditeur complet : sticker PNG transparent + titre + bruitages, dans le même moteur.
native(['-f','lavfi','-i','color=c=red@1:size=128x128,format=rgba,geq=r=255:g=0:b=0:a=255','-frames:v','1','sticker.png']);
const fx=sanitizeStyle({...style,stickers:[{kind:'png',file_id:'s1',x:0.5,y:0.5,size:0.3,s:0.2,e:duration-0.2,sfx:true}],titles:[{text:'ÉPISODE 2',x:0.5,y:0.2,s:0,e:duration,sfx:true}],sfxKind:'pop',sfxVolume:0.8});
ff.FS.writeFile('words.ass',brandASS(words,fx,{format:'9:16',duration}));ff.FS.writeFile('sticker-0.png',fs.readFileSync(path.join(dir,'sticker.png')));
for(const f of fontsFor(fx))ff.FS.writeFile('fonts/'+f,fs.readFileSync(new URL('../public/media-engine/fonts/'+f,import.meta.url)));
logs.length=0;run(['-loglevel','verbose',...brandFinishArgs({subtitles:true,voice:false,music:true,duck:true,musicVolume:fx.music.volume,duration,dims:[540,960],stickers:fx.stickers,sfx:{events:sfxEvents(fx),kind:fx.sfxKind,volume:fx.sfxVolume}})]);
assert.match(logs.join('\n'),/fontselect: \(Anton/,'title font loaded');
fs.writeFileSync(path.join(dir,'editor.mp4'),ff.FS.readFile('final.mp4'));
native(['-ss','1','-i','editor.mp4','-frames:v','1','-vf','crop=20:20:260:470,scale=1:1','-f','rawvideo','-pix_fmt','rgb24','center.rgb']);
const [r,g,b]=fs.readFileSync(path.join(dir,'center.rgb'));assert.ok(r>180&&g<90&&b<90,'sticker visible at the center: '+[r,g,b]);
native(['-ss','1','-i','editor.mp4','-frames:v','1','editor.png']);
const ep=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(dir,'editor.mp4')]).toString());assert.ok(Math.abs(Number(ep.format.duration)-duration)<0.35);assert.ok(ep.streams.some(s=>s.codec_type==='audio'));
console.log('PASS: editor render — PNG sticker overlay, title (Anton), synthesized SFX ('+sfxEvents(fx).length+' events).');
console.log('PASS: real WebAssembly brand render — silence detection and cut ('+total.toFixed(1)+' s → '+duration.toFixed(1)+' s), zooms, vertical fill, word-timed ASS with bundled Inter/DM Serif/Caveat, hook, outro, ducked music, H.264/AAC 540x960.');
console.log('QA artifacts:',dir);
