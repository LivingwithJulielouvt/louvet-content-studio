// Mode « vraie base Postgres » pour les tests : HARNESS_PG=1 node tests/xxx.mjs
// Chaque fichier de test reçoit une base neuve créée à partir des scripts Supabase (00 + 02).
// Les assertions écrites en SQL synchrone (h.sqlite...) passent par psql.
import {execFileSync} from 'node:child_process';
import {pgSQL,StudioDatabase} from '../lib/vercel-db.mjs';
import pg from 'pg';
const host=process.env.HARNESS_PG_HOST||'127.0.0.1',port=process.env.HARNESS_PG_PORT||'5433';
const psql=(db,args)=>execFileSync('psql',['-h',host,'-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const literal=(v)=>v===null||v===undefined?'NULL':typeof v==='number'||typeof v==='bigint'?String(v):typeof v==='boolean'?(v?'1':'0'):"'"+String(v).replaceAll("'","''")+"'";
function inline(sql,args){return pgSQL(sql).replace(/\$(\d+)/g,(_,n)=>literal(args[Number(n)-1]))}
export function pgHarnessDb(includeBetaFixtures=false){
 const name='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
 psql('postgres',['-c',`CREATE DATABASE ${name}`]);
 for(const f of ['00-schema.sql','02-nouvelles-fonctions.sql',...(includeBetaFixtures?['01-beta-fixtures-OPTIONNEL.sql']:[]),'03-protections.sql'])psql(name,['-q','-f',new URL('../supabase/'+f,import.meta.url).pathname]);
 process.env.DATABASE_URL=`postgres://postgres@${host}:${port}/${name}`;process.env.DATABASE_SSL='false';
 const db=new StudioDatabase(null,new pg.Pool({connectionString:`postgres://postgres@${host}:${port}/${name}`,max:5}));
 const sqlite={
  exec(sql){psql(name,['-c',sql])},
  prepare(sql){return{
   get:(...a)=>sqlite.prepare(sql).all(...a)[0],
   all:(...a)=>JSON.parse(psql(name,['-At','-c',`SELECT coalesce(json_agg(t),'[]') FROM (${inline(sql,a).replace(/;\s*$/,'')}) t`]).trim()||'[]'),
   run:(...a)=>{const out=psql(name,['-c',inline(sql,a)]);return{changes:Number(out.trim().split(/\s+/).pop())||0}},
  }},
 };
 return {db,sqlite,name};
}
