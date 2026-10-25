export const AQUATIC=Object.freeze({hp:1500,guards:0,wake:28,healDelay:8000,healRate:30,spawnEvery:6000,max:6,
 ventRadius:6,ventWarning:2000,ventDuration:6000,ventCooldown:16000,poisonDps:8,maxFields:4,
 spitterHp:100,speed:1.2,range:10,windup:1100,flight:1400,reload:4000,blastRadius:1.4,damage:24,puddleRadius:1.6,puddleDuration:3500,maxShots:8});
export const isSpitter=e=>e.kind==='swimmer'&&e.variant==='bile-spitter';
