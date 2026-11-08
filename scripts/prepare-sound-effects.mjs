// Prepare runtime copies; never modify the author's source WAV files.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUND_FILES, SOUND_PROFILES } from '../public/sound-catalog.js';
import { COLONY_SOUND_FILES, COLONY_SOUND_PROFILES } from '../public/colony-sound-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'soundeffect');
const args = process.argv.slice(2);
let colony = false, encoderArgument;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--colony' && !colony) colony = true;
  else if (args[i] === '--ffmpeg' && !encoderArgument && args[i + 1] && !args[i + 1].startsWith('--')) encoderArgument = args[++i];
  else throw new Error('Usage: node scripts/prepare-sound-effects.mjs [--colony] [--ffmpeg <executable>]');
}
const outputDir = path.join(root, 'public/audio/effects', colony ? 'colony' : 'generated');
const selectedProfiles = colony ? COLONY_SOUND_PROFILES : SOUND_PROFILES;
const selectedFiles = colony ? COLONY_SOUND_FILES : Object.values(SOUND_FILES);

function resolveEncoder() {
  if (encoderArgument || process.env.FFMPEG_PATH) return encoderArgument || process.env.FFMPEG_PATH;
  if (spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true }).status === 0) return 'ffmpeg';
  // The local video workspace already supplies FFmpeg; no download is required.
  const packages = path.join(root, 'video/node_modules/.pnpm');
  if (existsSync(packages)) {
    for (const name of readdirSync(packages).filter(n => n.startsWith('@remotion+compositor-win32-x64-msvc@')).sort().reverse()) {
      const file = path.join(packages, name, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
      if (existsSync(file)) return file;
    }
  }
  throw new Error('FFmpeg with libopus is required. Set FFMPEG_PATH or pass --ffmpeg <executable>.');
}

function runEncoder(encoder, options, input) {
  const result = spawnSync(encoder, options, { encoding: 'utf8', windowsHide: true, input });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'FFmpeg failed');
  return result.stdout;
}

function inspectWave(bytes, name) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${name}: expected a RIFF/WAVE source`);
  }
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw new Error(`${name}: truncated ${id} chunk`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error(`${name}: invalid format chunk`);
      format = {
        encoding: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10),
        sampleRate: bytes.readUInt32LE(offset + 12), blockAlign: bytes.readUInt16LE(offset + 20),
        bits: bytes.readUInt16LE(offset + 22),
      };
    }
    if (id === 'data') data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!format || !data || format.encoding !== 1 || format.bits !== 16 ||
      format.channels !== 2 || format.sampleRate !== 48000 || format.blockAlign !== 4 || data.length % 4) {
    throw new Error(`${name}: expected complete 48 kHz stereo PCM16 audio`);
  }
  let peak = 0;
  for (let offset = 0; offset < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)) / 32768);
  if (!peak) throw new Error(`${name}: silent source`);
  const frames = data.length / format.blockAlign;
  // Preserve 10 ms before the first sample above -60 dB relative to source peak.
  // Do not shorten the end: a quiet tail may still be artistically meaningful.
  const threshold = peak * .001;
  let first = 0;
  for (; first < frames; first++) {
    const offset = first * format.blockAlign;
    if (Math.max(Math.abs(data.readInt16LE(offset)), Math.abs(data.readInt16LE(offset + 2))) / 32768 >= threshold) break;
  }
  const trimFrames = Math.max(0, first - Math.round(format.sampleRate * .01));
  return { ...format, frames, peak, first, trimFrames, data };
}

function prepareLoop(wave) {
  const overlap = Math.min(Math.round(wave.sampleRate * .08), Math.floor(wave.frames / 4));
  if (overlap < 2) throw new Error('Loop source is too short for a wrap crossfade');
  const frames = wave.frames - overlap, middle = wave.frames - overlap * 2;
  const bytes = Buffer.alloc(44 + frames * wave.blockAlign);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(wave.channels, 22);
  bytes.writeUInt32LE(wave.sampleRate, 24); bytes.writeUInt32LE(wave.sampleRate * wave.blockAlign, 28);
  bytes.writeUInt16LE(wave.blockAlign, 32); bytes.writeUInt16LE(wave.bits, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * wave.blockAlign, 40);
  // Start after the head overlap. At the end, fade the original tail into the
  // original head; the wrap then continues from head[overlap - 1] to head[overlap].
  // Linear weights preserve the source amplitude bound without normalization.
  wave.data.copy(bytes, 44, overlap * wave.blockAlign, (wave.frames - overlap) * wave.blockAlign);
  for (let frame = 0; frame < overlap; frame++) {
    const blend = frame / (overlap - 1);
    for (let channel = 0; channel < wave.channels; channel++) {
      const tail = wave.data.readInt16LE((wave.frames - overlap + frame) * wave.blockAlign + channel * 2);
      const head = wave.data.readInt16LE(frame * wave.blockAlign + channel * 2);
      bytes.writeInt16LE(Math.round(tail * (1 - blend) + head * blend), 44 + (middle + frame) * wave.blockAlign + channel * 2);
    }
  }
  return { bytes, frames, overlap };
}

const encoder = resolveEncoder();
const encoderVersion = runEncoder(encoder, ['-version']).split(/\r?\n/)[0];
mkdirSync(outputDir, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
// Keep retired takes in the source folder without exporting or loading them.
const selectedSources = [...new Set(selectedFiles.map(file => path.basename(file).replace(/\.ogg$/, '.wav')))];
// Semantics, not filename suffixes, decide which recordings get a loop join.
const loopSources = new Set(Object.values(selectedProfiles).filter(profile => profile.loop)
  .map(profile => path.basename(profile.file).replace(/\.ogg$/, '.wav')));
for (const sourceName of selectedSources.sort()) {
  const sourcePath = path.join(sourceDir, sourceName), bytes = readFileSync(sourcePath);
  const wave = inspectWave(bytes, sourceName), file = sourceName.replace(/\.wav$/, '.ogg');
  const outputPath = path.join(outputDir, file), fallbackFile = sourceName;
  const fallbackPath = path.join(outputDir, fallbackFile);
  const loop = loopSources.has(sourceName) ? prepareLoop(wave) : null;
  const trimFrames = loop ? 0 : wave.trimFrames;
  const filter = `atrim=start_sample=${trimFrames},asetpts=PTS-STARTPTS`;
  const encoderInput = loop ? 'pipe:0' : sourcePath;
  runEncoder(encoder, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-i', encoderInput, '-map_metadata', '-1', '-af', filter,
    '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-application', 'audio',
    '-ar', '48000', '-ac', '2', '-fflags', '+bitexact', '-flags:a', '+bitexact', outputPath], loop?.bytes);
  // PCM WAVE avoids dependence on an optional compressed-audio decoder. Keep
  // exactly the same prepared samples, sample rate and stereo channels.
  runEncoder(encoder, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-i', encoderInput, '-map_metadata', '-1', '-af', filter,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
    '-fflags', '+bitexact', '-flags:a', '+bitexact', fallbackPath], loop?.bytes);
  files.push({
    source: `soundeffect/${sourceName}`, file, fallbackFile,
    sourceSha256: sha256(bytes), outputSha256: sha256(readFileSync(outputPath)),
    fallbackSha256: sha256(readFileSync(fallbackPath)),
    sourceBytes: bytes.length, outputBytes: statSync(outputPath).size,
    fallbackBytes: statSync(fallbackPath).size,
    sourceDuration: wave.frames / wave.sampleRate,
    duration: (loop ? loop.frames : wave.frames - trimFrames) / wave.sampleRate,
    trimStart: trimFrames / wave.sampleRate, trimFrames,
    sampleRate: wave.sampleRate, channels: wave.channels, sourcePeak: wave.peak,
    ...(loop ? { loopPreparation: { method: 'linear-wrap-crossfade', crossfadeFrames: loop.overlap,
      crossfadeSeconds: loop.overlap / wave.sampleRate, rotationFrames: loop.overlap } } : {}),
  });
}
const manifest = {
  schemaVersion: 3,
  provenance: 'Author-provided ElevenLabs sound effects; see soundeffect/GENERATION.md. Original WAV files are unchanged.',
  encoder: encoderVersion,
  encoding: { container: 'Ogg', codec: 'Opus', bitrate: 128000, variableBitrate: true, channels: 2, sampleRate: 48000 },
  fallbackEncoding: { container: 'WAVE', codec: 'PCM', bitsPerSample: 16, channels: 2, sampleRate: 48000 },
  preparation: 'One-shots: trim only leading samples below -60 dB relative to source peak, preserving 10 ms pre-roll and the full tail. Explicit continuous loops: preserve the full source content with an 80 ms linear tail-to-head wrap crossfade, rotating the start by 80 ms and shortening the exported period by 80 ms. No pitch changes, normalization or single-shot extraction. Loop selection follows catalogue semantics, never filenames.',
  files,
};
writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(path.join(outputDir, 'manifest.js'), '// Generated by scripts/prepare-sound-effects.mjs; source WAVs are unchanged.\nexport const ' + (colony ? 'COLONY_SOUND_ASSETS' : 'SOUND_ASSETS') + ' = Object.freeze(' + JSON.stringify(files, null, 2) + '.map(asset => Object.freeze(asset)));\n');
console.log(`Prepared ${files.length} Ogg Opus assets: ${files.reduce((n, f) => n + f.outputBytes, 0).toLocaleString('en-US')} bytes; PCM WAVE fallbacks: ${files.reduce((n, f) => n + f.fallbackBytes, 0).toLocaleString('en-US')} bytes; original WAVs unchanged.`);
