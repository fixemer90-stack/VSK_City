import {cityBlockPosition,moscowAddress,CITY_HEART} from './city-layout';
import type {LandmarkKind} from './city-landmarks';
export interface CityPoint {x:number;y:number}
export interface CityRoad {points:CityPoint[];width:number;kind:'road'|'path';role?:'ring'|'radial'|'bridge';landmark?:boolean}
export interface CityNetwork {roads:CityRoad[];access:{index:number;point:CityPoint}[];civic:CityPoint;bounds:{x:number;y:number;w:number;d:number};river?:{points:CityPoint[];width:number}}
const LEFT=-52,RIGHT=1004,WEST=347,EAST=588;
const wave=(x:number)=>19*Math.sin(6*Math.PI*(x-LEFT)/(RIGHT-LEFT));
const frontage=(x:number,row:number):CityPoint=>({x,y:106+row*126+wave(x)});

// Generic towns retain their previous index-only grid and rounded boulevards.
// Identity layouts are also index-only, but reserve the ring annuli or dry banks
// before assigning thumbnails. Occupancy and private street names play no role.
export function cityNetwork(count:number,kind:LandmarkKind='generic'):CityNetwork {
 if(kind==='moscow')return moscowNetwork(count);
 if(kind==='vladivostok')return vladivostokNetwork(count);
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

function vladivostokNetwork(count:number):CityNetwork {
 const rows=Math.max(9,Math.ceil(count/6)),bottom=(rows-1)*126+210,roads:CityRoad[]=[],civic={x:485,y:520};
 const access=Array.from({length:count},(_,index)=>{const p=cityBlockPosition(index,'vladivostok');return {index,point:frontage(p.x+48,Math.floor(index/6))};});
 const add=(points:CityPoint[],width=18,role?:CityRoad['role'],landmark=false)=>roads.push({points,width,kind:'road',role,landmark});
 for(let row=0;row<rows;row++)for(const xs of [[LEFT,48,167,286,373],[597,671,790,909,RIGHT]]){
  for(let i=1;i<xs.length;i++){
   const a=xs[i-1],b=xs[i],samples=Math.ceil((b-a)/10);
   add(Array.from({length:samples+1},(_,j)=>frontage(a+(b-a)*j/samples,row)));
  }
 }
 for(const x of [LEFT,373,597,RIGHT]){
  const ys=[...new Set([-30,bottom-50,232,520,862,...Array.from({length:rows},(_,row)=>frontage(x,row).y)])].sort((a,b)=>a-b);
  for(let i=1;i<ys.length;i++)add([{x,y:ys[i-1]},{x,y:ys[i]}],26);
 }
 for(const y of [232,862])add([{x:373,y},{x:597,y}],26,'bridge');
 add([{x:373,y:520},{x:392,y:520}]);add([{x:392,y:520},civic,{x:578,y:520}],26,'bridge',true);add([{x:578,y:520},{x:597,y:520}]);
 // The active SVG water openings are x=450.9..519.1, y=412 and 598.
 // Keep the civic reach straight and let the river gently meander outside it.
 const ys=[...new Set([-82,412,598,bottom,...Array.from({length:Math.ceil((bottom+82)/8)},(_,i)=>-82+i*8)])].sort((a,b)=>a-b);
 const river={width:68.2,points:ys.map(y=>({x:y<412?485+28*Math.sin((412-y)/190)**2:y>598?485-32*Math.sin((y-598)/230)**2:485,y}))};
 return {roads,access,civic,river,bounds:{x:-104,y:-82,w:1160,d:bottom+82}};
}

function moscowNetwork(count:number):CityNetwork {
 const ringCount=Math.max(3,moscowAddress(Math.max(0,count-1)).ring+1),roads:CityRoad[]=[];
 const point=(radius:number,angle:number):CityPoint=>({x:CITY_HEART.x+radius*Math.cos(angle),y:CITY_HEART.y+radius*Math.sin(angle)});
 const access=Array.from({length:count},(_,index)=>{const {radius,angle}=moscowAddress(index);return {index,point:point(radius,angle)};});
 for(let ring=0;ring<ringCount;ring++){
  const radius=180+ring*180,capacity=8+ring*12,offset=Array.from({length:ring},(_,r)=>8+r*12).reduce((a,b)=>a+b,0);
  const angles=[...new Set([...Array.from({length:192},(_,i)=>i*Math.PI/96),...Array.from({length:capacity},(_,i)=>moscowAddress(offset+i).angle)])].sort((a,b)=>a-b);
  const points=angles.map(angle=>point(radius,angle));points.push({...points[0]});
  roads.push({points,width:26,kind:'road',role:'ring'});
  if(ring)for(let arm=0;arm<4;arm++)roads.push({points:[point(radius-180,arm*Math.PI/2),point(radius,arm*Math.PI/2)],width:18,kind:'road',role:'radial'});
 }
 const civic={x:485,y:602};roads.push({points:[point(180,Math.PI/2),civic],width:5,kind:'path'});
 const reach=180+(ringCount-1)*180+180;
 return {roads,access,civic,bounds:{x:485-reach,y:505-reach,w:reach*2,d:reach*2}};
}
