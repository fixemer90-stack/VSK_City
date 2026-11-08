import type {LandmarkKind} from './city-landmarks';

export const CITY_HEART={x:485,y:505};
/** Visual overview addresses only. Personal-street lots and saved IDs never use this layout. */
export function moscowAddress(index:number):{ring:number;radius:number;angle:number} {
 let ring=0,slot=index;
 while(slot>=8+ring*12){slot-=8+ring*12;ring++;}
 const perQuadrant=2+ring*3;
 return {ring,radius:180+ring*180,angle:(slot%4)*Math.PI/2+(Math.floor(slot/4)+.5)*Math.PI/(2*perQuadrant)};
}
export function cityBlockPosition(index:number,kind:LandmarkKind='generic'):{x:number;y:number} {
 if(kind==='moscow'){
  const {radius,angle}=moscowAddress(index);
  return {x:CITY_HEART.x+(radius+95)*Math.cos(angle)-54.5,y:CITY_HEART.y+(radius+95)*Math.sin(angle)-52.5};
 }
 if(kind==='vladivostok'){
  const col=index%6,row=Math.floor(index/6);
  return {x:col<3?col*119:623+(col-3)*119,y:row*126};
 }
 let slot=index;for(const reserved of [27,28,35,36])if(slot>=reserved)slot++;
 return {x:(slot%8)*119,y:Math.floor(slot/8)*126};
}
