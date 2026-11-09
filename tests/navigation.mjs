import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {studioDestination,studioLoginPath} from '../lib/studio-navigation.mjs';
import {harness} from './harness.mjs';
for(const next of ['https://attacker.test','//attacker.test','/\\attacker.test','/signin-with-chatgpt','/callback','/api/studio/state','/connexion','/studio/../../evil',null])assert.equal(studioDestination(next),'/studio');
assert.equal(studioDestination('/souscrire?lang=es&next=https://attacker.test'),'/souscrire?lang=es');
assert.equal(studioLoginPath('/studio'),'/connexion?next=%2Fstudio&lang=fr');
globalThis.__studioTestHeaders=new Headers();
const hook=registerHooks({
 resolve(specifier,context,next){
  if(specifier==='next/headers'||specifier==='next/navigation')return{url:'studio-test:'+specifier,shortCircuit:true};
  if(specifier==='server-only')return{url:'studio-test:server-only',shortCircuit:true};
  if(context.parentURL?.includes('/app/studio/page.tsx')&&['../studio-ui','../beta-chrome'].includes(specifier))return{url:'studio-test:client',shortCircuit:true};
  if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const u=new URL(specifier,context.parentURL);if(!/\.[a-z]+$/i.test(u.pathname))for(const ext of ['.tsx','.ts','.mjs'])if(fs.existsSync(fileURLToPath(u)+ext))return{url:u.href+ext,shortCircuit:true}}
  return next(specifier,context);
 },
 load(url,context,next){
  if(url==='studio-test:next/headers')return{format:'module',source:'export async function headers(){return globalThis.__studioTestHeaders} export async function cookies(){return{getAll(){return[]},get(){return undefined},set(){},delete(){}}}',shortCircuit:true};
  if(url==='studio-test:next/navigation')return{format:'module',source:'export function redirect(path){throw Object.assign(new Error("redirect"),{destination:path})} export function useRouter(){return{push(){},replace(){},refresh(){}}} export function useSearchParams(){return new URLSearchParams()} export function usePathname(){return "/"}',shortCircuit:true};
  if(url==='studio-test:server-only')return{format:'module',source:'export {}',shortCircuit:true};
  if(url==='studio-test:client')return{format:'module',source:'export default function Client(){return null}',shortCircuit:true};
  if(url.startsWith('file:')&&/\.tsx?$/.test(url)){return{format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true}}
  return next(url,context);
 }
});
const home=(await import('../app/page.tsx')).default,studio=(await import('../app/studio/page.tsx')).default,subscribe=(await import('../app/souscrire/page.tsx')).default,login=(await import('../app/connexion/page.tsx')).default,fallback=(await import('../app/[...protectedPath]/page.tsx')).default;
async function redirects(fn,path){await assert.rejects(fn,e=>e.destination===path)}
const anonymousHome=renderToStaticMarkup(React.createElement(home));assert.match(anonymousHome,/Une agence humaine/);assert.doesNotMatch(anonymousHome,/oai-authenticated|louvet.partners@gmail/);
await redirects(studio,studioLoginPath('/studio'));await redirects(fallback,studioLoginPath('/studio'));
// Le formulaire de demande est public (pas de connexion requise) et ne prend aucun paiement.
const formMarkup=renderToStaticMarkup(await subscribe({searchParams:Promise.resolve({lang:'es'})}));assert.match(formMarkup,/lang="es"/);
const loginMarkup=renderToStaticMarkup(await login({searchParams:Promise.resolve({next:'https://attacker.test'})}));assert.doesNotMatch(loginMarkup,/href="https:\/\/attacker/);
hook.deregister();
const h=harness(()=>{throw Error('No live API')});await h.call('state');
const a=(await h.call('clients',{name:'Fiction A',config:{allowedEmails:['a@example.test']}})).data,b=(await h.call('clients',{name:'Fiction B',config:{allowedEmails:['b@example.test']}})).data;
await h.call('join',{code:a.code},'a','a@example.test');await h.call('join',{code:b.code},'b','b@example.test');
const owner=(await h.call('state')).data,client=(await h.call('state',undefined,'a','a@example.test')).data;
assert.equal(owner.user.role,'agency');assert.equal(client.user.role,'client');assert.equal(client.selected,a.id);assert.deepEqual(client.clients.map(c=>c.id),[a.id]);assert.equal((await h.call('state?client='+b.id,undefined,'a','a@example.test')).status,403);
for(const action of ['state','public-requests','file/fake'])assert.equal((await h.call(action,undefined,'')).status,401,action);
for(const action of ['generate','feedback','billing-checkout','publication-confirm'])assert.equal((await h.call(action,{client_id:a.id},'')).status,401,action);
console.log('PASS: public root unchanged across sessions, login required for studio and unknown pages, public request form, safe return URLs, sign-in return to own role and tenant, no anonymous API access. Native identity mocked; no email or live deployment.');
