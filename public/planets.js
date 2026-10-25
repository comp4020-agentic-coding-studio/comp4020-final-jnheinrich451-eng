// Stable template IDs belong to saved campaigns; presentation can evolve separately.
// Adding another template also requires a matching server world generator/migration.
export const PLANETS = Object.freeze([
  Object.freeze({ id: 'caldera-v1', name: 'Caldera', designation: 'CDR / 01',
    description: 'Island footholds, open ocean and a continental battlefield. Establish your core, deploy your forces and fight together.' }),
  Object.freeze({ id:'vesper-v1',name:'Vesper',designation:'VSP / 02',description:'Slate mountain chains, green lowlands and inland lakes. Find the passes, bridge the rivers and sail the open ocean. High ridges block aircraft; rivers and lakes exclude ships.' }),
]);
