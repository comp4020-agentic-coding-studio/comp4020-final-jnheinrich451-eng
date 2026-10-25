import {expect,it} from 'vitest';
import {yardRetireError} from '../public/shipyard.js';

const yard={id:'dock',owner:'pilot',dock:{x:20.5,y:20.5,angle:0},dockStyle:'unfolding',elapsed:4.5,berthX:23.5,berthY:17.5};
const world=()=>({ships:[],tanks:[],logistics:{jobs:{},recyclers:[]}} as any);
it('identifies the robot on an empty pier and allows removal from its shore platform',()=>{
 const w=world(),robot={id:'pilot',body:'robot',life:'active',x:20.5,y:17.5};
 expect(yardRetireError(w,yard,[robot])).toContain('Your robot is on the offshore dock at 20:17');
 expect(yardRetireError(w,yard,[{...robot,y:20.5}])).toBeNull();
});
it.each(['tank','recycler','builder'])('identifies a blocking %s and ignores its destroyed wreck',kind=>{
 const w=world(),v={id:'vehicle',kind,x:20.5,y:17.5,destroyed:false};
 (kind==='tank'?w.tanks:w.logistics.recyclers).push(v);
 expect(yardRetireError(w,yard)).toContain(kind==='builder'?'bridge builder':kind);
 v.destroyed=true;expect(yardRetireError(w,yard)).toBeNull();
});
it('retains vessel and construction restrictions independently of pier occupants',()=>{
 const w=world();w.ships.push({id:'sub',yardId:'dock'});expect(yardRetireError(w,yard)).toContain('Retire its vessel');
 w.ships=[];w.logistics.jobs.dock={remaining:1};expect(yardRetireError(w,yard)).toContain('finish construction');
});
