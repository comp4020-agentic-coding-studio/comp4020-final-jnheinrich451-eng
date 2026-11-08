// Shared crop facts for hand tending, industry and presentation. No state writes.
export const CROPS = Object.freeze([
  Object.freeze({ id: 'sundrop', name: 'Sundrop', growTime: 45, yield: 2, regrows: false,
    color: '#efac4e', description: 'Golden little bulbs. A quick first harvest for your orbital sample box.' }),
  Object.freeze({ id: 'moonberry', name: 'Moonberry', growTime: 90, yield: 3, regrows: true,
    color: '#ac8bc4', description: 'A soft purple shrub that grows another harvest after picking.' }),
  Object.freeze({ id: 'cloudmelon', name: 'Cloudmelon', growTime: 150, yield: 5, regrows: false,
    color: '#a5c781', description: 'A plump striped melon. Slow and sweet, with a generous harvest.' }),
]);
export const cropById = id => CROPS.find(crop => crop.id === id) || null;
export const bedReady = bed => !!bed && !!cropById(bed.crop) && bed.growth >= cropById(bed.crop).growTime - 1e-8;
