// Stable template IDs belong to saved campaigns; presentation can evolve separately.
// Adding another template also requires a matching server world generator/migration.
export const PLANETS = Object.freeze([
  Object.freeze({ id: 'caldera-v1', name: 'Caldera', designation: 'CDR / 01',
    description: 'Four starting clearings, open ocean and densely defended continents. Establish your core, bring heavy firepower and fight together.' }),
  Object.freeze({ id:'vesper-v1',name:'Vesper',designation:'VSP / 02',description:'Four starting clearings amid dense alien strongholds, slate mountains and inland lakes. Bridge the rivers and find the passes. High ridges block aircraft; rivers and lakes exclude ships.' }),
  Object.freeze({ id:'sirocco-v1',name:'Sirocco',designation:'SRC / 03',description:'Four desert footholds between copper sand seas, stone mesas and turquoise oases. Ships skim loose sand; robots and vehicles use firm ground. Build sandports and assault the alien strongholds.' }),
]);
