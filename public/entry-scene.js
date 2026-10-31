import { loadEntryScene, saveEntryScene } from './entry-continuity.js';
import { PLANETS } from './planets.js';
import { SIROCCO_MASK } from './sirocco-preview.js';
import { entrySun, entrySurfaceLight } from './entry-lighting.js';
import { DROP, JUMP, dropCamera, dropState, jumpPose, jumpState, loadShip, paintDive, paintFlash, paintPod, paintShip, podPose, podScreenSize, shipDeparture, shipPose } from './entry-ship.js';
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
  'caldera-v1': [[27,57,65],[153,141,106],[91,112,82],[95,103,92],[104,120,116]],
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
function makeTexture(id) {
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
function sphere(id, size, phase, sun) {
  const key = `${id}:${size}`;
  if (!spheres.has(key)) spheres.set(key, makeSphere(id, size));
  const s = spheres.get(key);
  if (Math.abs(s.lastPhase - phase) < .00018 && Math.abs(s.lastLight - sun.angle) < .0006) return s.canvas;
  const { width, height, data } = s.texture, out = s.pixels.data;
  for (const p of s.samples) {
    const x = Math.floor(((p.u + phase) % 1 + 1) % 1 * width);
    const y = Math.min(height - 1, Math.floor(p.v * height));
    const i = (y * width + x) * 3, o = p.offset;
    const light = entrySurfaceLight(p.nx, p.ny, p.nz, sun), rim = light.rim * (id === 'moon' ? 12 : 105);
    out[o] = data[i] * light.brightness * .95 + rim * .42;
    out[o + 1] = data[i + 1] * light.brightness * 1.02 + rim * .78;
    out[o + 2] = data[i + 2] * light.brightness * 1.13 + rim;
  }
  s.ctx.putImageData(s.pixels, 0, 0); s.lastPhase = phase; s.lastLight = sun.angle;
  return s.canvas;
}
function makeAtmosphere() {
  // A unit rim with room for its blur. Rotate and scale this cached sprite
  // instead of issuing 16 shadow-blurred strokes per planet on every frame.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 288;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.translate(144, 144); ctx.strokeStyle = '#95dcff'; ctx.shadowColor = '#5bbfff';
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
    if (['menu', 'new', 'continue', 'join'].includes(view)) document.body.dataset.entryView = view;
    if (Object.hasOwn(MASKS, planet)) document.body.dataset.entryPlanet = planet;
  }
  const canvas = document.createElement('canvas'); canvas.className = 'entry-scene';
  canvas.setAttribute('aria-hidden', 'true'); document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { canvas.remove(); document.body.dataset.sceneReady = 'fallback'; const control = document.getElementById('motion'); if (control) control.hidden = true; return; }
  const media = matchMedia('(prefers-reduced-motion: reduce)'), restored = loadEntryScene();
  let savedPause = false;
  try { savedPause = sessionStorage.getItem('frontier-entry-paused') === '1'; } catch { /* Storage may be disabled. */ }
  let paused = media.matches || savedPause, dead = false, failed = false, frame = 0, width = 0, height = 0;
  let lastTime = 0, elapsed = restored?.elapsed || 0, transitionStart = 0, lastCheckpoint = 0;
  let currentView = '', currentPlanet = '', current = [], from = [], target = [];
  let orbitSide = restored?.orbitSide || -1, exchanging = false, transitionDuration = 600;
  let pointerX = restored?.pointer.x || 0, pointerY = restored?.pointer.y || 0, initialized = false;
  let ship = null, shipAlpha = 0, lastDrawn = elapsed, pixelScale = 1, jump = null, drop = null, clouds = null, grain = null;
  if (isCampaignPage) loadShip(images => { ship = images; document.body.dataset.entryShip = 'ready'; draw(performance.now()); });
  const nebula = makeNebula(), lightShafts = makeLightShafts(), atmosphere = makeAtmosphere();
  const stars = Array.from({ length: 1150 }, () => ({ x: random() * 2 - 1, y: random() * 2 - 1, z: .25 + random() * .75, phase: random() * TAU, size: random() }));
  function layout(view) {
    const mobile = width <= 760, unit = Math.min(width, height), main = document.body.dataset.entryPlanet || 'caldera-v1';
    const r = n => unit * n;
    if (view === 'join') return [
      { id: 'caldera-v1', x: width * .50, y: height * .18, r: r(mobile ? .25 : .22), alpha: 1 },
      { id: 'vesper-v1', x: width * .16, y: height * .77, r: r(mobile ? .23 : .29), alpha: 1 },
      { id: 'sirocco-v1', x: width * .83, y: height * .79, r: r(mobile ? .20 : .23), alpha: 1 },
    ];
    const settings = mobile
      ? { login: [.50, .36, .79], account: [.50, .36, .79], menu: [.50, .40, .74], new: [.50, .30, .44], continue: [.50, .28, .44] }
      : { login: [.50, .48, .60], account: [.50, .48, .60], menu: [.50, .48, .60], new: [.42, .49, .34], continue: [.29, .52, .33] };
    const [x, y, radius] = settings[view] || settings.menu;
    const noticeOffset = ['new', 'continue'].includes(view) ? parseFloat(document.body.style.getPropertyValue('--entry-notice-offset')) || 0 : 0;
    const selected = Math.max(0, PLANETS.findIndex(p => p.id === main));
    // The world left behind sits on the opposite side from the chosen arrow;
    // the remaining third world stays visible in the lower distant orbit.
    const behind = PLANETS[(selected + orbitSide + PLANETS.length) % PLANETS.length].id;
    const distant = PLANETS.find(p => p.id !== main && p.id !== behind).id;
    return [
      { id: Object.hasOwn(MASKS, main) ? main : 'caldera-v1', x: width * x, y: height * y + noticeOffset, r: r(radius), alpha: 1 },
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
  function applyState(immediate = false, direction = 0) {
    const oldView = currentView, oldPlanet = currentPlanet;
    currentView = document.body.dataset.entryView || 'login'; currentPlanet = document.body.dataset.entryPlanet || 'caldera-v1';
    const swap = direction && currentPlanet !== oldPlanet && currentView === oldView && ['new', 'continue'].includes(currentView);
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
    exchanging = !!swap && !paused && !immediate;
    transitionDuration = exchanging ? JUMP.total : 600;
    // A press after the swap waits for this arrival, so the ship never teleports.
    if (!exchanging) jump = null;
    else if (!jump) jump = { start: elapsed, direction };
    else if (jumpState(elapsed - jump.start).swapped) jump.next = direction;
    if (!jump) delete document.body.dataset.entryJump;
    if (paused || immediate) from = current = target.map(p => ({ ...p }));
    transitionStart = elapsed; draw(performance.now()); schedule();
  }
  function resize() {
    const previousWidth = width, previousHeight = height;
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25, 1920 / width, 1200 / height);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); pixelScale = ratio;
    if (!initialized && restored) {
      current = restored.camera.map((p, i) => ({ ...p, x: p.x * width, y: p.y * height, r: p.r * Math.min(width, height),
        scrollFactor: i === 0 && ['new', 'continue'].includes(restored.view) ? 1 : 0 }));
    } else if (current.length && previousWidth && previousHeight) {
      current = current.map(p => ({ ...p, x: p.x / previousWidth * width, y: p.y / previousHeight * height, r: p.r / Math.min(previousWidth, previousHeight) * Math.min(width, height) }));
    }
    applyState(initialized || !restored); initialized = true;
  }
  function paintSky(streak = 0) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    const span = Math.max(width, height);
    ctx.save(); ctx.translate(width * .58, height * .35); ctx.rotate(-.5 + elapsed * .000014);
    ctx.globalAlpha = .72; ctx.drawImage(nebula, -span * .85, -span * .70, span * 1.7, span * 1.4);
    ctx.rotate(1.5); ctx.globalAlpha = .23; ctx.drawImage(nebula, -span * .65, -span * .25, span * 1.4, span * .8); ctx.restore();
    // Roughly one degree per active second: visible sky rotation relative to
    // the planets and fixed controls, with a slower nebula layer for depth.
    const angle = elapsed * .000018, c = Math.cos(angle), s = Math.sin(angle);
    for (const star of stars) {
      const x = width * .5 + (star.x * c - star.y * s) * span * .77 + pointerX * star.z * 8;
      const y = height * .5 + (star.x * s + star.y * c) * span * .77 + pointerY * star.z * 5;
      if (x < 0 || y < 0 || x > width || y > height) continue;
      const alpha = (.3 + star.z * .6) * (.86 + .14 * Math.sin(elapsed * .0005 + star.phase));
      ctx.globalAlpha = alpha; ctx.fillStyle = star.size > .88 ? '#eff9ff' : '#afcde7';
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
  const bodyOrder = p => Math.max(0, PLANETS.findIndex(planet => planet.id === p.id));
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
    const image = sphere(p.id, size, phase, surfaceSun);
    const { x, y } = planetCenter(p);
    ctx.globalAlpha = p.alpha;
    // Atmosphere has the same source direction as the surface; the dark limb
    // never receives an unrelated complete glowing outline.
    if (p.id !== 'moon') {
      const angle = Math.atan2(sun.y, sun.x), strength = Math.hypot(sun.x, sun.y);
      const radius = p.r * 144 / 128;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = p.alpha * strength;
      ctx.drawImage(atmosphere, -radius, -radius, radius * 2, radius * 2); ctx.restore();
    }
    ctx.globalAlpha = p.alpha; ctx.drawImage(image, x - p.r, y - p.r, p.r * 2, p.r * 2); ctx.globalAlpha = 1;
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
  function endDrop() { drop = null; delete document.body.dataset.entryDrop; }
  // Unadmitted entry holds on the zoom's last moment. Release only starts on acceptance.
  const zoomHeld = () => Math.min(elapsed - drop.start, DROP.zoom - 1);
  function advanceDrop() {
    if (!drop) return null;
    let age = drop.accepted ? elapsed - drop.start : zoomHeld();
    if (drop.retreat !== undefined) age = drop.held - (elapsed - drop.retreat) * 2.5;
    if (age <= 0 && drop.retreat !== undefined) { endDrop(); return null; }
    const state = dropState(age);
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
  function paintVoyage(globe, jumped, flight, camera) {
    const wanted = ['new', 'continue'].includes(currentView) ? 1 : 0, step = (elapsed - lastDrawn) / 400;
    shipAlpha = paused ? wanted : clamp(shipAlpha + clamp(wanted - shipAlpha, -step, step));
    lastDrawn = elapsed;
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
      const jumped = advanceJump();
      const ease = paused ? 1 : jumped ? (jumped.swapped && !jump.next ? 1 : 0) : clamp((elapsed - transitionStart) / transitionDuration), t = ease * ease * (3 - 2 * ease);
      current = target.map((p, i) => {
        const a = from[i] || p;
        return { id: p.id, x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t, r: a.r + (p.r - a.r) * t, alpha: a.alpha + (p.alpha - a.alpha) * t,
          scrollFactor: a.scrollFactor + (p.scrollFactor - a.scrollFactor) * t };
      });
      if (ease === 1 && !jump) exchanging = false;
      const flight = advanceDrop();
      const sun = entrySun(elapsed); paintSky(jumped?.stars); paintSun(sun);
      // Slow surface rotation and lighting need only ten samples per second.
      // Camera movement, sky, rim direction and globe compositing use every
      // display frame. Pause uses the exact clock for identical reloads. A flight
      // keeps its first sample: the zoom would magnify ten samples a second into a
      // visibly low frame rate, and each one blocks the frame while it shades.
      const sampled = paused ? elapsed : Math.floor(elapsed / 100) * 100;
      const surfaceTime = flight ? drop.surfaceTime ??= sampled : sampled;
      const surfaceSun = entrySun(surfaceTime);
      // The ship flies over the largest world, whichever side of the swap it is on.
      const globe = current.filter(p => p.id !== 'moon').reduce((a, b) => b.r > a.r ? b : a);
      let camera = null;
      const follow = () => { ctx.save(); ctx.translate(camera.x, camera.y); ctx.scale(camera.z, camera.z); ctx.translate(-camera.fx, -camera.fy); };
      if (flight) {
        drop.pose ||= shipPose(planetCenter(globe), elapsed, width <= 760);
        camera = dropCamera(drop.pose, flight, podPose(drop.pose, flight), width, height); follow();
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
      paintVoyage(globe, jumped, flight, camera);
      if (flight) {
        ctx.restore();
        if (flight.dive > 0) paintDive(ctx, { width, height, progress: flight.dive, time: elapsed, size: podScreenSize(width, height), clouds });
      }
      paintFlash(ctx, width, height, jumped?.flash || 0);
      document.body.dataset.sceneReady = 'canvas';
      if (now - lastCheckpoint > 1000) { lastCheckpoint = now; checkpoint(); }
    } catch {
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
  document.addEventListener('frontier:drop-start', () => {
    if (paused || failed) return;
    jump = null; exchanging = false; delete document.body.dataset.entryJump;
    // Bake here, at the click, so the first dive frames cannot stutter.
    clouds ||= makeClouds(); surface(currentPlanet);
    drop = { start: elapsed, accepted: false, grain: ctx.createPattern(grain ||= makeGrain(), 'repeat') }; schedule();
  });
  document.addEventListener('frontier:drop-accept', () => {
    if (!drop) return;
    drop.start = elapsed - zoomHeld(); drop.accepted = true;
  });
  document.addEventListener('frontier:drop-cancel', () => {
    if (drop) { drop.held = zoomHeld(); drop.retreat = elapsed; }
  });
  document.addEventListener('frontier:drop-reset', endDrop);
  document.addEventListener('frontier:planet-select', event => {
    if (event.detail?.planet !== document.body.dataset.entryPlanet || ![-1, 1].includes(event.detail?.direction)) return;
    applyState(false, event.detail.direction);
  });
  new MutationObserver(() => { if (currentView !== document.body.dataset.entryView || currentPlanet !== (document.body.dataset.entryPlanet || 'caldera-v1')) applyState(); }).observe(document.body, { attributes: true, attributeFilter: ['data-entry-view', 'data-entry-planet'] });
  addEventListener('pagehide', () => { checkpoint(); dead = true; if (frame) cancelAnimationFrame(frame); frame = 0; });
  addEventListener('pageshow', event => { if (!event.persisted) return; dead = false; updateMotion(); });
  resize(); updateMotion();
}
try { startScene(); } catch {
  document.body.dataset.sceneReady = 'fallback';
  const control = document.getElementById('motion'); if (control) control.hidden = true;
}
