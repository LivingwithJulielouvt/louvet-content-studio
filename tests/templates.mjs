// Atelier « Modèles » : fonctions de mise en page (pures) + enregistrement des visuels côté serveur.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readyHarness as harness,photoForm} from './harness.mjs';
import {groupOrder,isTrendy,trendySlides,FORMATS,TEMPLATES,TEMPLATE_FONTS,contrastRatio,bestTextColor,passesContrast,readableAccent,paletteFrom,wrapText,fitText,splitCarousel,sanitizeTemplate,sanitizeTemplateSettings,orderedTemplates,serviceFirst,beforeAfterArgs,beforeAfterSize} from '../lib/templates.mjs';

// ---------- Fonctions pures ----------
assert.ok(Math.abs(contrastRatio('#000000','#FFFFFF')-21)<0.01);assert.equal(contrastRatio('#777','#777'),1);
assert.equal(bestTextColor('#1A1A1A'),'#FFFFFF');assert.equal(bestTextColor('#F6F1E9'),'#1A1A1A');
for(const bg of ['#F6F1E9','#1A1A1A','#B8291A','#2F4A3A','#F3D9D1','#FFD400','#0055FF','#7F7F7F'])assert.ok(passesContrast(bestTextColor(bg),bg),'auto text color is readable on '+bg);
assert.equal(passesContrast('#FFFFFF','#FFD400'),false,'white on yellow is flagged');
assert.equal(readableAccent('#F6F1E9','#FFFFFF','#1A1A1A'),'#1A1A1A','unreadable accent falls back to text color');
assert.deepEqual(paletteFrom({colors:'#abc, #B8291A; nope'}).slice(0,2),['#AABBCC','#B8291A']);
const measure=s=>s.length*10;
assert.deepEqual(wrapText('un deux trois quatre',110,measure),['un deux','trois','quatre']);
assert.deepEqual(wrapText('ligne\n\nautre',500,measure),['ligne','','autre'],'blank lines kept inside');
assert.ok(wrapText('anticonstitutionnellement',100,measure).every(l=>measure(l)<=100),'very long words are split');
const fit=fitText('Un texte assez long pour devoir passer sur plusieurs lignes',{maxWidth:300,maxHeight:200,maxSize:80,minSize:10},size=>s=>s.length*size*0.5);
assert.ok(fit.fits&&fit.lines.length*fit.size*1.18<=200&&fit.size<80,'fitText shrinks until it fits');
assert.equal(fitText('x',{maxWidth:300,maxHeight:200,maxSize:80},size=>s=>s.length*size*0.5).size,80,'short text keeps the max size');
assert.deepEqual(splitCarousel('Un.\n\nDeux.\n\nTrois.'),['Un.','Deux.','Trois.']);
assert.deepEqual(splitCarousel('A\n---\nB'),['A','B'],'--- separator');
assert.equal(splitCarousel('1.\n\n2.\n\n3.\n\n4.\n\n5.\n\n6.\n\n7.').length,5,'at most 5 content slides (6 with the cover)');
assert.ok(splitCarousel('Phrase un. Phrase deux. Phrase trois. Phrase quatre.').length>=2,'single block split by sentences');
assert.deepEqual(splitCarousel('   '),[]);
assert.equal(TEMPLATES.length,29);assert.equal(TEMPLATES.filter(t=>t.group==='trendy').length,15);assert.ok(TEMPLATES.find(t=>t.id==='review').requiresConsent);
for(const t of TEMPLATES){for(const l of [t.name,t.hint])assert.ok(l.fr&&l.es&&l.en,t.id+' trilingual');for(const f of t.fields)assert.ok(f.label.fr&&f.label.es&&f.label.en,t.id+'.'+f.key)}
assert.ok(!JSON.stringify(TEMPLATES.find(t=>t.id==='review').fields).match(/Super|Génial|Excellent/i),'no prefilled fake review');
for(const f of TEMPLATE_FONTS)assert.ok(fs.existsSync(new URL('../public/media-engine/fonts/'+f.file,import.meta.url)),'font file '+f.file);
for(const lic of ['playfair-display','lora','poppins','bebas-neue','dancing-script','space-grotesk'])assert.ok(fs.readFileSync(new URL(`../public/media-engine/fonts/OFL-${lic}.txt`,import.meta.url),'utf8').includes('SIL OPEN FONT LICENSE'),'OFL license '+lic);
assert.equal(orderedTemplates({})[0].group,'text');assert.equal(orderedTemplates({serviceBusiness:true})[0].group,'service');assert.ok(serviceFirst({sector:'wellness'}));
assert.ok(!orderedTemplates({hiddenTemplates:['quote']}).some(t=>t.id==='quote'));
// Montages photo tendance : d'abord pour les créatrices, à la fin pour les marques.
assert.deepEqual(groupOrder({workspaceType:'creator'}),['trendy','text','service']);assert.equal(orderedTemplates({workspaceType:'creator'})[0].group,'trendy');assert.equal(orderedTemplates({}).at(-1).group,'trendy');
for(const t of TEMPLATES.filter(x=>x.group==='trendy')){assert.ok(isTrendy(t.id));assert.ok(t.photos[0]>=1&&t.photos[1]>=t.photos[0],t.id+' photos');assert.ok(t.formats.length||t.carousel,t.id+' format');assert.ok(TEMPLATE_FONTS.some(f=>f.id===t.font),t.id+' font');for(const f of t.fields)if(f.placeholder){assert.ok(!/^\[/.test(f.placeholder.fr),t.id+'.'+f.key+' has a real default (nothing to fill in)')}}
let tr=sanitizeTemplate({id:'t-film',photos:['photo-a1','photo-b2','photo-c3'],format:'1:1',crops:[{x:9,y:-9,z:0.2},{x:'a'},null,{x:0},{x:0}],filter:'sepia',carousel:true,slide:7});
assert.equal(tr.format,'4:5','carousel slides are 4:5');assert.equal(tr.carousel,true);assert.equal(tr.slide,0,'slide beyond the 2 slides refused');assert.equal(tr.filter,'none');
assert.deepEqual(tr.crops.slice(0,3),[{x:1,y:-1,z:1},{x:0,y:0,z:1},{x:0,y:0,z:1}]);assert.equal(tr.crops.length,4,'crops capped to the max photo count');
assert.equal(trendySlides(tr),2);assert.equal(trendySlides({...tr,carousel:false}),1);
tr=sanitizeTemplate({id:'t-film',photos:['photo-a1','photo-b2','photo-c3'],format:'1:1',filter:'film'});assert.equal(tr.format,'9:16','square not offered: story by default');assert.equal(tr.carousel,false);assert.equal(tr.filter,'film');
assert.equal(sanitizeTemplate({id:'t-pano',photos:['photo-a1'],format:'9:16',slide:2}).carousel,true,'panorama is always a carousel');assert.equal(sanitizeTemplate({id:'t-pano',photos:['photo-a1'],slide:2}).slide,2);
assert.throws(()=>sanitizeTemplate({id:'t-dump',photos:['photo-a1','photo-b2']}),/photos/,'photo dump needs 4 photos');
assert.equal(sanitizeTemplate({id:'quote',carousel:true,crops:[{x:1}]}).crops,undefined,'classic templates untouched');
assert.throws(()=>sanitizeTemplate({id:'nope'}),/Modèle inconnu/);
assert.throws(()=>sanitizeTemplate({id:'review',fields:{quote:'x'}}),/vrai avis/);
assert.throws(()=>sanitizeTemplate({id:'beforeAfter',photos:['photo-aaaa']}),/photos/);
const st=sanitizeTemplate({id:'quote',fields:{text:'x'.repeat(999),evil:'<script>'},format:'7:3',bg:'red',font:'comic',scale:9,photos:['abcdef1']});
assert.equal(st.fields.text.length,220);assert.equal(st.fields.evil,undefined);assert.equal(st.format,'4:5');assert.equal(st.bg,'#F6F1E9');assert.equal(st.font,'playfair');assert.equal(st.scale,1.3);assert.deepEqual(st.photos,[],'no photos on text templates');
assert.equal(sanitizeTemplate({id:'review',reviewConfirmed:true,fields:{stars:'9'}}).fields.stars,'5');
assert.deepEqual(sanitizeTemplateSettings({hiddenTemplates:['quote','x'],templateFont:'bad',templateBg:'#abcdef',serviceBusiness:'yes'}),{serviceBusiness:false,templateFont:null,templateBg:'#ABCDEF',templateAccent:null,templateHandle:'',templateLogo:null,hiddenTemplates:['quote']});
assert.deepEqual(beforeAfterSize('9:16'),{width:720,height:1280});assert.ok(beforeAfterArgs().join(' ').includes('blend=all_expr'));

// ---------- Serveur ----------
let aiMode='ok';const aiBodies=[];
const apiFetch=async(url,opts)=>{const b=JSON.parse(opts.body);aiBodies.push(b);if(aiMode==='fail')return new Response(JSON.stringify({error:{message:'boom'}}),{status:500});return new Response(JSON.stringify({output_text:JSON.stringify({text:'Le calme d’un intérieur propre.',author:'jamais utilisé'})}))};
const h=harness(apiFetch),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
for(const [client,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const c=(await call('state?client='+client.id)).data.clients.find(x=>x.id===client.id);await call('settings',{client_id:c.id,name:c.name,quota_limit:30,active:true,config:{...c.config,allowedEmails:[email]}})}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local'),bob=(p,body)=>call(p,body,'bob','bob@test.local');
// Fichier PNG minimal aux dimensions voulues (le serveur lit l'en-tête IHDR).
const fakePng=(w,hh,size=2000)=>{const u=new Uint8Array(size);u.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const v=new DataView(u.buffer);v.setUint32(16,w);v.setUint32(20,hh);return u};
async function design(who,cid,template,bytes=fakePng(1080,1350),kind='design',mime='image/png'){const intent=await who('upload-intent',{kind,client_id:cid,filename:'modele.png',mime,size:bytes.length,template});if(intent.status!==200)return intent;h.objects.set(intent.data.path,bytes);return who('upload-commit',{intent_id:intent.data.id})}
const sa=(await alice('state')).data,sb=(await bob('state')).data;
const pa=(await alice('upload',photoForm(a.id,sa.products[0].id))).data.id,pa2=(await alice('upload',photoForm(a.id,sa.products[0].id))).data.id,pb=(await bob('upload',photoForm(b.id,sb.products[0].id))).data.id;
// Image texte : modèle obligatoire, dimensions exactes, enregistrement + réouverture.
assert.equal((await design(alice,a.id,undefined)).status,400,'template required');
assert.equal((await design(alice,a.id,{id:'quote',fields:{text:'Bonjour'},format:'4:5'},fakePng(1080,1080))).status,400,'wrong size refused at commit');
assert.equal((await design(alice,a.id,{id:'quote',fields:{text:'Bonjour'}},new Uint8Array(3000),'design','image/gif')).status,400,'gif refused');
assert.equal((await design(alice,a.id,{id:'quote',fields:{text:'Bonjour'}},fakePng(1080,1350,9*1024*1024))).status,413,'too big');
const q=await design(alice,a.id,{id:'quote',fields:{text:'Le vrai luxe, c’est le temps.',author:'Julie'},format:'4:5',bg:'#2f4a3a',font:'lora',texture:true,handle:'@maison'});
assert.equal(q.status,200,JSON.stringify(q.data));
let s=(await alice('state')).data;const saved=s.designs.find(d=>d.id===q.data.id);
assert.equal(saved.kind,'image');assert.equal(saved.template.fields.text,'Le vrai luxe, c’est le temps.');assert.equal(saved.template.bg,'#2F4A3A');assert.equal(saved.template.font,'lora');assert.equal(saved.template.texture,true);
assert.ok(s.files.some(f=>f.id===q.data.id&&f.purpose==='design'&&f.mime==='image/png'),'appears with the client files (calendar picker)');
assert.ok(h.sqlite.prepare('SELECT key FROM files WHERE id=?').get(q.data.id).key.startsWith(a.id+'/designs/'),'private key in the client folder');
// Cloisonnement.
assert.equal((await bob('state')).data.designs.length,0);
assert.equal((await bob('file/'+q.data.id)).status,403,'another client cannot read it');
assert.notEqual((await bob('design-delete',{id:q.data.id})).status,200,'nor delete it');
assert.equal((await design(bob,a.id,{id:'quote',fields:{text:'x'}})).status,403,'cannot save into another space');
assert.equal((await design(alice,a.id,{id:'portfolio',photos:[pb]})).status,403,'photos of another client refused');
// Modèles avec photos.
assert.equal((await design(alice,a.id,{id:'beforeAfter',photos:[pa]})).status,400,'before/after needs 2 photos');
const ba=await design(alice,a.id,{id:'beforeAfter',photos:[pa,pa2],fields:{before:'Avant',after:'Après'},layout:'diagonal'});assert.equal(ba.status,200,JSON.stringify(ba.data));
assert.deepEqual((await alice('state')).data.designs.find(d=>d.id===ba.data.id).template.photos,[pa,pa2]);
const carousel=[];for(let i=0;i<3;i++){const r=await design(alice,a.id,{id:'carousel',fields:{title:'3 erreurs',text:'Un.\n\nDeux.'},slide:i,format:'1:1'},fakePng(1080,1080));assert.equal(r.status,200);carousel.push(r.data.id)}
// Montages tendance : photos de l'espace uniquement, story 1080×1920, carrousel slide par slide.
const pa3=(await alice('upload',photoForm(a.id,sa.products[0].id))).data.id;
assert.equal((await design(alice,a.id,{id:'t-polaroid',photos:[pa,pb],format:'9:16'},fakePng(1080,1920))).status,403,'another client photo refused in a trendy layout');
assert.equal((await design(alice,a.id,{id:'t-polaroid',photos:[pa,pa2],format:'9:16'},fakePng(1080,1350))).status,400,'story must be 1080x1920');
const pol=await design(alice,a.id,{id:'t-polaroid',photos:[pa,pa2],format:'9:16',crops:[{x:0.4,y:0,z:1.5}],filter:'film',fields:{caption:'le meilleur week-end'}},fakePng(1080,1920));assert.equal(pol.status,200,JSON.stringify(pol.data));
let savedTr=(await alice('state')).data.designs.find(d=>d.id===pol.data.id).template;assert.deepEqual(savedTr.crops[0],{x:0.4,y:0,z:1.5});assert.equal(savedTr.filter,'film');assert.equal(savedTr.format,'9:16');
const slidesTr=[];for(let i=0;i<2;i++){const r=await design(alice,a.id,{id:'t-scrap',photos:[pa,pa2,pa3],carousel:true,slide:i},fakePng(1080,1350));assert.equal(r.status,200,JSON.stringify(r.data));slidesTr.push(r.data.id)}
const st2=(await alice('state')).data.designs.filter(d=>slidesTr.includes(d.id)).map(d=>[d.template.carousel,d.template.slide]).sort();assert.deepEqual(st2,[[true,0],[true,1]]);
assert.equal((await design(bob,a.id,{id:'t-scrap',photos:[pa,pa2],carousel:true})).status,403,'trendy layouts are tenant-isolated');
assert.ok(!(await bob('state')).data.designs.some(d=>slidesTr.includes(d.id)));
// Éditeur à calques (créatrices) : photos de l'espace uniquement, format vérifié, diapos une par une, favoris cloisonnés.
const lay=(photos,o={})=>({id:'layers',from:'e-gridbubble',format:'4:5',slides:1,bg:{color:'#ffffff'},layers:photos.map((f,i)=>({type:'photo',id:'p'+i,x:270+i*10,y:400,w:540,h:675,file:f})).concat([{type:'bubble',id:'b',x:540,y:675,w:500,h:110,text:'Mon café préféré',sticker:'☕'},{type:'script',id:'bad'}].slice(0,o.bad?2:1)),...o});
assert.equal((await design(alice,a.id,lay([pa,pa2],{bad:true}))).status,400,'unknown layer type refused');
assert.equal((await design(alice,a.id,lay([pa,pb]))).status,403,'another client photo refused in a layered visual');
assert.equal((await design(alice,a.id,lay([pa],{bg:{photo:pb}}))).status,403,'background photo checked too');
assert.equal((await design(alice,a.id,lay([pa,pa2],{format:'9:16'}),fakePng(1080,1350))).status,400,'story size enforced');
const lv=await design(alice,a.id,lay([pa,pa2]));assert.equal(lv.status,200,JSON.stringify(lv.data));
let savedL=(await alice('state')).data.designs.find(d=>d.id===lv.data.id).template;assert.equal(savedL.id,'layers');assert.equal(savedL.from,'e-gridbubble');assert.equal(savedL.layers.find(l=>l.type==='bubble').sticker,'☕');assert.deepEqual(savedL.photos,[pa,pa2]);
const seam=[];for(let i=0;i<3;i++){const r=await design(alice,a.id,{...lay([pa,pa2,pa3]),from:'e-sl-polaroids',slides:3,slide:i});assert.equal(r.status,200,JSON.stringify(r.data));seam.push(r.data.id)}
assert.deepEqual((await alice('state')).data.designs.filter(d=>seam.includes(d.id)).map(d=>d.template.slide).sort(),[0,1,2],'seamless carousel saved slide by slide');
assert.equal((await design(bob,a.id,lay([pa]))).status,403,'layered visuals are tenant-isolated');
assert.equal((await alice('template-favorite',{client_id:a.id,template_id:'nope',on:true})).status,400,'unknown template');
assert.equal((await alice('template-favorite',{client_id:a.id,template_id:'e-five',on:true})).status,200);
let fav=await alice('template-favorite',{client_id:a.id,template_id:'e-notes',on:true});assert.deepEqual(fav.data.favorites,['e-notes','e-five'],'newest favorite first');
assert.equal((await bob('template-favorite',{client_id:a.id,template_id:'e-five',on:false})).status,403,'cannot change another space favorites');
assert.deepEqual((await alice('state')).data.clients[0].config.templateFavorites,['e-notes','e-five']);
fav=await alice('template-favorite',{client_id:a.id,template_id:'e-five',on:false});assert.deepEqual(fav.data.favorites,['e-notes']);
assert.equal((await bob('state')).data.clients[0].config.templateFavorites,undefined,'favorites stay private to the space');
// Avis client : la case « vrai avis » est exigée par le serveur.
assert.equal((await design(alice,a.id,{id:'review',fields:{quote:'Un service impeccable.',name:'Ana',stars:'5'}})).status,400,'review without consent refused');
assert.equal((await design(alice,a.id,{id:'review',fields:{quote:'Un service impeccable.',name:'Ana',stars:'5'},reviewConfirmed:true})).status,200);
// Vidéo avant / après (MP4 réel, format vérifié).
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'louvet-tpl-'));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=#336699:size=720x900:rate=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','v.mp4'],{cwd:dir});
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=#336699:size=720x720:rate=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p','sq.mp4'],{cwd:dir});
const mp4=new Uint8Array(fs.readFileSync(path.join(dir,'v.mp4'))),sq=new Uint8Array(fs.readFileSync(path.join(dir,'sq.mp4')));
assert.equal((await design(alice,a.id,{id:'quote',fields:{text:'x'}},mp4,'design-video','video/mp4')).status,400,'only before/after has a video');
assert.equal((await design(alice,a.id,{id:'beforeAfter',photos:[pa,pa2],format:'4:5'},sq,'design-video','video/mp4')).status,400,'video ratio checked');
const vid=await design(alice,a.id,{id:'beforeAfter',photos:[pa,pa2],format:'4:5'},mp4,'design-video','video/mp4');assert.equal(vid.status,200,JSON.stringify(vid.data));
s=(await alice('state')).data;assert.equal(s.designs.find(d=>d.id===vid.data.id).kind,'video');assert.ok(!s.files.some(f=>f.id===vid.data.id),'videos stay out of the photo list');
// Calendrier : l'agence peut programmer le visuel ; il ne peut alors plus être supprimé.
const post=await call('publication-save',{client_id:a.id,title:'Citation',date:'2026-11-20',platform:'Instagram',caption:'Légende',file_id:q.data.id});assert.equal(post.status,200,JSON.stringify(post.data));
assert.equal((await alice('design-delete',{id:q.data.id})).status,409,'scheduled visual protected');
const key=h.sqlite.prepare('SELECT key FROM files WHERE id=?').get(carousel[0]).key;
assert.equal((await alice('design-delete',{id:carousel[0]})).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(carousel[0]).n,0);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM designs WHERE id=?').get(carousel[0]).n,0);assert.ok(!h.objects.has(key),'storage object removed');
// Réglages de l'agence : modèles masqués, police, logo de l'espace uniquement.
assert.equal((await alice('template-settings',{client_id:a.id,hiddenTemplates:['quote']})).status,403,'agency only');
assert.equal((await call('template-settings',{client_id:a.id,templateLogo:pb})).status,403,'logo must belong to the client');
assert.equal((await call('template-settings',{client_id:a.id,hiddenTemplates:['quote'],serviceBusiness:true,templateFont:'bebas',templateLogo:pa,templateTextCost:2})).status,200);
const cfg=(await alice('state')).data.clients[0].config;assert.equal(cfg.serviceBusiness,true);assert.equal(cfg.templateFont,'bebas');assert.equal(cfg.templateLogo,pa);assert.equal(cfg.templateTextCost,2);
assert.equal((await design(alice,a.id,{id:'quote',fields:{text:'x'}})).status,403,'hidden template refused');
assert.equal((await call('template-settings',{client_id:a.id,templateTextCost:50})).status,400);
// « Écris-moi le texte » : coût configurable, jamais pour un avis, repli sans IA.
const used=()=>h.sqlite.prepare('SELECT quota_used n FROM clients WHERE id=?').get(a.id).n;
let before=used();aiBodies.length=0;
let r=await alice('template-text',{client_id:a.id,template_id:'quote',brief:'le ménage',language:'fr'});
assert.equal(r.status,200);assert.equal(r.data.generated,true);assert.equal(r.data.fields.text,'Le calme d’un intérieur propre.');assert.equal(r.data.fields.author,undefined,'author is never written by the studio');
assert.equal(used(),before+2,'templateTextCost charged');assert.match(aiBodies[0].input,/Never invent numbers, prices, discounts, reviews/);assert.deepEqual(aiBodies[0].text.format.schema.required,['text']);
assert.equal((await alice('template-text',{client_id:a.id,template_id:'review'})).status,400,'reviews are never written by the studio');
assert.equal((await alice('template-text',{client_id:b.id,template_id:'quote'})).status,403,'other space');
aiMode='fail';before=used();r=await alice('template-text',{client_id:a.id,template_id:'tip'});assert.equal(r.status,200);assert.equal(r.data.generated,false);assert.equal(used(),before,'refund on failure');
aiMode='ok';h.env.AI_GENERATION_ENABLED='false';aiBodies.length=0;before=used();r=await alice('template-text',{client_id:a.id,template_id:'tip'});
assert.equal(r.data.generated,false);assert.equal(aiBodies.length,0);assert.equal(used(),before,'manual fallback, no credit');
h.env.AI_GENERATION_ENABLED='true';await call('template-settings',{client_id:a.id,templateTextCost:0});before=used();await alice('template-text',{client_id:a.id,template_id:'tip'});assert.equal(used(),before,'free by default');
console.log('templates OK — éditeur à calques (types, photos cloisonnées, diapos, favoris), montages tendance (ordre créatrices, recadrage, carrousel, cloisonnement), mise en page, contraste, carrousel, enregistrement, réouverture, cloisonnement, avis vérifié, vidéo avant / après, réglages agence, texte IA facturé/remboursé/repli');
