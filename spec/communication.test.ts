import {expect,it} from 'vitest';
import {createCommunication} from '../communication.js';
import {emoteAnchor,emotePoint} from '../public/emotes.js';

it('bounds room history, ignores blank submissions, validates text and deduplicates retries before rate limiting',()=>{
 let now=1000;const room=createCommunication('room-a',()=>now),player={id:'p',name:'Pilot'},anchor={kind:'player',id:'p'};
 const send=(id:string,text='hello')=>room.accept(player,{kind:'chat',requestId:id,text},anchor);
 expect(send('empty-000',' \n ').event).toBeNull();expect(room.snapshot().messages).toHaveLength(0);
 const first=send('message-1','<b>crew</b>');expect(first.event?.text).toBe('<b>crew</b>');
 expect(send('message-1')).toMatchObject({duplicate:true,event:first.event});
 send('message-2');send('message-3');expect(()=>send('message-4')).toThrow('Please wait');
 expect(()=>send('long-000', 'x'.repeat(281))).toThrow('280');
 for(let i=4;i<50;i++){now+=5000;send('message-'+i);}
 expect(room.snapshot().messages).toHaveLength(40);expect(room.snapshot().messages[0].sequence).toBe(10);
 expect(createCommunication('room-b').snapshot().messages).toHaveLength(0);
});

it('expires and replaces emotes without trusting unknown IDs or client anchors',()=>{
 let now=1000;const room=createCommunication('epoch',()=>now),player={id:'p',name:'Pilot'},anchor={kind:'ship',id:'real-ship'};
 const data={kind:'emote',requestId:'emote-001',emote:'help',anchor:{kind:'ship',id:'fake'}};
 const first=room.accept(player,data,anchor);expect(first.event?.anchor).toEqual(anchor);
 expect(()=>room.accept(player,{...data,requestId:'emote-002'},anchor)).toThrow('Please wait');
 now+=1000;room.accept(player,{...data,requestId:'emote-003',emote:'thanks'},anchor);
 expect(room.snapshot().emotes).toHaveLength(1);expect(room.snapshot().emotes[0].emote).toBe('thanks');
 expect(()=>room.accept(player,{...data,emote:'<svg>'},anchor)).toThrow('wheel');
 now+=3001;expect(room.snapshot().emotes).toHaveLength(0);
 expect(room.accept(player,data,anchor).duplicate).toBe(true);expect(room.snapshot().emotes).toHaveLength(0);
});

it('anchors bubbles to real vehicle seats and cannon leases rather than selected autonomous assets',()=>{
 const player={id:'p'},world:any={ships:[],tanks:[],airbases:[],artillery:[],logistics:{recyclers:[]}};
 expect(emoteAnchor(world,player)).toEqual({kind:'player',id:'p'});
 for(const [kind,list] of [['ship',world.ships],['tank',world.tanks],['recycler',world.logistics.recyclers]] as const){
  list.push({id:'unit',occupant:'p',x:10,y:20});const anchor=emoteAnchor(world,player);expect(anchor).toEqual({kind,id:'unit'});expect(emotePoint(world,[],anchor)).toMatchObject({x:10,y:20});list.pop();
 }
 world.airbases.push({aircraft:{id:'plane',occupant:'p',state:'flying',x:30,y:40}});
 expect(emoteAnchor(world,player)).toEqual({kind:'aircraft',id:'plane'});world.airbases=[];
 world.artillery.push({id:'gun',operator:'p',lease:2,x:20,y:30});
 expect(emoteAnchor(world,player)).toEqual({kind:'artillery',id:'gun'});
 expect(emotePoint(world,[],{kind:'artillery',id:'gun'})).toMatchObject({x:20.5,y:30.5});
 world.artillery[0].lease=0;expect(emoteAnchor(world,player).kind).toBe('player');
});
