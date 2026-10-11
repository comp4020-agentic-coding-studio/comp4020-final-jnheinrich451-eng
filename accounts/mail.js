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
        const request = purpose === 'verify'
          ? 'We received a request to register a Frontier account using this email address. To verify that you control this address and activate your account, open the link below and confirm on the page.'
          : 'We received a request to reset the password for your Frontier account. To choose a new password, open the link below and follow the instructions on the page.';
        const result = await transport.sendMail({ from, to: email, subject: action,
          text: `Hello,\n\nFrontier is a multiplayer game developed as a COMP8020 student project.\n\n${request}\n\n${url}\n\nThis link expires in 30 minutes and can be used once. Opening it alone does not change your account.\n\nIf you did not request this, you can ignore this email. No action is required.\n\nFrontier student project` });
        if (!result.accepted?.length) throw new Error('Mail not accepted');
      } finally { sending--; }
    },
  };
}
