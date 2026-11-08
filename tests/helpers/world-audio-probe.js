// Runs inside each test page before production audio is initialized. It observes
// existing output connections; it cannot repair a missing speaker connection.
export function installWorldAudioProbe() {
  const edges = new WeakMap(), encoded = new WeakMap(), decoded = new WeakMap();
  const records = new WeakMap(), intervals = [], meters = [];
  const connect = AudioNode.prototype.connect, fetchAudio = window.fetch;
  window.worldAudioRecords = []; window.worldAudioPeak = 0;
  AudioNode.prototype.connect = function (destination, ...ports) {
    edges.set(this, destination);
    if (destination instanceof AudioDestinationNode) {
      const analyser = this.context.createAnalyser(); analyser.fftSize = 1024;
      connect.call(this, analyser, ...ports); connect.call(analyser, destination);
      meters.push(analyser); return destination;
    }
    return connect.call(this, destination, ...ports);
  };
  setInterval(() => {
    for (const meter of meters) {
      const samples = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(samples);
      for (const sample of samples) window.worldAudioPeak = Math.max(window.worldAudioPeak, Math.abs(sample));
    }
  }, 16);
  window.fetch = async function (...args) {
    const response = await fetchAudio.apply(this, args), url = String(args[0]?.url || args[0]);
    if (url.includes('/audio/effects/')) {
      const arrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => { const bytes = await arrayBuffer(); encoded.set(bytes, url); return bytes; };
    }
    return response;
  };
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = async function (...args) {
    const file = encoded.get(args[0]), buffer = await decode.apply(this, args);
    decoded.set(buffer, file); return buffer;
  };
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const source = this, gain = edges.get(source), pan = edges.get(gain), context = source.context;
    const record = {
      file: decoded.get(source.buffer), loop: source.loop, duration: source.buffer.duration,
      start: Math.max(args[0] || 0, context.currentTime), source, gain, pan, context,
    };
    record.end = record.loop ? Infinity : record.start + Math.min(record.duration - (args[1] || 0), args[2] ?? Infinity) / source.playbackRate.value;
    records.set(source, record); intervals.push(record); window.worldAudioRecords.push(record);
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const record = records.get(this);
    if (record && record.end > this.context.currentTime) record.end = Math.max(args[0] || 0, this.context.currentTime);
    return stop.apply(this, args);
  };
  window.worldAudioReport = () => {
    const active = intervals.filter(r => r.start <= r.context.currentTime && r.end > r.context.currentTime);
    let peak = 0;
    for (const context of new Set(intervals.map(r => r.context))) {
      let count = 0;
      const changes = intervals.filter(r => r.context === context && r.end > r.start)
        .flatMap(r => [[r.start, 1], [r.end, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [, change] of changes) { count += change; peak = Math.max(peak, count); }
    }
    const view = r => ({ file: r.file, loop: r.loop, duration: r.duration, start: r.start, end: Number.isFinite(r.end) ? r.end : null,
      age: r.context.currentTime - r.start, gain: r.gain?.gain?.value, pan: r.pan?.pan?.value, rate: r.source.playbackRate.value });
    return { active: active.map(view), records: window.worldAudioRecords.map(view), peakVoices: peak, signal: window.worldAudioPeak };
  };
}
