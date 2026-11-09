// Suivi des erreurs : facultatif (SENTRY_DSN), sans donnée personnelle.
import assert from 'node:assert/strict';
import {scrub,parseDsn,reportError} from '../lib/monitor.mjs';
assert.equal(scrub('fail for lea@test.local with sk_live_abc123 and Bearer eyJ.x.y'),'fail for [email] with [secret] and Bearer [secret]');
assert.equal(scrub('id 4b0f7c1e-1111-2222-3333-444455556666 /x?token=abc&y=1'),'id [id] /x?token=[masqué]&y=1');
assert.equal(scrub('x'.repeat(3000)).length,2000);
assert.deepEqual(parseDsn('https://pub123@o1.ingest.sentry.io/4567'),{key:'pub123',host:'o1.ingest.sentry.io',project:'4567',url:'https://o1.ingest.sentry.io/api/4567/envelope/'});
assert.equal(parseDsn('http://k@h/1'),null);assert.equal(parseDsn('nonsense'),null);assert.equal(parseDsn(''),null);
// Sans DSN : rien n'est envoyé.
let calls=[];const f=async(u,o)=>{calls.push([u,o]);return new Response('{}')};
assert.deepEqual(await reportError({MONITOR_FETCH:f},{message:'boom'}),{sent:false});assert.equal(calls.length,0);
// Avec DSN : une enveloppe Sentry, sans e-mail ni secret.
const r=await reportError({SENTRY_DSN:'https://pub123@o1.ingest.sentry.io/4567',MONITOR_FETCH:f},{message:'TypeError: lea@test.local',stack:'at x (sk_test_123)',path:'/api/studio/state',source:'browser'});
assert.equal(r.sent,true);assert.equal(calls.length,1);
const [url,opts]=calls[0];assert.equal(url,'https://o1.ingest.sentry.io/api/4567/envelope/');assert.match(opts.headers['X-Sentry-Auth'],/sentry_key=pub123/);
assert.ok(!/test\.local|sk_test/.test(opts.body),'no personal data or secret in the report');
const ev=JSON.parse(opts.body.split('\n')[2]);assert.equal(ev.tags.source,'browser');assert.equal(ev.level,'error');
// Un échec réseau ne casse jamais l'action en cours.
assert.deepEqual(await reportError({SENTRY_DSN:'https://pub123@o1.ingest.sentry.io/4567',MONITOR_FETCH:async()=>{throw new Error('down')}},{message:'x'}),{sent:false});
console.log('monitor OK — Sentry facultatif, enveloppe côté serveur, e-mails et secrets masqués, jamais bloquant');
