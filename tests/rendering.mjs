import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readyHarness as harness} from './harness.mjs';
import {renderSettings,checkRender,planShots,segmentArgs,joinArgs,finishArgs,subtitleASS,autoSubtitleSRT} from '../lib/video-render.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'louvet-montage-'));
const native=(args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:dir,stdio:'pipe'});
native(['-f','lavfi','-i','testsrc2=size=320x240:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-f','mp4','source-0']);
native(['-f','lavfi','-i','color=c=#19352d:size=240x320:rate=30','-t','4','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-f','mp4','source-1']);
native(['-f','lavfi','-i','color=c=#edac61:size=120x80','-frames:v','1','-threads','1','logo.png']);
native(['-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','1','music.wav']);
globalThis.self={location:{href:'file:///ffmpeg-core.js'}};
const create=(await import('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js')).default;
const ff=await create({wasmBinary:fs.readFileSync(new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',import.meta.url))});
const logs=[];ff.setLogger(x=>logs.push(x.message));
function run(args,probe=false){ff.setTimeout(120000);(probe?ff.ffprobe:ff.exec)(...args);const code=ff.ret;ff.reset();if(!probe)assert.equal(code,0,logs.slice(-15).join('\n'))}
for(const f of ['source-0','source-1','logo.png'])ff.FS.writeFile(f,fs.readFileSync(path.join(dir,f)));ff.FS.writeFile('music',fs.readFileSync(path.join(dir,'music.wav')));
ff.FS.writeFile('DejaVuSans.ttf',fs.readFileSync(new URL('../public/media-engine/DejaVuSans.ttf',import.meta.url)));
const settings=renderSettings({format:'9:16',duration:15,subtitles:true,style:{config:{shotSeconds:3,transition:'fade',logoMode:'client_logo',music:'agency_approved'}}});
assert.throws(()=>checkRender(settings,{}),/SRT/);assert.throws(()=>checkRender({...settings,transition:'crossfade'},{}),/enchaîné/);checkRender(settings,{subtitles:true,logo:true,music:true});
const metadata=[];for(let i=0;i<2;i++){run(['-v','error','-show_streams','-show_format','-of','json','-o','meta.json','source-'+i],true);const p=JSON.parse(ff.FS.readFile('meta.json',{encoding:'utf8'}));metadata.push({duration:Number(p.format.duration),audio:p.streams.some(s=>s.codec_type==='audio')})}
const shots=planShots(metadata,settings);assert.equal(shots.length,4);assert.equal(shots.reduce((n,s)=>n+s.duration,0),8);assert.equal(metadata[1].audio,false);
for(let i=0;i<shots.length;i++)run(segmentArgs(shots[i],i,settings));
ff.FS.writeFile('shots.txt',shots.map((_,i)=>`file 'shot-${i}.mp4'`).join('\n'));run(joinArgs());
ff.FS.writeFile('words.ass',subtitleASS('1\n00:00:00,000 --> 00:00:03,000\nTest de montage Louvet\n\n2\n00:00:03,000 --> 00:00:07,000\nVersion finale automatique\n',settings));run(finishArgs(settings));
const output=ff.FS.readFile('final.mp4');assert.ok(output.length>1024);fs.writeFileSync(path.join(dir,'final.mp4'),output);
// Voix off (MP3 généré) + sous-titres automatiques + musique atténuée, avec le vrai moteur.
native(['-f','lavfi','-i','sine=frequency=330:sample_rate=24000','-t','5','-c:a','libmp3lame','-q:a','6','voice.mp3']);ff.FS.writeFile('voice.mp3',fs.readFileSync(path.join(dir,'voice.mp3')));
ff.FS.writeFile('words.ass',subtitleASS(autoSubtitleSRT('Notre bougie ambrée est coulée à la main. Commandez-la dès aujourd’hui.',5),settings));run(finishArgs({...settings,voice:true}));
{const v=ff.FS.readFile('final.mp4');fs.writeFileSync(path.join(dir,'final-voice.mp4'),v);const pv=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','final-voice.mp4'],{cwd:dir,encoding:'utf8'}));assert.ok(pv.streams.some(x=>x.codec_name==='aac'),'voice mix keeps an AAC track');assert.ok(Math.abs(Number(pv.format.duration)-8)<0.25,'voice is padded/trimmed to the video length')}
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','final.mp4'],{cwd:dir,encoding:'utf8'}));
const video=probe.streams.find(x=>x.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,540);assert.equal(video.height,960);assert.ok(probe.streams.some(x=>x.codec_name==='aac'));assert.ok(Math.abs(Number(probe.format.duration)-8)<0.25);
native(['-ss','1','-i','final.mp4','-frames:v','1','-threads','1','frame.png']);
const h=harness(()=>{throw new Error('Browser render must not call AI')});await h.call('state');const a=(await h.call('clients',{name:'Montage test',config:{allowedEmails:['alice@test.local']}})).data,b=(await h.call('clients',{name:'Other',config:{allowedEmails:['bob@test.local']}})).data;await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
function form(cid){const f=new FormData();f.set('client_id',cid);f.set('file',new File([fs.readFileSync(path.join(dir,'source-0'))],'rush.mp4',{type:'video/mp4'}));return f}
const clip=(await h.call('video-upload',form(a.id),'alice','alice@test.local')).data.id;
const edit=(await h.call('video-request',{client_id:a.id,clips:[clip],format:'9:16',duration:15,subtitles:false,request_key:'real-browser-render-1'},'alice','alice@test.local')).data.id;
assert.equal((await h.call('video-render-start',{edit_id:edit},'bob','bob@test.local')).status,403);
const attempts=await Promise.all([h.call('video-render-start',{edit_id:edit},'alice','alice@test.local'),h.call('video-render-start',{edit_id:edit},'alice','alice@test.local')]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);const job=attempts.find(r=>r.status===200).data;
function resultForm(id,bytes=output){const f=new FormData();f.set('render_id',id);f.set('file',new File([bytes],'final.mp4',{type:'video/mp4'}));return f}
assert.equal((await h.call('video-render-result',resultForm(job.id),'bob','bob@test.local')).status,403);assert.equal((await h.call('video-render-result',resultForm(job.id,new Uint8Array(2048)),'alice','alice@test.local')).status,400);
const saved=await h.call('video-render-result',resultForm(job.id),'alice','alice@test.local');assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.status,'review');assert.notEqual((await h.call('video-render-result',resultForm(job.id),'alice','alice@test.local')).status,200,'second result for same render is refused');
assert.equal((await h.call('file/'+saved.data.id,null,'bob','bob@test.local')).status,403);assert.equal((await h.call('video-render-start',{edit_id:edit},'alice','alice@test.local')).status,409);
const next=(await h.call('video-render-start',{edit_id:edit,new_version:true},'alice','alice@test.local')).data;const second=await h.call('video-render-result',resultForm(next.id),'alice','alice@test.local');assert.equal(second.status,200);assert.notEqual(second.data.id,saved.data.id);assert.equal((await h.call('file/'+saved.data.id,null,'alice','alice@test.local')).status,200);assert.equal(h.sqlite.prepare('SELECT quota_used FROM clients WHERE id=?').get(a.id).quota_used,0);
console.log('PASS: actual shipped WebAssembly engine rendered 8s MP4 H.264/AAC, mixed horizontal/vertical rushes, missing audio, fades, SRT captions, logo and music, AI voiceover mix with auto subtitles; tenant isolation, concurrent render claim, invalid result rejection, idempotent save, preserved versions, no AI calls.');
console.log('QA artifacts:',dir);
