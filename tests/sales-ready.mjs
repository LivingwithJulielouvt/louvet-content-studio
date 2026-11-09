// Parcours de vente de bout en bout (Stripe simulé) : tarif du pays → paiement → activation → portail → résiliation / impayé.
import assert from 'node:assert/strict';
import {readyHarness,harness} from './harness.mjs';
import {formatMoney,PRICING} from '../lib/pricing.mjs';
import {LEGAL_PAGES,LEGAL_UI,LEGAL_SLUGS} from '../lib/legal-copy.mjs';

// ---- Prix affichés ----
const sp=x=>x.replace(/[\u00a0\u202f]/g,' ');assert.equal(sp(formatMoney(89,'EUR','fr')),'89 €');assert.equal(sp(formatMoney(1800,'MXN','es')),'$1,800 MXN');assert.equal(sp(formatMoney(120,'USD','en')),'$120 USD');
assert.deepEqual([PRICING.FR.studio,PRICING.MX.studio,PRICING.US.studio],[89,1800,120]);

let now=Math.floor(Date.parse('2026-11-02T15:00:00Z')/1000);
const h=readyHarness(async()=>Response.json({id:'resp',status:'queued'}));await h.call('state');
Object.assign(h.env,{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STUDIO_URL:'https://studio.test',BILLING_NOW:()=>now*1000,STRIPE_PRICE_ID_FR:'price_fr',STRIPE_PRICE_ID_MX:'price_mx',STRIPE_PRICE_ID_US:'price_us',STRIPE_PORTAL_CONFIGURATION_ID:'bpc_portal'});
const prices={price_fr:[8900,'eur'],price_mx:[180000,'mxn'],price_us:[12000,'usd'],price_custom:[50000,'usd']};
const customers=new Map(),subs=new Map(),sessions=[],portals=[],idem=new Map();
h.env.STRIPE_FETCH=async(url,opts)=>{const u=new URL(url),form=new URLSearchParams(opts.body||''),key=opts.headers['Idempotency-Key'];if(key&&idem.has(key)){const [body,data]=idem.get(key);if(body!==opts.body)return Response.json({error:{message:'idempotency mismatch'}},{status:400});return Response.json(data)}let data;
 const id=u.pathname.split('/').at(-1);
 if(u.pathname.startsWith('/v1/prices/')&&prices[id])data={id,active:true,type:'recurring',unit_amount:prices[id][0],currency:prices[id][1],livemode:false,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 else if(u.pathname==='/v1/customers'){data={id:'cus_'+form.get('metadata[studio_client_id]').replaceAll('-',''),livemode:false,email:form.get('email'),metadata:{studio_client_id:form.get('metadata[studio_client_id]')}};customers.set(data.id,data)}
 else if(u.pathname==='/v1/subscriptions')data={data:[...subs.values()].filter(s=>s.customer===u.searchParams.get('customer')),has_more:false};
 else if(u.pathname==='/v1/checkout/sessions'){data={id:'cs_'+sessions.length,url:'https://checkout.stripe.com/c/pay/cs_'+sessions.length};sessions.push(Object.fromEntries(form))}
 else if(u.pathname==='/v1/billing_portal/sessions'){data={url:'https://billing.stripe.com/p/session_'+portals.length};portals.push(Object.fromEntries(form))}
 if(!data)return Response.json({error:{message:'not found'}},{status:404});if(key)idem.set(key,[opts.body,data]);return Response.json(data)};
function subscription(cid,customer,price,start,end,{status='active',paid=true,cancelAtEnd=false,reason='subscription_create'}={}){return{id:'sub_'+customer,customer,livemode:false,status,cancel_at_period_end:cancelAtEnd,metadata:{studio_client_id:cid},items:{data:[{id:'si',price:{id:price},quantity:1,current_period_start:start,current_period_end:end}]},latest_invoice:{id:'in_'+start,customer,parent:{subscription_details:{subscription:'sub_'+customer}},status:paid?'paid':'open',billing_reason:reason,created:start,due_date:start,lines:{data:[{period:{start,end},pricing:{price_details:{price}},parent:{subscription_item_details:{proration:false}}}]}}}}
async function webhook(type,customer,id){const body=JSON.stringify({id,type,livemode:false,data:{object:{customer}}}),t=now,k=await crypto.subtle.importKey('raw',new TextEncoder().encode('whsec_fixture'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(t+'.'+body)))].map(b=>b.toString(16).padStart(2,'0')).join('');const {handleStudio}=await import('../lib/studio.mjs');const r=await handleStudio(new Request('https://studio.test/api/studio/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body}),h.env);if(r.status!==200&&process.env.DEBUG_W)console.error('W',type,r.status,await r.clone().text());return r.status}

// ---- Une cliente en France ----
const fr=(await h.call('clients',{name:'Atelier Lune',config:{allowedEmails:['lea@test.local'],language:'fr',country:'FR'}})).data;
await h.call('join',{code:fr.code},'lea','lea@test.local');const lea=(p,b)=>h.call(p,b,'lea','lea@test.local');
let st=(await lea('state')).data;assert.deepEqual(st.billing.localPrice,{region:'FR',amount:89,yearly:890,currency:'EUR'},'local price shown even before billing');
// L'agence active le paiement sans saisir d'identifiant : le tarif du pays est pris.
let rec=h.sqlite.prepare('SELECT version FROM billing_accounts WHERE client_id=?').get(fr.id);
let s=await h.call('billing-settings',{client_id:fr.id,version:rec?.version??1,enabled:true,price_id:'',grace_days:3,monthly_credits:30});assert.equal(s.status,200,JSON.stringify(s.data));
assert.equal(s.data.record.price_id,'price_fr');assert.equal(s.data.access.state,'payment_required');
st=(await lea('state')).data;assert.equal(st.billing.offer.amount,8900);assert.equal(st.billing.offer.currency,'eur');assert.equal(st.billing.offer.region,'FR');assert.equal(st.billing.record,undefined);
// Paiement : page Stripe au tarif français, en français.
let c=await lea('billing-checkout',{});assert.equal(c.status,200,JSON.stringify(c.data));assert.match(c.data.url,/^https:\/\/checkout\.stripe\.com\//);
assert.equal(sessions[0]['line_items[0][price]'],'price_fr');assert.equal(sessions[0].locale,'fr');assert.equal(sessions[0].mode,'subscription');assert.equal(sessions[0]['subscription_data[metadata][studio_client_id]'],fr.id);
// L'agence corrige le pays (Mexique) avant le paiement : la page suivante suit le nouveau pays.
let cfg=(await h.call('state?client='+fr.id)).data.clients.find(x=>x.id===fr.id);
assert.equal((await h.call('settings',{client_id:fr.id,name:cfg.name,quota_limit:cfg.quota_limit,active:true,config:{...cfg.config,country:'MX'}})).status,200);
c=await lea('billing-checkout',{});assert.equal(c.status,200,JSON.stringify(c.data));assert.equal(sessions.at(-1)['line_items[0][price]'],'price_mx','checkout follows the country set by the agency');
assert.ok(h.sqlite.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='billing_price_follows_country' AND client_id=?").get(fr.id).n>=1);
assert.equal((await lea('state')).data.billing.localPrice.amount,1800);
// Retour au pays France pour la suite.
assert.equal((await h.call('settings',{client_id:fr.id,name:cfg.name,quota_limit:cfg.quota_limit,active:true,config:{...cfg.config,country:'FR'}})).status,200);
c=await lea('billing-checkout',{});assert.equal(sessions.at(-1)['line_items[0][price]'],'price_fr');
// Le retour depuis Stripe ne débloque rien : seule la notification signée + l'état Stripe comptent.
assert.equal((await lea('state?billing=success')).data.billing.access.allowed,false);
const cus=[...customers.keys()][0],start=now-60,end=start+30*86400;
subs.set('sub_'+cus,subscription(fr.id,cus,'price_fr',start,end));
assert.equal(await webhook('checkout.session.completed',cus,'evt_checkout'),200);
st=(await lea('state')).data;assert.equal(st.billing.access.state,'paid');assert.equal(st.billing.paidUntil,end);assert.equal(st.billing.hasSubscription,true);
assert.equal(h.sqlite.prepare('SELECT quota_limit,quota_used FROM clients WHERE id=?').get(fr.id).quota_limit,30,'credits renewed on first payment');
// Abonné : le bouton mène au portail (factures, carte, résiliation), dans la langue de la cliente.
const p=await lea('billing-portal',{});assert.equal(p.status,200);assert.match(p.data.url,/^https:\/\/billing\.stripe\.com\//);
assert.equal(portals.at(-1).locale,'fr');assert.equal(portals.at(-1).configuration,'bpc_portal');assert.equal(portals.at(-1).return_url,'https://studio.test/studio?billing=return');
assert.equal((await lea('billing-checkout',{})).data.url.startsWith('https://billing.stripe.com/'),true,'no second checkout once subscribed');
// Une fois abonnée, changer le pays ne touche pas à l'abonnement en cours.
await h.call('settings',{client_id:fr.id,name:cfg.name,quota_limit:cfg.quota_limit,active:true,config:{...cfg.config,country:'US'}});await lea('billing-checkout',{});
assert.equal(h.sqlite.prepare('SELECT price_id FROM billing_accounts WHERE client_id=?').get(fr.id).price_id,'price_fr');
await h.call('settings',{client_id:fr.id,name:cfg.name,quota_limit:cfg.quota_limit,active:true,config:{...cfg.config,country:'FR'}});
// Résiliation depuis le portail : l'accès reste jusqu'à la fin de la période payée…
subs.set('sub_'+cus,subscription(fr.id,cus,'price_fr',start,end,{cancelAtEnd:true}));assert.equal(await webhook('customer.subscription.updated',cus,'evt_cancel'),200);
assert.equal((await lea('state')).data.billing.access.state,'paid','access kept until the end of the paid period');
// … puis s'arrête (contenus conservés).
now=end+60;subs.set('sub_'+cus,subscription(fr.id,cus,'price_fr',start,end,{status:'canceled',cancelAtEnd:true}));assert.equal(await webhook('customer.subscription.deleted',cus,'evt_deleted'),200);
st=(await lea('state')).data;assert.equal(st.billing.access.allowed,false);assert.equal(st.billing.access.state,'suspended');
// Réabonnement possible : une nouvelle page de paiement est proposée.
c=await lea('billing-checkout',{});assert.equal(c.status,200);assert.match(c.data.url,/checkout\.stripe\.com/);

// ---- Un client aux États-Unis : échec de paiement → délai → suspension ----
now=Math.floor(Date.parse('2026-11-02T15:00:00Z')/1000);
const us=(await h.call('clients',{name:'Sunny Bakery',config:{allowedEmails:['sam@test.local'],language:'en',country:'US'}})).data;
await h.call('join',{code:us.code},'sam','sam@test.local');const sam=(p,b)=>h.call(p,b,'sam','sam@test.local');
s=await h.call('billing-settings',{client_id:us.id,version:1,enabled:true,grace_days:3,monthly_credits:30});assert.equal(s.status,200,JSON.stringify(s.data));assert.equal(s.data.record.price_id,'price_us');
assert.equal((await sam('billing-checkout',{})).status,200);assert.equal(sessions.at(-1).locale,'en');assert.equal(sessions.at(-1)['line_items[0][price]'],'price_us');
const cus2='cus_'+us.id.replaceAll('-',''),s2=now-60,e2=s2+30*86400;subs.set('sub_'+cus2,subscription(us.id,cus2,'price_us',s2,e2));assert.equal(await webhook('invoice.paid',cus2,'evt_uspaid'),200);
assert.equal((await sam('state')).data.billing.access.state,'paid');
now=e2+3600;subs.set('sub_'+cus2,subscription(us.id,cus2,'price_us',e2,e2+30*86400,{status:'past_due',paid:false,reason:'subscription_cycle'}));assert.equal(await webhook('invoice.payment_failed',cus2,'evt_usfailed'),200);
st=(await sam('state')).data;assert.equal(st.billing.access.state,'grace');assert.equal(st.billing.access.allowed,true);
now=e2+4*86400;st=(await sam('state')).data;assert.equal(st.billing.access.state,'suspended');assert.equal(st.billing.access.allowed,false);
assert.equal((await sam('billing-portal',{})).status,200,'portal stays reachable to update the card');
// Paiement régularisé → accès rouvert.
subs.set('sub_'+cus2,subscription(us.id,cus2,'price_us',e2,e2+30*86400,{reason:'subscription_cycle'}));assert.equal(await webhook('invoice.paid',cus2,'evt_usrecovered'),200);assert.equal((await sam('state')).data.billing.access.state,'paid');
// Isolation : portail et paiement d'un autre espace refusés.
assert.equal((await sam('billing-portal',{client_id:fr.id})).status,403);assert.equal((await sam('billing-checkout',{client_id:fr.id})).status,403);

// ---- Tarif personnalisé conservé ----
const vip=(await h.call('clients',{name:'VIP',config:{allowedEmails:['vip@test.local'],country:'FR'}})).data;await h.call('join',{code:vip.code},'vip','vip@test.local');
s=await h.call('billing-settings',{client_id:vip.id,version:1,enabled:true,price_id:'price_custom',grace_days:3,monthly_credits:30});assert.equal(s.status,200);
await h.call('billing-checkout',{client_id:vip.id},'vip','vip@test.local');assert.equal(sessions.at(-1)['line_items[0][price]'],'price_custom','agency custom price never replaced');

// ---- Pays choisi à l'inscription publique → tarif du bon pays ----
const now2=new Date().toISOString();
h.sqlite.prepare("INSERT INTO public_subscription_requests(id,request_key,first_name,email,name,workspace_type,language,answers,consent_at,created,ip_hash,copy_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run('req1','k1','Ana','ana@test.local','Ana Studio','brand','es',JSON.stringify({_country:'FR'}),now2,now2,'ip','v1');
const g=harness(async()=>Response.json({}));await g.call('state');
g.sqlite.prepare("INSERT INTO public_subscription_requests(id,request_key,first_name,email,name,workspace_type,language,answers,consent_at,created,ip_hash,copy_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run('req1','k1','Ana','ana@test.local','Ana Studio','brand','es',JSON.stringify({_country:'FR'}),now2,now2,'ip','v1');
{const rr=await g.call('register',{name:'Ana Studio',first_name:'Ana',workspaceType:'brand',language:'es'},'ana','Ana@Test.local');assert.equal(rr.status,200,JSON.stringify(rr.data))}
assert.equal(JSON.parse(g.sqlite.prepare("SELECT config FROM clients WHERE name='Ana Studio'").get().config).country,'FR','country from the public form');
assert.equal((await g.call('register',{name:'Bo',first_name:'Bo',workspaceType:'brand',language:'en'},'bo','bo@test.local')).status,200);
assert.equal(JSON.parse(g.sqlite.prepare("SELECT config FROM clients WHERE name='Bo'").get().config).country,'US','otherwise the language decides');

// ---- Pages légales : complètes dans les 3 langues, brouillon signalé, aucun identifiant inventé ----
for(const slug of LEGAL_SLUGS)for(const l of ['fr','es','en']){const pg=LEGAL_PAGES[slug][l];assert.ok(pg.title&&pg.intro&&pg.sections.length>=3,slug+' '+l);const all=JSON.stringify(pg);assert.doesNotMatch(all,/\b\d{14}\b|\bFR\d{11}\b/,'no invented SIRET / VAT number');}
assert.equal(LEGAL_PAGES.conditions.fr.sections.length,LEGAL_PAGES.conditions.es.sections.length);assert.equal(LEGAL_PAGES.conditions.fr.sections.length,LEGAL_PAGES.conditions.en.sections.length);
assert.match(LEGAL_UI.fr.draft,/Brouillon à faire valider par un professionnel du droit/);
const terms=JSON.stringify(LEGAL_PAGES.conditions.fr);for(const k of ['89 €','pays de facturation','sans engagement','fin de la période','[RAISON SOCIALE]'])assert.ok(terms.toLowerCase().includes(k.toLowerCase()),k);for(const k of ['1 800 MXN par mois','120 USD par mois'])assert.ok(!terms.includes(k),'no side-by-side prices: '+k);assert.match(JSON.stringify(LEGAL_PAGES.conditions.es),/1 800 MXN al mes/);assert.match(JSON.stringify(LEGAL_PAGES.conditions.en),/USD 120 per month/);
const privacy=JSON.stringify(LEGAL_PAGES.confidentialite.fr);for(const k of ['Supabase','Vercel','Stripe','Brevo','OpenAI','Calendly','cookie'])assert.ok(privacy.includes(k),k);
console.log('sales-ready OK — tarif du pays (89 € / 1 800 MXN / 120 USD), paiement Stripe, activation par notification signée, portail factures/carte/résiliation, fin de période, impayé → délai → suspension → reprise, pages légales FR/ES/EN');
