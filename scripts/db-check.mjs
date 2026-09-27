import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from '../server/postgres.mjs';
import {readRecord,writeRecord,Conflict} from '../server/store.mjs';
import {setupReady,securityReady} from '../server/auth.mjs';
const key=`checks/${randomUUID()}.json`;
try{
 const revision=await writeRecord(key,{test:'first'},null);
 assert.equal((await readRecord(key)).data.test,'first');
 const attempts=await Promise.allSettled([writeRecord(key,{test:'second'},revision),writeRecord(key,{test:'third'},revision)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
 const failed=attempts.find(r=>r.status==='rejected');assert.ok(failed.reason instanceof Conflict);
 assert.equal(await securityReady(),true);assert.equal(await setupReady(),true);
 console.log('Neon: leitura, gravação, conflito simultâneo e configuração de segurança verificados.');
}catch(error){console.error('Falha na verificação do Neon.',error.code||error.name);process.exitCode=1}
finally{try{const sql=database();await sql`DELETE FROM tiolira.records WHERE key=${key}`;}catch{console.error('Não foi possível remover o registro temporário de verificação.');process.exitCode=1}}
