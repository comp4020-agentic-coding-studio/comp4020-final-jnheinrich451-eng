import { expect, it } from 'vitest';
import net from 'node:net';
import { smtpMailer } from '../accounts/mail.js';

it('delivers a verification message through a local SMTP capture without contacting an external mailbox', async () => {
  let captured = '', recipient = '';
  const sockets = new Set<net.Socket>();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8'); socket.write('220 local test SMTP\r\n');
    let buffer = '', data = false;
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) { if (line === '.') { data = false; socket.write('250 accepted\r\n'); } else captured += line + '\n'; }
        else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 OK\r\n');
        else if (/^RCPT TO:/.test(line)) { recipient = line; socket.write('250 OK\r\n'); }
        else if (line === 'DATA') { data = true; socket.write('354 send data\r\n'); }
        else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); if (!address || typeof address === 'string') throw new Error();
    const mailer = smtpMailer({ APP_ORIGIN: 'http://127.0.0.1:8080', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(address.port), MAIL_FROM: 'Frontier <test@frontier.test>' });
    expect(mailer.available).toBe(true);
    await mailer.send('pilot@example.org', 'a'.repeat(64), 'verify');
    expect(recipient).toContain('pilot@example.org');
    expect(captured).toContain('Verify your Frontier email');
    // Quoted-printable encodes '=' and may soft-wrap the link.
    expect(captured.replace(/=\n/g, '').replace(/=3D/g, '=')).toContain('/verify/#token=' + 'a'.repeat(64));
  } finally { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('disables missing SMTP configuration and refuses insecure non-local origins', () => {
  expect(smtpMailer({}).available).toBe(false);
  expect(smtpMailer({ APP_ORIGIN: 'http://example.org', SMTP_HOST: 'smtp-relay.brevo.com', MAIL_FROM: 'a@example.org', SMTP_USER: 'test', SMTP_PASSWORD: 'not-a-real-credential' }).available).toBe(false);
});
