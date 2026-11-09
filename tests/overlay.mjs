import assert from 'node:assert/strict';
import {overlayInstruction} from '../lib/studio.mjs';
assert.equal(overlayInstruction(null),'Do not add claims, text or logos.','default keeps the no-text rule');
const p=overlayInstruction({text:'Nouvelle collection · -20 %',style:'handwritten'});
assert.match(p,/"Nouvelle collection · -20 %"/);assert.match(p,/handwritten/);assert.match(p,/do not add any other words/);
assert.match(overlayInstruction({text:'Hola',style:'unknown'}),/serif/,'unknown style falls back to elegant');
console.log('overlay OK');
