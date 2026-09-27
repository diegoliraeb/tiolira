import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {database} from '../server/postgres.mjs';
import seed from '../data/catalog.json' with {type:'json'};
try {
 const sql=database();
 await sql`CREATE SCHEMA IF NOT EXISTS tiolira`;
 await sql`CREATE TABLE IF NOT EXISTS tiolira.records (key text PRIMARY KEY, data jsonb NOT NULL, revision text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 // Seed only missing records; never overwrite an existing live catalog or administrator.
 await sql`INSERT INTO tiolira.records (key,data,revision) VALUES ('catalog.json',${JSON.stringify(seed)}::jsonb,${randomUUID()}) ON CONFLICT (key) DO NOTHING`;
 const token=randomBytes(32).toString('base64url');
 const security={sessionSecret:randomBytes(48).toString('base64url'),setupTokenHash:createHash('sha256').update(token).digest('hex')};
 const added=await sql`INSERT INTO tiolira.records (key,data,revision) VALUES ('security.json',${JSON.stringify(security)}::jsonb,${randomUUID()}) ON CONFLICT (key) DO NOTHING RETURNING key`;
 if(added.length){await mkdir('.local-data',{recursive:true,mode:0o700});await writeFile('.local-data/admin-setup.txt',`Configuração inicial do Tio Lira\n\nAbra https://tiolira.vercel.app/admin\nNo campo Código de configuração, use:\n${token}\n\nEscolha você mesmo seu e-mail e uma senha de pelo menos 12 caracteres.\nO código só cria o primeiro administrador e não altera uma conta existente.\nNão publique este arquivo.\n`,{mode:0o600});}
 const [counts]=await sql`SELECT jsonb_array_length(data->'products') AS products, jsonb_array_length(data->'stores') AS stores FROM tiolira.records WHERE key='catalog.json'`;
 console.log(JSON.stringify({database:'Neon PostgreSQL',schema:'tiolira',products:counts.products,stores:counts.stores,initialSetupCreated:Boolean(added.length)}));
}catch(error){console.error('Falha na migração.',error.code||error.name,'Verifique a conexão e as permissões do banco.');process.exitCode=1;}
