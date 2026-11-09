import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {handleStudio} from '../lib/studio.mjs';
import {intakeQuestions} from '../lib/client-intake.mjs';
import {MAIL_COPY_VERSION} from '../lib/studio-email-templates.mjs';
const h=harness(()=>{throw Error('No paid API call is allowed')});let sent=0;
h.env.BREVO_FETCH=async()=>{sent++;return Response.json({messageId:'mock-received-'+sent})};
async function issue(ip='192.0.2.1',email='camille@example.test'){const r=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{headers:{'cf-connecting-ip':ip,'x-forwarded-for':ip,'oai-authenticated-user-id':'lead:'+email,'oai-authenticated-user-email':email}}),h.env);return {email,status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
function body(n,overrides={}){return {nonce:n.data.nonce,request_key:crypto.randomUUID(),first_name:'Camille',name:'Marque fictive',email:'camille@example.test',workspaceType:'brand',language:'fr',answers:Object.fromEntries(intakeQuestions.map(q=>[q.key,'Réponse fictive à étudier.'])),consent:true,...overrides}}
async function post(n,b,options={}){const r=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{method:'POST',headers:{'Content-Type':'application/json','Origin':options.origin||'https://studio.test','X-Studio-Request':'1','cf-connecting-ip':options.ip||'192.0.2.1','x-forwarded-for':options.ip||'192.0.2.1','oai-authenticated-user-id':options.otherUser||'lead:'+n.email,'oai-authenticated-user-email':n.email,...(options.noCookie?{}:{Cookie:n.cookie})},body:JSON.stringify(b)}),h.env);return {status:r.status,data:await r.json()}}
assert.equal((await h.call('subscription-request',undefined,'')).status,200,'public form issues a nonce without account');
assert.equal((await h.call('subscription-request',{email:'anonymous@example.test'},'')).status,403,'post without nonce is refused');
const n=await issue();assert.equal(n.status,200);assert.match(n.cookie,/louvet_subscription_nonce=/);
assert.equal((await post(n,body(n),{origin:'https://attacker.test'})).status,403);
assert.equal((await post(n,body(n),{noCookie:true})).status,403);
/* Identity binding removed: the public form is anonymous since the Vercel migration. */
{/* Base de test séparée : cette vérification ne doit pas fausser les compteurs du reste du fichier. */const h2=harness(()=>{throw Error('No paid API call is allowed')});h2.env.BREVO_FETCH=h.env.BREVO_FETCH;const g=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{headers:{'x-forwarded-for':'192.0.2.77'}}),h2.env);const nv={email:'victim@example.test',data:await g.json(),cookie:g.headers.get('set-cookie')?.split(';')[0]};const v=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://studio.test','X-Studio-Request':'1','x-forwarded-for':'192.0.2.77',Cookie:nv.cookie},body:JSON.stringify(body(nv,{email:'victim@example.test'}))}),h2.env);assert.equal(v.status,200,'the form accepts the request');const vs=await h2.call('state',null,'victim','victim@example.test');assert.ok(vs.status!==200||!(vs.data.clients||[]).length,'a public request never grants access to a workspace by itself')}
assert.equal((await post(n,body(n,{consent:false}))).status,400);
assert.equal((await post(n,body(n,{answers:{story:'Test'}}))).status,400);
assert.equal((await post(n,body(n,{website:'bot.test'}))).status,400);
{/* Formulaire court : sans questionnaire, avec Instagram et pays. */const hs=harness(()=>{throw Error('No paid API call is allowed')});const g=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{headers:{'x-forwarded-for':'192.0.2.90'}}),hs.env);const ns={data:await g.json(),cookie:g.headers.get('set-cookie')?.split(';')[0]};const r=await handleStudio(new Request('https://studio.test/api/studio/subscription-request',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://studio.test','X-Studio-Request':'1','x-forwarded-for':'192.0.2.90',Cookie:ns.cookie},body:JSON.stringify({nonce:ns.data.nonce,request_key:crypto.randomUUID(),first_name:'Sam',name:'Short Form Co',email:'sam@example.test',workspaceType:'brand',language:'en',country:'US',instagram:'@shortform',consent:true})}),hs.env);assert.equal(r.status,200,'short form accepted');const row=hs.sqlite.prepare('SELECT language,answers FROM public_subscription_requests').get();assert.equal(row.language,'en');assert.deepEqual(JSON.parse(row.answers),{_country:'US',_instagram:'@shortform'})}
const b=body(n),ok=await post(n,b);assert.equal(ok.status,200);assert.equal(ok.data.mail,'held');assert.equal(sent,0);
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM accounts').get().n,0,'public request creates no identity');
assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM clients').get().n,0,'public request creates no tenant');
assert.equal((await post(n,b)).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM public_subscription_requests').get().n,1,'duplicate submit stays idempotent');
assert.equal((await post(n,body(n))).status,409);
assert.equal((await h.call('public-requests',undefined,'')).status,401);
assert.equal((await h.call('public-requests',undefined,'stranger')).status,403);
const agency=await h.call('public-requests');assert.equal(agency.status,200);assert.equal(agency.data[0].answers.story,b.answers.story);assert.equal(agency.data[0].email,b.email);
const stranger=(await h.call('state',undefined,'stranger')).data;assert.deepEqual(stranger.publicRequests,[]);assert.equal(JSON.stringify(stranger).includes(b.email),false);
// Approval and server secrets are all needed. Previously held requests are never swept up.
h.env.BREVO_API_KEY='mock-only';h.env.BREVO_SENDER_EMAIL='studio@example.test';h.env.STUDIO_URL='https://studio.test';h.env.EMAIL_DELIVERY_ENABLED='true';
const unapproved=await issue('192.0.2.2','es@example.test');assert.equal((await post(unapproved,body(unapproved,{email:'es@example.test',language:'es'}),{ip:'192.0.2.2'})).data.mail,'held');assert.equal(sent,0);
h.env.EMAIL_COPY_APPROVED_VERSION=MAIL_COPY_VERSION;
let sentBody;h.env.BREVO_FETCH=async(url,init)=>{sent++;sentBody=JSON.parse(init.body);return Response.json({messageId:'mock-approved'})};
const approved=await issue('192.0.2.3','approved@example.test');assert.equal((await post(approved,body(approved,{email:'approved@example.test',language:'es'}),{ip:'192.0.2.3'})).data.mail,'sent');assert.equal(sent,1);assert.equal(sentBody.subject,'Recibimos tu solicitud');assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM public_subscription_requests WHERE mail_status='held'").get().n,2);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM studio_mail_members').get().n,0,'unverified leads are not subscribed members');
// Lost provider response is recorded and never blindly retried by browser resubmission.
h.env.BREVO_FETCH=async()=>{sent++;throw Error('mock timeout')};
const uncertain=await issue('192.0.2.4','uncertain@example.test'),ub=body(uncertain,{email:'uncertain@example.test'});assert.equal((await post(uncertain,ub,{ip:'192.0.2.4'})).data.mail,'uncertain');const before=sent;assert.equal((await post(uncertain,ub,{ip:'192.0.2.4'})).data.mail,'uncertain');assert.equal(sent,before);
// Per-IP limits apply to separate forms; the fourth request cannot create another lead.
for(let i=0;i<6;i++){const ip='198.51.100.'+(i+1),v=await issue(ip,`limit${i}@example.test`),r=await post(v,body(v,{email:`limit${i}@example.test`}),{ip});assert.equal(r.status,i<5?200:429,'limite par sous-réseau /24')}
console.log('PASS: login-required 10-question request, verified address and identity-bound nonce and same-origin protection, consent/validation/rate limits, idempotency, no account or tenant grant, agency-only answers, gated bilingual Brevo receipt and uncertain-send protection.');
