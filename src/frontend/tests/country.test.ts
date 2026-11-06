import {test} from 'node:test';
import assert from 'node:assert/strict';

test('Russia and Vladivostok use the same geographic projection: the marker belongs to land',async()=>{
 const geo=await import('../app/country-geometry.ts').catch(()=>undefined);
 assert.ok(geo,'A shared real coastline/city projection must replace the unrelated hand-drawn outline');
 const p=geo.cityPoint('Владивосток');
 assert.ok(p);
 const inside=(ring:readonly number[])=>{
  let yes=false;
  for(let i=0,j=ring.length-2;i<ring.length;j=i,i+=2){
   const x=ring[i],y=ring[i+1],px=ring[j],py=ring[j+1];
   if((y>p.y)!==(py>p.y)&&p.x<(px-x)*(p.y-y)/(py-y)+x)yes=!yes;
  }
  return yes;
 };
 assert.ok(geo.COUNTRY_RINGS.some(inside),'Vladivostok must lie on the Primorye land polygon, not beyond its edge');
});

test('North is up: Petersburg is north of Moscow and Vladivostok lies in the southeast',async()=>{
 const {cityPoint,COUNTRY_BOUNDS}=await import('../app/country-geometry.ts');
 const m=cityPoint('Москва')!,p=cityPoint('Санкт-Петербург')!,v=cityPoint('Владивосток')!;
 assert.ok(p.y<m.y,'northern cities must not be drawn south of Moscow');
 assert.ok(v.x>m.x+COUNTRY_BOUNDS.width*.5);
 assert.ok(v.y>COUNTRY_BOUNDS.height*.8,'Primorye belongs at the bottom, not top of the map');
});
