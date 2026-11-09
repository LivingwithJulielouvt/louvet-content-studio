// Rendu réel de 3 versions à tester avec le moteur WebAssembly livré (même enchaînement que renderBrand) :
// accroches différentes, styles de sous-titres, version courte, aperçu en ouverture, titre de couverture, musique.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {segmentArgs,joinArgs,brandASS,brandFinishArgs,fontsFor,dimensions,analysisAudioArgs,silenceArgs} from '../lib/video-render.mjs';
import {parseSilences,speechSilences,silencesToKeeps,keptDuration,remapWords,sourceTime,buildPlan,proportionalWords} from '../lib/video-timing.mjs';
import {sanitizeStyle} from '../lib/video-style.mjs';
import {buildRecipes,fillHooks,versionKeeps,versionStyle} from '../lib/test-versions.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'louvet-versions-'));
const native=(args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:dir,stdio:'pipe'});
// Source : 8 s avec une pause d'1,5 s ; musique d'une seconde (bouclée par le moteur).
native(['-f','lavfi','-i','testsrc2=size=320x240:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=8','-filter_complex',"[1:a]volume='if(between(t,3,4.5),0,1)':eval=frame[a]",'-map','0:v','-map','[a]','-t','8','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-f','mp4','source-0']);
native(['-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','1','-c:a','libmp3lame','music.mp3']);
globalThis.self={location:{href:'file:///ffmpeg-core.js'}};
const create=(await import('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js')).default;
const ff=await create({wasmBinary:fs.readFileSync(new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',import.meta.url))});
const logs=[];ff.setLogger(x=>logs.push(x.message));
function run(args,probe=false){ff.setTimeout(180000);(probe?ff.ffprobe:ff.exec)(...args);const code=ff.ret;ff.reset();if(!probe)assert.equal(code,0,logs.slice(-15).join('\n'))}
ff.FS.writeFile('source-0',fs.readFileSync(path.join(dir,'source-0')));ff.FS.writeFile('music',fs.readFileSync(path.join(dir,'music.mp3')));
run(['-v','error','-show_streams','-show_format','-of','json','-o','meta.json','source-0'],true);
const p=JSON.parse(ff.FS.readFile('meta.json',{encoding:'utf8'}));const clips=[{duration:Number(p.format.duration),audio:true}];const total=clips[0].duration;
run(analysisAudioArgs(clips));logs.length=0;run(silenceArgs());
const base=silencesToKeeps(speechSilences(parseSilences(logs.join('\n'),total),clips),total);
assert.ok(keptDuration(base)<total-1,'silence cut once for every version');
const words=proportionalWords('Voici mon pain au levain du matin, croustillant et doré. Venez le goûter !',keptDuration(base)).map(w=>({...w,s:sourceTime(base,w.s),e:sourceTime(base,w.e)}));
const ctx={hooks:fillHooks(['Le vrai levain'],3,{lang:'fr',subject:'le pain'}),music:['m1']};
const recipes=buildRecipes(3,['hook','subs','duration','start','cover','music'],ctx);
assert.equal(recipes.length,3);
const results=[];
for(const r of recipes){
  const t0=Date.now();
  const keeps=versionKeeps(base,total,r);
  const ws=remapWords(words.map((w,i)=>({...w,oi:i})),keeps);
  const style=sanitizeStyle(versionStyle(sanitizeStyle({}),r,'Pain du matin'));
  const plan=buildPlan(keeps,clips.map(c=>c.duration),clips.map(c=>c.audio),style,ws.map(w=>({...w,s:sourceTime(keeps,w.s),e:sourceTime(keeps,w.e)})));
  plan.forEach((x,i)=>run(segmentArgs({...x,fill:true},i,{format:'9:16',transition:'cut',originalAudio:true})));
  ff.FS.writeFile('shots.txt',plan.map((_,i)=>`file 'shot-${i}.mp4'`).join('\n'));run(joinArgs());
  const duration=Math.min(keptDuration(keeps),60);
  ff.FS.writeFile('words.ass',brandASS(ws,style,{format:'9:16',duration}));try{ff.FS.mkdir('fonts')}catch{}
  for(const f of fontsFor(style))ff.FS.writeFile('fonts/'+f,fs.readFileSync(new URL('../public/media-engine/fonts/'+f,import.meta.url)));
  run(brandFinishArgs({subtitles:true,voice:false,music:!!r.music,duck:true,musicVolume:style.music.volume,duration,stickers:[],dims:dimensions('9:16'),sfx:null}));
  const out=ff.FS.readFile('final.mp4');const file=path.join(dir,'version-'+r.label+'.mp4');fs.writeFileSync(file,out);
  for(const name of ff.FS.readdir('.'))if(/^shot-\d+\.mp4$/.test(name))ff.FS.unlink(name);
  const pr=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).toString());
  const v=pr.streams.find(s=>s.codec_type==='video');assert.equal(`${v.width}x${v.height}`,'540x960');assert.ok(pr.streams.some(s=>s.codec_type==='audio'));
  assert.ok(Math.abs(Number(pr.format.duration)-duration)<0.35,`version ${r.label}: ${pr.format.duration} vs ${duration}`);
  native(['-ss','0.6','-i',file,'-frames:v','1','-vf','scale=90:160','-f','rawvideo','-pix_fmt','gray','first-'+r.label+'.gray']);
  native(['-ss','0.6','-i',file,'-frames:v','1','first-'+r.label+'.png']);
  results.push({label:r.label,duration,hash:crypto.createHash('sha1').update(out).digest('hex'),frame:fs.readFileSync(path.join(dir,'first-'+r.label+'.gray')),ms:Date.now()-t0});
}
assert.equal(new Set(results.map(x=>x.hash)).size,3,'three distinct files');
const diff=(a,b)=>a.reduce((n,x,i)=>n+Math.abs(x-b[i]),0)/a.length;
assert.ok(diff(results[0].frame,results[1].frame)>2&&diff(results[0].frame,results[2].frame)>2,'opening frames differ (hook, subtitles, cover)');
const kept=keptDuration(base);assert.ok(Math.abs(results[1].duration-(kept*0.7+1.4))<0.05,'short cut (70 %) + 1.4 s highlight: '+results.map(x=>x.duration).join(' / '));
assert.ok(Math.abs(results[2].duration-(kept+1.4))<0.05,'full length + 1.4 s ending teaser');
assert.ok(Math.abs(results[0].duration-kept)<0.05,'version A keeps the base cut');
console.log('PASS: 3 real WebAssembly test versions — distinct files and opening frames, short cut ('+results.map(x=>x.label+' '+x.duration.toFixed(1)+' s').join(', ')+'), cover title, music; render '+results.map(x=>(x.ms/1000).toFixed(1)+' s').join(' / ')+'.');
console.log('QA artifacts:',dir);
