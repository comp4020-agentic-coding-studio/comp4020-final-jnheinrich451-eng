import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { authError, hashPassword, verifyPassword } from './passwords.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('hex');
const lifetime = 8 * 60 * 60 * 1000, actionLifetime = 30 * 60 * 1000;
export const ACCOUNT_COOKIE = 'frontier_account';
const INBOX_COOKIE = 'frontier_demo';
export function cookie(req, name) {
  return req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
}
function setCookie(req, res, name, value, age = lifetime / 1000) {
  const secure = process.env.APP_ORIGIN?.startsWith('https:') || req.headers['x-forwarded-proto'] === 'https';
  const previous = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`]);
}
function emailFor(raw, kind) {
  if (!['email', 'demo'].includes(kind)) throw authError('Choose Email or Demo mode.');
  if (typeof raw !== 'string') throw authError('Enter an email address.');
  const email = raw.trim().toLowerCase();
  if (kind === 'demo') {
    if (!/^[a-z0-9][a-z0-9._-]{0,47}@frontier\.test$/.test(email)) throw authError('Choose an address such as pilot@frontier.test for Demo.');
  } else if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) || email.endsWith('.test') || email.includes('..')) {
    throw authError('Enter a real email address. No ANU address is required. Use Demo for @frontier.test.');
  }
  return email;
}

export function createAccounts(db, { mailer, guest, revokePlayer, audit }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('email','demo')),
      email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
      pending_player_id TEXT UNIQUE, player_id TEXT UNIQUE,
      activated_at INTEGER, email_verified_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (hash TEXT PRIMARY KEY, account_id TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_tokens (hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_inboxes (hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_messages (id TEXT PRIMARY KEY, inbox_hash TEXT NOT NULL, nonce TEXT NOT NULL, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
  `);
  const jobs = new Set();
  let stopped = false;
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const accountById = id => db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
  function publicAccount(a) { return a ? { id: a.id, kind: a.kind, email: a.email, name: a.name, playerId: a.player_id, verifiedEmail: !!a.email_verified_at } : null; }
  function sessionHash(req) { const raw = cookie(req, ACCOUNT_COOKIE); return raw && /^[a-f0-9]{64}$/.test(raw) ? digest(raw) : null; }
  function sessionByHash(hash) {
    return hash ? db.prepare('SELECT a.*, s.hash AS session_hash FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.hash=? AND s.expires_at>? AND a.activated_at IS NOT NULL').get(hash, Date.now()) : null;
  }
  const account = req => sessionByHash(sessionHash(req));
  function inbox(req) {
    const raw = cookie(req, INBOX_COOKIE);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const row = db.prepare("SELECT i.*, a.kind FROM demo_inboxes i JOIN accounts a ON a.id=i.account_id WHERE i.hash=? AND i.expires_at>? AND a.kind='demo'").get(digest(raw), Date.now());
    return row ? { ...row, secret: raw } : null;
  }
  function cleanup() {
    const now = Date.now();
    for (const table of ['account_sessions', 'account_tokens', 'demo_inboxes', 'demo_messages']) db.prepare(`DELETE FROM ${table} WHERE expires_at<=?`).run(now);
    db.prepare('DELETE FROM account_limits WHERE resets_at<=?').run(now);
  }
  function throttle(key, max = 8) {
    const now = Date.now(), row = db.prepare('SELECT * FROM account_limits WHERE key=?').get(key);
    if (row && row.resets_at > now && row.count >= max) throw authError('Too many attempts. Please try again in 15 minutes.', 429);
    db.prepare('INSERT INTO account_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,resets_at=excluded.resets_at')
      .run(key, row && row.resets_at > now ? row.count + 1 : 1, row && row.resets_at > now ? row.resets_at : now + 15 * 60000);
  }
  function revoke(id, message) {
    const a = accountById(id);
    if (a?.player_id) revokePlayer(a.player_id, message);
    db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(id);
  }
  function closeInbox(req, res) {
    const current = inbox(req);
    if (current) {
      db.prepare('DELETE FROM demo_messages WHERE inbox_hash=?').run(current.hash);
      db.prepare('DELETE FROM demo_inboxes WHERE hash=?').run(current.hash);
    }
    setCookie(req, res, INBOX_COOKIE, '', 0);
  }
  function openInbox(a, req, res) {
    if (a.kind !== 'demo') throw authError('Only Demo accounts have a simulated inbox.');
    closeInbox(req, res);
    // At most one private inbox grant per Demo account. Reopening needs password
    // authentication or an already valid account session, never just an address.
    db.prepare('DELETE FROM demo_messages WHERE inbox_hash IN (SELECT hash FROM demo_inboxes WHERE account_id=?)').run(a.id);
    db.prepare('DELETE FROM demo_inboxes WHERE account_id=?').run(a.id);
    const raw = secret(), hash = digest(raw);
    db.prepare('INSERT INTO demo_inboxes VALUES (?,?,?)').run(hash, a.id, Date.now() + lifetime);
    setCookie(req, res, INBOX_COOKIE, raw);
    return { hash, account_id: a.id, secret: raw };
  }
  const messageToken = (grant, nonce) => createHmac('sha256', grant.secret).update(`frontier-demo:${nonce}`).digest('hex');
  async function deliver(a, purpose, grant = null) {
    const nonce = secret(), token = a.kind === 'demo' ? messageToken(grant, nonce) : secret(), hash = digest(token);
    const expires = Date.now() + actionLifetime;
    transaction(() => {
      // Only the newest action of this purpose remains usable.
      db.prepare('DELETE FROM account_tokens WHERE account_id=? AND purpose=?').run(a.id, purpose);
      db.prepare('INSERT INTO account_tokens VALUES (?,?,?,?)').run(hash, a.id, purpose, expires);
      if (a.kind === 'demo') {
        db.prepare('DELETE FROM demo_messages WHERE inbox_hash=? AND purpose=?').run(grant.hash, purpose);
        db.prepare('INSERT INTO demo_messages VALUES (?,?,?,?,?)').run(randomUUID(), grant.hash, nonce, purpose, expires);
      }
    });
    if (a.kind === 'email') {
      try { await mailer.send(a.email, token, purpose); }
      catch {
        db.prepare('DELETE FROM account_tokens WHERE hash=?').run(hash);
        throw authError('Email could not be sent. Your account and saved progress are unchanged. Try Resend when email is available.', 503);
      }
    }
  }
  function defer(fn) {
    if (jobs.size >= 2) return;
    const job = Promise.resolve().then(fn).catch(() => { console.warn('Account email delivery failed; no token or address logged.'); }).finally(() => jobs.delete(job));
    jobs.add(job);
  }
  function tokenInfo(raw, purpose) {
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw authError('This link is invalid or expired. Request another link.');
    const row = db.prepare('SELECT * FROM account_tokens WHERE hash=? AND purpose=? AND expires_at>?').get(digest(raw), purpose, Date.now());
    if (!row) throw authError('This link is invalid, expired or already used.');
    return row;
  }

  const auditAccount = a => { if (a) audit?.actor({ id: a.player_id || a.pending_player_id, name: a.name, kind: a.kind }); };
  async function handle(action, req, res, data = {}) {
    auditAccount(account(req));
    if (stopped) throw authError('Server is restarting. Try again shortly.', 503);
    if (action === 'status') return { account: publicAccount(account(req)), smtpAvailable: mailer.available, demoInboxAvailable: !!inbox(req) };
    if (action === 'inbox') {
      const grant = inbox(req);
      if (!grant) throw authError('Sign in with your Demo address and password to open your private inbox.', 401);
      const a = accountById(grant.account_id);
      const messages = db.prepare('SELECT * FROM demo_messages WHERE inbox_hash=? AND expires_at>? ORDER BY rowid DESC').all(grant.hash, Date.now());
      return { email: a.email, messages: messages.map(m => ({ purpose: m.purpose, expiresAt: m.expires_at,
        href: `/${m.purpose === 'verify' ? 'verify' : 'reset-password'}/#token=${messageToken(grant, m.nonce)}` })) };
    }
    cleanup(); throttle('all', 180);
    if (action === 'register') {
      if (account(req)) throw authError('Sign out before creating a different account.', 409);
      const email = emailFor(data.email, data.kind);
      throttle('register', 30); throttle('register:' + digest(email), 3);
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 32 || /[\x00-\x1f]/.test(name)) throw authError('Choose a display name of 1–32 characters.');
      if (data.kind === 'email' && !mailer.available) throw authError('Real email is not configured yet. Choose Demo or play as a guest.', 503);
      const passwordHash = await hashPassword(data.password);
      if (db.prepare('SELECT id FROM accounts WHERE email=?').get(email)) return { message: 'If you already registered, sign in or request another verification link.', next: '/login/' };
      const player = guest(req, res);
      if (db.prepare('SELECT id FROM accounts WHERE player_id=? OR pending_player_id=?').get(player.id, player.id)) throw authError('This guest already has an account registration. Sign in or resend verification.', 409);
      if (db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n >= 2000) throw authError('This prototype has reached its account limit.', 503);
      const id = randomUUID();
      db.prepare('INSERT INTO accounts(id,kind,email,name,password_hash,pending_player_id,created_at) VALUES (?,?,?,?,?,?,?)').run(id, data.kind, email, name, passwordHash, player.id, Date.now());
      const a = accountById(id), grant = a.kind === 'demo' ? openInbox(a, req, res) : null;
      await deliver(a, 'verify', grant);
      auditAccount(a); audit?.bind({ reason: 'registration_pending' });
      return { message: a.kind === 'demo' ? 'Open your private Demo inbox to confirm this simulated account.' : 'Check your email to verify your account. Your guest progress is kept.', next: a.kind === 'demo' ? '/demo-inbox/' : null };
    }
    if (action === 'login') {
      const email = emailFor(data.email, data.kind);
      throttle('login:' + digest(email));
      const a = db.prepare('SELECT * FROM accounts WHERE email=? AND kind=?').get(email, data.kind);
      if (!await verifyPassword(data.password, a?.password_hash) || !a) throw authError('Email or password is incorrect.', 401);
      auditAccount(a);
      if (!a.activated_at) {
        if (a.kind === 'demo') { const grant = openInbox(a, req, res); await deliver(a, 'verify', grant); return { next: '/demo-inbox/' }; }
        throw authError('Verify your email before signing in. Use Resend verification if needed.', 409);
      }
      const other = db.prepare('SELECT * FROM account_sessions WHERE account_id=? AND expires_at>?').get(a.id, Date.now());
      if (other && other.hash !== sessionHash(req) && data.takeover !== true) return { takeoverRequired: true, message: 'This account is signed in elsewhere. Take over to disconnect its previous session and stop its controls?' };
      const previous = account(req);
      if (previous && previous.id !== a.id) revoke(previous.id, 'Switched account.');
      revoke(a.id, 'This account signed in on another device.');
      const raw = secret();
      db.prepare('INSERT INTO account_sessions VALUES (?,?,?)').run(digest(raw), a.id, Date.now() + lifetime);
      setCookie(req, res, ACCOUNT_COOKIE, raw);
      if (a.kind === 'demo') openInbox(a, req, res); else closeInbox(req, res);
      audit?.bind({ reason: 'session_established' });
      return { next: '/', account: publicAccount(a) };
    }
    if (action === 'verify') {
      const token = tokenInfo(data.token, 'verify'), a = accountById(token.account_id);
      if (!a || a.activated_at || !a.pending_player_id) throw authError('This account is already activated or unavailable.');
      const player = db.prepare('SELECT * FROM scouts WHERE id=?').get(a.pending_player_id);
      if (!player) throw authError('The pending guest save is unavailable. Contact the host.', 409);
      revokePlayer(player.id, 'Your player is now linked to an account. Sign in to continue.', { linkingAccountId: a.id });
      transaction(() => {
        if (!db.prepare('DELETE FROM account_tokens WHERE hash=? AND expires_at>?').run(token.hash, Date.now()).changes) throw authError('This link has expired or was already used.');
        db.prepare('UPDATE accounts SET player_id=pending_player_id,pending_player_id=NULL,activated_at=?,email_verified_at=? WHERE id=?').run(Date.now(), a.kind === 'email' ? Date.now() : null, a.id);
        // Rotate the old guest bearer credential; preserve every ownership ID.
        db.prepare('UPDATE scouts SET token=?,name=? WHERE id=?').run(randomUUID(), a.name, player.id);
      });
      auditAccount(a); audit?.bind({ reason: 'account_activated' });
      return { message: a.kind === 'demo' ? 'Demo account activated. No real email ownership is verified.' : 'Email verified. Your saved player is linked.', next: '/login/?mode=' + a.kind };
    }
    if (action === 'logout' || action === 'guest') {
      const a = account(req); if (a) revoke(a.id, 'Signed out.');
      setCookie(req, res, ACCOUNT_COOKIE, '', 0); closeInbox(req, res);
      return { next: action === 'guest' ? '/' : '/login/', message: 'Signed out. Saved progress is retained.' };
    }
    if (action === 'open-inbox') {
      const a = account(req);
      if (!a || a.kind !== 'demo') throw authError('Sign in to your Demo account first.', 401);
      openInbox(a, req, res); return { next: '/demo-inbox/' };
    }
    if (action === 'resend' || action === 'recover') {
      const email = emailFor(data.email, data.kind);
      const generic = { message: 'If this account is eligible, a link will be delivered. Check your inbox. Demo recovery needs an existing private inbox or signed-in session.' };
      try { throttle(action + ':' + digest(email), 3); throttle('mail', 30); } catch { return generic; }
      const a = db.prepare('SELECT * FROM accounts WHERE email=? AND kind=?').get(email, data.kind);
      if (!a || (action === 'resend' ? !!a.activated_at : !a.activated_at)) return generic;
      let grant = inbox(req);
      if (a.kind === 'demo') {
        if (grant?.account_id !== a.id) {
          if (account(req)?.id !== a.id) return generic;
          grant = openInbox(a, req, res);
        }
        await deliver(a, action === 'resend' ? 'verify' : 'reset', grant);
      } else if (mailer.available) defer(() => deliver(a, action === 'resend' ? 'verify' : 'reset'));
      return generic;
    }
    if (action === 'reset') {
      throttle('reset', 20);
      const before = tokenInfo(data.token, 'reset');
      const passwordHash = await hashPassword(data.password);
      const token = tokenInfo(data.token, 'reset'); // Recheck after async hashing.
      const a = accountById(before.account_id);
      if (!a?.activated_at) throw authError('This account is unavailable.');
      revoke(a.id, 'Password changed. Sign in again.');
      transaction(() => {
        db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(passwordHash, a.id);
        db.prepare('DELETE FROM account_tokens WHERE account_id=?').run(token.account_id);
        db.prepare('DELETE FROM demo_messages WHERE inbox_hash IN (SELECT hash FROM demo_inboxes WHERE account_id=?)').run(a.id);
        db.prepare('DELETE FROM demo_inboxes WHERE account_id=?').run(a.id);
      });
      setCookie(req, res, ACCOUNT_COOKIE, '', 0); closeInbox(req, res);
      auditAccount(a); audit?.bind({ reason: 'sessions_revoked' });
      return { message: 'Password changed. All old sessions are signed out; your player and progress are retained.', next: '/login/?mode=' + a.kind };
    }
    throw authError('Unknown account action.', 404);
  }
  return { handle, account, sessionHash, sessionByHash, hasCookie: req => !!cookie(req, ACCOUNT_COOKIE),
    async close() { stopped = true; await Promise.allSettled([...jobs]); } };
}
