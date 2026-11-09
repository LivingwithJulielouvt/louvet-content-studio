// « Importer mon site » : lecture sécurisée (SSRF), extraction (couleurs, polices, produits JSON-LD, réseaux), application.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {readyHarness as harness,originalPath} from './harness.mjs';
import {isBlockedIp,normalizeSiteUrl,safeFetch,extractPage,colorsFrom,fontsFrom,readSite} from '../lib/site-import.mjs';

// ---- Adresses interdites ----
for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','172.31.255.255','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','255.255.255.255','::1','::','fe80::1','fc00::1','fd12::1','::ffff:127.0.0.1','::ffff:7f00:1','::ffff:a9fe:a9fe','64:ff9b::7f00:1','2002:7f00:1::','ff02::1','nonsense'])assert.ok(isBlockedIp(ip),ip);
for(const ip of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111','172.32.0.1'])assert.ok(!isBlockedIp(ip),ip);
// ---- Adresses saisies ----
assert.equal(normalizeSiteUrl('monsite.com'),'https://monsite.com/');
assert.equal(normalizeSiteUrl('https://www.monsite.com/fr#top'),'https://www.monsite.com/fr');
for(const bad of ['http://monsite.com','ftp://monsite.com','https://user:pw@monsite.com','https://127.0.0.1','https://[::1]/','https://localhost','https://imprimante.local','https://monsite.com:8443','https://intranet','javascript:alert(1)',''])assert.equal(normalizeSiteUrl(bad),null,bad);

// ---- Lecture : serveur local (http seulement pour le test), DNS simulé ----
const big='x'.repeat(1.6*1024*1024);
const HOME=`<!doctype html><html><head><title>Atelier Exemple | Bougies</title><meta name="description" content="Bougies coulées à la main à Lyon.">
<meta property="og:image" content="/og.png"><meta name="theme-color" content="#C46A3B"><link rel="stylesheet" href="/style.css">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter&display=swap" rel="stylesheet">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Atelier Exemple","sameAs":["https://www.instagram.com/atelier.exemple/","https://www.facebook.com/sharer/sharer.php?u=x"]},{"@type":"Product","name":"Bougie Figue","description":"Cire de soja, 200 g","offers":{"@type":"Offer","price":"24","priceCurrency":"EUR"}}]}</script>
<style>body{color:#2B2B2B;background:#FFFFFF} .btn{background:#C46A3B} h1{color:#c46a3b}</style></head>
<body><a href="/a-propos">À propos</a><a href="/boutique">Boutique</a><a href="https://autre-site.com/products">ailleurs</a><a href="https://www.tiktok.com/@atelier">TikTok</a><h1>Bienvenue</h1><script>var secret=1</script><p>Des bougies naturelles.</p></body></html>`;
const pages={'/':[200,'text/html; charset=utf-8',HOME],'/style.css':[200,'text/css','.h{font-family:"Lora",serif;color:#3D5A40}.x{color:#3d5a40}'],'/a-propos':[200,'text/html','<p>Fondé en 2019 par deux amies.</p><script type="application/ld+json">{"@type":"Product","name":"Bougie Ambre","offers":{"price":30,"priceCurrency":"EUR"}}</script>'],'/boutique':[200,'text/html','<p>Boutique</p>'],'/big':[200,'text/html',big],'/pdf':[200,'application/pdf','%PDF'],'/redir-private':[302,'text/html','',{location:'http://internal.test/admin'}],'/loop':[302,'text/html','',{location:'/loop'}],'/slow':[200,'text/html','SLOW'],'/err':[500,'text/html','oops'],'/nolen':[200,'text/html',null]};
const server=http.createServer((req,res)=>{const p=pages[req.url];if(!p){res.writeHead(404);return res.end()}if(p[2]==='SLOW')return;const [code,type,body,extra]=p;if(body===null){res.writeHead(200,{'content-type':'text/html'});let n=0;const t=setInterval(()=>{res.write('y'.repeat(256*1024));if(++n>8){clearInterval(t);res.end()}},1);return}res.writeHead(code,{'content-type':type,...(extra||{})});res.end(body)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const publicLookup=(h,o,cb)=>{const done=typeof o==='function'?o:cb;if(h==='internal.test')return done(null,[{address:'10.0.0.5',family:4}]);done(null,[{address:'127.0.0.1',family:4}])};
// Le serveur de test écoute sur 127.0.0.1 : on ne bloque que les adresses qui ne sont pas lui, pour simuler un site public.
const opts={allowHttp:true,request:http.request,lookup:publicLookup,blocked:(ip)=>ip!=='127.0.0.1'&&isBlockedIp(ip),timeout:800};
const U=(p)=>`http://site.test:${port}${p}`;
const err=async(p,status,o=opts)=>{let e=null;try{await safeFetch(U(p),{opts:o})}catch(x){e=x}assert.ok(e,'should fail '+p);assert.equal(e.status,status,p+' '+e.message)};
// https obligatoire en vrai
try{await safeFetch(U('/'));assert.fail()}catch(e){assert.equal(e.status,400)}
await err('/redir-private',400);await err('/loop',400);await err('/big',413);await err('/nolen',413);await err('/pdf',415);await err('/err',502);await err('/slow',504);
// DNS qui renvoie une adresse privée : refusé à la connexion
try{await safeFetch(U('/'),{opts:{...opts,blocked:isBlockedIp}});assert.fail()}catch(e){assert.equal(e.status,400)}
const ok=await safeFetch(U('/'),{opts});assert.match(ok.text,/Atelier Exemple/);

// ---- Extraction ----
const page=extractPage(HOME,'https://atelier.example/');
assert.equal(page.name,'Atelier Exemple');assert.equal(page.description,'Bougies coulées à la main à Lyon.');assert.equal(page.image,'https://atelier.example/og.png');
assert.deepEqual(page.products,[{name:'Bougie Figue',description:'Cire de soja, 200 g',price:'24 EUR',image:''}]);
assert.deepEqual([...page.socials].sort(),['https://www.instagram.com/atelier.exemple','https://www.tiktok.com/@atelier']);
assert.deepEqual(page.links,['https://atelier.example/a-propos','https://atelier.example/boutique'],'same-origin pages only');
assert.ok(!page.text.includes('secret'),'no script text');
assert.deepEqual(colorsFrom('a{color:#fff;background:#C46A3B}b{color:#c46a3b;border:1px solid rgb(61,90,64)}','#C46A3B'),['#C46A3B','#3D5A40']);
assert.deepEqual(fontsFrom('h{font-family:"Lora",serif}',HOME),['Lora','Playfair Display','Inter']);
const site=await readSite(U('/'),opts);
assert.equal(site.products.length,2,'products from internal pages too');assert.ok(site.colors.includes('#3D5A40'),'linked stylesheet read');assert.ok(site.fonts.includes('Lora'));
server.close();

// ---- Parcours : lecture, application, agence ----
const SITE={url:'https://atelier.example/',name:'Atelier Exemple',title:'Atelier Exemple',description:'Bougies coulées à la main.',image:'https://atelier.example/og.png',colors:['#C46A3B','#3D5A40'],fonts:['Lora'],products:[{name:'Bougie Figue',description:'Cire de soja',price:'24 EUR',image:''},{name:'Bougie Ambre',description:'',price:'30 EUR',image:''}],socials:['https://www.instagram.com/atelier.exemple'],text:'Bougies naturelles faites main.'};
const h=harness(async(url)=>{if(String(url).endsWith('/responses'))return new Response(JSON.stringify({output_text:JSON.stringify({tagline:'La lumière faite main',tone:'Chaleureux et simple',pillars:['Fabrication','Ambiance','Conseils'],products:[{name:'Coffret découverte',description:'Trois mini bougies'}]})}),{status:200});throw new Error('no network')}),call=h.call;
h.env.SITE_READ=async(u)=>({...SITE,url:u});h.env.SITE_IMAGE=async()=>({bytes:new Uint8Array(fs.readFileSync(originalPath)),mime:'image/png'});
await call('state');const [a,b]=(await call('seed',{})).data.clients;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);assert.equal((await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})).status,200)}
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local');
assert.equal((await alice('site-import',{client_id:a.id,url:'http://atelier.example'})).status,400);
assert.equal((await alice('site-import',{client_id:a.id,url:'https://10.0.0.1'})).status,400);
assert.equal((await bob('site-import',{client_id:a.id,url:'atelier.example'})).status,403);
let r=await alice('site-import',{client_id:a.id,url:'atelier.example'});assert.equal(r.status,200,JSON.stringify(r.data));const imp=r.data.import;
assert.equal(imp.tagline,'La lumière faite main');assert.deepEqual(imp.pillars,['Fabrication','Ambiance','Conseils']);assert.equal(imp.products.length,3,'site + AI products');assert.equal(imp.ai,true);
let st=(await alice('state')).data;assert.equal(st.siteImports[0].id,imp.id);assert.equal((await bob('state')).data.siteImports.length,0);
assert.equal((await bob('site-import-apply',{id:imp.id,products:[0]})).status,403);
const before=h.sqlite.prepare('SELECT COUNT(*) n FROM products WHERE client_id=?').get(a.id).n;
r=await alice('site-import-apply',{id:imp.id,products:[0,1,99,-1,'x'],image:true,suggest:{tone:true,colors:true,pillars:true}});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(r.data.products.length,2);assert.ok(r.data.image);assert.equal(r.data.suggested,true);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM products WHERE client_id=?').get(a.id).n,before+2);
const photo=h.sqlite.prepare('SELECT * FROM files WHERE id=?').get(r.data.image);assert.equal(photo.client_id,a.id);assert.equal(photo.product_id,r.data.products[0]);assert.equal(photo.purpose,'original');
assert.equal((await alice('site-import-apply',{id:imp.id,products:[2]})).status,409,'applied once');
assert.ok(h.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE client_id='__agency__' AND message LIKE 'Site importé pour%'").get().n>=1,'agency notified');
// Le profil de marque n'est changé que par l'agence.
assert.equal((await alice('site-import-agency-apply',{id:imp.id})).status,403);
assert.equal((await call('site-import-agency-apply',{id:imp.id})).status,200);
const cfg=JSON.parse(h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(a.id).config);assert.equal(cfg.tone,'Chaleureux et simple');assert.equal(cfg.colors,'#C46A3B, #3D5A40');assert.deepEqual(cfg.contentPillars,['Fabrication','Ambiance','Conseils']);
assert.equal((await call('site-import-agency-apply',{id:imp.id})).status,409);
// Sans IA : extraction seule.
h.env.AI_GENERATION_ENABLED='false';r=await alice('site-import',{client_id:a.id,url:'atelier.example'});assert.equal(r.data.import.ai,false);assert.equal(r.data.import.tagline,'Bougies coulées à la main.');assert.deepEqual(r.data.import.pillars,[]);h.env.AI_GENERATION_ENABLED='true';
// Limite : 5 lectures par jour.
for(let i=2;i<5;i++)assert.equal((await alice('site-import',{client_id:a.id,url:'atelier.example'})).status,200);
assert.equal((await alice('site-import',{client_id:a.id,url:'atelier.example'})).status,429);
assert.ok(h.sqlite.prepare('SELECT COUNT(*) n FROM site_imports WHERE client_id=?').get(a.id).n<=10);
console.log('site-import OK — adresses privées/IPv6/redirection refusées, https, taille, type, délai, extraction (couleurs, polices, JSON-LD, réseaux, pages internes), application cloisonnée, agence seule sur le profil, sans IA, limite quotidienne');
