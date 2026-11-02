// Shared presentation rules. Only the expedition's active clock advances this
// state; browser time zones and independent client randomness have no role.
export const AMBIENCE = Object.freeze({ daySeconds: 1440, weatherSeconds: 360,
  movieDuration: 596.458333, fireLimit: 4, cinemaLimit: 1 });
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const positiveMod = (value, divisor) => ((value % divisor) + divisor) % divisor;
export const LIGHTING_PRESETS = Object.freeze(['natural', 'sunrise', 'day', 'sunset', 'night']);
export const WEATHER_PRESETS = Object.freeze(['natural', 'clear', 'cloudy', 'rain']);

function hash(text) {
  let result = 2166136261;
  for (const char of String(text)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
function mixWeather(value) {
  // FNV alone keeps neighbouring numeric suffixes close together. Avalanche the
  // sample so consecutive weather slots can vary without any client randomness.
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}
export function defaultEnvironment(state) {
  // Ordinary snapshots omit world, so use template first on both server/client.
  return { seed: hash(state.template || state.world?.template || state.world?.id || 'colony'), lighting: 'natural', weather: 'natural' };
}
export const decorationItems = state => Array.isArray(state?.decorations?.items) ? state.decorations.items : [];
export const decorationCells = (kind, x, y) => kind === 'cinema'
  ? [{ x: x - 1, y }, { x, y }, { x: x + 1, y }] : [{ x, y }];
export const decorationAt = (state, x, y) => decorationItems(state)
  .find(item => decorationCells(item.kind, item.x, item.y).some(cell => cell.x === x && cell.y === y)) || null;

export function environmentAt(state, time = state?.time || 0) {
  const config = state?.environment || defaultEnvironment(state || {});
  const active = Math.max(0, Number.isFinite(time) ? time : 0);
  const lightingPreset = LIGHTING_PRESETS.includes(config.lighting) ? config.lighting : 'natural';
  const weatherPreset = WEATHER_PRESETS.includes(config.weather) ? config.weather : 'natural';
  const phases = { sunrise: .26, day: .5, sunset: .74, night: .02 };
  const phase = lightingPreset === 'natural' ? positiveMod(active / AMBIENCE.daySeconds + .36, 1) : phases[lightingPreset];
  const daylight = clamp((Math.sin((phase - .25) * TAU) + .18) / 1.18);
  const horizonDistance = Math.min(Math.abs(phase - .25), Math.abs(phase - .75));
  const warmth = clamp(1 - horizonDistance / .095);
  const slot = Math.floor(active / AMBIENCE.weatherSeconds);
  const weatherFor = index => {
    const value = mixWeather(hash(`${config.seed ?? defaultEnvironment(state).seed}:${index}`)) / 4294967296;
    return value < .24 ? 'rain' : value < .56 ? 'cloudy' : 'clear';
  };
  const weather = weatherPreset === 'natural' ? weatherFor(slot) : weatherPreset;
  const previous = weatherPreset === 'natural' ? weatherFor(Math.max(0, slot - 1)) : weather;
  const blend = clamp(positiveMod(active, AMBIENCE.weatherSeconds) / 12);
  const amount = (kind, type) => type === 'rain' ? kind === 'rain' ? 1 : 0 : kind === 'rain' ? .9 : kind === 'cloudy' ? .65 : 0;
  const rain = amount(previous, 'rain') * (1 - blend) + amount(weather, 'rain') * blend;
  const cloud = amount(previous, 'cloud') * (1 - blend) + amount(weather, 'cloud') * blend;
  return { phase, hour: phase * 24, daylight, warmth, night: 1 - daylight,
    weather, rain, cloud, wind: .22 + rain * .45 + cloud * .1, lightingPreset, weatherPreset };
}

export function cinemaPosition(state, time = state?.time || 0) {
  const cinema = state?.cinema;
  if (!cinema) return 0;
  const elapsed = cinema.playing ? Math.max(0, time - cinema.startedAt) : 0;
  return clamp((cinema.position || 0) + elapsed, 0, AMBIENCE.movieDuration);
}

export function tickCinema(state) {
  if (state.cinema?.playing && cinemaPosition(state) >= AMBIENCE.movieDuration) {
    state.cinema.position = AMBIENCE.movieDuration;
    state.cinema.startedAt = state.time;
    state.cinema.playing = false;
    state.cinema.revision++;
  }
}
