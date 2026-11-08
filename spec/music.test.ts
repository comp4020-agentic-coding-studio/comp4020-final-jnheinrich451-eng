import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupMusic } from '../public/music.js';

describe('pending music playback', () => {
  let dom: JSDOM, music: ReturnType<typeof setupMusic>, audio: HTMLAudioElement;
  let paused: boolean;
  let attempts: { resolve: () => void; reject: (reason: Error) => void }[];
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  const error = (name: string) => Object.assign(new Error(name), { name });
  const activate = () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a' }));
  const start = () => { music.setWorld({ template: 'morrow-v1' }, 'colonization'); activate(); };
  const visibility = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
  };
  const interruptAndResume = (kind: string) => {
    if (kind === 'visibility') { visibility(true); visibility(false); }
    else { document.getElementById('music-toggle')!.click(); document.getElementById('music-toggle')!.click(); }
  };

  beforeEach(() => {
    dom = new JSDOM('<body><fieldset class="music-settings"><button id="music-toggle"></button><input id="music-volume" type="range"><p id="music-status"></p><p id="music-track"></p></fieldset></body>', { url: 'http://localhost/' });
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.stubGlobal('localStorage', dom.window.localStorage);
    paused = true; attempts = [];
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'paused', { get: () => paused });
    dom.window.HTMLMediaElement.prototype.pause = function () { paused = true; };
    dom.window.HTMLMediaElement.prototype.play = function () {
      paused = false;
      return new Promise<void>((resolve, reject) => { attempts.push({ resolve, reject }); });
    };
    music = setupMusic();
    audio = document.getElementById('background-music') as HTMLAudioElement;
    visibility(false);
  });
  afterEach(() => { dom.window.close(); vi.unstubAllGlobals(); });

  it.each(['visibility', 'toggle'])('resumes after a quick %s change aborts a pending play', async kind => {
    start();
    interruptAndResume(kind);
    expect(attempts).toHaveLength(1);
    expect(audio.paused).toBe(true);
    attempts[0].reject(error('AbortError')); await flush();
    expect(attempts).toHaveLength(2);
    attempts[1].resolve(); await flush();
    expect(audio.paused).toBe(false);
    expect(document.getElementById('music-status')!.textContent).toContain('Playing / Twilight Over the Still Lake');
  });

  it('does not turn a requested retry into an abort retry loop', async () => {
    start(); interruptAndResume('visibility');
    attempts[0].reject(error('AbortError')); await flush();
    paused = true; attempts[1].reject(error('AbortError')); await flush();
    expect(attempts).toHaveLength(2);
    expect(audio.paused).toBe(true);
  });

  it.each(['NotAllowedError', 'NotSupportedError'])('does not automatically retry %s after a queued resume', async name => {
    start(); interruptAndResume('visibility');
    attempts[0].reject(error(name)); await flush();
    expect(attempts).toHaveLength(1);
    expect(audio.paused).toBe(true);
    expect(document.getElementById('music-status')!.textContent).toContain(name === 'NotAllowedError' ? 'click, tap or key press' : 'Music unavailable');
  });

  it('does not carry a queued resume or stale failure into a different track', async () => {
    start(); interruptAndResume('visibility');
    music.setWorld({ template: 'nacre-v1' }, 'colonization');
    expect(attempts).toHaveLength(2);
    attempts[0].reject(error('NotSupportedError')); await flush();
    // The new track also aborts, without a new resume request for its generation.
    paused = true; attempts[1].reject(error('AbortError')); await flush();
    expect(attempts).toHaveLength(2);
    expect(document.getElementById('music-status')!.textContent).not.toContain('unavailable');
    expect(audio.src).toContain('Harvest_at_Low_Tide_Colonnization.mp3');
    activate(); expect(attempts).toHaveLength(3);
    attempts[2].resolve(); await flush();
    expect(document.getElementById('music-status')!.textContent).toContain('Playing / Harvest at Low Tide');
  });

  it('remembers an early gesture and keeps playback position through same-planet snapshots', async () => {
    activate();
    expect(attempts).toHaveLength(0);
    music.setWorld({ template: 'sirocco-v1' });
    expect(attempts).toHaveLength(1);
    attempts[0].resolve(); await flush();
    audio.currentTime = 24;
    music.setWorld({ template: 'sirocco-v1' });
    expect(audio.currentTime).toBe(24);
    expect(attempts).toHaveLength(1);
  });
});
