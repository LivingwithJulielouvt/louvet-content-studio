import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SERVER_MESSAGES,translateServerMessage} from '../lib/server-messages.mjs';
assert.equal(translateServerMessage('Espace introuvable.','es'),'Espacio no encontrado.');
assert.equal(translateServerMessage('Espace introuvable.','en'),'Space not found.');
assert.equal(translateServerMessage('Espace introuvable.','fr'),'Espace introuvable.');
assert.equal(translateServerMessage('Message inconnu.','en'),'Message inconnu.');
assert.equal(translateServerMessage(undefined,'en'),undefined);
for(const [fr,v] of Object.entries(SERVER_MESSAGES)){assert.ok(Array.isArray(v)&&v.length===2&&v.every(x=>typeof x==='string'&&x.trim()),fr)}
// Chaque message littéral fail(…, "…") des fichiers serveur est couvert.
const missing=[];
for(const f of fs.readdirSync(new URL('../lib/',import.meta.url)).filter(x=>x.endsWith('.mjs'))){const s=fs.readFileSync(new URL('../lib/'+f,import.meta.url),'utf8');for(const m of s.matchAll(/fail\(\s*\d+\s*,\s*"((?:[^"\\]|\\.)*)"/g))if(!SERVER_MESSAGES[m[1]])missing.push(f+': '+m[1])}
assert.deepEqual(missing,[],'messages serveur sans traduction');
console.log('PASS: '+Object.keys(SERVER_MESSAGES).length+' server messages translated (es/en), unknown and French passthrough, full fail() coverage.');
