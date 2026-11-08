import { loadEntryScene, saveEntryScene } from './entry-continuity.js';
import { PLANETS } from './planets.js';
import { COLONY_PLANETS, colonyPlanetById, colonySavePlanetId } from './colony-planets.js';
const ALL_PLANETS = [...PLANETS, ...COLONY_PLANETS];
import { SIROCCO_MASK } from './sirocco-preview.js';
import { entrySun, entrySurfaceLight } from './entry-lighting.js';
import { DROP, JUMP, WARP, dropCamera, dropState, jumpPose, jumpState, loadPod, loadShip, paintDive, paintFlash, paintPod, paintShip, paintWarp, podPose, podScreenSize, shipDeparture, shipPose, warpState } from './entry-ship.js';
import { COLONY_ENTRY, COLONY_TRAVEL, colonyCamera, colonyCarrierPose, colonyEntryState, colonyShuttlePose, colonyTravelPose, colonyTravelState, loadColonyShip, gradeColonyDescent, paintColonyAtmosphere, paintColonyVessels } from './colony-entry-ship.js';
import { colonyWormholeState, createColonySky, paintColonySky, paintColonySun, paintColonyWormhole } from './colony-system.js';
import { THROAT_COLORS, WORMHOLE_LENS, createRearStars, createWormholeLens, lensLayer, paintLensStars, paintThroatLight, skyCover, wormholeLensState } from './wormhole-lens.js';
// Presentation only. Terrain masks are a 2:1 sampling of createPlanet's immutable
// Caldera/Vesper/Sirocco templates, encoded as [run length, palette ID].
// Baking this tiny preview avoids importing the gameplay module graph on login.
// No world, save, collision, weather or account data is read by this renderer.
const MASKS = {
  'sirocco-v1': SIROCCO_MASK,
  "caldera-v1": "/wD/AP8ABgACAR8AAwEIAAMB0QACAQIAAgEBAgQBAQIEAQ0AFgHNAAIBAgABAQsCAQELAAQBBgIEAQYCBAHQAAEBCwIBAQoAAwEUAgMBzgABAQsCAQEKAAMBFgIDAc0AAQEMAgEBCAADARgCAwHPAAsCAQEDAAcEGQICAc8ACwIBAQcAAgEaAgIBygABAQ8CAQEGAAIBHAICAcoAAwELAgEBBwACARwCAgHNAAEBBwIDAQgAAgEcAgIBzgADAQMCAQELAAEBHgIBAdEAAwELAAIBFwIBAwYCAgE1AA0BnAACAR4CAgEfACcBmAACAR4CAgEdABsBCAIIAUsABQFFAAIBIAICARsABQEKAgcBEQIIAToAEAEBAgUBQgACASACAgEZAAUBEwIBAxMCCAE1AAMBFAIFAT0AAgEiAgIBFwAEAQgCAQMjAgcBMgACARoCAwE7AAIBHgIBAwMCAgEXAAMBMAIGAS8AAgEdAgMBOQACASICAgEWAAMBMwIGAS0AAQEgAgIBOAABAQECAQMiAgEBFQAEATUCBQErAAIBIAICATcAAgEkAgIBFAADATgCBAEpAAIBIgIBATcAAgEkAgIBEwADARoCAQMfAgMBKAACASMCAgEqAAcBBQACASQCAgESAAQBOwIDASYAAgEkAgIBKQAJAQUAAgEiAgIBEwADATwCAwEmAAIBJAICASgACwEEAAIBIgICARIAAwE+AgMBJAACAQUCAQMgAgEBKAALAQQAAgEeAgEDAwICAREABAE+AgMBJAACASYCAgEmAA0BBAACASACAgERAAQBPwIDASQAAgEnAgIBJQANAQUAAgEeAgIBEgADAUACAwEkAAIBKAICASQADQEGAAIBDgIBAw0CAgESAAMBBAIBAzwCAwEkAAEBKgIBASQADQEHAAMBGAIDARIABAFCAgIBIwACASoCAgEjAA0BCAAEARQCBAETAAMBQwIDASIAAgEqAgIBIwANAQoAAwEMAgEDBQIDARQAAwFEAgMBIgABASsCAgEkAAsBDAADAQECAQMOAgMBFQADAUQCAwEhAAIBKgICASUACwENAAMBDgIDARUABAFEAgQBIAACASoCAgEmAAkBEAACAQECAQMKAgIBFwADAUYCAwEhAAIBKAICASgABwESAAMBCAIDARgAAwFGAgQBIAACASgCAgFCAAQBBAIEARkAAwE+AgEDCAIDASEAAwEHAgEDHQICAUUACAEbAAMBBAIBA0MCAwEiAAMBIgICAUgABAEcAAQBSQIDASMAAwEfAgIBaQADAUoCBAEkAAIBGwIEAWoAAwFLAgMBJQADARYCBAFtAAMBTAIDASYAAgETAgMBcAADAUwCAwEnAAMBEAICAXIAAwFMAgQBKAAFAQsCAgFyAAMBTgIDASwABQEEAgMBdAADAU4CAwEwAAYBdgADAU4CAwGrAAMBAgIBA0wCAwGrAAMBTgIEAasAAwFOAgMBrAADAU4CAwGrAAMBTgIEAasABAFNAgMBrQADAUwCBAGtAAMBTAIDAa4ABAFKAgQBrwADAUoCAwGwAAQBBwIBA0ACBAGxAAUBRgIDAbQABAFCAgEDAQIDAbYABQFBAgQBuAAFAQYCAQMmAgEDCQIBAwYCBAG7AAUBOAIBAwICBAG9AAUBOQIEAcAABQE1AgUBwgAFATICBgHFAAQBLQIIAcgABAEqAgcBzAAEAQUCAQMIAgEDGAIGAdAABAEgAgEDAwIGAdMABQEhAgUB1wAFAR4CBAHaAAcBGgIEAT8AAwGbAAkBFQIEAToADgGZAAkBEAIEASIACwEKABYBmgAJAQoCBQEgADABmwAUAR8AIgEIAgsBnAAOASAAHgEQAgoBngAHASIABwEPAgQBGAIJAcQABgEvAgoBwAAFAQsCAQMoAgkBvQAFARcCAQMbAgEDAwIJAbsABAE6AggBuQAEAT0CBwG4AAQBKQIBAxUCBgG2AAQBGgIBAycCBQG0AAUBQwIFAbMABAExAgEDEwIFAbEABQFGAgQBsQAEAUgCBAGvAAUBSAIEAUwACgFZAAQBQAIBAwkCBAE4AAoBBAASAVUABQFKAgQBNgAkAVMABAFLAgQBNQAVAQsCBwFQAAQBTQIDATQABAEfAgcBTQAFAU0CAwEzAAQBEwIBAw4CBwFLAAQBTgIEATEAAwEnAgYBSAAFAU4CBAEwAAQBCAIBAyACBQFGAAUBTwIEATAAAwENAgEDHgIEAUUABAFQAgQBLwADAS4CBAFDAAUBUAIEAS8AAwEvAgQBQgAEAVICAwEuAAMBMQIEAUAABQFSAgMBLgADATICAwFAAAQBUwIEASwAAwE0AgIBQAAEAVMCBAEsAAMBNAIDAT4ABAFQAgEDAwIEASsAAwE1AgMBPgAEAVQCBAErAAMBNgICAT4ABAFVAgQBKQADATcCAgE+AAMBVgIEASkAAwEzAgEDAwICAT0ABAFXAgQBJwADATgCAwE8AAQBVwIEAScAAwE4AgMBPAAEAVgCBAElAAMBOQIDATwABAFXAgEDBQEkAAMBOQIDATwABAFZAgQBIwADAToCAwE8AAQBWgIEASIAAwE2AgEDBAICATwABAFaAgQBIgACATgCAQMDAgMBOwAEAVsCBAEgAAMBPAIDATsAAwFcAgQBIAADATwCAwEoAAIBEAAEAV0CBAEfAAMBPQIDAR8ADAEOAAQBXQIEAR8AAwE9AgMBHgAIAQQCAwEMAAQBAQNaAgEDAgIEAR4AAwE+AgMBHAACAQ0CAgELAAQBXgIEAR4AAgFAAgIBHAABAQ8CAgEKAAMBXwIEAR4AAgFAAgMBGwABARACAgEIAAQBXwIEAR4AAgFBAgMBGQABARICAgEHAAQBAQIBA10CBAEdAAMBQQIDARkAAQETAgEBBwADAWACBAEdAAMBQgICARkAAQETAgEBBgAEAQEDXwIEAR0AAwEGAgEDOwIDARcAAQEUAgEBBgAEAWACBAEdAAMBAQNBAgMBFwABARQCAQEGAAQBYAIEAR0AAgFDAgMBFgACARUCBgADAWECBAEcAAMBQwIDARYAAQEWAgEBBQADAWACBAEdAAMBQwIDARYAAQECAgEDEwIBAQQABAFgAgQBHQADAUMCAwEWAAEBFgIBAQQABAFgAgQBHQACAUQCAwEVAAEBFwIBAQQABAFfAgUBHAADAUQCAwEVAAEBAgIBAxQCAQEEAAQBXwIEAR0AAwFEAgMBFQABARgCAQEDAAQBXwIEAR0AAwEHAgEDPAICARYAAQEYAgEBAwAEAV4CBAEeAAMBOwIBAwcCAwEWAAEBGAIBAQQAAwFeAgQBHgADAUMCAwEWAAEBGQIBAQMABAFcAgUBHgADAQECAQNAAgMBFwABARkCAQEDAAQBXAIEAR8AAwFCAgMBFwABAQICAQMWAgEBBAAEAVsCBAEfAAMBQgIDARcAGgIBAQQABQFZAgQBIQADAUACAwEXAAEBGgIBAQUABQFYAgQBIQADAUACAwEXAAEBGgIBAQYABQFWAgQBIwADAT8CAgEYAAEBGQICAQYABgFVAgQBIwAEAT0CAwEYAAEBGQIBAQgABgEDAgEDTwIEASUABAE8AgMBGAABARkCAQEKAAYBDgIBA0ICBAEmAAQBOgIDARkAAgEVAgEDAgIBAQsABgFPAgQBKQAEATgCAwEaAAEBFwICAQwABwEPAgEDPAIFASoABAE2AgMBGwACAQMCAQMSAgEBDwAGAQEDCwIBAy8CAQMNAgUBLAAFATMCBAEcAAIBFQIBARAABwFHAgUBLwAEATECBAEeAAIBEwICARIABgFFAgYBMAAEASYCAQMIAgQBIAABARMCAQEUAAYBQwIGATIABAEsAgUBIgABAQICAQMLAgIDAgEWAAYBQAIHATQABAEpAgUBJAACAQ4CAgEZAAUBPQIHATcAAwEmAgcBJgABAQ0CAgEbAAUBOQIJATkAAwEjAgcBKAACAQsCAgEdAAUBNQIKATsABAEGAgEDGgIFASwAAgEKAgEBHgAGAS0CAQMEAgoBPgAEAQsCAQMTAgUBLgADAQcCAQEgAAUBMQIIAUIABAEcAgEDBAExAAMBBQICASEABgEuAgcBRQAFARoCBAE0AAMBAgICASMABgErAgcBSAAGAQcCAQMPAgQBNwAEASUABgEnAgEDAQIGAUwABwEUAgMBYgAHASYCBgFPAAgBDwIEAWQACAEkAgUBUgAIAQwCBAFnAAgBIQIEAVcACAEHAgUBaQAKAR0CBAFbABABbAALAQUCAQMSAgUBXgANAXAACwEGAgEDDQIFAWIABwF1AAwBEAIFAeIADAELAgYB5gAZAeoAFQHuABAB8wALAf8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wBLAA==",
  "vesper-v1": "/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8ALgAPAe4AJAHaAAYBDAIYAUIADQGFAAUBIQIIAToAHgF5AAQBFgICBQ8CBQE2AAoBCwIiAWEABAEXAgMFAQcCAgEDDQIBAwQBMQAIARkCHQFcAAQBFwICBgIHAgURAgMBLwAHATQCBwFZAAQBAwIBAxQCAgYCBwMFEQIDASwABgE6AgYBVgADARsCAQYCBwQGEQIDASkABgE+AgUBVAADAR0CAgcEBgEHEAIDAScABgFCAgQBUgADAR8CAQYCBQQGEAIDASUABQE/AgEDBQIEAVAAAwEDAgEDHQICBQQGAQUPAgMBIwAFAUgCBAFOAAMBDAIBAxYCAQYCBwIGAgcPAgIBIgAFAUoCBAFMAAMBJQICBwIGAgcPAgMBIAAEARYCAgUCBwEGMgIDAUwAAwEmAgEHBAUBBg4CAwEeAAUBFAIBBQIGBAcEBigCAQMGAgQBSgADAR8CAQMIAgQFAQYPAgIBHQAFARICAgcCBQIGBAcEBgIFAQcDAgEDGgIBAw0CBAFKAAIBKQICBwQGDgIDARwABAEQAgEHAgUEBwYFCAcBBh8CAQMLAgMBSQADAQICAQMnAgEHBQYNAgMBGwAEAQ4CAgYCBwIFBAcGBQgHAgYCBygCBAFIAAMBKgIDBQMGDQIDARoABAEOAgUGAgUCBwIGBAUCBgIHAgYCBwIFAgcCBQEGKAIDAUgAAgEsAgIFAwYOAgMBGQADAQ4CBgYCBQIHAgYEBQIGAgcCBgIHAgUCBwIFAgYUAgEDEgIEAUkAAgEmAgEDBAIEBQ4CAwEYAAQBDgICBgIHAgYEBwQGAQcDAgIGAgcCBQQHAgYCBScCBAFJAAIBLAICBRACAwEXAAMBBAIBAwoCAgYCBwIGBAcCBgkCAQcCBQQHAgYCBSgCBAFIAAIBPgIDARYABAEQAgMFAgYCBQEGDgIBBwYGAgcZAgEDDwIEAUcAAgE/AgMBFQAEARECAgUCBgEFEwIEBgEHCgIEBRwCBAFHAAIBPwIDARUAAwE4AgIHAgUCBhkCAQMCAgQBRgACAUACAwEUAAMBNQIBAwICAgcCBQIGAgUBAgEDGQIEAUUAAgFBAgMBEgAEASkCAQMOAgIGBAUCBwIGGgIEAUQAAgFBAgMBEgAEATgCAgYEBQIHAgYBBxoCBAFDAAIBLgIEBRACAwERAAMBOwIGBgQFAQYWAgEDAgIEAUIAAgEtAgUFEQICARAABAE8AgUGBAUDBhgCBAFBAAIBLQIBBwIFAgcBBhACAwEPAAQBPgIBBwIGAgcCBQIHAgUYAgMBQQACASgCAQMEAgEHAgUCBwEGEAIDAQ8AAwFAAgIGAgcCBQIHAgUBBhcCBAFAAAIBLQIFBwIFEAICAQ4ABAEOAgEDMwICBgQFAgYCBxcCAwFAAAIBLgIEBwIFEAICAQ4ABAFEAgQFAgYCBxcCBAE/AAIBLgIEBwIFEAICAQ4AAwFGAgEGAgUEBgEHFgIEAT8AAgEuAgQHAgUBBw8CAgENAAQBEQIBAzUCAgUEBgIHFQIEAT8AAgEvAgMFAgYBBQ4CAwENAAMBLwIBAxkCAQcEBQIHFQIEATkAAgEnAgQICgIDBQIGAgUNAgMBDQADATQCBQgRAgQFAgcBBRQCBAE4AAMBJAIJCAECAQMHAgIHBAUNAgMBDAAEATACDAgOAgIGAgUCBwIFEgIEATkAAwEjAgwIBwICBwQFAQMMAgIBDQAEAS8CDwgNAgEGAgUCBwIFEgIEATkAAwEjAgwIBwICBwIGAgcMAgMBDQAEAS4CEQgNAgIHAgYCBwEFEAIEATsAAgEjAg0IBgICBwIGAgcLAgMBDgAEAQoCAQMiAhIIDQICBwIGAgcCBQ8CBAE7AAMBIQIOCAYCAgcCBgIHCwIDAQ8AAwEtAhMIDQIBBQIGAgUCBgcCAQMGAgQBPAADASECDggGAgIHAgYCBwoCAwEQAAQBLAITCAECAQMMAgIGAgUDBgwCBAE+AAIBIQINCAcCAgUCBgIHCQIDAREABAEsAhMIDgICBgQHAQYLAgQBPwADAQICAQMIAgEDFQILCAgCAgUCBgIHCQIDARIABAErAhIIEAIBBgQHCgIFAUEAAwEhAggICQIBBwIGBAUIAgMBFAAFAScCAQMCAhAIEgICBwIFCQIFAUMAAwEfAgUIDQIBBwIGAwUIAgMBFgAFASYCAQMEAg0IHwIFAUUABAEIAgEDEwIFCA4CAQUFBgcCAwEZAAUBKwIJCCACBAFIAAQBGgIFCA8CAQUFBgYCAwEcAAYBLQIFCAICAQMaAgUBSwAFARYCBQgRAgIGAgUBBgUCAwEfAAcBKwIFCBsCBQFOAAUBFAIECBMCAQYBBQEDBQIDASMABwEXAgEDEQIFCBgCBQFSAAUBEgIDCBoCBAEnAAcBJwIFCBUCBgFVAAUBDwIECBkCBAErAAcBJQIGCBICBQFZAAUBDQIECAQCAQMTAgQBLwAGASQCCAgMAgYBXQAEAQwCBAgWAgUBMgAGARkCAQMJAgkICAIGAWAABAELAgMIFQIFATYABQEkAgkIAwIHAWMABAEJAgQIEwIFAToABQElAgcIBgFoAAMBCAIECBACBgE+AAUBJQIGCAIBbAADAQcCBAgOAgYBQQAFASACBgEDCHAABAEFAgMIDAIGAUYABQEbAggBdQAEAQMCBAgJAgEDBgFKAAYBFAIJAXoABAEBAgQIBwIGAU8ACAELAgoBfwADAQQIDAFUABYBhQABAQQICQFbAA0BjgAFAf8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wClAAoB9AAQAe4AIAHfAAUBBwIBAwICFAHcAAQBEAISAdkABAEfAgUB1wADASMCBAHVAAMBEQIBAxMCBAFbABMBZQADAQ8CAgUCBxQCAwFWACIBWgADAQ8CAQYCBQMHFAIDAVIADQEHAigBQgAEAQ8CAQcEBgEFFQICAVAACQEWAiMBPQAEARACAQcEBgIFFAIDAUwACAE1AgoBOwADARECBwUBBhQCAgFKAAgBFAIBAycCBwE4AAMBEwIGBQIGEwICAUkABgFBAgcBNgADARQCAQYCBQIGAgUTAgMBRgAGAUUCBgE0AAMBFgICBQIGAgUBBwoCAQMHAgMBRAAGAUkCBQEzAAIBFwIEBQIGAgcSAgIBQwAGASoCAQMgAgUBMQADARgCAwUCBgIHEgICAUEABgFOAgUBMAACARoCAgYCBwMFEQICAUAABgFQAgQBLwADARoCAgYCBwQFEAIDAT4ABQEPAgEHAgYBBT8CAQMEAS4AAgEcAgMFBAcQAgMBPQAFAQ8CAgcCBgIFAgYEBzkCBAEuAAIBHQICBQQHEQICATwABQEOAgIFBAYEBQQGAgcCBjYCBAEsAAMBHQICBgIHAgYBBxACAgE7AAUBDgIBBgIFBAYEBQQGAgcDBjUCBAEsAAIBHwIBBgIHAgYBBxACAgE6AAUBDQIBBgIHAgUCBgQHBgYEBQEHNQIEASwAAgEfAgEFAgcCBQEGEAIDATgABQENAgIGAgcCBQIGBAcGBgQFAQcUAgEDIQIEASsAAgEfAgEFAgcCBQEGEAIDATcABQEMAgIHBAYCBQgGAgcCBgQFAQc2AgQBKgADAQ8CAwgNAgMHAgYCBxACAgE3AAQBAQMKAgIFAgcEBgIFAwYBAgQGAgcCBgQFHAIBAxICAQMHAgQBKgADAQ4CBggMAgIHAgYCBxACAgE2AAQBCwIBBgQFAgcCBQIHAgYKAgIHAQUNAgQFKAIEASkAAgEOAggICwICBwIGAgcQAgMBNQAEAQoCAgYEBQIHAgUCBwMCAQMXAgEGBAUCByYCBAEpAAIBDQIJCAsCAgcCBgIHAQUQAgIBNAAEAQoCAwUCBwIFBQYIAgEDEwIBBQIGAgcDBiYCBAEoAAIBDQIKCAsCAQYEBQEHEAIDATMABAEKAgMFAgcCBQMGHgIBBQIGAgcEBiUCBAEoAAIBDAILCAsCAQYEBRECAwEzAAQBCgIBBwIGAgUCBwIFHwIFBQIHAgUBBiUCBAEnAAIBDAIMCAsCBAcSAgIBMgAEAQsCAQcCBgIFAgciAgQFAgcCBQIGJAIFASYAAgEMAgwIIQIDATEABAEMAgIFAgclAgEFAgcCBgIFBAcjAgQBJQADAQwCDAgiAgIBMQAEARkCAQMcAgIHAgYCBQQHAQYjAgQBJAADAQwCDAgiAgMBLwAFAQMCAQMJAgEDHgIBAwoCAQcIBQIHCAIBAxkCBQEjAAIBDAINCAoCAQMYAgIBLwAEATkCCAUDByICBQEiAAIBCgIOCCQCAgEvAAQBOwICBgIFBAYCByICBQEhAAIBCQIPCCQCAwEuAAQBDgIBAy0CAQYCBQQGAwciAgUBIAACAQcCEQglAgIBLgAEAT0CBAYCBwIFAgYiAgQBIAACAQUCBwgCAgkIJgICAS0ABAEYAgEDJgIDBgIHAgUCBiMCBAEeAAMBAgIJCAQCBwgnAgIBLQAEAQsCAQM0AgQHAgUDBhUCAQMMAgUBHQACAQECCQgHAgUIKAICAS0ABAFBAgMHAgUEBiICBAEdAAoIDQIBAygCAwErAAQBGAIBAxkCAQMQAgQHAgYDByECBQEcAAcIOQIDASsABAEVAgEDFAIKCBACAwcCBgMHIgIEARwABQgdAgIGHAIDASsABAEkAgEDAgIPCA4CAQcCBQQHAgUhAgQBGwADCB8CAgYDBRoCAwEqAAQBJwISCA0CAgUEBwMFDAIBAxMCBAEbAAMBFQIBAwgCAQUCBgMFGgIDASoABAEmAhQIDQIBBwYFAQcgAgUBGgACAR4CAgUFBhoCAgErAAQBIwIBAwECFQgNAgEHBgUCBx8CBQEaAAIBHgICBQUGGgICASoABAEmAhYIDQICBQIGAgcCBQEGHgIFARoAAgEdAgEHAgYCBwIFGwICASoABAElAhcICgIBAwMCAQUCBgIHAgUBBh4CBAEbAAIBHAICBwIGAgcCBRsCAgEqAAQBJQIXCA8CAgYCBQIGAgUdAgQBGwACARwCBgcBBRsCAwEqAAQBJQIXCA8CAgYCBQIGAgUcAgUBGwACARsCBwccAgIBKwAEAQgCAQMdAhYIEAIBBgYFHAIEARwAAgEaAgIHBgYWAgEDBAIDASsABAERAgEDFAIVCBICBQUCAgEDGQIFARwAAwEZAgIHBQYcAgMBKwAEAScCEwgUAgEGAgUdAgQBHQADARgCAQYEBwIFHQICASwABAEpAhAINAIFAR4AAgEXAgIGBAcCBRwCAwEsAAQBKgINCDUCBQEfAAIBFwICBwIGAgUBBx0CAgEuAAQBLAIHCAsCAQMrAgUBIAADARYCAgcCBgIFDAIBAw0CAQMCAgMBLgAFASsCBAg5AgUBIgACARYCBAcCBR0CAgEwAAQBKwIDCDkCBQEjAAMBAgIBAxICBAcCBRwCAwEwAAUBBgIBAyICBAg4AgUBJQADARQCAgYCBQIGGwIDATIABgEnAgQINwIFAScAAwETAgIGAgUCBgEDFgIBAwMCAwE0AAUBJgIDCAsCAQMrAgUBKAAEARICAgUCBgIFGgIDATYABgELAgEDFwIECCUCAQMQAgUBKgAEAQEDEQIBBQIGAgUBBhgCAwE5AAYBIQIECBECAQMiAgYBLAAFARACAQcFBRgCAwE7AAcBHgIFCDICBQEwAAQBDwIBBwUFFwIDAT4ACAEcAgQIMQIFATIABQENAgMGAwcWAgQBQAAJARoCBAguAgYBNAAFAQwCAwYDBxUCBAFEAAkBEAIBAwYCBQgsAgUBOAAEAQsCBQUBBhUCAwFIAAgBFgIECCoCBgE6AAQBBAIBAwUCBQUBBhQCAwFMAAcBFQIECAkCAQMdAgYBPQAEAQoCAgUDBwICAQMPAgQBTwAHAQgCAQMKAgUIJAIHAT8ABAEJAgIFAgcSAgQBUgAGARMCBAghAggBQgADAR4CBAFVAAYBEgIECB4CCAFFAAMBGwIFAVgABQERAgQIGgIJAUkAAwEZAgUBWgAFARECBAgWAgoBTAADARYCBQFeAAUBDwIECBMCCgFPAAMBFAIGAWAABgEOAgQIDwIJAVQAAwESAgUBZAAGAQ0CBAgLAgkBWAADAQ8CBQFnAAcBCwIECAcCCgFcAAQBCwIGAWoACAEJAgQIAgILAWAABQEHAgYBbgAPAQQICQFlAA8BcwANAQQIBAFqAAwBeQAJAQMIcQAIAf8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/ADsA"
};
const PALETTES = {
  'sirocco-v1': [[169,104,54],[214,186,134],[193,161,112],[131,94,67],[104,120,116],[131,73,52],[163,103,68],[193,143,95],[40,137,133]],
  'caldera-v1': [[13,34,51],[169,181,187],[43,79,130],[81,90,104],[104,120,116]],
  'vesper-v1': [[22,47,66],[154,150,126],[76,106,85],[79,91,106],[105,120,118],[66,77,89],[105,116,125],[163,173,175],[44,94,101]],
};
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
let seed = 49183;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const noise = (x, y) => {
  let n = Math.imul(x + 131, 374761393) ^ Math.imul(y + 907, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (noise(ix, iy) * (1 - u) + noise(ix + 1, iy) * u) * (1 - v)
    + (noise(ix, iy + 1) * (1 - u) + noise(ix + 1, iy + 1) * u) * v;
}
function cloudNoise(x, y) {
  return smoothNoise(x, y) * .5 + smoothNoise(x * 2.07 + 31, y * 2.07 - 12) * .27
    + smoothNoise(x * 4.13 - 7, y * 4.13 + 39) * .15 + smoothNoise(x * 8.19 + 71, y * 8.19) * .08;
}
// Civilian worlds have their own soft geographic silhouettes. Their palettes
// come from the same catalog as the playable districts, not the combat masks.
function makeColonyTexture(id) {
  const planet = colonyPlanetById(id), palette = planet.surface;
  const width = 512, height = 384, data = new Uint8ClampedArray(width * height * 3), mask = new Uint8Array(256 * 192);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const water = rgb(palette.water), land = rgb(palette.land), shore = rgb(palette.shore), dark = rgb(palette.dark);
  const variant = COLONY_PLANETS.findIndex(p => p.id === id);
  const continents = [
    [[.18,.40,.17,.31],[.62,.42,.19,.23],[.79,.72,.16,.19],[.36,.80,.12,.10]],
    [[.14,.38,.12,.22],[.45,.61,.13,.24],[.72,.33,.15,.17],[.88,.69,.10,.21],[.28,.77,.07,.08]],
    [[.12,.42,.24,.28],[.52,.31,.17,.23],[.75,.67,.24,.29],[.34,.76,.16,.18]],
  ][variant];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height, lon = u * TAU;
    const coarse = smoothNoise(Math.cos(lon) * 5 + variant * 17 + 20, Math.sin(lon) * 3 + v * 9 + 31);
    const detail = smoothNoise(Math.cos(lon) * 15 + variant * 13, Math.sin(lon) * 8 + v * 22);
    let elevation = -2;
    for (const [cx, cy, rx, ry] of continents) {
      const du = Math.min(Math.abs(u - cx), 1 - Math.abs(u - cx));
      elevation = Math.max(elevation, 1 - (du / rx) ** 2 - ((v - cy) / ry) ** 2);
    }
    elevation += (coarse - .5) * .82 + (detail - .5) * .20;
    // Sheltered lagoons on Nacre, bright inland lakes on Aurelia.
    if (variant === 1 && detail > .57 && coarse > .51) elevation -= .72;
    if (variant === 2 && detail > .64 && coarse < .47) elevation -= 1.02;
    const kind = elevation <= 0 ? 0 : elevation < .13 ? 1 : 2;
    mask[(y >> 1) * 256 + (x >> 1)] = kind;
    const base = kind === 0 ? water : kind === 1 ? shore : land;
    const relief = kind === 2 ? Math.min(.50, Math.max(0, (coarse - .42) * .82)) : 0;
    const grain = (noise(x, y) - .5) * 4;
    const terrace = variant === 2 && kind === 2 ? Math.sin((elevation * 15 + coarse) * 8) * 2.8 : 0;
    const deep = kind === 0 ? .61 + .20 * Math.max(0, 1 + elevation) : 1;
    const clouds = smoothNoise(Math.cos(lon) * 7 + 83, Math.sin(lon) * 2 + v * 17 + variant * 9);
    const band = Math.sin(v * 34 + Math.sin(lon * 2) * 3 + variant) * .08;
    const cloud = Math.min(.68, Math.max(0, (clouds + band - .64) * 2.1));
    const offset = (y * width + x) * 3;
    for (let c = 0; c < 3; c++) {
      const pigment = (base[c] * (1 - relief) + dark[c] * relief) * deep + grain + terrace;
      data[offset + c] = pigment * (1 - cloud) + [242, 242, 227][c] * cloud;
    }
  }
  return { width, height, data, mask };
}
function makeTexture(id) {
  if (colonyPlanetById(id)) return makeColonyTexture(id);
  const width = 512, height = 384, data = new Uint8ClampedArray(width * height * 3);
  const mask = new Uint8Array(256 * 192);
  if (Object.hasOwn(MASKS, id)) {
    const runs = atob(MASKS[id]); let cursor = 0;
    for (let i = 0; i < runs.length; i += 2) {
      const count = runs.charCodeAt(i); mask.fill(runs.charCodeAt(i + 1), cursor, cursor + count); cursor += count;
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tile = mask[(y >> 1) * 256 + (x >> 1)];
    const mx = x / 2 + Math.sin(y * .073) * .35, my = y / 2 + Math.cos(x * .067) * .35;
    const ix = Math.floor(mx), iy = Math.floor(my), fx = mx - ix, fy = my - iy;
    const color = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      const value = mask[clamp(iy + dy, 0, 191) * 256 + (ix + dx + 256) % 256];
      const sample = PALETTES[id]?.[value] || [110,103,94];
      for (let c = 0; c < 3; c++) color[c] += sample[c] * weight;
    }
    const dunes = id === 'sirocco-v1' && tile === 0;
    const fine = (noise(x, y) - .5) * (tile || dunes ? 9 : 4);
    const broad = dunes ? Math.sin(y * .19 + Math.sin(x * .07) * 2.5) * 9 : (Math.sin(x * .026 + Math.cos(y * .047) * 3) + Math.sin(y * .033 - x * .021)) * (tile ? 7 : 3);
    const relief = (noise(x >> 2, y >> 2) - .5) * (tile || dunes ? 12 : 2);
    const offset = (y * width + x) * 3;
    for (let c = 0; c < 3; c++) data[offset + c] = color[c] + fine + broad + relief;
  }
  return { width, height, data, mask };
}
const textures = new Map();
function getTexture(id) {
  if (!textures.has(id)) textures.set(id, makeTexture(id));
  return textures.get(id);
}
// The dive lands on a coast, so land and sea are both in view when the pod arrives.
function nearestCoast(mask, x, y) {
  for (let ring = 0; ring < 96; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
    const tx = ((x >> 1) + dx + 256) % 256, ty = clamp((y >> 1) + dy, 0, 191);
    if (mask[ty * 256 + tx] === 1) return { x: tx * 2, y: ty * 2 };
  }
  return { x, y };
}
// Daylit surface for the dive. The pod's descent shows land whichever side of the
// planet the sun is on, because re-entry cannot wait for dawn.
const surfaces = new Map();
function surface(id) {
  if (surfaces.has(id)) return surfaces.get(id);
  const { width, height, data } = getTexture(id), flat = document.createElement('canvas'), canvas = document.createElement('canvas');
  flat.width = width; flat.height = height; canvas.width = width * 2; canvas.height = height * 2;
  const source = flat.getContext('2d'), ctx = canvas.getContext('2d'); if (!source || !ctx) throw new Error('Canvas unavailable');
  const pixels = source.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) pixels.data[i * 4 + c] = data[i * 3 + c] * 1.32;
    pixels.data[i * 4 + 3] = 255;
  }
  source.putImageData(pixels, 0, 0);
  // A soft bake melts the 2:1 map's stair-stepped coast at dive altitude.
  ctx.filter = 'blur(3px)'; ctx.drawImage(flat, 0, 0, canvas.width, canvas.height);
  surfaces.set(id, canvas); return canvas;
}
const projections = new Map();
function makeSphere(id, size) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const pixels = ctx.createImageData(size, size);
  let samples = projections.get(size);
  if (!samples) {
    samples = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + .5) * 2 / size - 1, ny = (y + .5) * 2 / size - 1;
      const r2 = nx * nx + ny * ny; if (r2 >= 1) continue;
      const nz = Math.sqrt(1 - r2), u = Math.atan2(nx, nz) / TAU + .5;
      samples.push({ offset: (y * size + x) * 4, u, v: Math.asin(ny) / Math.PI + .5,
        nx, ny, nz, alpha: Math.min(1, (1 - r2) * size) * 255 });
    }
    // The other planet uses the same projection. Reuse it on the first arrow
    // press instead of allocating and projecting another full sphere.
    projections.set(size, samples);
  }
  for (const p of samples) pixels.data[p.offset + 3] = p.alpha;
  return { canvas, ctx, pixels, samples, texture: getTexture(id), lastPhase: NaN, lastLight: NaN };
}
const spheres = new Map();
function sphere(id, size, phase, sun, warm = false) {
  const key = `${id}:${size}:${warm ? 'warm' : 'cold'}`;
  if (!spheres.has(key)) spheres.set(key, makeSphere(id, size));
  const s = spheres.get(key);
  if (Math.abs(s.lastPhase - phase) < .00018 && Math.abs(s.lastLight - sun.angle) < .0006) return s.canvas;
  const { width, height, data } = s.texture, out = s.pixels.data;
  for (const p of s.samples) {
    const x = Math.floor(((p.u + phase) % 1 + 1) % 1 * width);
    const y = Math.min(height - 1, Math.floor(p.v * height));
    const i = (y * width + x) * 3, o = p.offset;
    const light = entrySurfaceLight(p.nx, p.ny, p.nz, sun), rim = light.rim * (id === 'moon' ? 12 : 105);
    if (warm) {
      const brightness = .10 + light.brightness * .93;
      out[o] = data[i] * brightness * 1.08 + rim;
      out[o + 1] = data[i + 1] * brightness * 1.02 + rim * .88;
      out[o + 2] = data[i + 2] * brightness * .95 + rim * .55;
    } else {
      out[o] = data[i] * light.brightness * .95 + rim * .42;
      out[o + 1] = data[i + 1] * light.brightness * 1.02 + rim * .78;
      out[o + 2] = data[i + 2] * light.brightness * 1.13 + rim;
    }
  }
  s.ctx.putImageData(s.pixels, 0, 0); s.lastPhase = phase; s.lastLight = sun.angle;
  return s.canvas;
}
function makeAtmosphere(warm = false) {
  // A unit rim with room for its blur. Rotate and scale this cached sprite
  // instead of issuing 16 shadow-blurred strokes per planet on every frame.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 288;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.translate(144, 144); ctx.strokeStyle = warm ? '#fff0b5' : '#95dcff'; ctx.shadowColor = warm ? '#e9c36c' : '#5bbfff';
  ctx.shadowBlur = 128 * .026; ctx.lineWidth = 128 * .005;
  for (let i = -8; i < 8; i++) {
    ctx.globalAlpha = .32 * Math.pow(Math.cos(i / 8 * Math.PI / 2), 2);
    ctx.beginPath(); ctx.arc(0, 0, 128 * 1.002, i / 8 * Math.PI / 2, (i + 1) / 8 * Math.PI / 2); ctx.stroke();
  }
  return canvas;
}
function makeNebula() {
  // Cached cloudy filaments, not a full-screen colored wash. The empty regions stay black.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const nx = x / 512 * 2 - 1, ny = y / 512 * 2 - 1;
    const warp = cloudNoise(x * .009 + 8, y * .009 - 4);
    const f = cloudNoise(x * .022 + warp * 5, y * .022 + warp * 3);
    const lane = ny + .23 * Math.sin(nx * 3.6) + (warp - .5) * .45;
    const band = Math.exp(-lane * lane * 7) * Math.max(0, 1 - Math.pow(Math.abs(nx), 3));
    const curls = Math.max(0, f - .32) * 2.8;
    const density = clamp(band * curls * .65);
    const fade = clamp((1 - Math.hypot(nx * .75, ny)) * 2);
    const pale = clamp((f - .54) * 4), offset = (y * 512 + x) * 4;
    pixels.data[offset] = 17 + pale * 48;
    pixels.data[offset + 1] = 58 + pale * 85;
    pixels.data[offset + 2] = 104 + pale * 100;
    pixels.data[offset + 3] = density * fade * 155;
  }
  ctx.putImageData(pixels, 0, 0); return canvas;
}
function makeClouds() {
  // Soft decks for the pod's dive, built on first use rather than on every lobby visit.
  const size = 240, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size * 2 - 1, ny = y / size * 2 - 1, offset = (y * size + x) * 4;
    pixels.data[offset] = pixels.data[offset + 1] = 236; pixels.data[offset + 2] = 244;
    pixels.data[offset + 3] = clamp((cloudNoise(x * .02 + 3, y * .02 + 9) - .42) * 3.4) * clamp((1 - Math.hypot(nx, ny)) * 1.8) * 190;
  }
  ctx.putImageData(pixels, 0, 0); return canvas;
}
function makeGrain() {
  // A seamless tile of light and dark mottling for soft-light over the ground.
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const pixels = ctx.createImageData(size, size);
  const wrapped = (x, y, period) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => noise(a % period, b % period);
    return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = wrapped(x / 16, y / 16, 8) * .5 + wrapped(x / 8, y / 8, 16) * .3 + wrapped(x / 4, y / 4, 32) * .2, offset = (y * size + x) * 4;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = value > .5 ? 255 : 0;
    pixels.data[offset + 3] = clamp(Math.abs(value - .5) * 4.5) * 200;
  }
  ctx.putImageData(pixels, 0, 0); return canvas;
}
function makeLightShafts() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.translate(320, 320); ctx.filter = 'blur(5px)';
  for (let i = 0; i < 18; i++) {
    const angle = i * TAU / 18 + Math.sin(i * 3.1) * .16;
    const length = 260 * (.62 + .5 * noise(i, 72)), width = .016 + noise(i, 44) * .055;
    ctx.save(); ctx.rotate(angle);
    const shaft = ctx.createLinearGradient(0, 0, length, 0);
    shaft.addColorStop(0, '#dbf5ffb0'); shaft.addColorStop(.18, '#8ad5ff36'); shaft.addColorStop(1, '#3c9ae500');
    ctx.fillStyle = shaft; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, -length * width); ctx.lineTo(length * 1.06, 0); ctx.lineTo(length, length * width); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  return canvas;
}

function startScene() {
  document.body.classList.add('entry-world');
  const isCampaignPage = !location.pathname.match(/^\/(login|register|account|demo-inbox|verify|forgot-password|reset-password)/);
  if (isCampaignPage) {
    const params = new URLSearchParams(location.hash.slice(1)), view = params.get('view'), planet = params.get('planet');
    if (['menu', 'colony', 'new', 'continue', 'join'].includes(view)) document.body.dataset.entryView = view;
    if (params.get('mode') === 'colonization' || view === 'colony') {
      document.body.dataset.entryMode = 'colonization';
      document.body.dataset.entryPlanet = colonySavePlanetId(planet);
    } else if (PLANETS.some(p => p.id === planet)) document.body.dataset.entryPlanet = planet;
  }
  const canvas = document.createElement('canvas'); canvas.className = 'entry-scene';
  canvas.setAttribute('aria-hidden', 'true'); document.body.prepend(canvas);
  let ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { canvas.remove(); document.body.dataset.sceneReady = 'fallback'; const control = document.getElementById('motion'); if (control) control.hidden = true; return; }
  const media = matchMedia('(prefers-reduced-motion: reduce)'), restored = loadEntryScene();
  let savedPause = false;
  try { savedPause = sessionStorage.getItem('frontier-entry-paused') === '1'; } catch { /* Storage may be disabled. */ }
  let paused = media.matches || savedPause, dead = false, failed = false, frame = 0, width = 0, height = 0;
  let lastTime = 0, elapsed = restored?.elapsed || 0, transitionStart = 0, lastCheckpoint = 0;
  let currentView = '', currentPlanet = '', currentMode = '', current = [], from = [], target = [];
  let orbitSide = restored?.orbitSide || -1, exchanging = false, transitionDuration = 600;
  let pointerX = restored?.pointer.x || 0, pointerY = restored?.pointer.y || 0, initialized = false;
  let ship = null, colonyShip = null, colonyShipRequested = false, shipAlpha = 0, lastDrawn = elapsed, pixelScale = 1, jump = null, warp = null, drop = null, clouds = null, grain = null;
  let colonyTravel = null, lastColonyPose = null, wormhole = null, colonySky = null, colonyAtmosphere = null;
  // The lens context is created on the first branch change; null means WebGL2
  // is unavailable or failed, and the 2D iris is used from then on.
  let lens, lensStars = null, rearStars = null;
  if (isCampaignPage) { loadPod(); loadShip(images => { ship = images; document.body.dataset.entryShip = 'ready'; draw(performance.now()); }); }
  function ensureColonyShip() {
    if (!isCampaignPage || colonyShipRequested || (document.body.dataset.entryMode !== 'colonization' && !colonyPlanetById(document.body.dataset.entryPlanet))) return;
    colonyShipRequested = true;
    loadColonyShip(images => { colonyShip = images; document.body.dataset.entryColonyShip = 'ready'; draw(performance.now()); });
  }
  const nebula = makeNebula(), lightShafts = makeLightShafts(), atmosphere = makeAtmosphere();
  const warmSystem = () => currentMode === 'colonization';
  function endWormhole() {
    if (wormhole?.lensed) lens?.release();
    wormhole = null; delete document.body.dataset.entryWormhole; delete document.body.dataset.entryWormholeDirection; delete document.body.dataset.entryWormholeLens;
  }
  function endColonyTravel(reason = 'settled') {
    const completed = colonyTravel;
    colonyTravel = null; delete document.body.dataset.entryColonyTravel;
    if (completed?.requestId == null) return;
    const { planet, requestId, mode, view } = completed;
    // Menu updates can measure layout and redraw the scene. Notify only after
    // this frame has finished, and identify the request so old trips cannot
    // commit their text after a quick reversal or navigation away.
    queueMicrotask(() => document.dispatchEvent(new CustomEvent('frontier:planet-travel-end', {
      detail: { planet, requestId, mode, view, reason },
    })));
  }
  const stars = Array.from({ length: 1150 }, () => ({ x: random() * 2 - 1, y: random() * 2 - 1, z: .25 + random() * .75, phase: random() * TAU, size: random() }));
  function layout(view) {
    const mobile = width <= 760, unit = Math.min(width, height), main = document.body.dataset.entryPlanet || 'caldera-v1';
    const peaceful = document.body.dataset.entryMode === 'colonization' || !!colonyPlanetById(main);
    const catalogue = peaceful ? COLONY_PLANETS : PLANETS;
    const r = n => unit * n;
    if (view === 'join') return [
      { id: catalogue[0].id, x: width * .50, y: height * .18, r: r(mobile ? .25 : .22), alpha: 1 },
      { id: catalogue[1].id, x: width * .16, y: height * .77, r: r(mobile ? .23 : .29), alpha: 1 },
      { id: catalogue[2].id, x: width * .83, y: height * .79, r: r(mobile ? .20 : .23), alpha: 1 },
    ];
    const settings = mobile
      ? { login: [.50, .36, .79], account: [.50, .36, .79], menu: [.50, .40, .74], new: [.50, .30, .44], continue: [.50, .28, .44], arrival: [.50, .46, .52] }
      : { login: [.50, .48, .60], account: [.50, .48, .60], menu: [.50, .48, .60], new: [.42, .49, .34], continue: [.29, .52, .33], arrival: [.50, .50, .46] };
    const [x, y, radius] = settings[view] || settings.menu;
    const noticeOffset = ['new', 'continue'].includes(view) ? parseFloat(document.body.style.getPropertyValue('--entry-notice-offset')) || 0 : 0;
    const selected = Math.max(0, catalogue.findIndex(p => p.id === main));
    if (peaceful) return [
      { id: catalogue[selected].id, x: width * x, y: height * y + noticeOffset, r: r(radius), alpha: 1 },
      { id: catalogue[(selected + catalogue.length - 1) % catalogue.length].id, x: width * .10, y: height * .22, r: r(.062), alpha: .88 },
      { id: catalogue[(selected + 1) % catalogue.length].id, x: width * .88, y: height * .80, r: r(.061), alpha: .9 },
    ];
    // The world left behind sits on the opposite side from the chosen arrow;
    // the remaining third world stays visible in the lower distant orbit.
    const behind = catalogue[(selected + orbitSide + catalogue.length) % catalogue.length].id;
    const distant = catalogue.find(p => p.id !== main && p.id !== behind).id;
    return [
      { id: ALL_PLANETS.some(p => p.id === main) ? main : catalogue[0].id, x: width * x, y: height * y + noticeOffset, r: r(radius), alpha: 1 },
      { id: distant, x: width * (orbitSide > 0 ? .12 : .88), y: height * .78, r: r(.056), alpha: .8 },
      { id: behind, x: width * (orbitSide > 0 ? .91 : .09), y: height * .24, r: r(.055), alpha: .85 },
    ];
  }
  function checkpoint() {
    if (!width || !height || current.length !== 3) return;
    const unit = Math.min(width, height);
    saveEntryScene({ elapsed, view: currentView, planet: currentPlanet,
      camera: current.map(p => ({ ...p, x: p.x / width, y: p.y / height, r: p.r / unit })),
      pointer: { x: pointerX, y: pointerY }, orbitSide });
  }
  function applyState(immediate = false, direction = 0, requestId = null) {
    ensureColonyShip();
    const oldView = currentView, oldPlanet = currentPlanet, oldMode = currentMode;
    currentView = document.body.dataset.entryView || 'login'; currentPlanet = document.body.dataset.entryPlanet || 'caldera-v1';
    currentMode = document.body.dataset.entryMode || 'combat';
    document.body.dataset.entryTheme = warmSystem() ? 'colony-gold' : 'combat-blue';
    if (warmSystem()) { colonySky ||= createColonySky(nebula, lightShafts); colonyAtmosphere ||= makeAtmosphere(true); }
    if (wormhole && (currentMode !== wormhole.toMode || currentView !== wormhole.toView || paused || immediate)) endWormhole();
    const navigation = oldMode !== currentMode || oldView !== currentView || !['new', 'continue'].includes(currentView);
    if (navigation || paused || immediate) endColonyTravel(navigation ? 'cancelled' : 'settled');
    const swap = direction && currentPlanet !== oldPlanet && currentView === oldView && ['new', 'continue'].includes(currentView);
    const routePlanetChange = oldPlanet && oldPlanet !== currentPlanet && !swap && currentView !== 'arrival';
    if (routePlanetChange) endColonyTravel('cancelled');
    // The world the ship just left stays behind it in the sky.
    if (swap) orbitSide = direction > 0 ? -1 : 1;
    target = layout(currentView).map((p, i) => ({ ...p, scrollFactor: i === 0 && ['new', 'continue'].includes(currentView) ? 1 : 0 }));
    const body = document.body;
    body.style.setProperty('--entry-planet-x', target[0].x + 'px');
    body.style.setProperty('--entry-planet-y', target[0].y + 'px');
    body.style.setProperty('--entry-planet-r', target[0].r + 'px');
    body.style.setProperty('--entry-planet-bottom', (target[0].y + target[0].r) + 'px');
    // Match bodies by identity, not their foreground/background array slots.
    // This also rebases a quick second arrow press on the last visible poses.
    from = target.map(p => ({ ...(current.find(a => a.id === p.id) || p) }));
    if (swap && warmSystem() && !paused && !immediate) {
      endColonyTravel('cancelled');
      const largest = current.reduce((a, b) => b.r > a.r ? b : a), selected = current.find(p => p.id === currentPlanet) || target[0];
      const startPose = lastColonyPose || colonyCarrierPose(planetCenter(largest), elapsed, width <= 760);
      const endPose = colonyCarrierPose(planetCenter(target[0]), elapsed + COLONY_TRAVEL.total, width <= 760);
      const destination = planetCenter(selected), previous = planetCenter(target.find(p => p.id === oldPlanet) || target[1]);
      colonyTravel = { start: elapsed, fromPose: startPose, toPose: endPose,
        planet: currentPlanet, requestId, mode: currentMode, view: currentView,
        options: { departureAngle: Math.atan2(destination.y - startPose.y, destination.x - startPose.x),
          arrivalAngle: Math.atan2(endPose.y - previous.y, endPose.x - previous.x), distance: Math.hypot(width, height) * 1.4 } };
      document.dispatchEvent(new CustomEvent('frontier:planet-travel-start', {
        detail: { planet: currentPlanet, requestId, mode: currentMode, view: currentView },
      }));
    }
    exchanging = !!colonyTravel || (!!swap && !paused && !immediate && !warmSystem());
    transitionDuration = colonyTravel ? COLONY_TRAVEL.total : exchanging ? JUMP.total : currentView === 'arrival' ? WARP.approach : 600;
    // A press after the swap waits for this arrival, so the ship never teleports.
    if (!exchanging || warmSystem()) jump = null;
    else if (!jump) jump = { start: elapsed, direction };
    else if (jumpState(elapsed - jump.start).swapped) jump.next = direction;
    if (!jump) delete document.body.dataset.entryJump;
    // A route or save-list change is not a planet-arrow voyage. Start directly
    // on its selected body instead of briefly anchoring the ship to an old one.
    if (routePlanetChange) { shipAlpha = 0; lastColonyPose = null; }
    if (paused || immediate || routePlanetChange || wormhole) from = current = target.map(p => ({ ...p }));
    transitionStart = elapsed; draw(performance.now()); schedule();
  }
  function resize() {
    const previousWidth = width, previousHeight = height;
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25, 1920 / width, 1200 / height);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); pixelScale = ratio;
    const restoreCamera = restored && (!isCampaignPage || restored.planet === (document.body.dataset.entryPlanet || 'caldera-v1'));
    if (!initialized && restoreCamera) {
      current = restored.camera.map((p, i) => ({ ...p, x: p.x * width, y: p.y * height, r: p.r * Math.min(width, height),
        scrollFactor: i === 0 && ['new', 'continue'].includes(restored.view) ? 1 : 0 }));
    } else if (current.length && previousWidth && previousHeight) {
      current = current.map(p => ({ ...p, x: p.x / previousWidth * width, y: p.y / previousHeight * height, r: p.r / Math.min(previousWidth, previousHeight) * Math.min(width, height) }));
    }
    applyState(initialized || !restoreCamera); initialized = true;
  }
  // `wide` (lens layers only) paints the sky beyond the screen as well.
  function paintSky(streak = 0, sun, wide = null) {
    if (warmSystem()) paintColonySky(ctx, colonySky, width, height, elapsed, sun);
    else {
      ctx.fillStyle = '#000'; if (wide) ctx.fillRect(wide.x, wide.y, wide.width, wide.height); else ctx.fillRect(0, 0, width, height);
      const span = Math.max(width, height);
      ctx.save(); ctx.translate(width * .58, height * .35); ctx.rotate(-.5 + elapsed * .000014);
      ctx.globalAlpha = .72; ctx.drawImage(nebula, -span * .85, -span * .70, span * 1.7, span * 1.4);
      ctx.rotate(1.5); ctx.globalAlpha = .23; ctx.drawImage(nebula, -span * .65, -span * .25, span * 1.4, span * .8); ctx.restore();
    }
    paintStars(streak, wide);
  }
  function paintStars(streak = 0, wide = null) {
    const span = Math.max(width, height);
    // Roughly one degree per active second: visible sky rotation relative to
    // the planets and fixed controls, with a slower nebula layer for depth.
    const angle = elapsed * .000018, c = Math.cos(angle), s = Math.sin(angle);
    const left = wide ? wide.x : 0, top = wide ? wide.y : 0, right = wide ? wide.x + wide.width : width, bottom = wide ? wide.y + wide.height : height;
    // A lens layer keeps the forward field to its disc (every on-screen star is
    // inside it) and continues with the rear sky beyond.
    const sky = wide ? [...stars.filter(star => star.x * star.x + star.y * star.y <= 1), ...(rearStars ||= createRearStars(stars.length))] : stars;
    const rear = 2 * WORMHOLE_LENS.focal * span;
    for (const star of sky) {
      const behind = star.tan !== undefined;
      const x = behind ? width * .5 + Math.cos(star.angle + angle) * rear * star.tan : width * .5 + (star.x * c - star.y * s) * span * .77 + pointerX * star.z * 8;
      const y = behind ? height * .5 + Math.sin(star.angle + angle) * rear * star.tan : height * .5 + (star.x * s + star.y * c) * span * .77 + pointerY * star.z * 5;
      if (x < left || y < top || x > right || y > bottom) continue;
      const alpha = (.3 + star.z * .6) * (.86 + .14 * Math.sin(elapsed * .0005 + star.phase));
      ctx.globalAlpha = alpha; ctx.fillStyle = warmSystem() ? (star.size > .88 ? '#fffdf1' : '#d8d2b7') : star.size > .88 ? '#eff9ff' : '#afcde7';
      const radius = .35 + star.size * star.z * .9;
      if (streak) { const length = streak * (40 + star.z * 260); ctx.fillRect(x - length / 2, y, length, radius); continue; }
      ctx.fillRect(x, y, radius * 1.4, radius * 1.4);
      if (star.size > .982 && star.z > .7) {
        ctx.globalAlpha = alpha * .22; ctx.fillRect(x - 3, y + .6, 8, .6); ctx.fillRect(x + .6, y - 3, .6, 8);
      }
    }
    ctx.globalAlpha = 1;
  }
  function paintSun(sun) {
    if (warmSystem()) { paintColonySun(ctx, colonySky.shafts, sun, width, height, elapsed); return; }
    if (sun.visible <= 0) return;
    const x = width * (.5 + .48 * sun.x), y = height * (.48 + .65 * sun.y), unit = Math.min(width, height);
    const size = unit * .24, glow = ctx.createRadialGradient(x, y, 0, x, y, size);
    glow.addColorStop(0, '#eefbffff'); glow.addColorStop(.03, '#e4faffff'); glow.addColorStop(.065, '#a4e5ffdf');
    glow.addColorStop(.12, '#65bdff72'); glow.addColorStop(.4, '#278ee324'); glow.addColorStop(1, '#0861c000');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = sun.visible * sun.pulse;
    ctx.fillStyle = glow; ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.translate(x, y); ctx.rotate(elapsed * .000025);
    // Broad tapered shafts suggest sunlight through thin blue dust. Their
    // brightness breathes slowly; no flash or full-frame strobe is used.
    ctx.drawImage(lightShafts, -size * 1.23, -size * 1.23, size * 2.46, size * 2.46);
    const streak = ctx.createLinearGradient(-size * 1.5, 0, size * 1.5, 0);
    streak.addColorStop(0, '#82d5ff00'); streak.addColorStop(.42, '#a8e4ff35'); streak.addColorStop(.5, '#e8fbffcf'); streak.addColorStop(.58, '#a8e4ff35'); streak.addColorStop(1, '#82d5ff00');
    ctx.rotate(-elapsed * .000025 + .12); ctx.fillStyle = streak; ctx.fillRect(-size * 1.5, -.65, size * 3, 1.3);
    ctx.fillStyle = '#f4fcff'; ctx.beginPath(); ctx.arc(0, 0, Math.max(2, unit * .0075), 0, TAU); ctx.fill(); ctx.restore();
  }
  const bodyOrder = p => Math.max(0, ALL_PLANETS.findIndex(planet => planet.id === p.id));
  function planetCenter(p) {
    const depth = clamp(p.r / (Math.min(width, height) * .34));
    const drift = Math.sin(elapsed * .00008 + bodyOrder(p)) * (3 - depth * 2.5);
    // The foreground destination belongs to the same document space as its
    // title and form. The distant sky remains fixed while that content scrolls.
    const scroll = scrollY * p.scrollFactor;
    return { x: p.x + pointerX * (2 + depth * 3), y: p.y + pointerY * (1 + depth * 2) + drift - scroll, r: p.r };
  }
  function paintPlanet(p, index, sun, surfaceTime, surfaceSun) {
    // Spin and parallax belong to the planet. Changing its depth must not turn
    // the texture abruptly or jump its surface when it becomes the main globe.
    const bodyIndex = bodyOrder(p);
    const phase = .13 + surfaceTime * (bodyIndex ? .0000013 : .0000021) + bodyIndex * .19;
    const large = index === 0 || (exchanging && p.id !== 'moon');
    const size = large ? (width <= 760 ? 320 : 448) : p.r > 140 ? 256 : 128;
    const image = sphere(p.id, size, phase, surfaceSun, warmSystem());
    const { x, y } = planetCenter(p);
    ctx.globalAlpha = p.alpha;
    // Atmosphere has the same source direction as the surface; the dark limb
    // never receives an unrelated complete glowing outline.
    if (p.id !== 'moon') {
      const angle = Math.atan2(sun.y, sun.x), strength = Math.hypot(sun.x, sun.y);
      const radius = p.r * 144 / 128;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = p.alpha * strength;
      ctx.drawImage(warmSystem() ? colonyAtmosphere : atmosphere, -radius, -radius, radius * 2, radius * 2); ctx.restore();
    }
    ctx.globalAlpha = p.alpha; ctx.drawImage(image, x - p.r, y - p.r, p.r * 2, p.r * 2); ctx.globalAlpha = 1;
  }
  function captureCelestials(frame = null) {
    // Keep stars out of the cached source. The lens can remove planets and the
    // sun while exactly the same live star field remains behind the aperture.
    // Reuse the incoming layer at the display's backing resolution. A smaller
    // frozen image would jump in rotation, lighting and sharpness on handoff.
    const layer = frame?.image || document.createElement('canvas');
    if (layer.width !== canvas.width || layer.height !== canvas.height) {
      layer.width = canvas.width; layer.height = canvas.height;
    }
    const layerContext = layer.getContext('2d');
    if (!layerContext) throw new Error('Canvas unavailable');
    layerContext.setTransform(layer.width / width, 0, 0, layer.height / height, 0, 0);
    layerContext.clearRect(0, 0, width, height);
    const screenContext = ctx, sampled = paused ? elapsed : Math.floor(elapsed / 100) * 100;
    try {
      ctx = layerContext;
      const sun = entrySun(elapsed), surfaceSun = entrySun(sampled);
      paintSun(sun);
      for (const { p, i } of current.map((p, i) => ({ p, i })).sort((a, b) => a.p.r - b.p.r)) paintPlanet(p, i, sun, sampled, surfaceSun);
    } finally { ctx = screenContext; }
    const globe = current.reduce((a, b) => b.r > a.r ? b : a), center = planetCenter(globe);
    const result = frame || { image: layer, focus: null };
    result.focus = { x: center.x, y: center.y, radius: center.r };
    return result;
  }
  // The whole universe for the lens: sky, stars, sun and planets, painted
  // beyond the screen so a compressed view still shows whole planets. Screen
  // texels keep the display's backing grid, so start and end match exactly.
  function captureUniverse(frame = null) {
    const area = frame?.area || lensLayer(width, height, canvas.width, canvas.height, lens?.maxTexture);
    const layer = frame?.image || document.createElement('canvas');
    if (layer.width !== area.backingWidth || layer.height !== area.backingHeight) { layer.width = area.backingWidth; layer.height = area.backingHeight; }
    layer.dataset.marginX = String(area.marginX); layer.dataset.marginY = String(area.marginY);
    const layerContext = layer.getContext('2d');
    if (!layerContext) throw new Error('Canvas unavailable');
    layerContext.setTransform(canvas.width / width, 0, 0, canvas.height / height, area.marginX, area.marginY);
    layerContext.globalAlpha = 1; layerContext.globalCompositeOperation = 'source-over';
    layerContext.fillStyle = warmSystem() ? '#080c0d' : '#000'; layerContext.fillRect(area.x, area.y, area.width, area.height);
    const screenContext = ctx, sampled = paused ? elapsed : Math.floor(elapsed / 100) * 100;
    try {
      ctx = layerContext;
      const sun = entrySun(elapsed), surfaceSun = entrySun(sampled);
      paintSky(0, sun, area); paintSun(sun);
      for (const { p, i } of current.map((p, i) => ({ p, i })).sort((a, b) => a.p.r - b.p.r)) paintPlanet(p, i, sun, sampled, surfaceSun);
    } finally { ctx = screenContext; }
    const globe = current.reduce((a, b) => b.r > a.r ? b : a), center = planetCenter(globe);
    const result = frame || { image: layer, area, focus: null };
    result.focus = { x: center.x, y: center.y, radius: center.r };
    return result;
  }
  const starColours = warm => warm ? { dim: '#d8d2b7', bright: '#fffdf1' } : { dim: '#afcde7', bright: '#eff9ff' };
  // Live positions of every star, including those beyond the screen and the
  // rear sky that aberration pulls into view. Same motion as paintStars.
  function lensSky() {
    rearStars ||= createRearStars(stars.length);
    const total = stars.length + rearStars.length;
    const sky = lensStars ||= { count: 0, x: new Float32Array(total), y: new Float32Array(total), alpha: new Float32Array(total), size: new Float32Array(total), bright: new Uint8Array(total) };
    const span = Math.max(width, height), angle = elapsed * .000018, c = Math.cos(angle), s = Math.sin(angle), rear = 2 * WORMHOLE_LENS.focal * span;
    let n = 0;
    const add = (star, x, y) => {
      sky.x[n] = x; sky.y[n] = y; sky.alpha[n] = (.3 + star.z * .6) * (.86 + .14 * Math.sin(elapsed * .0005 + star.phase));
      sky.size[n] = (.35 + star.size * star.z * .9) * 1.4; sky.bright[n++] = star.size > .88 ? 1 : 0;
    };
    for (const star of stars) if (star.x * star.x + star.y * star.y <= 1) add(star, width * .5 + (star.x * c - star.y * s) * span * .77 + pointerX * star.z * 8, height * .5 + (star.x * s + star.y * c) * span * .77 + pointerY * star.z * 5);
    for (const star of rearStars) add(star, width * .5 + Math.cos(star.angle + angle) * rear * star.tan, height * .5 + Math.sin(star.angle + angle) * rear * star.tan);
    sky.count = n; return sky;
  }
  // Bend the origin universe around the mouth, show the destination through
  // the throat, and compress both by the camera's aberration (wormhole-lens.js).
  function renderLens(warp) {
    const universe = wormhole.universe = captureUniverse(wormhole.universe), layer = wormhole.origin.area;
    const from = wormhole.origin.focus, to = universe.focus, state = wormholeLensState(elapsed - wormhole.start, from.radius);
    const blend = warp.phase === 'collapse' ? 0 : warp.phase === 'expand' ? 1 : warp.phaseProgress * warp.phaseProgress * (3 - 2 * warp.phaseProgress);
    const view = { centre: { x: from.x + (to.x - from.x) * blend, y: from.y + (to.y - from.y) * blend }, width, height, layer,
      focal: WORMHOLE_LENS.focal * Math.max(width, height),
      origin: { focus: from, cover: skyCover(state.k, from, layer), ...starColours(wormhole.fromWarm) },
      destination: { focus: to, cover: skyCover(state.k, to, layer), ...starColours(warmSystem()) } };
    lens.upload(1, universe.image);
    lens.render({ state, ...view, backingWidth: canvas.width, backingHeight: canvas.height });
    return { state, view };
  }
  function advanceJump() {
    if (!jump) return null;
    if (elapsed - jump.start >= JUMP.total) {
      if (jump.next) jump = { start: elapsed, direction: jump.next };
      else { jump = null; delete document.body.dataset.entryJump; return null; }
    }
    const state = jumpState(elapsed - jump.start), holding = !state.swapped || jump.next;
    if (holding) document.body.dataset.entryJump = state.phase; else delete document.body.dataset.entryJump;
    return state;
  }
  function advanceColonyTravel() {
    if (!colonyTravel) return null;
    const state = colonyTravelState(elapsed - colonyTravel.start);
    if (state.done) { endColonyTravel('arrived'); return null; }
    document.body.dataset.entryColonyTravel = state.phase; return state;
  }
  function endDrop() { drop = null; warp = null; delete document.body.dataset.entryDrop; delete document.body.dataset.entryArrival; delete document.body.dataset.entryWarp; }
  function beginDrop(civilian, accepted) {
    drop = { start: elapsed, accepted, civilian, grain: civilian ? null : ctx.createPattern(grain ||= makeGrain(), 'repeat') };
    document.body.dataset.entryArrival = civilian ? 'civilian' : 'combat';
  }
  // Join is already admitted, so the drop that follows the warp starts accepted.
  function advanceWarp() {
    if (!warp) return null;
    const state = warpState(elapsed - warp.start);
    if (state.done) { warp = null; delete document.body.dataset.entryWarp; beginDrop(false, true); return null; }
    document.body.dataset.entryWarp = state.phase;
    return state;
  }
  // Unadmitted entry holds on the zoom's last moment. Release only starts on acceptance.
  const zoomHeld = () => Math.min(elapsed - drop.start, (drop.civilian ? COLONY_ENTRY : DROP).zoom - 1);
  function advanceDrop() {
    if (!drop) return null;
    let age = drop.accepted ? elapsed - drop.start : zoomHeld();
    if (drop.retreat !== undefined) age = drop.held - (elapsed - drop.retreat) * 2.5;
    if (age <= 0 && drop.retreat !== undefined) { endDrop(); return null; }
    const state = drop.civilian ? colonyEntryState(age, drop.accepted) : dropState(age);
    document.body.dataset.entryDrop = state.done ? 'dark' : state.phase;
    if (state.done && !drop.dark) { drop.dark = true; document.dispatchEvent(new CustomEvent('frontier:drop-dark')); }
    return state;
  }
  function chooseGround(globe, surfaceTime) {
    // Start from the patch of globe under the pod, then settle on the nearest coast.
    const center = planetCenter(globe), pod = podPose(drop.pose, { release: 1 }), texture = getTexture(globe.id), order = bodyOrder(globe);
    const nx = clamp((pod.x - center.x) / globe.r, -.95, .95), ny = clamp((pod.y - center.y) / globe.r, -.95, .95), nz = Math.sqrt(Math.max(.01, 1 - nx * nx - ny * ny));
    const phase = .13 + surfaceTime * (order ? .0000013 : .0000021) + order * .19, u = Math.atan2(nx, nz) / TAU + .5 + phase;
    const coast = nearestCoast(texture.mask, Math.floor(((u % 1) + 1) % 1 * texture.width), Math.floor((Math.asin(ny) / Math.PI + .5) * texture.height));
    return { id: globe.id, u: coast.x / texture.width, v: coast.y / texture.height, r: globe.r };
  }
  function paintGround(flight, camera, fade) {
    const image = surface(drop.ground.id), scaleX = drop.ground.r * camera.z / (image.width / TAU), scaleY = drop.ground.r * camera.z / (image.height / Math.PI);
    const x = drop.ground.u * image.width + flight.dive * 3, y = drop.ground.v * image.height + flight.dive * 4;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(width / 2, height * .46);
    ctx.save(); ctx.scale(scaleX, scaleY); ctx.translate(-x, -y);
    for (const wrap of [-image.width, 0, image.width]) ctx.drawImage(image, wrap, 0);
    ctx.restore();
    // Two sizes of soft mottling stay locked to the ground, so it never reads as a flat blur.
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = drop.grain;
    for (const tile of [.7, .15]) {
      const k = scaleX * tile; ctx.save(); ctx.globalAlpha = fade * .22; ctx.scale(k, k); ctx.translate(-x / tile, -y / tile);
      ctx.fillRect(x / tile - width / k, y / tile - height / k, width * 2 / k, height * 2 / k); ctx.restore();
    }
    ctx.restore();
  }
  function paintVoyage(globe, jumped, flight, camera, civilian, traveled, warped) {
    if (warped) {
      if (ship && warped.line > 0) paintWarp(ctx, ship, shipPose(planetCenter(globe), elapsed, width <= 760), warped, { width, height, time: elapsed, pixels: pixelScale });
      return;
    }
    const wanted = ['new', 'continue'].includes(currentView) ? 1 : 0, step = (elapsed - lastDrawn) / 400;
    shipAlpha = paused ? wanted : clamp(shipAlpha + clamp(wanted - shipAlpha, -step, step));
    lastDrawn = elapsed;
    if (document.body.dataset.entryMode === 'colonization' || civilian) {
      if (!colonyShip || (!shipAlpha && !civilian)) { delete document.body.dataset.entryCarrier; return; }
      let hover = civilian ? drop.pose : colonyCarrierPose(planetCenter(globe), elapsed, width <= 760);
      if (traveled) hover = colonyTravelPose(colonyTravel.fromPose, colonyTravel.toPose, traveled, colonyTravel.options);
      // An arrow during the offscreen exchange rebases from the last actual
      // position, not the hidden arrival anchor in the centre of the new world.
      if ((hover.alpha ?? 1) > 0) lastColonyPose = hover;
      paintColonyVessels(ctx, colonyShip, hover, civilian || undefined, (civilian ? 1 : shipAlpha) * (hover.alpha ?? 1),
        { time: elapsed, travel: traveled, paused });
      document.body.dataset.entryCarrier = 'mycorrhizal';
      return;
    }
    delete document.body.dataset.entryCarrier;
    if (!flight) {
      if (!ship || !shipAlpha) return;
      const hover = shipPose(planetCenter(globe), elapsed, width <= 760);
      paintShip(ctx, ship, jumped ? jumpPose(hover, jumped, jump.direction) : hover, { alpha: shipAlpha, stretch: jumped?.stretch, glow: jumped?.glow, time: elapsed, pixels: pixelScale });
      return;
    }
    if (flight.dive > 0) return;
    if (flight.release > 0) { const pod = podPose(drop.pose, flight); paintPod(ctx, pod.x, pod.y, pod.angle, pod.size); }
    if (ship) { const away = shipDeparture(drop.pose, flight); paintShip(ctx, ship, away.pose, { glow: away.glow, time: elapsed, pixels: pixelScale * camera.z }); }
  }
  function draw(now) {
    if (failed || dead || document.hidden) return;
    try {
      // Use the active scene clock, so a hidden tab freezes both the sky and
      // the jump. Globes hold still until the flash peaks, then swap beneath it.
      const jumped = advanceJump(), traveled = advanceColonyTravel();
      const ease = paused ? 1 : traveled ? traveled.sceneMix : jumped ? (jumped.swapped && !jump.next ? 1 : 0) : clamp((elapsed - transitionStart) / transitionDuration), t = ease * ease * (3 - 2 * ease);
      current = target.map((p, i) => {
        const a = from[i] || p;
        return { id: p.id, x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t, r: a.r + (p.r - a.r) * t, alpha: a.alpha + (p.alpha - a.alpha) * t,
          scrollFactor: a.scrollFactor + (p.scrollFactor - a.scrollFactor) * t };
      });
      if (ease === 1 && !jump) exchanging = false;
      if (wormhole) {
        const warp = colonyWormholeState(elapsed - wormhole.start);
        if (warp.done) endWormhole();
        else {
          document.body.dataset.entryWormhole = warp.phase;
          // A WebGL failure falls back to the 2D iris for the rest of the
          // session. Failures drawing to the screen still reach the outer catch.
          let lensed = null;
          if (wormhole.lensed) {
            try { lensed = renderLens(warp); } catch { lens = null; wormhole.lensed = false; document.body.dataset.entryWormholeLens = '2d'; }
          }
          if (lensed) {
            // Beyond the painted layers is the same empty sky colour as each
            // universe (combat black, civilian #080c0d), exchanged at the throat.
            const into = warp.phase === 'collapse' ? 0 : warp.phase === 'expand' ? 1 : warp.phaseProgress;
            const shade = ((wormhole.fromWarm ? 1 : 0) * (1 - into) + (warmSystem() ? 1 : 0) * into);
            ctx.fillStyle = `rgb(${Math.round(8 * shade)},${Math.round(12 * shade)},${Math.round(13 * shade)})`; ctx.fillRect(0, 0, width, height);
            paintLensStars(ctx, lensSky(), lensed.state, lensed.view);
            ctx.drawImage(lens.canvas, 0, 0, width, height);
            paintThroatLight(ctx, lensed.state, lensed.view.centre, THROAT_COLORS[wormhole.direction], Math.min(width, height));
          } else {
            // Only the visible destination needs refreshing. Its slow sphere
            // shading still uses the normal 100 ms cache, while light, parallax
            // and compositing follow the live clock through the reveal.
            if (!wormhole.incoming || warp.phase === 'expand') wormhole.incoming = captureCelestials(wormhole.incoming);
            ctx.fillStyle = '#080c0d'; ctx.fillRect(0, 0, width, height);
            paintStars();
            paintColonyWormhole(ctx, wormhole.outgoing.image, wormhole.incoming.image, warp, width, height, {
              direction: wormhole.direction, focus: wormhole.outgoing.focus, incomingFocus: wormhole.incoming.focus,
            });
          }
          document.body.dataset.sceneReady = 'canvas';
          return;
        }
      }
      const warped = advanceWarp(), voyage = advanceDrop(), civilian = drop?.civilian ? voyage : null, flight = civilian ? null : voyage;
      const sun = entrySun(elapsed); paintSky(jumped?.stars, sun); paintSun(sun);
      // Slow surface rotation and lighting need only ten samples per second.
      // Camera movement, sky, rim direction and globe compositing use every
      // display frame. Pause uses the exact clock for identical reloads. A flight
      // keeps its first sample: the zoom would magnify ten samples a second into a
      // visibly low frame rate, and each one blocks the frame while it shades.
      const sampled = paused ? elapsed : Math.floor(elapsed / 100) * 100;
      const surfaceTime = voyage ? drop.surfaceTime ??= sampled : sampled;
      const surfaceSun = entrySun(surfaceTime);
      // The ship flies over the largest world, whichever side of the swap it is on.
      const globe = current.filter(p => p.id !== 'moon').reduce((a, b) => b.r > a.r ? b : a);
      let camera = null;
      const follow = () => { ctx.save(); ctx.translate(camera.x, camera.y); ctx.scale(camera.z, camera.z); ctx.translate(-camera.fx, -camera.fy); };
      if (flight) {
        drop.pose ||= shipPose(planetCenter(globe), elapsed, width <= 760);
        camera = dropCamera(drop.pose, flight, podPose(drop.pose, flight), width, height); follow();
      } else if (civilian) {
        drop.pose ||= colonyCarrierPose(planetCenter(globe), elapsed, width <= 760);
        camera = colonyCamera(drop.pose, civilian, width, height); follow();
      }
      // Small, distant bodies sit behind larger ones.
      for (const { p, i } of current.map((p, i) => ({ p, i })).sort((a, b) => a.p.r - b.p.r)) paintPlanet(p, i, sun, surfaceTime, surfaceSun);
      if (flight) {
        // The daylit ground rises as the ship leaves, beneath the pod and the hull.
        ctx.restore();
        const fade = clamp((flight.release - .45) / .55);
        if (fade) { drop.ground ||= chooseGround(globe, surfaceTime); paintGround(flight, camera, fade * fade * (3 - 2 * fade)); }
        follow();
      }
      if (civilian) {
        ctx.restore();
        const shuttle = colonyShuttlePose(drop.pose, civilian);
        paintColonyAtmosphere(ctx, { width, height, state: civilian, time: elapsed, clouds,
          ground: surface(globe.id), palette: colonyPlanetById(globe.id)?.surface, light: drop.light,
          shuttle: { ...shuttle, x: camera.x + (shuttle.x - camera.fx) * camera.z, y: camera.y + (shuttle.y - camera.fy) * camera.z } });
        follow();
      }
      paintVoyage(globe, jumped, flight, camera, civilian, traveled, warped);
      // The garden's light (admission reply) falls over the whole descent, shuttle included.
      if (civilian) { ctx.restore(); gradeColonyDescent(ctx, { width, height, state: civilian, light: drop.light }); }
      if (flight) {
        ctx.restore();
        if (flight.dive > 0) paintDive(ctx, { width, height, progress: flight.dive, time: elapsed, size: podScreenSize(width, height), clouds });
      }
      paintFlash(ctx, width, height, jumped?.flash || (warped?.flash || 0) * .45);
      document.body.dataset.sceneReady = 'canvas';
      if (now - lastCheckpoint > 1000) { lastCheckpoint = now; checkpoint(); }
    } catch {
      endWormhole(); endColonyTravel('cancelled'); delete document.body.dataset.entryJump;
      failed = true; canvas.remove(); document.body.dataset.sceneReady = 'fallback';
      const control = document.getElementById('motion'); if (control) control.hidden = true;
    }
  }
  function schedule() { if (!frame && !paused && !dead && !failed && !document.hidden) frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0;
    if (paused || document.hidden || dead) { lastTime = 0; return; }
    if (lastTime) elapsed += Math.min(100, now - lastTime); lastTime = now;
    draw(now); schedule();
  }
  function updateMotion() {
    document.body.classList.toggle('entry-motion-paused', paused);
    const button = document.getElementById('motion');
    if (button) { button.textContent = paused ? 'Play animation' : 'Pause animation'; button.setAttribute('aria-pressed', String(paused)); }
    if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    // Finish at the exact persisted phase, rather than a cached earlier sample.
    if (paused) for (const image of spheres.values()) image.lastPhase = NaN;
    if (!document.hidden) { if (paused) applyState(true); else draw(performance.now()); schedule(); } checkpoint();
  }
  const button = document.getElementById('motion');
  if (button) button.addEventListener('click', () => {
    paused = !paused; savedPause = paused;
    try { sessionStorage.setItem('frontier-entry-paused', paused ? '1' : '0'); } catch { /* Optional preference. */ }
    updateMotion();
  });
  media.addEventListener('change', () => { paused = media.matches || savedPause; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion); addEventListener('resize', resize);
  document.addEventListener('frontier:entry-layout', () => {
    if (currentView === document.body.dataset.entryView && ['new', 'continue'].includes(currentView)) applyState(true);
  });
  addEventListener('scroll', () => { if (paused) draw(performance.now()); }, { passive: true });
  addEventListener('pointermove', event => { if (paused || event.pointerType !== 'mouse') return; pointerX = clamp(event.clientX / width) - .5; pointerY = clamp(event.clientY / height) - .5; }, { passive: true });
  // The lobby owns these: the pod only leaves once the server has admitted the player.
  document.addEventListener('frontier:system-transition', event => {
    const { from: sourceMode, to: toMode } = event.detail || {};
    if (paused || failed || dead || sourceMode !== currentMode || !['combat', 'colonization'].includes(toMode) || sourceMode === toMode) return;
    if (currentView !== (sourceMode === 'colonization' ? 'colony' : 'menu')) return;
    // A second branch click during the effect skips it; navigation stays usable.
    if (wormhole) { endWormhole(); return; }
    endColonyTravel('cancelled'); jump = null; delete document.body.dataset.entryJump;
    // The mode has not switched yet: the screen and `current` still show the origin.
    wormhole = { start: elapsed, outgoing: captureCelestials(), incoming: null, origin: null, universe: null, lensed: false, fromWarm: warmSystem(),
      toMode, toView: toMode === 'colonization' ? 'colony' : 'menu', direction: toMode === 'colonization' ? 'gold' : 'blue' };
    if (lens === undefined) lens = createWormholeLens();
    if (lens?.usable) { try { wormhole.origin = captureUniverse(); lens.upload(0, wormhole.origin.image); wormhole.lensed = true; } catch { lens = null; } }
    document.body.dataset.entryWormhole = 'collapse'; document.body.dataset.entryWormholeDirection = wormhole.direction;
    document.body.dataset.entryWormholeLens = wormhole.lensed ? 'gl' : '2d';
    schedule();
  });
  document.addEventListener('frontier:drop-start', () => {
    if (paused || failed) return;
    const civilian = document.body.dataset.entryMode === 'colonization';
    if (civilian && !colonyShip) return;
    jump = null; exchanging = false; delete document.body.dataset.entryJump; endColonyTravel('cancelled'); endWormhole();
    // Bake here, at the click, so the first dive frames cannot stutter.
    clouds ||= makeClouds(); surface(currentPlanet);
    beginDrop(civilian, false); schedule();
  });
  document.addEventListener('frontier:warp-start', () => {
    if (paused || failed) return;
    applyState(); jump = null; exchanging = false;
    clouds ||= makeClouds(); surface(currentPlanet);
    warp = { start: elapsed }; schedule();
  });
  document.addEventListener('frontier:drop-accept', event => {
    if (!drop) return;
    drop.start = elapsed - zoomHeld(); drop.accepted = true;
    // A colony admission names the garden's light; the descent lands in it.
    drop.light = /** @type {CustomEvent} */ (event).detail?.light || null;
  });
  document.addEventListener('frontier:drop-cancel', () => {
    if (!drop) return;
    if (paused || document.hidden) { endDrop(); draw(performance.now()); return; }
    drop.held = zoomHeld(); drop.retreat = elapsed;
  });
  document.addEventListener('frontier:drop-reset', endDrop);
  document.addEventListener('frontier:planet-select', event => {
    if (failed || dead || event.detail?.planet !== document.body.dataset.entryPlanet || ![-1, 1].includes(event.detail?.direction)) return;
    applyState(false, event.detail.direction, event.detail.requestId);
  });
  new MutationObserver(() => { ensureColonyShip(); if (currentView !== document.body.dataset.entryView || currentPlanet !== (document.body.dataset.entryPlanet || 'caldera-v1') || currentMode !== (document.body.dataset.entryMode || 'combat')) applyState(); }).observe(document.body, { attributes: true, attributeFilter: ['data-entry-view', 'data-entry-planet', 'data-entry-mode'] });
  addEventListener('pagehide', () => { checkpoint(); endWormhole(); endColonyTravel('cancelled'); dead = true; if (frame) cancelAnimationFrame(frame); frame = 0; });
  addEventListener('pageshow', event => { if (!event.persisted) return; dead = false; applyState(true); updateMotion(); });
  resize(); updateMotion();
}
try { startScene(); } catch {
  document.body.dataset.sceneReady = 'fallback';
  const control = document.getElementById('motion'); if (control) control.hidden = true;
}
