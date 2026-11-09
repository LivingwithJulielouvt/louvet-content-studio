// Reels avec @withjulielouvet : un client déclare un Reel publié en collaboration, l'agence valide,
// la remise (2 € / 40 MXN / 2 USD selon le pays) est créditée sur le solde Stripe, une seule fois. Plafond mensuel.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {normalizeReelUrl,applyReelCredits} from '../lib/collabs.mjs';
import {reelCollabReward,reelCollabMaxPerMonth} from '../lib/pricing.mjs';
import {tenantTables} from '../lib/client-lifecycle.mjs';

// ---- Liens acceptés ----
assert.deepEqual(normalizeReelUrl('https://www.instagram.com/reel/C9abcDEF12/?igsh=xyz'),{shortcode:'C9abcDEF12',url:'https://www.instagram.com/reel/C9abcDEF12/'});
assert.equal(normalizeReelUrl('instagram.com/reels/C9abcDEF12').shortcode,'C9abcDEF12');
assert.equal(normalizeReelUrl('https://instagram.com/p/C9abcDEF12/').url,'https://www.instagram.com/p/C9abcDEF12/');
assert.equal(normalizeReelUrl('https://www.instagram.com/withjulielouvet/reel/C9abcDEF12/').shortcode,'C9abcDEF12','new /account/reel/ format');
assert.equal(normalizeReelUrl('https://m.instagram.com/reel/C9abcDEF12').shortcode,'C9abcDEF12');
for(const bad of ['','https://www.instagram.com/withjulielouvet/','https://example.com/reel/C9abcDEF12','https://www.instagram.com/reel/','https://evil.com/instagram.com/reel/C9abcDEF12','https://www.instagram.com/reel/abc','https://www.instagram.com/stories/x/123456789/','javascript:alert(1)'])assert.equal(normalizeReelUrl(bad),null,bad);
assert.deepEqual(reelCollabReward('FR'),{cents:200,currency:'eur',amount:2});assert.deepEqual(reelCollabReward('MX'),{cents:4000,currency:'mxn',amount:40});assert.deepEqual(reelCollabReward('US'),{cents:200,currency:'usd',amount:2});
assert.equal(reelCollabMaxPerMonth,10);assert.ok(tenantTables.includes('reel_collab_claims'));

const h=harness(async()=>{throw new Error('no network')}),call=h.call;
await call('state');const [a,b]=(await call('seed',{})).data.clients;
const setCfg=(id,extra)=>{const row=h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(id);h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.config||'{}'),...extra}),id)};
const setup=async(c,email)=>{const row=(await call('state?client='+c.id)).data.clients.find(x=>x.id===c.id);const r=await call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}});assert.equal(r.status,200,JSON.stringify(r.data))};
await setup(a,'alice@test.local');await setup(b,'bob@test.local');
setCfg(a.id,{country:'FR'});setCfg(b.id,{country:'US',workspaceType:'creator'});
await call('join',{code:a.code},'alice','alice@test.local');await call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>call(x,y,'alice','alice@test.local'),bob=(x,y)=>call(x,y,'bob','bob@test.local'),agency=(x,y)=>call(x,y);

// ---- Affichage : montant dans la devise du pays (marques et créatrices) ----
let s=(await alice('state')).data.reelCollab;assert.equal(s.account,'withjulielouvet');assert.equal(s.reward_cents,200);assert.equal(s.currency,'eur');assert.equal(s.cap,10);assert.equal(s.month_count,0);
assert.equal((await bob('state')).data.reelCollab.currency,'usd','creators get it too');

// ---- Déclaration ----
assert.equal((await alice('reel-claim',{client_id:a.id,url:'https://example.com/x'})).status,400);
let r=await alice('reel-claim',{client_id:a.id,url:'https://www.instagram.com/reel/AAAAA11111/?utm_source=ig'});assert.equal(r.status,200,JSON.stringify(r.data));const c1=r.data.id;
assert.equal((await alice('reel-claim',{client_id:a.id,url:'instagram.com/p/AAAAA11111'})).status,409,'same Reel, same client');
assert.equal((await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/AAAAA11111/'})).status,409,'same Reel cannot be claimed by anyone else');
assert.equal((await bob('reel-claim',{client_id:a.id,url:'https://www.instagram.com/reel/BBBBB22222/'})).status,403,'never in another space');
assert.equal((await alice('reel-review',{id:c1,decision:'approve'})).status,403,'clients cannot validate');
s=(await alice('state')).data.reelCollab;assert.equal(s.claims.length,1);assert.equal(s.claims[0].status,'pending');assert.equal(s.claims[0].url,'https://www.instagram.com/reel/AAAAA11111/');
assert.equal((await bob('state')).data.reelCollab.claims.length,0,'claims are private');

// ---- Refus avec motif, puis redéclaration ----
r=await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/BBBBB22222/'});const c2=r.data.id;
assert.equal((await agency('reel-review',{id:c2,decision:'refuse',reason:'La collaboration n’a pas été acceptée.'})).status,200);
assert.equal((await agency('reel-review',{id:c2,decision:'approve'})).status,409,'reviewed once');
s=(await bob('state')).data.reelCollab;assert.equal(s.claims[0].status,'refused');assert.equal(s.claims[0].reason,'La collaboration n’a pas été acceptée.');
assert.equal((await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/BBBBB22222/'})).status,200,'a refused Reel can be submitted again');
assert.equal((await bob('state')).data.reelCollab.claims[0].status,'pending');

// ---- Validation sans client Stripe : en attente, puis crédit unique ----
r=await agency('reel-review',{id:c1,decision:'approve'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.waiting,true);
let row=h.sqlite.prepare('SELECT * FROM reel_collab_claims WHERE id=?').get(c1);assert.equal(row.status,'approved');assert.equal(row.amount_cents,200);assert.equal(row.currency,'eur');
assert.ok(h.sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE client_id=? AND message LIKE 'Votre Reel avec @withjulielouvet est validé%'").get(a.id).n===1);
s=(await alice('state')).data.reelCollab;assert.equal(s.month_count,1);assert.equal(s.claims[0].status,'approved');
// Alice passe au tarif Mexique avant le crédit : la remise suit la devise de son abonnement.
setCfg(a.id,{country:'MX'});
const stripeCalls=[];Object.assign(h.env,{STRIPE_SECRET_KEY:'sk_test_123',STRIPE_FETCH:async(url,opts)=>{stripeCalls.push([url,opts.body,opts.headers['Idempotency-Key']]);return Response.json({id:'cbtxn_reel_1'})}});
assert.equal((await applyReelCredits(h.env,a.id)).waiting,true,'no Stripe customer yet');
h.sqlite.prepare("INSERT INTO billing_accounts(client_id,customer_id,updated) VALUES(?,?,?)").run(a.id,'cus_alice',new Date().toISOString());
assert.equal((await applyReelCredits(h.env,a.id)).credited,1);
row=h.sqlite.prepare('SELECT * FROM reel_collab_claims WHERE id=?').get(c1);assert.equal(row.status,'credited');assert.equal(row.stripe_reference,'cbtxn_reel_1');assert.equal(row.currency,'mxn');assert.equal(row.amount_cents,4000);
assert.match(stripeCalls[0][0],/customers\/cus_alice\/balance_transactions$/);assert.match(stripeCalls[0][1],/amount=-4000/);assert.match(stripeCalls[0][1],/currency=mxn/);assert.equal(stripeCalls[0][2],'studio-reel:'+c1,'idempotency key per claim');
await applyReelCredits(h.env,a.id);assert.equal(stripeCalls.length,1,'credited only once');
// Échec Stripe : la remise reste due et repart au prochain essai.
r=await alice('reel-claim',{client_id:a.id,url:'https://www.instagram.com/reel/CCCCC33333/'});const c3=r.data.id;
h.env.STRIPE_FETCH=async()=>new Response(JSON.stringify({error:{message:'down'}}),{status:500});
assert.equal((await agency('reel-review',{id:c3,decision:'approve'})).status,200);
assert.equal(h.sqlite.prepare('SELECT status FROM reel_collab_claims WHERE id=?').get(c3).status,'approved','kept for retry');
h.env.STRIPE_FETCH=async(url,opts)=>{stripeCalls.push([url,opts.body,opts.headers['Idempotency-Key']]);return Response.json({id:'cbtxn_reel_3'})};
await applyReelCredits(h.env,a.id);assert.equal(h.sqlite.prepare('SELECT status FROM reel_collab_claims WHERE id=?').get(c3).status,'credited');
s=(await alice('state')).data.reelCollab;assert.equal(s.month_count,2);assert.equal(s.currency,'mxn');

// ---- Plafond mensuel ----
const t=new Date().toISOString(),month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Monterrey',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7); // même mois que le serveur (heure de Monterrey)
for(let i=0;i<8;i++)h.sqlite.prepare("INSERT INTO reel_collab_claims(id,client_id,user_id,shortcode,url,status,amount_cents,currency,approved_month,created,updated) VALUES(?,?,?,?,?,'credited',4000,'mxn',?,?,?)").run('cap-'+i,a.id,'alice','CAPXX'+i+'xxxx','https://www.instagram.com/reel/CAPXX'+i+'xxxx/',month,t,t);
r=await alice('reel-claim',{client_id:a.id,url:'https://www.instagram.com/reel/DDDDD44444/'});
assert.equal((await agency('reel-review',{id:r.data.id,decision:'approve'})).status,409,'10 per month');
h.sqlite.prepare('UPDATE reel_collab_claims SET approved_month=? WHERE id LIKE ?').run('2000-01','cap-%');
assert.equal((await agency('reel-review',{id:r.data.id,decision:'approve'})).status,200,'previous months do not count');

// ---- Agence : file de validation ----
s=(await agency('state')).data;assert.ok(s.reelQueue.length>=4);assert.equal(s.reelQueue[0].status,'pending','pending first');assert.equal(s.reelCap,10);

// ---- Limite de déclarations par jour ----
for(let i=0;i<20;i++)h.sqlite.prepare("INSERT INTO reel_collab_claims(id,client_id,user_id,shortcode,url,status,created,updated) VALUES(?,?,?,?,?,'pending',?,?)").run('day-'+i,b.id,'bob','DAYXX'+i+'xxxx','u',t,t);
assert.equal((await bob('reel-claim',{client_id:b.id,url:'https://www.instagram.com/reel/EEEEE55555/'})).status,429);

// ---- Purge ----
r=await agency('client-lifecycle',{client_id:a.id,mode:'delete',confirm_name:a.name});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM reel_collab_claims WHERE client_id=?').get(a.id).n,0);

console.log('reel-collab OK — liens Instagram normalisés, Reel unique tous clients confondus, refus avec motif et redéclaration, crédit Stripe unique dans la devise du pays (2 € / 40 MXN / 2 USD), reprise après échec, plafond mensuel, cloisonnement, purge');
