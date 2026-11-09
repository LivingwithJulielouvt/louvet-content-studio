// Parrainage : code par client, rattachement à la marque parrainée, remise dans la devise du parrain (10 € / 200 MXN / 10 USD) après son premier paiement.
import assert from 'node:assert/strict';
import {readyHarness as harness} from './harness.mjs';
import {handleStudio} from '../lib/studio.mjs';
import {onReferredPayment,applyReferralCredits} from '../lib/referrals.mjs';
import {intakeQuestions} from '../lib/client-intake.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')}),call=h.call;
await call('state');
const [a]=(await call('seed',{})).data.clients;
const ca=(await call('state?client='+a.id)).data.clients.find(x=>x.id===a.id);
await call('settings',{client_id:a.id,name:ca.name,quota_limit:ca.quota_limit,active:true,config:{...ca.config,country:'FR',allowedEmails:['alice@test.local']}});
await call('join',{code:a.code},'alice','alice@test.local');
const alice=(p,body)=>call(p,body,'alice','alice@test.local');
const ref=(await alice('state')).data.referral;assert.ok(ref.code);assert.equal(ref.reward_cents,1000);assert.equal(ref.currency,'eur','French referrer earns euros');
assert.equal((await alice('state')).data.referral.code,ref.code,'code is stable');
// Formulaire public avec le code d'Alice.
async function publicForm(email,code){const g=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{headers:{'x-forwarded-for':'192.0.2.5'}}),h.env);const nonce=(await g.json()).nonce,cookie=g.headers.get('set-cookie').split(';')[0];
 const r=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://studio.test','X-Studio-Request':'1','x-forwarded-for':'192.0.2.5',Cookie:cookie},body:JSON.stringify({nonce,request_key:crypto.randomUUID(),first_name:'Nina',name:'Marque Nina',email,workspaceType:'brand',language:'fr',answers:Object.fromEntries(intakeQuestions.map(q=>[q.key,'Réponse.'])),consent:true,referral_code:code})}),h.env);return r.status}
assert.equal(await publicForm('nina@test.local','CODE-INCONNU'),400,'unknown code is refused');
assert.equal(await publicForm('nina@test.local',ref.code.toLowerCase()),200);
// L'agence ouvre l'espace de Nina ; à sa connexion le parrainage est rattaché.
const nina=(await call('clients',{name:'Marque Nina',config:{allowedEmails:['nina@test.local']}})).data;
assert.equal((await call('join',{code:nina.code},'nina','nina@test.local')).status,200);
let r=h.sqlite.prepare('SELECT * FROM referrals WHERE referred_client_id=?').get(nina.id);assert.equal(r.client_id,a.id);assert.equal(r.status,'pending');assert.equal(r.currency,'eur');assert.equal(r.amount_cents,1000);
// Alice passe au tarif Mexique avant le crédit : la remise suit la devise de son abonnement.
h.sqlite.prepare('UPDATE clients SET config=? WHERE id=?').run(JSON.stringify({...JSON.parse(h.sqlite.prepare('SELECT config FROM clients WHERE id=?').get(a.id).config),country:'MX'}),a.id);
// Paiement de Nina → crédit Stripe de 200 MXN sur le compte d'Alice.
const stripeCalls=[];Object.assign(h.env,{STRIPE_SECRET_KEY:'sk_test_123',STRIPE_FETCH:async(url,opts)=>{stripeCalls.push([url,opts.body,opts.headers['Idempotency-Key']]);return Response.json({id:'cbtxn_1'})}});
await onReferredPayment(h.env,nina.id,{amount_paid:0});
assert.equal(h.sqlite.prepare('SELECT status FROM referrals WHERE id=?').get(r.id).status,'pending','free invoices do not count');
await onReferredPayment(h.env,nina.id,{amount_paid:8900});
assert.equal(h.sqlite.prepare('SELECT status FROM referrals WHERE id=?').get(r.id).status,'qualified','waits until Alice has a Stripe customer');
h.sqlite.prepare("INSERT INTO billing_accounts(client_id,customer_id,updated) VALUES(?,?,?)").run(a.id,'cus_alice',new Date().toISOString());
await applyReferralCredits(h.env,a.id);
r=h.sqlite.prepare('SELECT * FROM referrals WHERE id=?').get(r.id);assert.equal(r.status,'credited');assert.equal(r.stripe_reference,'cbtxn_1');
assert.match(stripeCalls[0][0],/customers\/cus_alice\/balance_transactions$/);assert.match(stripeCalls[0][1],/amount=-20000/);assert.match(stripeCalls[0][1],/currency=mxn/);
await applyReferralCredits(h.env,a.id);await onReferredPayment(h.env,nina.id,{amount_paid:8900});assert.equal(stripeCalls.length,1,'credited only once');
const view=(await alice('state')).data.referral;assert.equal(view.earned_cents,20000);assert.equal(view.currency,'mxn');assert.equal(view.referrals[0].referred_name,'Marque Nina');
// Nina ne voit pas les parrainages d'Alice.
const ninaView=(await call('state',null,'nina','nina@test.local')).data;assert.notEqual(ninaView.referral?.code,ref.code);
console.log('referrals OK');
