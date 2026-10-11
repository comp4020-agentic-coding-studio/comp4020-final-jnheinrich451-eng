import nodemailer from 'nodemailer';
import { authError } from './passwords.js';

export function smtpMailer(env = process.env) {
  let transport, origin, from;
  try {
    const url = new URL(env.APP_ORIGIN);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && ['localhost', '127.0.0.1'].includes(env.SMTP_HOST);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error();
    if (!env.SMTP_HOST || !env.MAIL_FROM || /[\r\n]/.test(env.MAIL_FROM)) throw new Error();
    if (!local && (!env.SMTP_USER || !env.SMTP_PASSWORD)) throw new Error();
    const port = Number(env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    origin = url.origin; from = env.MAIL_FROM;
    transport = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465,
      requireTLS: !local && port !== 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
      disableFileAccess: true, disableUrlAccess: true });
  } catch { /* Guest/Demo play and existing login remain available without SMTP. */ }
  let sending = 0;
  return {
    available: !!transport,
    async send(email, token, purpose) {
      if (!transport) throw authError('Real email is not configured yet. Use Demo or continue as a guest.', 503);
      if (sending >= 2) throw authError('Email delivery is busy. Try again shortly.', 429);
      sending++;
      try {
        const action = purpose === 'verify' ? 'Verify your Frontier email' : 'Reset your Frontier password';
        const url = `${origin}/${purpose === 'verify' ? 'verify' : 'reset-password'}/#token=${token}`;
        const result = await transport.sendMail({ from, to: email, subject: action,
          text: `${action}\n\n${url}\n\nThis link expires in 30 minutes and works once. Opening the link does not change your account; confirm on the page. If you did not request this, ignore this email.` });
        if (!result.accepted?.length) throw new Error('Mail not accepted');
      } finally { sending--; }
    },
  };
}
