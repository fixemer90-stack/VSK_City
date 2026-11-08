import {Graphics} from 'pixi.js';
import {StreetProp} from './streetscape';

// Small ground-anchored silhouettes, muted wood / slate / warm cream, no text or glow.
export function streetFurniture(prop:StreetProp):Graphics {
 const g=new Graphics();g.label=`decor-${prop.kind}`;g.position.set(prop.x-prop.y,(prop.x+prop.y)*.48);g.eventMode='none';
 const tile=(x:number,y:number,w:number,d:number,z:number,color:number)=>g.poly([x-y,(x+y)*.48-z,x+w-y,(x+w+y)*.48-z,x+w-y-d,(x+w+y+d)*.48-z,x-y-d,(x+y+d)*.48-z]).fill(color);
 g.ellipse(3,2,prop.kind==='lamp'?8:18,3).fill({color:0x4e6046,alpha:.16});
 if(prop.kind==='lamp'){
  tile(-3,-3,6,6,0,0x667570);
  g.moveTo(0,0).lineTo(0,-42).lineTo(9,-46).stroke({color:0x4e6263,width:2.8,cap:'round',join:'round'});
  g.poly([4,-47,11,-50,18,-46,11,-42]).fill(0x53686a);
  g.poly([7,-45,11,-43,15,-45,15,-41,11,-39,7,-41]).fill(0xf2e5b7);
  g.moveTo(7,-40).lineTo(15,-44).stroke({color:0x879187,width:1});
 }else if(prop.kind==='bench'){
  for(const x of [-10,9]){g.moveTo(x-4,(x-4)*.48-7).lineTo(x-4,(x-4)*.48).moveTo(x+3,(x+3)*.48-7).lineTo(x+3,(x+3)*.48).stroke({color:0x4d6260,width:2});}
  for(const y of [-5,-1,3])tile(-15,y,30,3,8,0xa68b62);
  for(const z of [14,19])tile(-15,-6,30,2,z,0xb39a72);
  g.moveTo(-9,-22).lineTo(-9,-9).moveTo(15,-10).lineTo(15,3).stroke({color:0x556965,width:1.5});
 }else if(prop.kind==='bin'){
  g.poly([-5,-13,5,-13,4,0,-4,0]).fill(0x5d7770);
  g.ellipse(0,-13,6,3).fill(0x71877b);g.ellipse(0,-13,3.5,1.5).fill(0x394f4d);
  g.moveTo(-2,-9).lineTo(-2,-2).moveTo(2,-9).lineTo(2,-2).stroke({color:0x94a28a,width:.7});
 }else if(prop.kind==='flowerbed'){
  tile(-17,-7,34,14,1,0x8d9878);tile(-15,-5,30,10,3,0xd5cbb0);tile(-13,-3,26,6,3,0x64794f);
  for(let i=0;i<7;i++){const x=-11+i*3.7,y=(i%2?1:-1);g.circle(x-y,(x+y)*.48-5,2.5).fill(i%3===0?0xc79983:i%3===1?0xddd2a5:0x839367);}
 }
 return g;
}
