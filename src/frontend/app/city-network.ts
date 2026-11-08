import {cityBlockPosition} from './model';
export interface CityPoint {x:number;y:number}
export interface CityRoad {points:CityPoint[];width:number;kind:'road'|'path'}
export interface CityNetwork {roads:CityRoad[];access:{index:number;point:CityPoint}[];civic:CityPoint;bounds:{x:number;y:number;w:number;d:number}}
const LEFT=-52,RIGHT=1004,WEST=347,EAST=588;
const wave=(x:number)=>19*Math.sin(6*Math.PI*(x-LEFT)/(RIGHT-LEFT));
const frontage=(x:number,row:number):CityPoint=>({x,y:106+row*126+wave(x)});

// Preserve the index-only thumbnail origins. Boulevards follow their frontages;
// broad rounded perimeter turns and two civic collectors join them into one town.
// No decorative river: there can be no accidental unbridged road/water crossing.
export function cityNetwork(count:number):CityNetwork {
 const rows=Math.max(7,...Array.from({length:count},(_,i)=>Math.floor(cityBlockPosition(i).y/126)+1));
 const roads:CityRoad[]=[],access=Array.from({length:count},(_,index)=>{const p=cityBlockPosition(index);return {index,point:frontage(p.x+48,p.y/126)};});
 const add=(points:CityPoint[],width=18,kind:'road'|'path'='road')=>roads.push({points,width,kind});
 for(let row=0;row<rows;row++){
  const xs=[...new Set([LEFT,WEST,EAST,RIGHT,...Array.from({length:8},(_,col)=>col*119+48)])].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++){
   const a=xs[i-1],b=xs[i];if((row===3||row===4)&&a>=WEST&&b<=EAST)continue;
   const samples=Math.ceil((b-a)/12);add(Array.from({length:samples+1},(_,j)=>frontage(a+(b-a)*j/samples,row)));
  }
 }
 for(let row=1;row<rows;row++)for(const x of [LEFT,RIGHT])add([frontage(x,row-1),frontage(x,row)],26);
 const arc=(cx:number,cy:number,start:number,end:number)=>Array.from({length:17},(_,i)=>{const a=start+(end-start)*i/16;return {x:cx+60*Math.cos(a),y:cy+60*Math.sin(a)};});
 add([frontage(LEFT,0),{x:LEFT,y:30},...arc(8,30,Math.PI,Math.PI*1.5),{x:944,y:-30},...arc(944,30,-Math.PI/2,0),frontage(RIGHT,0)],26);
 const bottom=100+(rows-1)*126;
 add([frontage(RIGHT,rows-1),{x:RIGHT,y:bottom+15},...arc(944,bottom+15,0,Math.PI/2),{x:8,y:bottom+75},...arc(8,bottom+15,Math.PI/2,Math.PI),frontage(LEFT,rows-1)],26);
 for(const x of [WEST,EAST]){for(let row=3;row<=4;row++)add([frontage(x,row-1),frontage(x,row)]);add([frontage(x,4),{x,y:620}]);}
 const south=(x:number):CityPoint=>({x,y:620+3*Math.sin(Math.PI*(x-WEST)/(EAST-WEST))});
 for(const [a,b] of [[WEST,485],[485,EAST]])add(Array.from({length:17},(_,i)=>south(a+(b-a)*i/16)));
 const civic={x:485,y:602};add([south(485),civic],5,'path');
 return {roads,access,civic,bounds:{x:-104,y:-82,w:1160,d:bottom+210}};
}
