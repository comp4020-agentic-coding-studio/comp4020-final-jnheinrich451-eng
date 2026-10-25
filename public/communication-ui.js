import { EMOTES, emotePoint } from './emotes.js';

export function communicationUI({ api, available, stop, focus, draftKey }) {
  const host = document.querySelector('.battlefield');
  const panel = document.createElement('section'); panel.className = 'communication'; panel.setAttribute('aria-label', 'Room communication');
  panel.innerHTML = `<div class="chat-history" id="chat-history" hidden><ol id="chat-messages" role="log" aria-label="Room messages" aria-live="polite" aria-relevant="additions"></ol></div>
    <form id="chat-form" hidden><label for="chat-input">Room chat</label><input id="chat-input" type="text" maxlength="280" autocomplete="off" placeholder="Message your crew..." enterkeyhint="send"><button type="submit">Send</button><button id="chat-cancel" type="button" aria-label="Close chat and keep draft">Esc</button><small>Enter sends / Esc keeps draft</small></form>
    <p id="chat-status" role="status" hidden></p><div class="communication-buttons"><button id="chat-open" type="button" aria-controls="chat-form" aria-expanded="false">Chat <kbd>Enter</kbd></button><button id="chat-history-toggle" type="button" aria-controls="chat-history" aria-expanded="false" aria-label="Show chat history">History</button><button id="emote-open" type="button" aria-controls="emote-wheel" aria-expanded="false">Emote <kbd>Q</kbd></button></div>`;
  const cover = document.createElement('div'); cover.className = 'emote-cover'; cover.hidden = true;
  cover.innerHTML = '<div id="emote-wheel" role="group" aria-label="Emote wheel"><div class="emote-center"><strong id="emote-choice">Emotes</strong><small>Point / release Q<br>or tap a choice</small><button id="emote-cancel" type="button">Cancel / Esc</button></div></div>';
  host.append(panel, cover);
  const $ = id => document.getElementById(id), form = $('chat-form'), input = $('chat-input'), history = $('chat-history'), list = $('chat-messages');
  let typing = false, expanded = false, wheelMode = null, chosen = -1, epoch = null, messages = [], bubbles = [], sending = false, retry = null, fade;
  const images = EMOTES.map(e => { const image = new Image(); image.src = '/emotes/' + e.image; return image; });
  let loadedDraftKey;
  function loadDraft() {
    const key = typeof draftKey === 'function' ? draftKey() : draftKey;
    if (key === loadedDraftKey) return;
    loadedDraftKey = key; input.value = '';
    try { input.value = sessionStorage.getItem(key) || ''; } catch {}
  }
  const saveDraft = () => { if (loadedDraftKey) try { sessionStorage.setItem(loadedDraftKey, input.value); } catch {} };
  function fitKeyboard() {
    const viewport = window.visualViewport;
    const inset = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
    panel.style.bottom = typing && innerWidth <= 760 && inset > 100 ? (inset + 10) + 'px' : '';
  }
  window.visualViewport?.addEventListener('resize', fitKeyboard);
  window.visualViewport?.addEventListener('scroll', fitKeyboard);
  const status = text => { $('chat-status').textContent = text; $('chat-status').hidden = !text; };
  function showHistory() {
    clearTimeout(fade); history.hidden = !messages.length;
    panel.classList.toggle('chat-expanded', expanded || typing);
    $('chat-history-toggle').setAttribute('aria-expanded', String(expanded));
    if (!expanded && !typing) fade = setTimeout(() => { history.hidden = true; }, 10000);
  }
  function renderMessages() {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 20;
    // Append new entries without reparsing player text or reannouncing old entries.
    const existing = new Set([...list.children].map(li => li.dataset.id));
    for (const message of messages) if (!existing.has(message.id)) {
      const li = document.createElement('li'); li.dataset.id = message.id;
      const name = document.createElement('strong'); name.textContent = message.name + ': ';
      li.append(name, document.createTextNode(message.text)); list.append(li);
    }
    for (const li of [...list.children]) if (!messages.some(m => m.id === li.dataset.id)) li.remove();
    showHistory(); if (atBottom || !expanded) list.scrollTop = list.scrollHeight;
  }
  function ingest(packet) {
    if (packet.epoch !== epoch) { epoch = packet.epoch; messages = []; bubbles = []; list.replaceChildren(); }
    const events = packet.type === 'history' ? [...packet.messages, ...packet.emotes] : packet.event ? [packet.event] : [];
    let changed = false;
    for (const event of events) {
      if (event.kind === 'chat' && !messages.some(m => m.id === event.id)) { messages.push(event); changed = true; }
      if (event.kind === 'emote' && EMOTES.some(e => e.id === event.emote)) {
        const previous = bubbles.find(b => b.senderId === event.senderId);
        if (previous && previous.sequence >= event.sequence) continue;
        const ttl = Math.min(3000, event.expiresAt - packet.now);
        if (ttl <= 0) continue;
        bubbles = bubbles.filter(b => b.senderId !== event.senderId);
        bubbles.push({ ...event, until: performance.now() + ttl }); bubbles = bubbles.slice(-16);
      }
    }
    messages.sort((a,b) => a.sequence - b.sequence); messages = messages.slice(-40);
    if (changed) renderMessages();
  }
  function closeChat(refocus = true) {
    saveDraft(); typing = false; host.classList.remove('chat-typing'); form.hidden = true; $('chat-open').setAttribute('aria-expanded', 'false'); showHistory(); fitKeyboard(); if (refocus) focus();
  }
  function openChat() {
    if (!available()) { status('Connect to an active room to chat.'); return; }
    loadDraft(); closeWheel(false); stop(true); typing = true; host.classList.add('chat-typing'); form.hidden = false; status(''); fitKeyboard();
    $('chat-open').setAttribute('aria-expanded', 'true'); showHistory(); input.focus({preventScroll:true});
  }
  async function submit() {
    const text = input.value;
    if (!text.trim()) { input.value = ''; closeChat(); status(''); return; }
    if (sending) { closeChat(); status('Sending your previous message. Your draft is kept.'); return; }
    const requestId = retry?.text === text ? retry.requestId : crypto.randomUUID();
    retry = { text, requestId }; sending = true; input.value = ''; closeChat(); status('');
    try {
      const response = await api('communication', { kind: 'chat', text, requestId });
      ingest({ type: 'event', ...response }); retry = null;
    } catch (error) {
      if (!input.value) input.value = text;
      saveDraft(); status(error.message + ' Draft kept; open Chat to retry.');
    } finally { sending = false; }
  }
  function select(index) {
    chosen = index; $('emote-choice').textContent = EMOTES[index]?.label || 'Emotes';
    buttons.forEach((button,i) => { button.classList.toggle('selected', i === index); button.setAttribute('aria-pressed', String(i === index)); });
  }
  function closeWheel(refocus = true) { wheelMode = null; cover.hidden = true; $('emote-open').setAttribute('aria-expanded', 'false'); select(-1); if (refocus) focus(); }
  async function sendEmote(index) {
    closeWheel(); if (!EMOTES[index]) return;
    try { const response = await api('communication', { kind: 'emote', emote: EMOTES[index].id, requestId: crypto.randomUUID() }); ingest({ type: 'event', ...response }); }
    catch (error) { status(error.message); }
  }
  function openWheel(mode = 'keyboard') {
    if (!available() || typing || wheelMode) return;
    stop(false); wheelMode = mode; cover.hidden = false; select(-1);
    $('emote-open').setAttribute('aria-expanded', 'true');
  }
  const buttons = EMOTES.map((e,index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'emote-option'; button.dataset.emote = e.id; button.setAttribute('aria-pressed','false');
    const image = document.createElement('img'); image.src = '/emotes/' + e.image; image.alt = ''; image.width = 32; image.height = 32;
    button.append(image, document.createTextNode(e.label));
    const angle = index * Math.PI / 3 - Math.PI / 2;
    button.style.left = (150 + Math.cos(angle) * 104) + 'px'; button.style.top = (150 + Math.sin(angle) * 104) + 'px';
    button.onclick = () => { void sendEmote(index); }; button.onfocus = () => select(index);
    $('emote-wheel').append(button); return button;
  });
  cover.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = $('emote-wheel').getBoundingClientRect(), dx = event.clientX - rect.left - 150, dy = event.clientY - rect.top - 150;
    const distance = Math.hypot(dx, dy);
    select(distance < 62 || distance > 175 ? -1 : Math.round((Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) / (Math.PI / 3)) % 6);
  });
  cover.addEventListener('pointerdown', event => { if (event.target === cover) closeWheel(); });
  $('emote-cancel').onclick = () => closeWheel(); $('emote-open').onclick = () => openWheel('tap');
  $('chat-open').onclick = () => typing ? closeChat() : openChat(); $('chat-cancel').onclick = () => closeChat();
  $('chat-history-toggle').onclick = () => { expanded = !expanded; showHistory(); };
  input.addEventListener('input', saveDraft);
  form.addEventListener('submit', event => { event.preventDefault(); void submit(); });
  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  window.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (typing && ['Enter','Escape'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (event.key === 'Escape') closeChat(); else void submit(); } return;
    }
    if (!wheelMode) return;
    if (['Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation(); if (event.repeat) return;
      if (event.key === 'Escape') closeWheel();
      else if (event.key === 'Enter') void sendEmote(chosen);
      else select((chosen + (['ArrowLeft','ArrowUp'].includes(event.key) ? 5 : 1) + 6) % 6);
    }
  }, true);
  window.addEventListener('keyup', event => { if (event.code === 'KeyQ' && wheelMode === 'keyboard') { event.preventDefault(); void sendEmote(chosen); } });
  function suspend() { if (wheelMode) closeWheel(false); if (typing) closeChat(false); }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  function draw(c, world, players, tile, zoom, now) {
    bubbles = bubbles.filter(b => b.until > now);
    for (const bubble of bubbles) {
      if (!players.some(p => p.id === bubble.senderId)) continue;
      const point = emotePoint(world, players, bubble.anchor), index = EMOTES.findIndex(e => e.id === bubble.emote), image = images[index];
      if (!point || !image?.complete || !image.naturalWidth) continue;
      c.save(); c.translate(point.x * tile, point.y * tile - tile * 1.25); c.scale(1 / zoom, 1 / zoom); c.imageSmoothingEnabled = false;
      c.drawImage(image, -24, -52, 48, 48); c.font = '10px monospace'; c.textAlign = 'center';
      const label = EMOTES[index].label, width = c.measureText(label).width + 10;
      c.fillStyle = '#101e22e6'; c.fillRect(-width / 2, -3, width, 15); c.fillStyle = '#f5d48c'; c.fillText(label, 0, 8); c.restore();
    }
  }
  return { openChat, openWheel, ingest, draw, suspend, typing: () => typing, active: () => typing || !!wheelMode };
}
