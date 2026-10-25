import { EMOTES } from './public/emotes.js';

const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };
// A bounded, ephemeral channel owned by one world runtime. No campaign save writes.
export function createCommunication(epoch, clock = Date.now) {
  let sequence = 0;
  const messages = [], emotes = new Map(), receipts = new Map(), rates = new Map();
  function snapshot() {
    const now = clock();
    for (const [id, e] of emotes) if (e.expiresAt <= now) emotes.delete(id);
    return { epoch, now, messages: [...messages], emotes: [...emotes.values()] };
  }
  function accept(player, data, anchor) {
    if (!['chat', 'emote'].includes(data.kind)) reject(400, 'Choose chat or an emote.');
    if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(data.requestId)) reject(400, 'A message request ID is required.');
    let text;
    if (data.kind === 'chat') {
      if (typeof data.text !== 'string' || data.text.length > 280) reject(400, 'Chat messages can contain up to 280 characters.');
      text = data.text.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
      if (!text) return { duplicate: false, event: null };
    } else if (!EMOTES.some(e => e.id === data.emote)) reject(400, 'Choose an emote from the wheel.');
    const key = player.id + ':' + data.requestId;
    if (receipts.has(key)) return { duplicate: true, event: receipts.get(key) };
    const now = clock(), rateKey = player.id + ':' + data.kind;
    const window = data.kind === 'chat' ? 5000 : 1000, max = data.kind === 'chat' ? 3 : 1;
    const recent = (rates.get(rateKey) || []).filter(at => now - at < window);
    if (recent.length >= max) reject(429, 'Please wait a moment before sending again.');
    rates.delete(rateKey); rates.set(rateKey, [...recent, now]);
    if (rates.size > 128) rates.delete(rates.keys().next().value);
    const event = { id: epoch + ':' + (++sequence), sequence, senderId: player.id, name: player.name, at: now, kind: data.kind,
      ...(data.kind === 'chat' ? { text } : { emote: data.emote, anchor, expiresAt: now + 3000 }) };
    if (data.kind === 'chat') { messages.push(event); if (messages.length > 40) messages.shift(); }
    else { emotes.delete(player.id); emotes.set(player.id, event); if (emotes.size > 16) emotes.delete(emotes.keys().next().value); }
    receipts.set(key, event); if (receipts.size > 256) receipts.delete(receipts.keys().next().value);
    return { duplicate: false, event };
  }
  return { snapshot, accept };
}
