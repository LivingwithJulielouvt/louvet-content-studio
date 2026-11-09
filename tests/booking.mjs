import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {bookingTarget,bookingSource,DEFAULT_BOOKING_URL} from '../lib/studio.mjs';

// ---- Lien de réservation : Calendly par défaut, préremplissage seulement pour calendly.com ----
assert.equal(bookingSource({}),DEFAULT_BOOKING_URL);assert.equal(bookingSource({BOOKING_URL:''}),DEFAULT_BOOKING_URL);
assert.equal(bookingSource({BOOKING_URL:'none'}),null);assert.equal(bookingSource({BOOKING_URL:' https://x.test/a '}),'https://x.test/a');
const cal=new URL(bookingTarget(DEFAULT_BOOKING_URL,{email:'ana@test.local',name:'Ana & Co'}));
assert.equal(cal.hostname,'calendly.com');assert.equal(cal.searchParams.get('email'),'ana@test.local');assert.equal(cal.searchParams.get('name'),'Ana & Co');
const g=new URL(bookingTarget('https://calendar.app.google/abc?x=1',{email:'ana@test.local',name:'Ana'}));assert.equal(g.searchParams.get('email'),null,'no personal data for non-Calendly links');assert.equal(g.search,'?x=1');
assert.equal(bookingTarget('https://evilcalendly.com/x',{email:'a@b.c'}).includes('email'),false,'look-alike host gets nothing');
assert.equal(bookingTarget('javascript:alert(1)'),null);assert.equal(bookingTarget('http://calendly.com/x'),null);assert.equal(bookingTarget(null),null);

// ---- Serveur ----
const h=harness(async()=>{throw new Error('no network')});
await h.call('state');const {clients:[a,b]}=(await h.call('seed',{})).data;
for(const [c,email] of [[a,'alice@test.local'],[b,'bob@test.local']]){const s=(await h.call('state?client='+c.id)).data,row=s.clients.find(x=>x.id===c.id);await h.call('settings',{client_id:c.id,name:c.name,quota_limit:row.quota_limit,active:true,config:{...row.config,allowedEmails:[email]}})}
await h.call('join',{code:a.code},'alice','alice@test.local');await h.call('join',{code:b.code},'bob','bob@test.local');
const alice=(x,y)=>h.call(x,y,'alice','alice@test.local'),bob=(x,y)=>h.call(x,y,'bob','bob@test.local');
// Lien (par défaut, le Calendly de Julie, prérempli avec l'e-mail du compte).
assert.equal((await alice('state?client='+a.id)).data.bookingUrl,true);
const link=await alice('booking-link',{client_id:a.id});assert.equal(link.status,200);const lu=new URL(link.data.url);assert.equal(lu.searchParams.get('email'),'alice@test.local');assert.ok(!/client|quota|code/i.test(lu.search),'only email and name in the URL');
assert.equal((await alice('booking-link',{client_id:b.id})).status,403,'never another space');
h.env.BOOKING_URL='none';assert.equal((await alice('state?client='+a.id)).data.bookingUrl,false);assert.equal((await alice('booking-link',{client_id:a.id})).status,404);
// Demande dans le studio : nettoyage, isolation, limite.
const req=await alice('booking-request',{client_id:a.id,topic:'hack',slots:['  Lundi 10h <script>  ','',{x:1},'Mardi\u0000 15h','Mercredi 9h','Jeudi'],message:'<b>Aide</b>\nsvp'.repeat(1),timezone:'America/Monterrey'});
assert.equal(req.status,200,JSON.stringify(req.data));
let row=h.sqlite.prepare('SELECT * FROM booking_requests WHERE id=?').get(req.data.id);
assert.equal(row.topic,'other');const slots=JSON.parse(row.slots);assert.equal(slots.length,3,'3 slots max');assert.ok(slots.every(x=>!/[<>\u0000]/.test(x)));assert.equal(slots[0],'Lundi 10h script');
assert.ok(!/[<>]/.test(row.message));assert.equal(row.timezone,'America/Monterrey');assert.equal(row.client_id,a.id);
const bad=(await alice('booking-request',{client_id:a.id,slots:['x'],timezone:'"; DROP'})).data;assert.equal(bad.ok,true);
assert.equal(h.sqlite.prepare("SELECT timezone FROM booking_requests WHERE id=?").get(bad.id).timezone,'UTC','bad timezone replaced');
assert.equal((await alice('booking-request',{client_id:a.id,slots:[]})).status,400,'at least one slot');
assert.equal((await alice('booking-request',{client_id:b.id,slots:['x']})).status,403,'cannot request for another space');
assert.equal((await h.call('booking-request',{client_id:a.id,slots:['x']})).status,403,'agency does not book itself');
assert.equal((await alice('booking-request',{client_id:a.id,slots:['3e']})).status,200);
assert.equal((await alice('booking-request',{client_id:a.id,slots:['4e']})).status,429,'3 pending max per client');
assert.equal((await alice('state?client='+a.id)).data.bookingPending,3);
assert.equal((await bob('state?client='+b.id)).data.bookingPending,0);assert.equal((await bob('state?client='+b.id)).data.bookingRequests,undefined,'clients never see the agency list');
// Agence : liste « À traiter » et « Marquer comme planifié ».
const ag=(await h.call('state')).data.bookingRequests;assert.equal(ag.length,3);assert.ok(Array.isArray(ag[0].slots));assert.equal(ag[0].email,'alice@test.local');
assert.equal((await alice('booking-done',{id:req.data.id})).status,403,'only the agency plans');
assert.equal((await h.call('booking-done',{id:req.data.id})).status,200);assert.equal((await h.call('booking-done',{id:req.data.id})).data.duplicate,true);
assert.equal((await h.call('state')).data.bookingRequests.length,2);
const notes=(await alice('state?client='+a.id)).data.notifications.map(n=>n.message);assert.ok(notes.some(m=>/planifié/.test(m)),'client is notified');
assert.equal((await alice('booking-request',{client_id:a.id,slots:['5e']})).status,200,'slot freed after planning');
// Limite quotidienne par compte (5 / 24 h).
h.sqlite.prepare("UPDATE booking_requests SET status='planned' WHERE client_id=?").run(a.id);
assert.equal((await alice('booking-request',{client_id:a.id,slots:['6e']})).status,200);
assert.equal((await alice('booking-request',{client_id:a.id,slots:['7e']})).status,429,'5 requests per day per account');
console.log('booking OK — lien Calendly par défaut, préremplissage limité, demandes nettoyées, cloisonnées et limitées');
