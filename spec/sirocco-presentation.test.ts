import { afterEach, expect, it, vi } from 'vitest';
import { createSirocco } from '../public/sirocco-world.js';
import { PLANETS } from '../public/planets.js';
import { SIROCCO_MASK } from '../public/sirocco-preview.js';
import { terrainColor } from '../public/terrain-rules.js';
import { siroccoPalms, drawSiroccoPalms } from '../public/sirocco-art.js';
import { loadEntryScene, saveEntryScene } from '../public/entry-continuity.js';

afterEach(()=>vi.unstubAllGlobals());

it('registers Sirocco and bakes its actual desert, mesa and oasis geography for entry',()=>{
 const w=createSirocco(), runs=Buffer.from(SIROCCO_MASK,'base64'), decoded:number[]=[];
 expect(PLANETS.find(p=>p.id===w.template)?.name).toBe(w.name);
 for(let i=0;i<runs.length;i+=2)for(let n=0;n<runs[i];n++)decoded.push(runs[i+1]);
 expect(decoded).toHaveLength(256*192);
 const actual:number[]=[];
 for(let y=0;y<192;y++)for(let x=0;x<256;x++){
  const i=y*2*w.width+x*2;
  actual.push(w.mountains[i]?4+w.mountains[i]:w.waterKinds[i]>1?8:w.terrain[i]);
 }
 expect(decoded).toEqual(actual);
 const sand=terrainColor(w,256,192),lake=terrainColor(w,112,65),ground=terrainColor(w,112,128);
 expect(new Set([sand,lake,ground]).size).toBe(3);
 expect(sand).toBe('#b9763e');expect(lake).toBe('#3b9d9a');
});

it('keeps decorative palm canopies on firm oasis banks and hides them under construction',()=>{
 const w=createSirocco(),before=JSON.stringify(w),palms=siroccoPalms(w);
 expect(palms.length).toBeGreaterThan(12);expect(palms.length).toBeLessThan(300);
 for(const p of palms){const i=Math.floor(p.y)*w.width+Math.floor(p.x);expect(w.terrain[i]).toBe(2);expect(w.waterKinds[i]).toBe(0);}
 const p=palms[0], bounds={x0:p.x-.1,y0:p.y-.1,x1:p.x+.1,y1:p.y+.1};
 const alphas:number[]=[], ctx:any=new Proxy({}, {set:(o,k,v)=>{if(k==='globalAlpha')alphas.push(v);Reflect.set(o,k,v);return true;},get:(o,k)=>Reflect.get(o,k)??(()=>{})});
 drawSiroccoPalms(ctx,w,48,bounds,[p]);expect(alphas).toContain(.27);
 alphas.length=0;
 drawSiroccoPalms(ctx,w,48,bounds,[],new Set(palms.map((p:{x:number,y:number})=>Math.floor(p.y)*w.width+Math.floor(p.x))));expect(alphas).toHaveLength(0);
 expect(JSON.stringify(w)).toBe(before);
});

it('persists the third planet camera and still accepts existing entry presentation snapshots',()=>{
 const values=new Map<string,string>();
 vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
 const state={elapsed:100,view:'new',planet:'sirocco-v1',camera:PLANETS.map((p,i)=>({id:p.id,x:.3+i*.2,y:.5,r:.2,alpha:1})),pointer:{x:0,y:0},orbitSide:-1};
 expect(saveEntryScene(state)).toBe(true);expect(loadEntryScene()).toMatchObject(state);
 const legacy={...state,planet:'caldera-v1',camera:[state.camera[0],state.camera[1],{...state.camera[2],id:'moon'}]};
 expect(saveEntryScene(legacy)).toBe(true);expect(loadEntryScene()).toMatchObject(legacy);
});
