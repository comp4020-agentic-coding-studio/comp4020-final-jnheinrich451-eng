const $ = id => document.getElementById(id);
const page = location.pathname.split('/').filter(Boolean)[0] || 'login';
const mode = new URLSearchParams(location.search).get('mode') === 'demo' ? 'demo' : 'email';
const token = new URLSearchParams(location.hash.slice(1)).get('token');
if (token) history.replaceState(null, '', location.pathname + location.search);
const titles = { login: 'Welcome back.', register: 'Connect your player.', account: 'Your account.', 'demo-inbox': 'Private Demo inbox.', verify: 'Confirm your account.', 'forgot-password': 'Recover your account.', 'reset-password': 'Choose a new password.' };
$('title').textContent = titles[page] || titles.login;
const forms = { login: 'login', register: 'register', verify: 'verify', 'forgot-password': 'recover', 'reset-password': 'reset' };
if (forms[page]) $(forms[page] + '-form').hidden = false;
const modePage = ['login', 'register', 'forgot-password'].includes(page);
$('modes').hidden = !modePage;
for (const kind of ['email', 'demo']) { const link = $(kind + '-mode'); link.href = `/${page}/?mode=${kind}`; if (mode === kind) link.setAttribute('aria-current', 'page'); }
$('mode-help').textContent = !modePage ? '' : mode === 'demo' ? 'Choose a @frontier.test address. Verification stays in a private simulated inbox; no real email is sent.' : 'Use any real email address you control. We will email verification and recovery links.';
for (const input of document.querySelectorAll('input[name=email]')) input.placeholder = mode === 'demo' ? 'pilot@frontier.test' : 'you@example.com';
for (const [id, route] of [['login-link', 'login'], ['register-link', 'register'], ['forgot-link', 'forgot-password']]) $(id).href = `/${route}/?mode=${mode}`;
$('resend').hidden = page !== 'login';
$('intro').hidden = !['login', 'register'].includes(page);
let busy = false, takeover = false;
function message(text, error = false) { $('message').textContent = text || ''; $('message').classList.toggle('error', error); }
async function request(action, data) {
  const response = await fetch(`/api/auth/${action}`, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Account request failed.');
  return result;
}
async function inbox() {
  const result = await request('inbox');
  $('inbox-address').textContent = result.email;
  $('messages').replaceChildren(...result.messages.map(item => {
    const a = document.createElement('a'); a.href = item.href;
    a.textContent = item.purpose === 'verify' ? 'Confirm this Demo account' : 'Choose a new password'; return a;
  }));
  if (!result.messages.length) $('messages').textContent = 'No current messages. Verification links expire after 30 minutes; password reset messages appear here when requested.';
}
async function perform(action, data = {}) {
  if (busy) return;
  busy = true;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  try {
    const result = await request(action, data);
    message(result.message);
    if (result.takeoverRequired) { takeover = true; $('takeover').hidden = false; return; }
    if (action === 'login' || action === 'guest' || action === 'logout' || action === 'open-inbox') { location.assign(result.next); return; }
    if (result.next) {
      $('next').hidden = false; $('next').href = result.next;
      $('next').textContent = result.next.startsWith('/demo-inbox') ? 'Open private Demo inbox' : 'Continue to sign in';
    }
    if (['verify', 'reset'].includes(action)) $(action + '-form').hidden = true;
    const state = await request('status'); $('inbox-link').hidden = !state.demoInboxAvailable;
  } catch (error) { message(error.message, true); }
  finally { busy = false; for (const button of document.querySelectorAll('button')) button.disabled = false; }
}
for (const form of document.querySelectorAll('form[data-action]')) form.addEventListener('submit', event => {
  event.preventDefault(); const action = form.dataset.action;
  void perform(action, { ...Object.fromEntries(new FormData(form)), kind: mode, token, takeover: false });
});
$('login-form').addEventListener('input', () => { takeover = false; $('takeover').hidden = true; });
$('takeover').onclick = () => { if ($('login-form').reportValidity()) void perform('login', { ...Object.fromEntries(new FormData($('login-form'))), kind: mode, takeover: true }); };
$('guest').onclick = () => perform('guest');
$('logout').onclick = () => perform('logout');
$('open-inbox').onclick = () => perform('open-inbox');
$('refresh-inbox').onclick = () => inbox().catch(error => message(error.message, true));
try {
  const state = await request('status');
  $('inbox-link').hidden = !state.demoInboxAvailable;
  if (mode === 'email' && modePage && !state.smtpAvailable) { $('mail-status').hidden = false; $('mail-status').textContent = 'Real email delivery is not connected yet. Demo and guest access work now; existing accounts can still sign in.'; }
  if (page === 'account') {
    if (!state.account) location.replace('/login/');
    else {
      $('profile').hidden = false; const a = state.account;
      // Use the server's active room, rather than the root URL (the planet lobby).
      if (new URLSearchParams(location.search).get('legacy') === '1') {
        $('return-battle').href = '/?legacy=1'; $('return-battle').textContent = 'Return to battlefield';
      } else {
        const response = await fetch('/api/campaigns/list', { cache: 'no-store' });
        if (response.ok) {
          const rooms = await response.json();
          if (rooms.active) {
            $('return-battle').href = '/?campaign=' + encodeURIComponent(rooms.active);
            $('return-battle').textContent = 'Return to battlefield';
          }
        }
      }
      $('identity').textContent = `${a.name} · ${a.email} · ${a.kind === 'demo' ? 'Demo (simulated verification)' : 'Verified email'}`;
      $('open-inbox').hidden = a.kind !== 'demo'; $('reset-link').href = '/forgot-password/?mode=' + a.kind;
    }
  }
  if (page === 'demo-inbox') { $('inbox').hidden = false; await inbox(); }
  if (['verify', 'reset-password'].includes(page) && !token) { message('This link has no token. Open the complete link from your inbox.', true); $(forms[page] + '-form').hidden = true; }
} catch (error) { message(error.message, true); }
