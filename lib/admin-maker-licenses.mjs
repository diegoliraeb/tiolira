export const licenseStatusLabels={active:'Ativa',expired:'Vencida',pending:'Pagamento pendente',failed:'Tentativa não concluída',review:'Em conferência',revoked:'Revogada',cancelled:'Cancelada',none:'Sem licença',creating:'Criando cobrança',paid:'Pago',overdue:'Pagamento vencido',subscribed:'Assinatura anterior'};
export const isLicenseAttempt=r=>!r.active&&['failed','pending','creating','review','overdue'].includes(r.status);
export const isLicenseDue=(r,days=30)=>r.active&&r.daysRemaining!==null&&r.daysRemaining>=0&&r.daysRemaining<=days;
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function licenseDateKey(value){if(!value||!Number.isFinite(Date.parse(value)))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-')}
export function licenseCounts(rows){return {all:rows.length,active:rows.filter(r=>r.active).length,due:rows.filter(r=>isLicenseDue(r)).length,expired:rows.filter(r=>r.status==='expired').length,attempt:rows.filter(isLicenseAttempt).length}}
export function filterMakerLicenses(rows,{query='',status='all',provider='all',validity='all',from='',to='',sort='expiry'}={}){
 const q=normalize(query).trim();return rows.filter(r=>{
 if(q&&!normalize(`${r.name} ${r.email} ${r.whatsapp}`).includes(q)&&!(q.replace(/\D/g,'').length>=4&&String(r.whatsapp||'').replace(/\D/g,'').includes(q.replace(/\D/g,''))))return false;
 if(status!=='all'&&!(status==='active'?r.active:status==='due'?isLicenseDue(r):status==='attempt'?isLicenseAttempt(r):r.status===status))return false;
 if(provider!=='all'&&r.provider!==provider)return false;
 if(validity==='none'&&r.validUntil||validity==='expired'&&r.status!=='expired'||['7','30','90'].includes(validity)&&!isLicenseDue(r,Number(validity)))return false;
 const day=licenseDateKey(r.validUntil);if((from&&(!day||day<from))||(to&&(!day||day>to)))return false;
 return true;
 }).sort((a,b)=>sort==='name'?String(a.name||'').localeCompare(b.name||'','pt-BR'):sort==='recent'?(Date.parse(b.lastActivityAt||b.createdAt)||0)-(Date.parse(a.lastActivityAt||a.createdAt)||0):(Date.parse(a.validUntil)||Infinity)-(Date.parse(b.validUntil)||Infinity)||String(a.name||'').localeCompare(b.name||'','pt-BR'));
}
