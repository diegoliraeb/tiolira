import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
export const databaseUrl=()=>process.env.DATABASE_URL||process.env.POSTGRES_URL;
export function database(){const url=databaseUrl();if(!url)throw new Error('DATABASE_URL não configurada.');return neon(url);}
export async function readPostgresRecord(key){const sql=database();const [row]=await sql`SELECT data, revision FROM tiolira.records WHERE key=${key}`;return row?{data:row.data,etag:row.revision}:null;}
export async function writePostgresRecord(key,data,etag){
 const sql=database(),revision=randomUUID();
 // Compare-and-swap is a single SQL statement, also across Vercel instances.
 const rows=etag?await sql`UPDATE tiolira.records SET data=${JSON.stringify(data)}::jsonb, revision=${revision}, updated_at=now() WHERE key=${key} AND revision=${etag} RETURNING revision`:await sql`INSERT INTO tiolira.records (key,data,revision) VALUES (${key},${JSON.stringify(data)}::jsonb,${revision}) ON CONFLICT (key) DO NOTHING RETURNING revision`;
 return rows[0]?.revision??null;
}
