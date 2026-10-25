import {createWorld} from './world.js';
import {expandWorld} from './expansion.js';
import {expandPlanet} from './planet-world.js';
import {createVesper} from './vesper-world.js';
export function createPlanet(template='caldera-v1'){
 if(template==='vesper-v1')return createVesper();
 if(template!=='caldera-v1')throw Error('Unknown planet template: '+template);
 return expandPlanet(expandWorld(createWorld()));
}
