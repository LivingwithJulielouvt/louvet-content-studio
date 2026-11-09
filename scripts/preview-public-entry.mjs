// Render the actual page component into a local, API-free review surface.
import fs from 'node:fs/promises';
import ts from 'typescript';
import {intakeQuestions,creatorIntakeQuestions} from '../lib/client-intake.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const source=new URL('../app/public-site.tsx',import.meta.url),compiled=new URL('../app/.public-site-preview.mjs',import.meta.url);
const compiledLogin=new URL('./.email-login-preview.mjs',import.meta.url);
await fs.writeFile(compiledLogin,ts.transpileModule(await fs.readFile(new URL('./email-login-preview.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
await fs.writeFile(compiled,ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
try{
 const {default:Page}=await import(compiled.href+'?v='+Date.now());
 const {default:EmailLogin}=await import(compiledLogin.href+'?v='+Date.now());
 const panels=[];
 for(const language of ['fr','es'])for(const view of ['home','form']){
  let markup=renderToStaticMarkup(React.createElement(Page,{initialView:view,initialLanguage:language,initialBeta:true}));
  markup=markup.replaceAll('tabindex="-1"','').replace(/id="(concept|how|price|faq)"/g,(_,id)=>`id="${language}-${id}"`).replace(/href="#(concept|how|price|faq)"/g,(_,id)=>`href="#${language}-${id}"`);
  panels.push(`<div data-preview-panel data-lang="${language}" data-view="${view}"${language==='fr'&&view==='home'?'':' hidden'}>\n${markup.replaceAll('><','>\n<')}\n</div>`);
 }
 for(const language of ['fr','es'])for(const view of ['login','entry'])panels.push(`<div data-preview-panel data-lang="${language}" data-view="${view}" hidden>\n${renderToStaticMarkup(React.createElement(EmailLogin,{language,entry:view==='entry'})).replaceAll('><','>\n<')}\n</div>`);
 const path='/workspace/louvet-studio-acces.html';
 const template=await fs.readFile(new URL('./public-entry-preview.template.html',import.meta.url),'utf8');
 if(!template.includes('<!--PUBLIC_PANELS-->'))throw Error('Use a fresh preview template.');
 const css=(await fs.readFile(new URL('../app/public-site.css',import.meta.url),'utf8')).split('.public-request{')[0];
 await fs.writeFile(path,template.replace('/*QUESTION_DATA*/null',JSON.stringify({brand:intakeQuestions,creator:creatorIntakeQuestions})).replace('/*PUBLIC_CSS*/',css).replace('<!--PUBLIC_PANELS-->',panels.join('\n')));
 console.log('Rendered actual FR/ES home and request form; local interactions only.');
}finally{await fs.unlink(compiled);await fs.unlink(compiledLogin)}
