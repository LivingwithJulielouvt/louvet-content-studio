// Abonnement annuel (2 mois offerts) : tarifs validés, paiement annuel choisi par la cliente, visuels renouvelés chaque mois.
import assert from 'node:assert/strict';
import {readyHarness} from './harness.mjs';
import {PRICING,studioYearPrice} from '../lib/pricing.mjs';
import {monthSliceStart} from '../lib/billing.mjs';

const sp=x=>x.replace(/[  ]/g,' ');
assert.deepEqual([PRICING.FR.studioYear,PRICING.MX.studioYear,PRICING.US.studioYear],[890,18000,1200],'10 × the monthly price');
for(const r of ['FR','MX','US'])assert.equal(PRICING[r].studioYear,PRICING[r].studio*10);
assert.equal(sp(studioYearPrice('FR','fr').year),'890 €');assert.equal(sp(studioYearPrice('FR','fr').perMonth),'74 €');
assert.equal(sp(studioYearPrice('US','en').year),'$1,200 USD');assert.equal(sp(studioYearPrice('MX','es').perMonth),'$1,500 MXN');
// Tranches mensuelles d'une année payée.
const s0=Math.floor(Date.parse('2026-01-31T10:00:00Z')/1000);
assert.equal(monthSliceStart(s0,s0+3600),s0,'first month');
assert.equal(new Date(monthSliceStart(s0,Math.floor(Date.parse('2026-03-01T00:00:00Z')/1000))*1000).toISOString(),'2026-02-28T10:00:00.000Z','short month clamps the day');
assert.equal(new Date(monthSliceStart(s0,Math.floor(Date.parse('2026-07-15T00:00:00Z')/1000))*1000).toISOString(),'2026-06-30T10:00:00.000Z');

let now=Math.floor(Date.parse('2026-11-02T15:00:00Z')/1000);
const h=readyHarness(async()=>Response.json({id:'resp',status:'queued'}));await h.call('state');
Object.assign(h.env,{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STUDIO_URL:'https://studio.test',BILLING_NOW:()=>now*1000,STRIPE_PRICE_ID_FR:'price_fr',STRIPE_PRICE_ID_MX:'price_mx',STRIPE_PRICE_ID_US:'price_us',STRIPE_PRICE_ID_FR_YEAR:'price_fryear'});
const prices={price_fr:[8900,'eur','month'],price_mx:[180000,'mxn','month'],price_us:[12000,'usd','month'],price_fryear:[89000,'eur','year'],price_fryearbad:[99000,'eur','year'],price_fryearmonthly:[89000,'eur','month']};
const sessions=[];
h.env.STRIPE_FETCH=async(url,opts)=>{const u=new URL(url),form=new URLSearchParams(opts.body||''),id=u.pathname.split('/').at(-1);let data;
 if(u.pathname.startsWith('/v1/prices/')&&prices[id])data={id,active:true,type:'recurring',unit_amount:prices[id][0],currency:prices[id][1],livemode:false,recurring:{interval:prices[id][2],interval_count:1,usage_type:'licensed'}};
 else if(u.pathname==='/v1/customers')data={id:'cus_x',livemode:false,metadata:{studio_client_id:form.get('metadata[studio_client_id]')}};
 else if(u.pathname==='/v1/subscriptions')data={data:[],has_more:false};
 else if(u.pathname==='/v1/checkout/sessions'){data={id:'cs_'+sessions.length,url:'https://checkout.stripe.com/c/pay/cs_'+sessions.length};sessions.push(Object.fromEntries(form))}
 if(!data)return Response.json({error:{message:'not found'}},{status:404});return Response.json(data)};

const fr=(await h.call('clients',{name:'Atelier Lune',config:{allowedEmails:['lea@test.local'],language:'fr',country:'FR'}})).data;
await h.call('join',{code:fr.code},'lea','lea@test.local');const lea=(p,b)=>h.call(p,b,'lea','lea@test.local');
let rec=h.sqlite.prepare('SELECT version FROM billing_accounts WHERE client_id=?').get(fr.id);
let s=await h.call('billing-settings',{client_id:fr.id,version:rec?.version??1,enabled:true,price_id:'',grace_days:3,monthly_credits:30});assert.equal(s.status,200,JSON.stringify(s.data));
let st=(await lea('state')).data.billing;assert.equal(st.yearlyReady,true,'yearly offered when the country has a yearly price');assert.equal(st.interval,'month');assert.equal(st.localPrice.yearly,890);
// La cliente choisit l'annuel : la page Stripe utilise le tarif annuel.
let c=await lea("billing-checkout",{interval:"year"});assert.equal(c.status,200,JSON.stringify(c.data));
assert.equal(sessions.at(-1)['line_items[0][price]'],'price_fryear');
assert.equal((await lea('state')).data.billing.interval,'year');
// Retour au mensuel avant de payer : le tarif mensuel revient.
c=await lea('billing-checkout',{interval:'month'});assert.equal(c.status,200,JSON.stringify(c.data));assert.equal(sessions.at(-1)['line_items[0][price]'],'price_fr');
// Pays sans tarif annuel : refus clair.
const us=(await h.call('clients',{name:'Sunset',config:{allowedEmails:['sam@test.local'],language:'en',country:'US'}})).data;
await h.call('join',{code:us.code},'sam','sam@test.local');const sam=(p,b)=>h.call(p,b,'sam','sam@test.local');
rec=h.sqlite.prepare('SELECT version FROM billing_accounts WHERE client_id=?').get(us.id);
await h.call('billing-settings',{client_id:us.id,version:rec?.version??1,enabled:true,price_id:'',grace_days:3,monthly_credits:30});
assert.equal((await sam('state')).data.billing.yearlyReady,false);
assert.equal((await sam('billing-checkout',{interval:'year'})).status,409);
// Un tarif annuel mal configuré (montant ou rythme) est refusé.
h.env.STRIPE_PRICE_ID_FR_YEAR='price_fryearbad';
c=await lea('billing-checkout',{interval:'year'});assert.equal(c.status,400);assert.match(c.data.error,/annuel/);
h.sqlite.prepare("UPDATE billing_accounts SET price_id='price_fr' WHERE client_id=?").run(fr.id);h.env.STRIPE_PRICE_ID_FR_YEAR='price_fryearmonthly';
c=await lea('billing-checkout',{interval:'year'});assert.equal(c.status,400);assert.match(c.data.error,/annuel/);
console.log('annual OK — 890 € / 18 000 MXN / 1 200 USD par an, tarif annuel validé, choix mensuel/annuel au paiement, visuels renouvelés chaque mois');
