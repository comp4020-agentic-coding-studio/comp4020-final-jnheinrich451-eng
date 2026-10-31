import {createWorld} from './world.js';
import {expandWorld} from './expansion.js';
import {expandPlanet} from './planet-world.js';
import {createVesper} from './vesper-world.js';
import {createSirocco} from './sirocco-world.js';
export function createPlanet(template='caldera-v1'){
 if(template==='sirocco-v1')return createSirocco();
 if(template==='vesper-v1')return createVesper();
 if(template!=='caldera-v1')throw Error('Unknown planet template: '+template);
 return expandPlanet(expandWorld(createWorld()));
}
