// Cohérence métier : prix Stripe du pays, pays par défaut, devise des remises, effacement complet,
// suppression bloquée par un abonnement actif, livraison réservée aux espaces à jour, e-mails au vouvoiement.
import assert from 'node:assert/strict';
import {readyHarness} from './harness.mjs';
import {creditRegionFor} from '../lib/billing.mjs';
import {rewardFor,applyReferralCredits} from '../lib/referrals.mjs';
import {emailPreviews,MAIL_COPY_VERSION} from '../lib/studio-email-templates.mjs';
import {runDailyStudio} from '../lib/studio.mjs';

const h=readyHarness(async()=>Response.json({id:'resp',status:'queued'}));await h.call('state');
const now=Math.floor(Date.parse('2026-11-02T15:00:00Z')/1000);
Object.assign(h.env,{STRIPE_SECRET_KEY:'sk_test_fixture',STUDIO_URL:'https://studio.test',BILLING_NOW:()=>now*1000,STRIPE_PRICE_ID_FR:'price_fr',STRIPE_PRICE_ID_MX:'price_mxwrong',STRIPE_PRICE_ID_US:'price_us'});
// price_mxwrong : l'ancien prix 89 USD collé par erreur à la place de 1 800 MXN.
const prices={price_fr:[8900,'eur'],price_mxwrong:[8900,'usd'],price_us:[12000,'usd']};
const calls=[];let failBalance=false;
h.env.STRIPE_FETCH=async(url,opts)=>{const u=new URL(url),form=new URLSearchParams(opts.body||'');calls.push({method:opts.method,path:u.pathname,form:Object.fromEntries(form)});const id=u.pathname.split('/').at(-1);
 if(u.pathname.startsWith('/v1/prices/')&&prices[id])return Response.json({id,active:true,type:'recurring',unit_amount:prices[id][0],currency:prices[id][1],livemode:false,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}});
 if(u.pathname.endsWith('/balance_transactions'))return failBalance?Response.json({error:{message:'Currency mismatch'}},{status:400}):Response.json({id:'cbtxn_'+calls.length});
 if(opts.method==='DELETE'&&u.pathname.startsWith('/v1/subscriptions/'))return Response.json({id,status:'canceled'});
 return Response.json({error:{message:'not found'}},{status:404})};
const mk=async(name,config)=>(await h.call('clients',{name,config:{allowedEmails:[name.toLowerCase().replace(/\W/g,'')+'@test.local'],...config}})).data;
const cfgOf=async id=>(await h.call('state?client='+id)).data.clients.find(x=>x.id===id).config;

// 1. Pays par défaut déduit de la langue (jamais Mexique d'office).
const fr=await mk('Atelier Lune',{language:'fr'}),us=await mk('Sunny Shop',{language:'en'}),mx=await mk('Velas Sol',{language:'es'});
assert.equal((await cfgOf(fr.id)).country,'FR');assert.equal((await cfgOf(us.id)).country,'US');assert.equal((await cfgOf(mx.id)).country,'MX');

// 2. Tarif catalogue : montant et devise vérifiés contre le prix affiché.
const ver=id=>h.sqlite.prepare('SELECT version FROM billing_accounts WHERE client_id=?').get(id)?.version??1;
let r=await h.call('billing-settings',{client_id:mx.id,version:ver(mx.id),enabled:true,price_id:'',grace_days:3,monthly_credits:30});
assert.equal(r.status,400,'MX price with wrong currency must be refused');assert.match(r.data.error,/1800 MXN/);
r=await h.call('billing-settings',{client_id:fr.id,version:ver(fr.id),enabled:true,price_id:'',grace_days:3,monthly_credits:30});
assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.record.price_id,'price_fr');assert.equal(r.data.record.price_currency,'eur');assert.equal(r.data.record.price_amount,8900);
assert.equal(r.data.checkoutReady,true);
// Sans tarif pour le pays : le bouton « S'abonner » ne doit pas être proposé.
delete h.env.STRIPE_PRICE_ID_US;assert.equal((await h.call('state?client='+us.id)).data.billing.checkoutReady,false);

// 3. Remises dans la devise de l'abonnement, même si le pays change ensuite.
h.sqlite.prepare("UPDATE billing_accounts SET customer_id='cus_fr',subscription_id='sub_fr',status='active',paid_until=? WHERE client_id=?").run(now+20*86400,fr.id);
const c=await cfgOf(fr.id);await h.call('settings',{client_id:fr.id,name:fr.name,quota_limit:30,active:true,config:{...c,country:'US'}});
assert.equal((await cfgOf(fr.id)).country,'US');assert.equal(await creditRegionFor(h.env.DB,h.env,fr.id),'FR','credit currency follows the EUR subscription');
assert.equal((await rewardFor(h.env.DB,fr.id,h.env)).currency,'eur');
const t=new Date().toISOString();
h.sqlite.prepare("INSERT INTO referrals(id,client_id,referred_client_id,referred_name,status,amount_cents,currency,created,updated) VALUES('ref1',?,?,?,'qualified',1000,'usd',?,?)").run(fr.id,mx.id,'Velas Sol',t,t);
failBalance=true;await applyReferralCredits(h.env,fr.id);
let ref=h.sqlite.prepare("SELECT * FROM referrals WHERE id='ref1'").get();assert.equal(ref.status,'qualified','failed credit stays due');assert.match(ref.credit_error,/Stripe/,'failure visible to the agency');
failBalance=false;await applyReferralCredits(h.env,fr.id);
ref=h.sqlite.prepare("SELECT * FROM referrals WHERE id='ref1'").get();assert.equal(ref.status,'credited');assert.equal(ref.currency,'eur');assert.equal(ref.amount_cents,1000);assert.equal(ref.credit_error,null);
assert.equal(calls.filter(x=>x.path.endsWith('/balance_transactions')).at(-1).form.currency,'eur');

// 4. Livraison mensuelle : jamais envoyée à un espace impayé.
const mkDelivery=(id,cid)=>h.sqlite.prepare("INSERT INTO monthly_deliveries(id,client_id,month,status,items,created,updated) VALUES(?,?,'2026-10','validated','{\"approved\":[]}',?,?)").run(id,cid,t,t);
h.sqlite.prepare("UPDATE billing_accounts SET status='canceled',paid_until=?,subscription_id=NULL,customer_id=NULL WHERE client_id=?").run(now-40*86400,fr.id);
mkDelivery('d-unpaid',fr.id);mkDelivery('d-free',us.id);
await runDailyStudio(h.env,new Date('2026-11-03T16:00:00Z'));
assert.equal(h.sqlite.prepare("SELECT status FROM monthly_deliveries WHERE id='d-unpaid'").get().status,'validated','unpaid space is not delivered');
assert.equal(h.sqlite.prepare("SELECT status FROM monthly_deliveries WHERE id='d-free'").get().status,'sent','space without automatic billing is delivered');

// 5. Suppression : bloquée tant qu'un abonnement Stripe est actif, puis effacement complet.
h.sqlite.prepare("UPDATE billing_accounts SET customer_id='cus_fr2',subscription_id='sub_fr2',status='active',paid_until=? WHERE client_id=?").run(now+20*86400,fr.id);
const email=c.allowedEmails[0];
await h.call('join',{code:fr.code},'lune',email);
h.sqlite.prepare("INSERT INTO public_subscription_requests(id,request_key,first_name,email,name,workspace_type,language,answers,status,consent_at,created,ip_hash,mail_status,copy_version) VALUES('psr1','k1','Léa',?,'Atelier Lune','brand','fr','{}','pending',?,?,'ip','held','v')").run(email.toUpperCase(),t,t);
h.sqlite.prepare("INSERT INTO referral_claims(email,code,created) VALUES(?,?,?)").run(email,'CODE-1',t);
h.sqlite.prepare("INSERT INTO referrals(id,client_id,referred_client_id,referred_name,status,amount_cents,currency,created,updated) VALUES('ref2',?,?,?,'pending',1000,'usd',?,?)").run(us.id,fr.id,'Atelier Lune',t,t);
r=await h.call('client-lifecycle',{client_id:fr.id,mode:'delete',confirm_name:fr.name});
assert.equal(r.status,409,JSON.stringify(r.data));assert.match(r.data.error,/Résiliez d’abord l’abonnement/);
r=await h.call('client-lifecycle',{client_id:fr.id,mode:'delete',confirm_name:fr.name,cancel_subscription:true});
assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.deleted,true);
assert.ok(calls.some(x=>x.method==='DELETE'&&x.path==='/v1/subscriptions/sub_fr2'),'subscription cancelled at Stripe');
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM public_subscription_requests WHERE id='psr1'").get().n,0,'public request erased');
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM referral_claims WHERE lower(email)=lower(?)").get(email).n,0,'referral claim erased');
assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM referrals WHERE referred_client_id=?").get(fr.id).n,0,'referral as referred erased');

// 6. E-mails : vouvoiement en français, version des textes à jour.
assert.equal(MAIL_COPY_VERSION,'louvet-2026-10-26-v5');
for(const m of emailPreviews().filter(x=>x.language==='fr'))
 for(const s of [m.subject,m.text])assert.doesNotMatch(s.replace(/https?:\S+/g,''),/(^|[\s«(’'])(tu|ton|ta|tes|toi|te|t’|t')(?=[\s,.!?»)]|$)/i,m.kind+' FR must use vous: '+s.slice(0,120));
const delivery=emailPreviews().find(x=>x.kind==='delivery'&&x.language==='fr');assert.match(delivery.subject,/6 contenus/);
const {studioEmail}=await import('../lib/studio-email-templates.mjs');assert.match(studioEmail('delivery','fr',{count:4}).subject,/Vos 4 contenus/);assert.match(studioEmail('delivery','en',{count:1}).subject,/Your post for the month/);

console.log('PASS: logic fixes — catalogue price amount/currency checked, country from language, credits in subscription currency with visible failures, unpaid spaces not delivered, deletion blocked by active subscription then full personal-data purge, FR emails vouvoiement (v5) with real delivery count.');
