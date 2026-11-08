import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cityBlockPosition} from '../app/model';

test('connected curved city network reaches every stable street frontage and the civic approach without crossing buildings',async()=>{
 const module=await import('../app/city-network').catch(()=>({cityNetwork:undefined}));
 assert.equal(typeof module.cityNetwork,'function','city needs a deterministic connected network, not fifty isolated strips');
 const network=module.cityNetwork!(50),key=(p:{x:number;y:number})=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`;
 const adjacency=new Map<string,Set<string>>();
 for(const road of network.roads){
  assert.ok(road.points.length>=2);
  for(let i=1;i<road.points.length;i++){
   const a=key(road.points[i-1]),b=key(road.points[i]);
   if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a)!.add(b);adjacency.get(b)!.add(a);
  }
 }
 const seen=new Set<string>(),queue=[key(network.access[0].point)];
 while(queue.length){const node=queue.pop()!;if(seen.has(node))continue;seen.add(node);queue.push(...adjacency.get(node)??[]);}
 assert.equal(seen.size,adjacency.size,'all roads must belong to one actual endpoint-connected component');
 assert.equal(network.access.length,50);for(const access of network.access)assert.ok(seen.has(key(access.point)),`street ${access.index} reaches the shared network`);
 assert.ok(seen.has(key(network.civic)), 'civic plaza has a connected approach');
 assert.ok(network.roads.some(r=>r.points.some((p,i)=>i>1&&Math.abs((p.x-r.points[i-1].x)*(r.points[i-1].y-r.points[i-2].y)-(p.y-r.points[i-1].y)*(r.points[i-1].x-r.points[i-2].x))>.1)),'curves must have non-collinear samples');
 // Occupied thumbnail footprints (not their clickable frontage, which includes the street).
 for(const road of network.roads)for(const p of road.points)for(let index=0;index<50;index++){
  const lot=cityBlockPosition(index),radius=road.width/2;
  const boxes=[{x:lot.x+6,y:lot.y+10,w:82,d:66},{x:lot.x+65,y:lot.y+46,w:28,d:28},{x:lot.x+88,y:lot.y+12,w:8,d:8}];
  for(const b of boxes)assert.ok(!(p.x+radius>b.x&&p.x-radius<b.x+b.w&&p.y+radius>b.y&&p.y-radius<b.y+b.d),`road cannot cross street ${index} buildings at ${JSON.stringify(p)}`);
  assert.ok(!(p.x+radius>392&&p.x-radius<578&&p.y+radius>412&&p.y-radius<598),'no through-road across center artwork footprint');
 }
 const firstRow=network.roads.flatMap(r=>r.points).filter(p=>p.x>=0&&p.x<=952&&p.y>=78&&p.y<=136);
 assert.ok(Math.max(...firstRow.map(p=>p.y))-Math.min(...firstRow.map(p=>p.y))>=36,'boulevards need visible sweeping bends, not a near-straight texture swap');
 assert.deepEqual(module.cityNetwork!(50),network);
 const grown=module.cityNetwork!(51);
 for(const old of network.access)assert.deepEqual(grown.access[old.index],old,'adding a street cannot move an existing frontage');
 for(const p of network.access){const lot=cityBlockPosition(p.index);assert.ok(p.point.x>=lot.x&&p.point.x<=lot.x+109);assert.ok(p.point.y>=lot.y+78&&p.point.y<=lot.y+136);}
});
