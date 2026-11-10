import {createHash, randomBytes, randomInt} from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
export const normalizedEmail = value => String(value || '').trim().toLowerCase();
export const emailIsVerified = member => Boolean(member?.emailVerification?.verifiedAt && member.emailVerification.email === normalizedEmail(member.email));
const fail = (message, status = 400) => {throw Object.assign(Error(message), {status});};

// Injected delivery and storage let tests exercise the real state transitions without sending email.
export function createEmailVerification({updateRecord, send, now = Date.now}) {
  const memberIn = (state, member) => {
    const current = state?.members?.find(m => m.id === member.id && m.version === member.version);
    if (!current || normalizedEmail(current.email) !== normalizedEmail(member.email)) fail('Entre novamente na sua conta.', 401);
    return current;
  };
  return {
    async request(member) {
      const code = String(randomInt(100_000_000)).padStart(8, '0');
      const salt = randomBytes(16).toString('hex'), createdAt = now();
      const pending = {salt, hash: digest(`${salt}:${code}`), email: normalizedEmail(member.email), createdAt, expiresAt: createdAt + 15 * 60_000, attempts: 0};
      let needed, name='';
      await updateRecord('club-members.json', state => {
        const current = memberIn(state, member); name=current.name || ''; needed = !emailIsVerified(current);
        if (!needed) return state;
        if (current.emailVerificationPending?.createdAt > now() - 60_000) fail('Aguarde um minuto antes de pedir outro código.', 429);
        current.emailVerificationPending = pending;
        return state;
      });
      if (!needed) return {verified: true};
      try {await send({email: pending.email, code, name});}
      catch {
        await updateRecord('club-members.json', state => {
          const current = state?.members?.find(m => m.id === member.id);
          if (current?.emailVerificationPending?.hash === pending.hash) delete current.emailVerificationPending;
          return state;
        });
        fail('Não foi possível enviar o código. Tente novamente em alguns instantes.', 503);
      }
      return {sent: true, expiresAt: new Date(pending.expiresAt).toISOString()};
    },
    async confirm(member, input) {
      if (typeof input?.code !== 'string' || !/^\d{8}$/.test(input.code)) fail('Informe os 8 números do código enviado por e-mail.');
      let verified = false;
      await updateRecord('club-members.json', state => {
        const current = memberIn(state, member); verified = emailIsVerified(current);
        if (verified) return state;
        const pending = current.emailVerificationPending;
        if (!pending || pending.email !== normalizedEmail(current.email) || pending.expiresAt <= now() || pending.attempts >= 5) return state;
        pending.attempts++;
        verified = digest(`${pending.salt}:${input.code}`) === pending.hash;
        if (verified) {
          current.emailVerification = {email: pending.email, verifiedAt: new Date(now()).toISOString()};
          delete current.emailVerificationPending;
        }
        return state;
      });
      if (!verified) fail('Código inválido ou expirado. Após 5 tentativas, solicite um novo código.');
      return {verified: true};
    },
  };
}
