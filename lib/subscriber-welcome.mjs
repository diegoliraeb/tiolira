// Stored in the same atomic write as the first confirmed entitlement.
// Existing paid periods never gain a marker on a repeated webhook or on renewal.
export function markSubscriberWelcome(row,rows,now=new Date().toISOString()){
 if(row.welcomeRequestedAt||row.status!=='paid'||!row.startsAt||!row.endsAt)return;
 if(rows.some(r=>r.id!==row.id&&r.memberId===row.memberId&&r.environment===row.environment&&r.startsAt&&r.endsAt))return;
 row.welcomeRequestedAt=now;
}
export function markLegacySubscriberWelcome(row,hadPeriod,now=new Date().toISOString()){
 if(hadPeriod||row.welcomeRequestedAt||!row.periods?.some(p=>!p.revoked&&p.startsAt&&p.endsAt))return;
 row.welcomeRequestedAt=now;
}
